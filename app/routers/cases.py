import os
import re
from datetime import datetime as _dt, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.database import get_db
from app.deps import get_current_user
from app.models.inquiry_case import InquiryCase, CaseStatusHistory
from app.models.document import InquiryDocument
from app.models.extract import ExtractedLineItem
from app.models.match import ProductRecommendation
from app.models.quotation import QuotationDraft, QuotationLine
from app.models.outbound import OutboundMessage
from app.models.email import EmailMessage
from app.models.pricing import PricingSnapshot, PricingLine
from app.ai_client import AiMatchError, identify_product
from app.inquiry_gate import block_message, status_for_case
from app.enquiry_documents import (
    list_related_enquiry_documents,
    load_ai_enquiry_files,
)
from app.quotation_builder import (
    build_quotation_docx,
    draft_email_text,
    QUOTATIONS_DIR,
    resolve_quotation_file,
    quotation_docx_filename,
)
from app.schemas import (
    CaseOut, CaseDetailOut, LineItemOut, QuotationOut, QuotationDetailOut,
    QuotationLineOut, OutboundMessageOut, EditRecommendationRequest, CaseSummaryOut,
    EnquiryEmailOut, StatusHistoryEntry, EmailUpdateRequest, RevisionSummary, QtnGroupOut,
    QuotationLineUpdateRequest, QuotationLineCreateRequest, DocumentOut, PricingUpdateRequest,
    PricingSnapshotOut, PricingLineOut, CommunicationEntry, BulkAiMatchRequest,
    BulkAiMatchResponse, BulkAiMatchResultItem,
)

router = APIRouter(prefix="/api", tags=["cases"], dependencies=[Depends(get_current_user)])


# ---------- helpers ----------

def _top_recommendation(line_item):
    if not line_item.recommendations:
        return None
    approved = [r for r in line_item.recommendations if r.is_selected_by_engineer is True]
    if approved:
        return approved[0]
    return sorted(line_item.recommendations, key=lambda r: r.rank_no)[0]


def _line_item_to_out(item) -> LineItemOut:
    return LineItemOut.model_validate(item)


def _drop_blocked_match(db: Session, case: InquiryCase) -> str | None:
    """Deleted enquiries keep no product cards and are not sent to the model."""
    status = status_for_case(case.qtnno, case.internal_ref)
    message = block_message(status)
    if not message:
        return None
    changed = False
    for rec in db.query(ProductRecommendation).filter_by(case_id=case.case_id).all():
        db.delete(rec)
        changed = True
    for item in db.query(ExtractedLineItem).filter_by(case_id=case.case_id).all():
        quoted = db.query(QuotationLine).filter_by(line_item_id=item.line_item_id).first()
        if quoted is not None:
            continue
        db.delete(item)
        changed = True
    if status == "deleted" and case.exception_type != "DELETED":
        case.exception_type = "DELETED"
        changed = True
    if changed:
        db.commit()
    return message


def _case_to_out(c, revision_count: int = 1) -> CaseOut:
    history = sorted(c.status_history, key=lambda h: h.changed_at) if c.status_history else []
    return CaseOut(
        case_id=c.case_id, internal_ref=c.internal_ref, status=c.status,
        project_name=c.project_name, enq_no_customer=c.enq_no_customer,
        enq_received_at=c.enq_received_at, match_confidence=c.match_confidence,
        customer_name=c.customer.display_name if c.customer else None,
        status_history=[
            StatusHistoryEntry(from_status=h.from_status, to_status=h.to_status, changed_at=h.changed_at)
            for h in history
        ],
        revision_no=c.revision_no or 0,
        revision_count=revision_count,
    )


def _maybe_create_quotation_draft(db: Session, case_id: int):
    """Creates (or updates) the QuotationDraft + QuotationLine rows as
    soon as AT LEAST ONE line item is approved — no longer waits for
    every line item to be approved. Each time a new item gets approved,
    its line is added to the existing draft if one already exists.
    Does NOT generate the .docx yet, and does NOT flip the case status
    to QUOTED — that only happens once the document is actually
    generated (see generate_quotation_document)."""
    line_items = db.query(ExtractedLineItem).filter_by(case_id=case_id).all()
    if not line_items:
        return None

    approved_items = [
        item for item in line_items
        if _top_recommendation(item) and _top_recommendation(item).is_selected_by_engineer is True
    ]
    if not approved_items:
        return None

    existing = (
        db.query(QuotationDraft)
        .filter_by(case_id=case_id)
        .order_by(QuotationDraft.revision_no.desc())
        .first()
    )

    if existing is not None:
        existing_line_item_ids = {
            ql.line_item_id
            for ql in db.query(QuotationLine).filter_by(draft_id=existing.draft_id).all()
        }
        next_line_no = (
            db.query(func.max(QuotationLine.line_no)).filter_by(draft_id=existing.draft_id).scalar() or 0
        )
        added = False
        for item in approved_items:
            if item.line_item_id in existing_line_item_ids:
                continue
            rec = _top_recommendation(item)
            spec_bits = [b for b in [item.moc, item.range_text, item.op_temp, item.op_pressure] if b]
            next_line_no += 1
            db.add(QuotationLine(
                draft_id=existing.draft_id, line_item_id=item.line_item_id, line_no=next_line_no,
                model_code=rec.model_code if rec else None,
                description=item.description or item.equipment_name,
                qty=str(item.qty) if item.qty is not None else None,
                uom=item.uom,
                technical_spec_text=", ".join(spec_bits) if spec_bits else None,
            ))
            added = True
        if added:
            db.commit()
        return existing

    draft = QuotationDraft(
        case_id=case_id, revision_no=0, template_id="STANDARD",
        status="DRAFT", pricing_blank=True, created_by="system-auto",
    )
    db.add(draft)
    db.flush()

    for item in approved_items:
        rec = _top_recommendation(item)
        spec_bits = [b for b in [item.moc, item.range_text, item.op_temp, item.op_pressure] if b]
        db.add(QuotationLine(
            draft_id=draft.draft_id, line_item_id=item.line_item_id, line_no=item.line_no,
            model_code=rec.model_code if rec else None,
            description=item.description or item.equipment_name,
            qty=str(item.qty) if item.qty is not None else None,
            uom=item.uom,
            technical_spec_text=", ".join(spec_bits) if spec_bits else None,
        ))

    db.commit()
    return draft


# ---------- routes ----------

@router.get("/review-queue", response_model=list[LineItemOut])
def review_queue(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    items = (
        db.query(ExtractedLineItem)
        .join(ExtractedLineItem.recommendations)
        .join(InquiryCase, ExtractedLineItem.case_id == InquiryCase.case_id)
        .options(joinedload(ExtractedLineItem.recommendations))
        .filter(
            ~ExtractedLineItem.recommendations.any(
                ProductRecommendation.is_selected_by_engineer == True
            )
        )
    )
    if current_user.role != "ADMIN" and current_user.category:
        my_categories = [c.strip() for c in current_user.category.split(",")]
        items = items.filter(InquiryCase.category.in_(my_categories))
    items = items.order_by(ExtractedLineItem.created_at.desc()).all()

    seen, unique = set(), []
    for item in items:
        if item.line_item_id not in seen:
            seen.add(item.line_item_id)
            unique.append(item)
    return [_line_item_to_out(i) for i in unique]


@router.get("/cases", response_model=list[CaseOut])
def list_cases(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    date_from: str | None = None,
    date_to: str | None = None,
):
    query = db.query(InquiryCase)
    if current_user.role != "ADMIN" and current_user.category:
        my_categories = [c.strip() for c in current_user.category.split(",")]
        query = query.filter(InquiryCase.category.in_(my_categories))
    if date_from:
        query = query.filter(InquiryCase.enq_received_at >= _dt.fromisoformat(date_from))
    if date_to:
        query = query.filter(InquiryCase.enq_received_at <= _dt.fromisoformat(date_to + "T23:59:59"))
    cases = query.order_by(InquiryCase.created_at.desc()).all()

    # Collapse quotation revisions (same qtnno + fyear) into a single
    # row — only the latest revision is shown, with a revision_count
    # so the frontend can display "R1 · 2 versions". Cases without a
    # qtnno/fyear (demo/email-based cases) are shown individually.
    revision_groups: dict[tuple, list] = {}
    standalone = []
    for c in cases:
        if c.qtnno and c.fyear:
            key = (c.qtnno, c.fyear)
            revision_groups.setdefault(key, []).append(c)
        else:
            standalone.append(c)

    grouped: list[tuple] = []
    for members in revision_groups.values():
        members.sort(key=lambda m: m.revision_no or 0)
        latest = members[-1]
        grouped.append((latest, len(members)))
    for c in standalone:
        grouped.append((c, 1))

    STATUS_PRIORITY = {"IN_REVIEW": 0, "RECEIVED": 1, "QUOTED": 2}
    grouped.sort(key=lambda pair: STATUS_PRIORITY.get(pair[0].status, 1))

    return [_case_to_out(c, revision_count=rc) for c, rc in grouped]


@router.get("/cases/{case_id}", response_model=CaseDetailOut)
def case_detail(case_id: int, db: Session = Depends(get_db)):
    case = db.get(InquiryCase, case_id)
    if case is None:
        raise HTTPException(404, "Case not found")
    _merge_fps_ecs_line_items(db, case_id)
    _split_distinct_product_line_items(db, case_id)
    line_items = (
        db.query(ExtractedLineItem).filter_by(case_id=case_id).order_by(ExtractedLineItem.line_no).all()
    )
    quotation = (
        db.query(QuotationDraft).filter_by(case_id=case_id)
        .order_by(QuotationDraft.revision_no.desc()).first()
    )
    out = CaseDetailOut.model_validate(case)
    out.customer_name = case.customer.display_name if case.customer else None
    out.line_items = [_line_item_to_out(i) for i in line_items]
    out.quotation = QuotationOut.model_validate(quotation) if quotation else None
    return out


@router.post("/recommendations/{recommendation_id}/approve", response_model=dict)
def approve_recommendation(recommendation_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    rec = db.get(ProductRecommendation, recommendation_id)
    if rec is None:
        raise HTTPException(404, "Recommendation not found")
    siblings = db.query(ProductRecommendation).filter_by(line_item_id=rec.line_item_id).all()
    for sib in siblings:
        sib.is_selected_by_engineer = sib.recommendation_id == rec.recommendation_id
        if sib.recommendation_id == rec.recommendation_id:
            sib.decided_by = current_user.display_name

    case = db.get(InquiryCase, rec.case_id)
    if case and case.status == "RECEIVED":
        case.status = "IN_REVIEW"
        db.add(CaseStatusHistory(
            case_id=case.case_id, from_status="RECEIVED", to_status="IN_REVIEW",
            changed_by="engineer",
        ))

    db.commit()

    quotation = _maybe_create_quotation_draft(db, rec.case_id)
    return {
        "status": "approved",
        "model_code": rec.model_code or rec.family_code,
        "quotation_generated": quotation is not None,
    }


@router.post("/recommendations/{recommendation_id}/reject", response_model=dict)
def reject_recommendation(recommendation_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    rec = db.get(ProductRecommendation, recommendation_id)
    if rec is None:
        raise HTTPException(404, "Recommendation not found")
    rec.is_selected_by_engineer = False
    rec.decided_by = current_user.display_name

    case = db.get(InquiryCase, rec.case_id)
    if case and case.status == "RECEIVED":
        case.status = "IN_REVIEW"
        db.add(CaseStatusHistory(
            case_id=case.case_id, from_status="RECEIVED", to_status="IN_REVIEW",
            changed_by="engineer",
        ))

    db.commit()
    return {"status": "rejected", "model_code": rec.model_code or rec.family_code}


@router.post("/recommendations/{recommendation_id}/edit", response_model=dict)
def edit_recommendation(recommendation_id: int, payload: EditRecommendationRequest, db: Session = Depends(get_db)):
    rec = db.get(ProductRecommendation, recommendation_id)
    if rec is None:
        raise HTTPException(404, "Recommendation not found")
    if payload.model_code:
        rec.model_code = payload.model_code
    if payload.rationale:
        rec.rationale = payload.rationale
    rec.is_selected_by_engineer = None
    db.commit()
    return {"status": "updated"}


@router.post("/line-items/{line_item_id}/pick/{recommendation_id}", response_model=dict)
def pick_alternative(line_item_id: int, recommendation_id: int, db: Session = Depends(get_db)):
    rec = db.get(ProductRecommendation, recommendation_id)
    if rec is None or rec.line_item_id != line_item_id:
        raise HTTPException(404, "Recommendation not found")
    siblings = db.query(ProductRecommendation).filter_by(line_item_id=line_item_id).all()
    current_top = min(siblings, key=lambda r: r.rank_no)
    if current_top.recommendation_id != rec.recommendation_id:
        current_top.rank_no, rec.rank_no = rec.rank_no, current_top.rank_no
    for sib in siblings:
        sib.is_selected_by_engineer = None
    db.commit()
    return {"status": "picked"}


@router.get("/cases/{case_id}/quotation", response_model=QuotationDetailOut)
def quotation_detail(case_id: int, db: Session = Depends(get_db)):
    case = db.get(InquiryCase, case_id)
    if case is None:
        raise HTTPException(404, "Case not found")
    quotation = (
        db.query(QuotationDraft).filter_by(case_id=case_id)
        .order_by(QuotationDraft.revision_no.desc()).first()
    )
    if quotation is None:
        raise HTTPException(404, "No quotation generated yet for this case")
    lines = (
        db.query(QuotationLine).filter_by(draft_id=quotation.draft_id)
        .order_by(QuotationLine.line_no).all()
    )
    outbound = (
        db.query(OutboundMessage).filter_by(draft_id=quotation.draft_id)
        .order_by(OutboundMessage.created_at.desc()).first()
    )
    return QuotationDetailOut(
        case=CaseOut.model_validate(case),
        quotation=QuotationOut.model_validate(quotation),
        lines=[QuotationLineOut.model_validate(l) for l in lines],
        outbound=OutboundMessageOut.model_validate(outbound) if outbound else None,
    )


@router.post("/cases/{case_id}/quotation/generate", response_model=QuotationDetailOut)
def generate_quotation_document(case_id: int, db: Session = Depends(get_db)):
    """Builds the actual .docx (and the draft email, first time only)
    from the current QuotationLine rows. Called when the engineer is
    happy with the draft (after reviewing/editing it) and clicks
    'Generate'."""
    case = db.get(InquiryCase, case_id)
    if case is None:
        raise HTTPException(404, "Case not found")

    quotation = (
        db.query(QuotationDraft).filter_by(case_id=case_id)
        .order_by(QuotationDraft.revision_no.desc()).first()
    )
    if quotation is None:
        raise HTTPException(404, "No quotation draft exists for this case yet")

    lines = (
        db.query(QuotationLine).filter_by(draft_id=quotation.draft_id)
        .order_by(QuotationLine.line_no).all()
    )
    if not lines:
        raise HTTPException(400, "Quotation has no line items to generate")

    pricing = (
        db.query(PricingSnapshot)
        .options(joinedload(PricingSnapshot.lines))
        .filter_by(case_id=case_id)
        .order_by(PricingSnapshot.entered_at.desc())
        .first()
    )

    docx_rel_path = build_quotation_docx(
        case, lines, quotation.revision_no, pricing=pricing
    )
    quotation.docx_blob_uri = docx_rel_path
    quotation.status = "GENERATED"

    if case.status != "QUOTED":
        old_status = case.status
        case.status = "QUOTED"
        db.add(CaseStatusHistory(
            case_id=case.case_id, from_status=old_status, to_status="QUOTED",
            changed_by="system-auto",
        ))

    outbound = db.query(OutboundMessage).filter_by(draft_id=quotation.draft_id).first()
    if outbound is None:
        subject, body = draft_email_text(case, lines)
        outbound = OutboundMessage(
            case_id=case_id, draft_id=quotation.draft_id, channel="EMAIL",
            to_emails=[case.customer.email] if case.customer and case.customer.email else None,
            subject=subject, body_text=body, send_status="PENDING", created_by="system-auto",
        )
        db.add(outbound)

    db.commit()
    db.refresh(quotation)

    return QuotationDetailOut(
        case=_case_to_out(case),
        quotation=QuotationOut.model_validate(quotation),
        lines=[QuotationLineOut.model_validate(l) for l in lines],
        outbound=OutboundMessageOut.model_validate(outbound),
    )


@router.patch("/cases/{case_id}/quotation/lines/{line_item_id}", response_model=QuotationLineOut)
def update_quotation_line(case_id: int, line_item_id: int, payload: QuotationLineUpdateRequest, db: Session = Depends(get_db)):
    quotation = (
        db.query(QuotationDraft).filter_by(case_id=case_id)
        .order_by(QuotationDraft.revision_no.desc()).first()
    )
    if quotation is None:
        raise HTTPException(404, "No quotation draft exists for this case")

    line = (
        db.query(QuotationLine)
        .filter_by(draft_id=quotation.draft_id, line_item_id=line_item_id)
        .first()
    )
    if line is None:
        raise HTTPException(404, "Quotation line not found")

    if payload.model_code is not None:
        line.model_code = payload.model_code
    if payload.description is not None:
        line.description = payload.description
    if payload.qty is not None:
        line.qty = payload.qty
    if payload.technical_spec_text is not None:
        line.technical_spec_text = payload.technical_spec_text

    db.commit()
    db.refresh(line)
    return QuotationLineOut.model_validate(line)


@router.get("/cases/{case_id}/quotation/download")
def download_case_quotation(case_id: int, db: Session = Depends(get_db)):
    """Serve the generated Word offer. Rebuilds the file if the stored path is stale."""
    case = db.get(InquiryCase, case_id)
    if case is None:
        raise HTTPException(404, "Case not found")
    quotation = (
        db.query(QuotationDraft).filter_by(case_id=case_id)
        .order_by(QuotationDraft.revision_no.desc()).first()
    )
    if quotation is None:
        raise HTTPException(404, "No quotation generated yet for this case")

    path = resolve_quotation_file(
        uri=quotation.docx_blob_uri,
        filename=quotation_docx_filename(case.internal_ref, quotation.revision_no),
    )
    if not path:
        lines = (
            db.query(QuotationLine).filter_by(draft_id=quotation.draft_id)
            .order_by(QuotationLine.line_no).all()
        )
        if not lines:
            raise HTTPException(404, "Quotation file not found")
        pricing = (
            db.query(PricingSnapshot)
            .options(joinedload(PricingSnapshot.lines))
            .filter_by(case_id=case_id)
            .order_by(PricingSnapshot.entered_at.desc())
            .first()
        )
        uri = build_quotation_docx(case, lines, quotation.revision_no, pricing=pricing)
        quotation.docx_blob_uri = uri
        quotation.status = "GENERATED"
        db.commit()
        path = resolve_quotation_file(uri=uri)
    if not path:
        raise HTTPException(404, "Quotation file not found")
    posix = "quotations/" + os.path.basename(path)
    if (quotation.docx_blob_uri or "").replace("\\", "/") != posix:
        quotation.docx_blob_uri = posix
        db.commit()
    return FileResponse(
        path,
        filename=os.path.basename(path),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


@router.get("/quotations/download/{filename}")
def download_quotation(filename: str):
    path = resolve_quotation_file(filename=filename)
    if not path:
        raise HTTPException(404, "File not found")
    return FileResponse(
        path,
        filename=os.path.basename(path),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


@router.get("/insights", response_model=dict)
def insights(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    from datetime import datetime, timezone
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    my_categories = [c.strip() for c in current_user.category.split(",")] if current_user.category else []

    base_query = db.query(InquiryCase)
    if current_user.role != "ADMIN" and my_categories:
        base_query = base_query.filter(InquiryCase.category.in_(my_categories))

    total_incoming_today = base_query.filter(InquiryCase.created_at >= today_start).count()
    total_incoming_all = base_query.count()

    outgoing_query = db.query(QuotationDraft).join(InquiryCase, QuotationDraft.case_id == InquiryCase.case_id)
    if current_user.role != "ADMIN" and my_categories:
        outgoing_query = outgoing_query.filter(InquiryCase.category.in_(my_categories))
    total_quotations_sent = outgoing_query.count()
    quotations_today = outgoing_query.filter(QuotationDraft.created_at >= today_start).count()

    under_review = (
        db.query(ExtractedLineItem)
        .join(InquiryCase, ExtractedLineItem.case_id == InquiryCase.case_id)
        .join(ExtractedLineItem.recommendations)
    )
    if current_user.role != "ADMIN" and my_categories:
        under_review = under_review.filter(InquiryCase.category.in_(my_categories))
    under_review_count = (
        under_review.filter(~ExtractedLineItem.recommendations.any(ProductRecommendation.is_selected_by_engineer == True))
        .distinct()
        .count()
    )

    result = {
        "scope": "ALL_CATEGORIES" if current_user.role == "ADMIN" else (current_user.category or "UNASSIGNED"),
        "incoming_today": total_incoming_today,
        "incoming_total": total_incoming_all,
        "quotations_sent_today": quotations_today,
        "quotations_sent_total": total_quotations_sent,
        "under_review": under_review_count,
    }

    decided_recs = db.query(ProductRecommendation).filter(ProductRecommendation.is_selected_by_engineer.isnot(None)).all()

    if current_user.role == "ADMIN":
        my_decided_recs = decided_recs
    else:
        my_decided_recs = [r for r in decided_recs if r.decided_by == current_user.display_name]

    my_total_decided = len(my_decided_recs)
    my_total_rejected = sum(1 for r in my_decided_recs if r.is_selected_by_engineer is False)
    result["rejection_rate"] = round((my_total_rejected / my_total_decided * 100), 1) if my_total_decided > 0 else 0
    
    if current_user.role == "ADMIN":
        category_rows = (
            db.query(InquiryCase.category, func.count(InquiryCase.case_id))
            .group_by(InquiryCase.category)
            .all()
        )
        result["by_category"] = [{"category": c or "Unassigned", "count": n} for c, n in category_rows]

        engineer_stats = {}
        for r in decided_recs:
            name = r.decided_by or "Unknown"
            if name not in engineer_stats:
                engineer_stats[name] = {"approved": 0, "rejected": 0}
            if r.is_selected_by_engineer:
                engineer_stats[name]["approved"] += 1
            else:
                engineer_stats[name]["rejected"] += 1
        result["engineer_performance"] = [
            {"engineer": name, "approved": stats["approved"], "rejected": stats["rejected"]}
            for name, stats in engineer_stats.items()
        ]

    result["pipeline_breakdown"] = [
    {"category": "Incoming (Pending)", "count": under_review_count},
    {"category": "Quoted (Sent)", "count": total_quotations_sent},
    ]
    return result


@router.get("/review-queue-cases", response_model=list[CaseSummaryOut])
def review_queue_cases(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Grouped-by-case view for the new table UI — one row per case,
    not per line item. A case appears here if ANY of its line items
    still needs a decision (pending or rejected). Multiple quotation
    revisions of the same qtnno+fyear are collapsed into a single row
    (the revision that most needs review, or the latest one)."""
    query = (
        db.query(InquiryCase)
        .join(ExtractedLineItem, ExtractedLineItem.case_id == InquiryCase.case_id)
        .join(ExtractedLineItem.recommendations)
        .filter(
            ~ExtractedLineItem.recommendations.any(
                ProductRecommendation.is_selected_by_engineer == True
            )
        )
        .filter(InquiryCase.status != "QUOTED")
        .distinct()
    )
    if current_user.role != "ADMIN" and current_user.category:
        my_categories = [c.strip() for c in current_user.category.split(",")]
        query = query.filter(InquiryCase.category.in_(my_categories))
    cases = query.all()

    # Group cases needing review by (qtnno, fyear). Within a group,
    # pick the latest revision that needs review as the representative
    # row — that's the one whose case_id "View Details" will open.
    groups: dict[tuple, list] = {}
    standalone = []
    for case in cases:
        if case.qtnno and case.fyear:
            key = (case.qtnno, case.fyear)
            groups.setdefault(key, []).append(case)
        else:
            standalone.append(case)

    representative_cases = []
    revision_counts = {}
    for key, members in groups.items():
        members.sort(key=lambda m: m.revision_no or 0)
        rep = members[-1]
        representative_cases.append(rep)
        # Total revision count for this qtnno+fyear (including ones
        # that don't need review), so the badge reflects the real family size.
        total_siblings = db.query(InquiryCase).filter_by(qtnno=key[0], fyear=key[1]).count()
        revision_counts[rep.case_id] = total_siblings
    for case in standalone:
        representative_cases.append(case)
        revision_counts[case.case_id] = 1

    results = []
    for case in representative_cases:
        items = db.query(ExtractedLineItem).filter_by(case_id=case.case_id).all()
        confidences = []
        has_pending = False
        has_rejected = False
        for item in items:
            top = _top_recommendation(item)
            if top:
                if top.confidence is not None:
                    confidences.append(top.confidence)
                if top.is_selected_by_engineer is False:
                    has_rejected = True
                elif top.is_selected_by_engineer is None:
                    has_pending = True
        results.append(CaseSummaryOut(
            case_id=case.case_id,
            internal_ref=case.internal_ref,
            customer_name=case.customer.display_name if case.customer else None,
            project_name=case.project_name,
            items_count=len(items),
            top_confidence=max(confidences) if confidences else None,
            has_pending=has_pending,
            has_rejected=has_rejected,
            category=case.category,
            status=case.status,
            enq_received_at=case.enq_received_at,
            revision_no=case.revision_no or 0,
            revision_count=revision_counts.get(case.case_id, 1),
        ))

    results.sort(key=lambda r: (not r.has_pending, r.has_rejected))
    return results


@router.get("/cases/{case_id}/enquiry-email", response_model=EnquiryEmailOut)
def enquiry_email(case_id: int, db: Session = Depends(get_db)):
    """Fallback content for the 'Original Enquiry' panel when there are
    no attached documents — shows the actual email the AI agent read."""
    msg = (
        db.query(EmailMessage)
        .filter_by(case_id=case_id, direction="INBOUND")
        .order_by(EmailMessage.received_at.desc())
        .first()
    )
    if msg is None:
        raise HTTPException(404, "No enquiry email on file for this case")
    return EnquiryEmailOut(
        subject=msg.subject, sender_email=msg.sender_email,
        body_text=msg.body_text, received_at=msg.received_at,
    )


@router.patch("/cases/{case_id}/quotation/email", response_model=OutboundMessageOut)
def update_draft_email(case_id: int, payload: EmailUpdateRequest, db: Session = Depends(get_db)):
    outbound = (
        db.query(OutboundMessage)
        .filter_by(case_id=case_id)
        .order_by(OutboundMessage.created_at.desc())
        .first()
    )
    if outbound is None:
        raise HTTPException(404, "No draft email found for this case")

    if payload.subject is not None:
        outbound.subject = payload.subject
    if payload.body_text is not None:
        outbound.body_text = payload.body_text

    db.commit()
    db.refresh(outbound)
    return OutboundMessageOut.model_validate(outbound)


@router.get("/cases/{case_id}/revisions", response_model=QtnGroupOut)
def case_revisions(case_id: int, db: Session = Depends(get_db)):
    """
    Returns every other revision of the same quotation number (same
    qtnno + fyear), plus every document across ALL of those revisions
    combined — matching how the ERP groups them (one QTN number can
    have multiple enquiry revisions, each possibly with its own
    attachments).
    """
    case = db.get(InquiryCase, case_id)
    if case is None:
        raise HTTPException(404, "Case not found")

    siblings = []
    if case.qtnno and case.fyear:
        siblings = (
            db.query(InquiryCase)
            .filter_by(qtnno=case.qtnno, fyear=case.fyear)
            .order_by(InquiryCase.revision_no)
            .all()
        )

    revisions = [
        RevisionSummary(
            case_id=s.case_id, internal_ref=s.internal_ref, revision_no=s.revision_no,
            status=s.status, enq_received_at=s.enq_received_at,
        )
        for s in siblings
    ]

    return QtnGroupOut(
        qtnno=case.qtnno, fyear=case.fyear,
        revisions=revisions,
        documents=list_related_enquiry_documents(db, case),
    )


@router.get("/cases/{case_id}/pricing", response_model=PricingSnapshotOut)
def get_pricing(case_id: int, db: Session = Depends(get_db)):
    snapshot = (
        db.query(PricingSnapshot).filter_by(case_id=case_id)
        .order_by(PricingSnapshot.entered_at.desc()).first()
    )
    if snapshot is None:
        raise HTTPException(404, "No pricing has been entered for this case yet")
    return PricingSnapshotOut(
        pricing_id=snapshot.pricing_id, currency_code=snapshot.currency_code,
        discount_pct=snapshot.discount_pct, tax_pct=snapshot.tax_pct,
        freight_amount=snapshot.freight_amount, grand_total=snapshot.grand_total,
        validity_days=snapshot.validity_days, notes=snapshot.notes,
        entered_by=snapshot.entered_by,
        lines=[PricingLineOut.model_validate(l) for l in snapshot.lines],
    )


@router.put("/cases/{case_id}/pricing", response_model=PricingSnapshotOut)
def save_pricing(case_id: int, payload: PricingUpdateRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    case = db.get(InquiryCase, case_id)
    if case is None:
        raise HTTPException(404, "Case not found")

    quotation = (
        db.query(QuotationDraft).filter_by(case_id=case_id)
        .order_by(QuotationDraft.revision_no.desc()).first()
    )
    if quotation is None:
        raise HTTPException(404, "No quotation exists for this case yet")

    snapshot = (
        db.query(PricingSnapshot).filter_by(case_id=case_id)
        .order_by(PricingSnapshot.entered_at.desc()).first()
    )
    if snapshot is None:
        snapshot = PricingSnapshot(
            case_id=case_id, draft_id=quotation.draft_id,
            currency_code=payload.currency_code, entered_by=current_user.display_name,
        )
        db.add(snapshot)
        db.flush()
    else:
        snapshot.currency_code = payload.currency_code
        snapshot.entered_by = current_user.display_name
        for old_line in list(snapshot.lines):
            db.delete(old_line)
        db.flush()

    snapshot.discount_pct = payload.discount_pct
    snapshot.tax_pct = payload.tax_pct
    snapshot.freight_amount = payload.freight_amount
    snapshot.validity_days = payload.validity_days
    snapshot.notes = payload.notes

    subtotal = Decimal("0")
    quote_lines = db.query(QuotationLine).filter_by(draft_id=quotation.draft_id).all()
    by_quote_id = {ql.quote_line_id: ql for ql in quote_lines}
    by_line_item = {ql.line_item_id: ql for ql in quote_lines if ql.line_item_id is not None}

    for line_input in payload.lines:
        ql = by_quote_id.get(line_input.quote_line_id) or by_line_item.get(line_input.quote_line_id)
        if ql is None:
            continue

        qty = Decimal("1")
        if ql.qty:
            try:
                qty = Decimal(str(ql.qty))
            except Exception:
                qty = Decimal("1")

        unit_price = line_input.unit_price or Decimal("0")
        line_discount = line_input.discount_pct or Decimal("0")
        line_total = unit_price * qty * (Decimal("1") - line_discount / Decimal("100"))

        pricing_line = PricingLine(
            pricing_id=snapshot.pricing_id, quote_line_id=ql.quote_line_id,
            unit_price=unit_price, line_total=line_total, discount_pct=line_input.discount_pct,
        )
        db.add(pricing_line)
        subtotal += line_total

    discount = subtotal * (payload.discount_pct or Decimal("0")) / Decimal("100")
    after_discount = subtotal - discount
    tax = after_discount * (payload.tax_pct or Decimal("0")) / Decimal("100")
    freight = payload.freight_amount or Decimal("0")
    snapshot.grand_total = after_discount + tax + freight

    quotation.pricing_blank = False

    db.commit()
    db.refresh(snapshot)

    return PricingSnapshotOut(
        pricing_id=snapshot.pricing_id, currency_code=snapshot.currency_code,
        discount_pct=snapshot.discount_pct, tax_pct=snapshot.tax_pct,
        freight_amount=snapshot.freight_amount, grand_total=snapshot.grand_total,
        validity_days=snapshot.validity_days, notes=snapshot.notes,
        entered_by=snapshot.entered_by,
        lines=[PricingLineOut.model_validate(l) for l in snapshot.lines],
    )


def _same_gathered_sku(a: str, b: str) -> bool:
    ca = re.sub(r"[\s\-–—_/]+", "", (a or "").upper())
    cb = re.sub(r"[\s\-–—_/]+", "", (b or "").upper())
    if not ca or not cb:
        return False
    if ca == cb:
        return True
    if len(ca) != len(cb):
        longer, shorter = (ca, cb) if len(ca) > len(cb) else (cb, ca)
        return len(shorter) >= 8 and longer.startswith(shorter)
    diffs = [(ca[i], cb[i]) for i in range(len(ca)) if ca[i] != cb[i]]
    if len(diffs) != 1:
        return False
    groups = (set("ILT1"), set("O0Q"), set("S5"), set("B8"), set("Z2"))
    x, y = diffs[0]
    return any(x in g and y in g for g in groups)


def _clean_model_code(raw: str, family: str = "") -> str:
    mn = str(raw or "").strip()
    if "?" in mn:
        return ""
    if family and mn.upper() == family.upper() and "-" not in mn:
        return ""
    return mn


def _explode_techtrol_x_line(code: str) -> list[str]:
    """FPS-A X ECS-B X ECS-C → two SKUs, never one triple-joined string."""
    raw = (code or "").strip()
    if not raw:
        return []
    spaced = re.sub(r"(?i)\s*[xX×]\s*", " X ", raw)
    parts = [re.sub(r"\s+", "", p.strip()) for p in re.split(r"\s+X\s+", spaced) if p.strip()]
    if len(parts) <= 1:
        return [raw]
    if len(parts) == 2:
        return [f"{parts[0]} X {parts[1]}"]
    left = parts[0]
    out: list[str] = []
    seen: set[str] = set()
    for part in parts[1:]:
        if not re.match(r"(?i)(?:ECS|TLC)-", part):
            continue
        line = f"{left} X {part}"
        key = re.sub(r"[\s\-]+", "", line.upper())
        if key in seen:
            continue
        seen.add(key)
        out.append(line)
    return out or [raw]


def _collapse_unified_fps_ecs(rows: list[dict]) -> list[dict]:
    """One card per FPS×ECS pair. Never join two cages onto one SKU."""
    if not rows:
        return rows
    combos: list[dict] = []
    fps = None
    ecs: list[str] = []
    rest: list[dict] = []
    drop_sib = {"ECS", "TLC", "CFS", "ECT", "CFPS", "FPSB", "FPSO"}
    for row in rows:
        fam = str(row.get("_family") or "").strip().upper()
        mn = str(row.get("_model") or "").strip()
        if re.search(r"(?i)\s+X\s+", mn):
            for line in _explode_techtrol_x_line(mn):
                combo = dict(row)
                combo["_family"] = line.split("-", 1)[0].upper() or "FPS"
                combo["_display"] = line
                combo["_model"] = line
                combo["_needs_details"] = False
                combo["_alts"] = []
                combo["_conf"] = max(float(combo.get("_conf") or 0), 0.98)
                combos.append(combo)
            continue
        if fam in {"FPS", "FPSB"} and mn.upper().startswith("FPS") and " X " not in mn.upper():
            if fam == "FPS" or fps is None:
                fps = dict(row)
            continue
        if fam == "ECS" and mn.upper().startswith("ECS"):
            ecs.append(mn.split(" X ")[0].strip())
            continue
        if fam in drop_sib:
            continue
        rest.append(row)
    if not combos and fps is not None and ecs:
        left = str(fps.get("_model") or "").split(" X ")[0].strip()
        for right in dict.fromkeys(ecs):
            combo = dict(fps)
            combo["_family"] = "FPS"
            combo["_display"] = f"{left} X {right}"
            combo["_model"] = f"{left} X {right}"
            combo["_needs_details"] = False
            combo["_alts"] = []
            combo["_conf"] = max(float(combo.get("_conf") or 0), 0.98)
            combo["_rationale"] = "FPS with external cage ECS (Techtrol X accessory)"
            combos.append(combo)
    if not combos:
        return rows
    seen: set[str] = set()
    uniq: list[dict] = []
    for c in combos:
        k = str(c.get("_model") or "").upper()
        if k in seen:
            continue
        seen.add(k)
        uniq.append(c)
    return uniq + [
        r
        for r in rest
        if str(r.get("_family") or "").upper() not in drop_sib
    ]


def _alts_from_family(fam: dict, primary_mn: str) -> list[dict]:
    seen = {primary_mn.upper()} if primary_mn else set()
    alts = []
    for sm in fam.get("suggested_models") or []:
        cand = _clean_model_code(
            sm.get("model_number") or sm.get("model_code"),
            str(fam.get("product_family") or ""),
        )
        if not cand or cand.upper() in seen:
            continue
        if primary_mn and _same_gathered_sku(cand, primary_mn):
            continue
        if any(_same_gathered_sku(cand, prev) for prev in seen):
            continue
        seen.add(cand.upper())
        try:
            conf = float(sm.get("confidence") or fam.get("confidence") or 0)
        except (TypeError, ValueError):
            conf = 0.0
        notes = sm.get("notes") or sm.get("rationale") or "Alternative model suggested by AI."
        alts.append({
            "_model": cand,
            "_conf": max(0.0, min(conf, 0.9999)),
            "_rationale": str(notes)[:1000],
        })
    return alts


def _unify_ai_products(result: dict) -> list[dict]:
    """One card per Techtrol X combo (or per family when not combined)."""
    unified: dict[str, dict] = {}
    expanded: list[dict] = []
    for fam in result.get("products") or []:
        family = str(fam.get("product_family") or fam.get("display_name") or "").strip()
        codes: list[str] = []
        primary = _clean_model_code(fam.get("model_number") or fam.get("model_code"), family)
        if primary:
            codes.append(primary)
        for sm in fam.get("suggested_models") or []:
            cand = _clean_model_code(sm.get("model_number") or sm.get("model_code"), family)
            if cand:
                codes.append(cand)
        xcodes: list[str] = []
        for c in dict.fromkeys(codes):
            if re.search(r"(?i)\s+X\s+", c):
                xcodes.extend(_explode_techtrol_x_line(c) or [c])
        xcodes = list(dict.fromkeys(xcodes))
        if xcodes:
            for c in xcodes:
                row = dict(fam)
                row["model_number"] = c
                row["model_code"] = c
                row["suggested_models"] = [{"model_number": c, "model_code": c}]
                expanded.append(row)
        else:
            expanded.append(fam)

    for fam in expanded:
        family = str(fam.get("product_family") or fam.get("display_name") or "").strip()
        if not family:
            continue
        mn = _clean_model_code(fam.get("model_number") or fam.get("model_code"), family)
        if not mn:
            for sm in fam.get("suggested_models") or []:
                cand = _clean_model_code(sm.get("model_number") or sm.get("model_code"), family)
                if cand:
                    mn = cand
                    break
        try:
            conf = float(fam.get("confidence") or 0)
        except (TypeError, ValueError):
            conf = 0.0
        key = mn.upper() if mn and re.search(r"(?i)\s+X\s+", mn) else family.upper()
        prev = unified.get(key)
        better_sku = bool(mn) and (not prev or not prev["_model"])
        better_conf = prev is None or conf > float(prev["_conf"])
        alts = [] if (mn and re.search(r"(?i)\s+X\s+", mn)) else _alts_from_family(fam, mn)
        if prev is None or better_sku or (better_conf and (bool(mn) == bool(prev["_model"]))):
            display = mn if (mn and re.search(r"(?i)\s+X\s+", mn)) else str(fam.get("display_name") or family)
            confirmed = ""
            for sm in fam.get("suggested_models") or []:
                notes = str(sm.get("notes") or "")
                low = notes.lower()
                if "catalogue chart" in low or "inquiry-named" in low or "catalogue-verified" in low:
                    confirmed = notes
                    break
            why = [
                str(w)
                for w in (fam.get("why") or [])
                if w and not re.search(r"radar|gwr|ultrasonic", str(w), flags=re.I)
            ]
            rationale = confirmed or ", ".join(why) or "Matched by AI model."
            if not mn:
                rationale = (rationale + " — family identified; exact model needs details.")[:1000]
            if confirmed and mn:
                alts = []
            unified[key] = {
                "_family": family.split()[0] if family else family,
                "_display": display,
                "_model": mn,
                "_conf": max(0.0, min(conf, 0.9999)),
                "_rationale": rationale[:1000],
                "_needs_details": False if (confirmed and mn) else (bool(fam.get("needs_details")) or not mn),
                "_alts": alts,
            }

    rows = sorted(unified.values(), key=lambda r: r["_conf"], reverse=True)
    strong = [r for r in rows if r["_conf"] >= 0.30]
    collapsed = strong or rows
    has_rfg = any(str(r.get("_family") or "").upper() == "RFG" for r in collapsed)
    if has_rfg:
        collapsed = [r for r in collapsed if str(r.get("_family") or "").upper() != "RFGB"]
    drop_acc = set()
    has_fps_x = False
    for r in collapsed:
        mn = str(r.get("_model") or "")
        if re.search(r"(?i)\s+X\s+", mn):
            for part in re.split(r"(?i)\s+X\s+", mn)[1:]:
                drop_acc.add(part.split("-", 1)[0].upper())
            if re.search(r"(?i)\bECS-", mn):
                has_fps_x = True
    if has_fps_x:
        drop_acc.update({"ECS", "TLC", "CFS", "ECT", "CFPS", "FPSB", "FPSO"})
    if drop_acc:
        collapsed = [
            r
            for r in collapsed
            if str(r.get("_family") or "").upper() not in drop_acc
            or re.search(r"(?i)\s+X\s+", str(r.get("_model") or ""))
        ]
    return _collapse_unified_fps_ecs(collapsed)


def _persist_ai_match(
    db: Session,
    case: InquiryCase,
    result: dict,
    *,
    enquiry_title: str | None = None,
) -> tuple[int, int, list[str]]:
    """
    Persist one Products & Matching card per distinct product family.
    Extra SKUs for the same family stay as alternatives on that card.
    """
    products = _unify_ai_products(result)
    decision = result.get("decision") or ""
    persistable = decision in {
        "PRODUCTS_MATCHED",
        "PRODUCTS_MATCHED_NEED_DETAILS",
    } or bool(products)
    if not persistable or not products:
        return (0, 0, [])

    for rec in (
        db.query(ProductRecommendation).filter_by(case_id=case.case_id).all()
    ):
        db.delete(rec)
    db.flush()

    line_items = (
        db.query(ExtractedLineItem)
        .filter_by(case_id=case.case_id)
        .order_by(ExtractedLineItem.line_no, ExtractedLineItem.line_item_id)
        .all()
    )

    while len(line_items) > len(products):
        extra = line_items[-1]
        quoted = db.query(QuotationLine).filter_by(line_item_id=extra.line_item_id).first()
        if quoted is not None:
            break
        if extra.extraction_method == "ai-match" or extra.line_no > 1:
            db.delete(extra)
            line_items.pop()
            db.flush()
        else:
            break

    while len(line_items) < len(products):
        line = ExtractedLineItem(
            case_id=case.case_id,
            line_no=len(line_items) + 1,
            description=(enquiry_title or "AI-matched item")[:1000],
            qty=Decimal("1"),
            uom="NOS",
            extraction_method="ai-match",
        )
        db.add(line)
        db.flush()
        line_items.append(line)

    sku_matched = 0
    matched_models: list[str] = []
    for idx, row in enumerate(products):
        line = line_items[idx]
        if not line.qty or line.qty == 0:
            line.qty = Decimal("1")
        if not line.uom:
            line.uom = "NOS"
        line.product_type = row["_family"][:80]
        line.description = (row["_display"] or row["_family"] or enquiry_title or "AI-matched item")[:1000]
        recs_to_add = [{
            "_model": row["_model"],
            "_conf": row["_conf"],
            "_rationale": row["_rationale"],
            "_needs_details": row["_needs_details"],
        }] + list(row.get("_alts") or [])
        for rank, rec_row in enumerate(recs_to_add, start=1):
            rec = ProductRecommendation(
                case_id=case.case_id,
                line_item_id=line.line_item_id,
                rank_no=rank,
                match_level="A" if rank == 1 and not rec_row.get("_needs_details") else "B",
                family_code=row["_family"][:20],
                model_code=(rec_row["_model"] or "")[:120] or None,
                confidence=Decimal(str(round(float(rec_row["_conf"]), 4))),
                rationale=rec_row["_rationale"],
                is_selected_by_engineer=None,
                decided_by=None,
            )
            db.add(rec)
        if row["_model"]:
            sku_matched += 1
            matched_models.append(row["_model"])

    if case.status == "QUOTED":
        old_status = case.status
        case.status = "IN_REVIEW"
        db.add(
            CaseStatusHistory(
                case_id=case.case_id,
                from_status=old_status,
                to_status="IN_REVIEW",
                changed_by="ai-rematch",
            )
        )
    elif case.status in ("NEW", "EXTRACTED", "RECEIVED", None):
        old_status = case.status
        case.status = "IN_REVIEW"
        db.add(
            CaseStatusHistory(
                case_id=case.case_id,
                from_status=old_status or "NEW",
                to_status="IN_REVIEW",
                changed_by="ai-match",
            )
        )

    return (len(products), sku_matched, matched_models)


def _recommendation_family_key(rec: ProductRecommendation) -> str:
    fam = (rec.family_code or "").strip().upper()
    if fam:
        return fam
    return (rec.model_code or "").strip().upper()


def _merge_fps_ecs_line_items(db: Session, case_id: int) -> None:
    """One web-panel card per FPS×ECS pair. Never join two cages; drop CFS/ECT."""
    drop_sib = {"ECS", "TLC", "CFS", "ECT", "CFPS", "FPSB", "FPSO"}
    items = (
        db.query(ExtractedLineItem)
        .filter_by(case_id=case_id)
        .order_by(ExtractedLineItem.line_no, ExtractedLineItem.line_item_id)
        .all()
    )
    if not items:
        return

    combo_codes: list[str] = []
    fps_sku = ""
    ecs_codes: list[str] = []
    for item in items:
        for rec in item.recommendations or []:
            mc = (rec.model_code or "").strip()
            fam = (rec.family_code or item.product_type or "").strip().upper()
            if re.search(r"(?i)FPS\S*\s+X\s+ECS-", mc) or re.search(
                r"(?i)\s+X\s+ECS-", mc
            ):
                for line in _explode_techtrol_x_line(mc):
                    if not re.search(r"(?i)\s+X\s+ECS-", line):
                        continue
                    key = re.sub(r"[\s\-]+", "", line.upper())
                    if key not in {re.sub(r"[\s\-]+", "", c.upper()) for c in combo_codes}:
                        combo_codes.append(line)
            elif fam in {"FPS", "FPSB"} and mc.upper().replace(" ", "").startswith("FPS"):
                if not fps_sku or fam == "FPS":
                    fps_sku = mc.split(" X ")[0].strip()
            elif fam == "ECS" and mc.upper().startswith("ECS"):
                ecs_codes.append(mc.split(" X ")[0].strip())
    if not combo_codes and fps_sku and ecs_codes:
        for right in dict.fromkeys(ecs_codes):
            combo_codes.append(f"{fps_sku} X {right}")
    if not combo_codes:
        return

    changed = False
    slot_items: list[ExtractedLineItem] = []
    for item in list(items):
        quoted = db.query(QuotationLine).filter_by(line_item_id=item.line_item_id).first()
        fam = (item.product_type or "").strip().upper()
        recs = list(item.recommendations or [])
        has_x = any(re.search(r"(?i)\s+X\s+ECS-", r.model_code or "") for r in recs)
        rec_fams = {(r.family_code or "").strip().upper() for r in recs}
        if has_x or fam in {"FPS", "FPSB"}:
            slot_items.append(item)
            continue
        if fam in drop_sib or (rec_fams and rec_fams <= drop_sib):
            if quoted:
                continue
            for rec in recs:
                db.delete(rec)
            db.delete(item)
            changed = True

    while len(slot_items) < len(combo_codes):
        src = slot_items[0] if slot_items else items[0]
        max_no = max((it.line_no or 1) for it in slot_items) if slot_items else 1
        line = ExtractedLineItem(
            case_id=case_id,
            line_no=max_no + 1,
            description="FPS X ECS",
            qty=src.qty or Decimal("1"),
            uom=src.uom or "NOS",
            product_type="FPS",
            extraction_method="ai-match",
        )
        db.add(line)
        db.flush()
        slot_items.append(line)
        changed = True

    extra_slots = slot_items[len(combo_codes):]
    slot_items = slot_items[: len(combo_codes)]
    for item in extra_slots:
        if db.query(QuotationLine).filter_by(line_item_id=item.line_item_id).first():
            continue
        for rec in list(item.recommendations or []):
            db.delete(rec)
        db.delete(item)
        changed = True

    for idx, code in enumerate(combo_codes):
        item = slot_items[idx]
        item.product_type = "FPS"
        item.description = code[:1000]
        recs = list(item.recommendations or [])
        if recs:
            rec = recs[0]
            rec.model_code = code[:120]
            rec.family_code = "FPS"
            rec.confidence = max(float(rec.confidence or 0), 0.98)
            rec.rationale = "FPS with external cage ECS (Techtrol X accessory)"
            rec.match_level = "A"
            rec.rank_no = 1
            for extra in recs[1:]:
                db.delete(extra)
                changed = True
        else:
            db.add(
                ProductRecommendation(
                    case_id=case_id,
                    line_item_id=item.line_item_id,
                    rank_no=1,
                    match_level="A",
                    family_code="FPS",
                    model_code=code[:120],
                    confidence=Decimal("0.9800"),
                    rationale="FPS with external cage ECS (Techtrol X accessory)",
                    is_selected_by_engineer=None,
                    decided_by=None,
                )
            )
        changed = True

    if changed:
        db.commit()
        db.expire_all()


def _split_distinct_product_line_items(db: Session, case_id: int) -> None:
    """Split distinct product families that were stored on one enquiry line.

    Same-family SKUs stay as alternatives. Different families each get a
    Products & Matching card so they can be approved independently.
    """
    items = (
        db.query(ExtractedLineItem)
        .filter_by(case_id=case_id)
        .order_by(ExtractedLineItem.line_no, ExtractedLineItem.line_item_id)
        .all()
    )
    if not items:
        return

    changed = False
    max_line_no = max((item.line_no or 1) for item in items)
    for item in list(items):
        recs = list(item.recommendations or [])
        if len(recs) < 2:
            continue
        if db.query(QuotationLine).filter_by(line_item_id=item.line_item_id).first():
            continue
        x_recs = [rec for rec in recs if re.search(r"(?i)\s+X\s+", rec.model_code or "")]
        if x_recs:
            exploded: list[str] = []
            for rec in x_recs:
                exploded.extend(_explode_techtrol_x_line(rec.model_code or ""))
            exploded = list(dict.fromkeys(exploded))
            if len(exploded) <= 1 and len(recs) == len(x_recs):
                continue
            # Multiple FPS×ECS pairs on one line → one card each
            if len(exploded) > 1:
                recs[0].model_code = exploded[0][:120]
                recs[0].family_code = "FPS"
                recs[0].rank_no = 1
                recs[0].match_level = "A"
                for extra in recs[1:]:
                    db.delete(extra)
                for code in exploded[1:]:
                    max_line_no += 1
                    new_item = ExtractedLineItem(
                        case_id=case_id,
                        line_no=max_line_no,
                        description=code[:1000],
                        qty=item.qty,
                        uom=item.uom,
                        product_type="FPS",
                        extraction_method=item.extraction_method or "ai-match",
                    )
                    db.add(new_item)
                    db.flush()
                    db.add(
                        ProductRecommendation(
                            case_id=case_id,
                            line_item_id=new_item.line_item_id,
                            rank_no=1,
                            match_level="A",
                            family_code="FPS",
                            model_code=code[:120],
                            confidence=recs[0].confidence,
                            rationale=recs[0].rationale,
                            is_selected_by_engineer=None,
                            decided_by=None,
                        )
                    )
                item.product_type = "FPS"
                item.description = exploded[0][:1000]
                changed = True
            continue
        groups: dict[str, list[ProductRecommendation]] = {}
        for rec in recs:
            key = _recommendation_family_key(rec) or f"REC-{rec.recommendation_id}"
            groups.setdefault(key, []).append(rec)
        if len(groups) < 2:
            continue
        ordered_keys = sorted(
            groups,
            key=lambda k: min((r.rank_no or 99) for r in groups[k]),
        )
        keep_recs = groups[ordered_keys[0]]
        lead_keep = sorted(keep_recs, key=lambda r: r.rank_no or 99)[0]
        if lead_keep.family_code:
            item.product_type = lead_keep.family_code[:80]
            item.description = (lead_keep.family_code or lead_keep.model_code or item.description or "")[:1000]
        for extra_key in ordered_keys[1:]:
            extra_recs = sorted(groups[extra_key], key=lambda r: r.rank_no or 99)
            lead = extra_recs[0]
            max_line_no += 1
            new_line = ExtractedLineItem(
                case_id=case_id,
                line_no=max_line_no,
                description=(lead.family_code or lead.model_code or "Suggested product")[:1000],
                product_type=(lead.family_code or None),
                qty=item.qty if item.qty else Decimal("1"),
                uom=item.uom or "NOS",
                extraction_method="ai-match",
            )
            db.add(new_line)
            db.flush()
            for rank, rec in enumerate(extra_recs, start=1):
                rec.line_item_id = new_line.line_item_id
                rec.rank_no = rank
            changed = True
        for rank, rec in enumerate(sorted(keep_recs, key=lambda r: r.rank_no or 99), start=1):
            rec.rank_no = rank
        changed = True

    if changed:
        db.commit()
        db.expire_all()


@router.post("/cases/{case_id}/run-ai-match", response_model=dict)
def run_ai_match(case_id: int, db: Session = Depends(get_db)):
    case = db.get(InquiryCase, case_id)
    if case is None:
        raise HTTPException(404, "Case not found")

    blocked = _drop_blocked_match(db, case)
    if blocked:
        return {
            "status": "skipped",
            "decision": "DELETED",
            "items_matched": 0,
            "items_identified": 0,
            "needs_details": False,
            "files_sent": [],
            "files_skipped_price_quotation": [],
            "raw_message": blocked,
        }

    files_for_api, skipped = load_ai_enquiry_files(db, case)
    if not files_for_api:
        raise HTTPException(
            400,
            "No enquiry documents to send to AI "
            "(price/quotation files are excluded). Attach the customer RFQ/spec.",
        )

    email_msg = (
        db.query(EmailMessage).filter_by(case_id=case_id, direction="INBOUND")
        .order_by(EmailMessage.received_at.desc()).first()
    )

    try:
        result = identify_product(
            files=files_for_api,
            email_text=email_msg.body_text if email_msg else "",
            subject=email_msg.subject if email_msg else "",
            from_email=email_msg.sender_email if email_msg else "",
        )
    except AiMatchError as exc:
        raise HTTPException(502, exc.message) from exc

    decision = result.get("decision")
    if decision in {
        "DELETED",
        "NON_TECHTROL_PRODUCT",
        "NO_SUPPORTED_PRODUCT",
        "IRRELEVANT",
    }:
        for rec in db.query(ProductRecommendation).filter_by(case_id=case.case_id).all():
            db.delete(rec)
        for item in db.query(ExtractedLineItem).filter_by(case_id=case.case_id).all():
            quoted = db.query(QuotationLine).filter_by(line_item_id=item.line_item_id).first()
            if quoted is None:
                db.delete(item)
        db.commit()
        return {
            "status": "skipped",
            "decision": decision,
            "items_matched": 0,
            "items_identified": 0,
            "needs_details": False,
            "files_sent": [name for name, _b, _t in files_for_api],
            "files_skipped_price_quotation": skipped,
            "raw_message": result.get("message") or "",
        }

    identified, matched_count, matched_models = _persist_ai_match(
        db,
        case,
        result,
        enquiry_title=(email_msg.subject if email_msg else None),
    )
    db.commit()
    _merge_fps_ecs_line_items(db, case.case_id)
    if matched_count > 0 and matched_count == identified:
        decision = "PRODUCTS_MATCHED"

    return {
        "status": "done",
        "decision": decision,
        "items_matched": matched_count,
        "items_identified": identified,
        "matched_models": matched_models,
        "needs_details": matched_count == 0 and (
            decision == "PRODUCTS_MATCHED_NEED_DETAILS"
            or identified > 0
        ),
        "files_sent": [name for name, _b, _t in files_for_api],
        "files_skipped_price_quotation": skipped,
        "raw_message": result.get("message", ""),
    }


@router.post("/cases/{case_id}/quotation/email/send", response_model=OutboundMessageOut)
def mark_quotation_email_sent(case_id: int, db: Session = Depends(get_db)):
    """
    Marks the draft email as sent. NOTE: this does NOT actually send
    an email over SMTP/Graph API yet — that integration isn't wired up.
    This lets the engineer confirm "I sent this externally (e.g. via
    Outlook)" so the UI correctly shows the sent state instead of
    misleadingly showing 'Draft / Pending' forever.
    """
    outbound = (
        db.query(OutboundMessage)
        .filter_by(case_id=case_id)
        .order_by(OutboundMessage.created_at.desc())
        .first()
    )
    if outbound is None:
        raise HTTPException(404, "No draft email found for this case")

    outbound.send_status = "SENT"
    outbound.sent_at = _dt.now(timezone.utc)

    db.commit()
    db.refresh(outbound)
    return OutboundMessageOut.model_validate(outbound)

@router.get("/cases/{case_id}/communication", response_model=list[CommunicationEntry])
def case_communication(case_id: int, db: Session = Depends(get_db)):
    """
    Combined communication timeline for a case — the original enquiry
    email plus every quotation email (sent or drafted) across ALL
    revisions of the same qtnno+fyear, so the Communication tab shows
    the full history even when older revisions are technically
    separate InquiryCase rows.
    """
    case = db.get(InquiryCase, case_id)
    if case is None:
        raise HTTPException(404, "Case not found")

    if case.qtnno and case.fyear:
        siblings = (
            db.query(InquiryCase)
            .filter_by(qtnno=case.qtnno, fyear=case.fyear)
            .order_by(InquiryCase.revision_no)
            .all()
        )
    else:
        siblings = [case]

    latest_revision_no = max((s.revision_no or 0) for s in siblings)
    entries = []

    for sibling in siblings:
        inbound = (
            db.query(EmailMessage)
            .filter_by(case_id=sibling.case_id, direction="INBOUND")
            .order_by(EmailMessage.received_at.desc())
            .first()
        )
        if inbound:
            sib_items = db.query(ExtractedLineItem).filter_by(case_id=sibling.case_id).all()
            matched = []
            for it in sib_items:
                top = _top_recommendation(it)
                if top and (top.model_code or top.family_code):
                    matched.append(top.model_code or top.family_code)
            entries.append(CommunicationEntry(
                entry_type="ENQUIRY_RECEIVED", revision_no=sibling.revision_no or 0,
                subject=inbound.subject, from_email=inbound.sender_email,
                body_text=inbound.body_text, timestamp=inbound.received_at,
                is_current_revision=(sibling.revision_no or 0) == latest_revision_no,
                matched_products=matched or None,
            ))

        outbounds = db.query(OutboundMessage).filter_by(case_id=sibling.case_id).all()
        for ob in outbounds:
            entries.append(CommunicationEntry(
                entry_type="QUOTATION_SENT" if ob.send_status == "SENT" else "QUOTATION_DRAFTED",
                revision_no=sibling.revision_no or 0,
                subject=ob.subject, to_emails=ob.to_emails, body_text=ob.body_text,
                timestamp=ob.sent_at or ob.created_at,
                is_current_revision=(sibling.revision_no or 0) == latest_revision_no,
            ))

    entries.sort(key=lambda e: e.timestamp or _dt.min.replace(tzinfo=timezone.utc))
    return entries

def _run_ai_match_for_case(db: Session, case_id: int) -> BulkAiMatchResultItem:
    """Shared logic used by both the single-case and bulk AI-match
    endpoints — pulled into a function so we don't duplicate it."""
    case = db.get(InquiryCase, case_id)
    if case is None:
        return BulkAiMatchResultItem(case_id=case_id, status="error", error="Case not found")

    blocked = _drop_blocked_match(db, case)
    if blocked:
        return BulkAiMatchResultItem(case_id=case_id, status="skipped", error=blocked)

    files_for_api, skipped = load_ai_enquiry_files(db, case)
    if not files_for_api:
        return BulkAiMatchResultItem(
            case_id=case_id,
            status="error",
            error="No enquiry documents to send to AI (price/quotation files are excluded).",
        )

    email_msg = (
        db.query(EmailMessage).filter_by(case_id=case_id, direction="INBOUND")
        .order_by(EmailMessage.received_at.desc()).first()
    )

    try:
        result = identify_product(
            files=files_for_api,
            email_text=email_msg.body_text if email_msg else "",
            subject=email_msg.subject if email_msg else "",
            from_email=email_msg.sender_email if email_msg else "",
        )
    except AiMatchError as exc:
        return BulkAiMatchResultItem(case_id=case_id, status="error", error=exc.message)

    decision = result.get("decision")
    if decision in {
        "DELETED",
        "NON_TECHTROL_PRODUCT",
        "NO_SUPPORTED_PRODUCT",
        "IRRELEVANT",
    }:
        for rec in db.query(ProductRecommendation).filter_by(case_id=case.case_id).all():
            db.delete(rec)
        for item in db.query(ExtractedLineItem).filter_by(case_id=case.case_id).all():
            if db.query(QuotationLine).filter_by(line_item_id=item.line_item_id).first() is None:
                db.delete(item)
        db.commit()
        return BulkAiMatchResultItem(
            case_id=case_id,
            status="skipped",
            error=result.get("message") or "",
        )

    identified, matched_count, _matched_models = _persist_ai_match(
        db,
        case,
        result,
        enquiry_title=(email_msg.subject if email_msg else None),
    )
    db.commit()
    _merge_fps_ecs_line_items(db, case.case_id)
    return BulkAiMatchResultItem(case_id=case_id, status="done", items_matched=matched_count)


@router.post("/cases/bulk-ai-match", response_model=BulkAiMatchResponse)
def bulk_ai_match(payload: BulkAiMatchRequest, db: Session = Depends(get_db)):
    results = [_run_ai_match_for_case(db, cid) for cid in payload.case_ids]
    return BulkAiMatchResponse(results=results)

@router.post("/cases/{case_id}/quotation/lines", response_model=QuotationLineOut)
def create_quotation_line(case_id: int, payload: QuotationLineCreateRequest, db: Session = Depends(get_db)):
    """
    Lets the engineer add a brand-new line item (not AI-matched) directly
    inside the Generate Quotation modal — e.g. an accessory or spare part
    manually typed in. Creates both the underlying ExtractedLineItem (so
    it behaves like any other line) and the QuotationLine row for the
    current draft.
    """
    case = db.get(InquiryCase, case_id)
    if case is None:
        raise HTTPException(404, "Case not found")

    quotation = (
        db.query(QuotationDraft).filter_by(case_id=case_id)
        .order_by(QuotationDraft.revision_no.desc()).first()
    )
    if quotation is None:
        raise HTTPException(404, "No quotation draft exists for this case yet")

    existing_line_items = db.query(ExtractedLineItem).filter_by(case_id=case_id).count()
    existing_quote_lines = db.query(QuotationLine).filter_by(draft_id=quotation.draft_id).count()

    qty_decimal = None
    if payload.qty:
        try:
            qty_decimal = Decimal(str(payload.qty))
        except Exception:
            qty_decimal = None

    new_item = ExtractedLineItem(
        case_id=case_id,
        line_no=existing_line_items + 1,
        description=payload.description or payload.model_code or "Manually added item",
        qty=qty_decimal,
        uom=payload.uom or "NOS",
    )
    db.add(new_item)
    db.flush()

    new_line = QuotationLine(
        draft_id=quotation.draft_id,
        line_item_id=new_item.line_item_id,
        line_no=existing_quote_lines + 1,
        model_code=payload.model_code,
        description=payload.description,
        qty=payload.qty,
        uom=payload.uom or "NOS",
        technical_spec_text=payload.technical_spec_text,
    )
    db.add(new_line)
    db.commit()
    db.refresh(new_line)

    return QuotationLineOut.model_validate(new_line)

@router.post("/recommendations/{recommendation_id}/approve-as-new-item", response_model=dict)
def approve_recommendation_as_new_item(recommendation_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """
    Approves an alternate suggested match WITHOUT replacing the current
    top pick for that line item — instead it clones the line item so
    both products end up quoted side by side. Used when an engineer
    wants more than one suggested model included in the same quotation.
    """
    rec = db.get(ProductRecommendation, recommendation_id)
    if rec is None:
        raise HTTPException(404, "Recommendation not found")

    original_item = db.get(ExtractedLineItem, rec.line_item_id)
    if original_item is None:
        raise HTTPException(404, "Line item not found")

    max_line_no = db.query(func.max(ExtractedLineItem.line_no)).filter_by(case_id=rec.case_id).scalar() or 0
    new_item = ExtractedLineItem(
        case_id=rec.case_id,
        line_no=max_line_no + 1,
        customer_tag_no=original_item.customer_tag_no,
        description=rec.family_code or rec.model_code or original_item.description,
        product_type=rec.family_code or original_item.product_type,
        qty=original_item.qty,
        uom=original_item.uom,
        moc=original_item.moc,
        range_text=original_item.range_text,
    )
    db.add(new_item)
    db.flush()

    new_rec = ProductRecommendation(
        case_id=rec.case_id,
        line_item_id=new_item.line_item_id,
        rank_no=1,
        match_level=rec.match_level,
        family_code=rec.family_code,
        model_code=rec.model_code,
        confidence=rec.confidence,
        rationale=rec.rationale,
        is_selected_by_engineer=True,
        decided_by=current_user.display_name,
    )
    db.add(new_rec)

    case = db.get(InquiryCase, rec.case_id)
    if case and case.status in ("RECEIVED", "NEW", "EXTRACTED", None):
        old_status = case.status
        case.status = "IN_REVIEW"
        db.add(CaseStatusHistory(
            case_id=case.case_id, from_status=old_status or "RECEIVED", to_status="IN_REVIEW",
            changed_by="engineer",
        ))

    db.commit()

    quotation = _maybe_create_quotation_draft(db, rec.case_id)
    return {
        "status": "approved",
        "model_code": new_rec.model_code or new_rec.family_code,
        "quotation_generated": quotation is not None,
    }