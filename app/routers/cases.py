import os

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.database import get_db
from app.deps import get_current_user
from app.models.inquiry_case import InquiryCase, CaseStatusHistory
from app.models.extract import ExtractedLineItem
from app.models.match import ProductRecommendation
from app.models.quotation import QuotationDraft, QuotationLine
from app.models.outbound import OutboundMessage
from app.models.email import EmailMessage
from app.quotation_builder import build_quotation_docx, draft_email_text, QUOTATIONS_DIR
from app.schemas import (
    CaseOut, CaseDetailOut, LineItemOut, QuotationOut, QuotationDetailOut,
    QuotationLineOut, OutboundMessageOut, EditRecommendationRequest, CaseSummaryOut,
    EnquiryEmailOut, StatusHistoryEntry, EmailUpdateRequest,
)
router = APIRouter(prefix="/api", tags=["cases"], dependencies=[Depends(get_current_user)])


# ---------- helpers (same logic as the Flask version, framework-agnostic) ----------

def _top_recommendation(line_item):
    if not line_item.recommendations:
        return None
    approved = [r for r in line_item.recommendations if r.is_selected_by_engineer is True]
    if approved:
        return approved[0]
    return sorted(line_item.recommendations, key=lambda r: r.rank_no)[0]


def _line_item_to_out(item) -> LineItemOut:
    return LineItemOut.model_validate(item)

def _case_to_out(c) -> CaseOut:
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
    )


def _maybe_generate_quotation(db: Session, case_id: int):
    case = db.get(InquiryCase, case_id)
    line_items = db.query(ExtractedLineItem).filter_by(case_id=case_id).all()
    if not line_items:
        return None

    all_approved = all(
        _top_recommendation(item) and _top_recommendation(item).is_selected_by_engineer is True
        for item in line_items
    )
    if not all_approved:
        return None

    existing = (
        db.query(QuotationDraft)
        .filter_by(case_id=case_id)
        .order_by(QuotationDraft.revision_no.desc())
        .first()
    )
    if existing is not None:
        if case.status != "QUOTED":
            old_status = case.status
            case.status = "QUOTED"
            db.add(CaseStatusHistory(
                case_id=case.case_id, from_status=old_status, to_status="QUOTED",
                changed_by="system-auto",
            ))
            db.commit()
        return existing

    revision_no = 0
    draft = QuotationDraft(
        case_id=case_id, revision_no=revision_no, template_id="STANDARD",
        status="DRAFT", pricing_blank=True, created_by="system-auto",
    )
    db.add(draft)
    db.flush()

    quote_lines = []
    for item in line_items:
        rec = _top_recommendation(item)
        spec_bits = [b for b in [item.moc, item.range_text, item.op_temp, item.op_pressure] if b]
        line = QuotationLine(
            draft_id=draft.draft_id, line_item_id=item.line_item_id, line_no=item.line_no,
            model_code=rec.model_code if rec else None,
            description=item.description or item.equipment_name,
            qty=str(item.qty) if item.qty is not None else None,
            uom=item.uom,
            technical_spec_text=", ".join(spec_bits) if spec_bits else None,
        )
        db.add(line)
        quote_lines.append(line)
    db.flush()

    docx_rel_path = build_quotation_docx(case, quote_lines, revision_no)
    draft.docx_blob_uri = docx_rel_path
    old_status = case.status
    case.status = "QUOTED"
    db.add(CaseStatusHistory(
        case_id=case.case_id, from_status=old_status, to_status="QUOTED",
        changed_by="system-auto",
    ))

    subject, body = draft_email_text(case, quote_lines)
    outbound = OutboundMessage(
        case_id=case_id, draft_id=draft.draft_id, channel="EMAIL",
        to_emails=[case.customer.email] if case.customer and case.customer.email else None,
        subject=subject, body_text=body, send_status="PENDING", created_by="system-auto",
    )
    db.add(outbound)
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
                ProductRecommendation.is_selected_by_engineer.is_(True)
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


from datetime import datetime as _dt

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
    STATUS_PRIORITY = {"IN_REVIEW": 0, "RECEIVED": 1, "QUOTED": 2}
    cases = sorted(cases, key=lambda c: STATUS_PRIORITY.get(c.status, 1))
    return [_case_to_out(c) for c in cases]

@router.get("/cases/{case_id}", response_model=CaseDetailOut)
def case_detail(case_id: int, db: Session = Depends(get_db)):
    case = db.get(InquiryCase, case_id)
    if case is None:
        raise HTTPException(404, "Case not found")
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
def approve_recommendation(recommendation_id: int, db: Session = Depends(get_db)):
    rec = db.get(ProductRecommendation, recommendation_id)
    if rec is None:
        raise HTTPException(404, "Recommendation not found")
    siblings = db.query(ProductRecommendation).filter_by(line_item_id=rec.line_item_id).all()
    for sib in siblings:
        sib.is_selected_by_engineer = sib.recommendation_id == rec.recommendation_id

    case = db.get(InquiryCase, rec.case_id)
    if case and case.status == "RECEIVED":
        case.status = "IN_REVIEW"
        db.add(CaseStatusHistory(
            case_id=case.case_id, from_status="RECEIVED", to_status="IN_REVIEW",
            changed_by="engineer",
        ))

    db.commit()

    quotation = _maybe_generate_quotation(db, rec.case_id)
    return {
        "status": "approved",
        "model_code": rec.model_code or rec.family_code,
        "quotation_generated": quotation is not None,
    }


@router.post("/recommendations/{recommendation_id}/reject", response_model=dict)
def reject_recommendation(recommendation_id: int, db: Session = Depends(get_db)):
    rec = db.get(ProductRecommendation, recommendation_id)
    if rec is None:
        raise HTTPException(404, "Recommendation not found")
    rec.is_selected_by_engineer = False

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


@router.get("/quotations/download/{filename}")
def download_quotation(filename: str):
    path = os.path.join(QUOTATIONS_DIR, filename)
    if not os.path.isfile(path):
        raise HTTPException(404, "File not found")
    return FileResponse(path, filename=filename, media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")


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
        under_review.filter(~ExtractedLineItem.recommendations.any(ProductRecommendation.is_selected_by_engineer.is_(True)))
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

    if current_user.role == "ADMIN":
        category_rows = (
            db.query(InquiryCase.category, func.count(InquiryCase.case_id))
            .group_by(InquiryCase.category)
            .all()
        )
        result["by_category"] = [{"category": c or "Unassigned", "count": n} for c, n in category_rows]

    return result

@router.get("/review-queue-cases", response_model=list[CaseSummaryOut])
def review_queue_cases(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Grouped-by-case view for the new table UI — one row per case,
    not per line item. A case appears here if ANY of its line items
    still needs a decision (pending or rejected)."""
    query = (
        db.query(InquiryCase)
        .join(ExtractedLineItem, ExtractedLineItem.case_id == InquiryCase.case_id)
        .join(ExtractedLineItem.recommendations)
        .filter(
            ~ExtractedLineItem.recommendations.any(
                ProductRecommendation.is_selected_by_engineer.is_(True)
            )
        )
        .distinct()
    )
    if current_user.role != "ADMIN" and current_user.category:
        my_categories = [c.strip() for c in current_user.category.split(",")]
        query = query.filter(InquiryCase.category.in_(my_categories))
    cases = query.all()

    results = []
    for case in cases:
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
        ))

    # Pending-only cases first, mixed next, fully-rejected cases pushed to the bottom.
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