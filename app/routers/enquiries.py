import json
import os
import time
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, verify_service_key
from app.models.inquiry_case import InquiryCase
from app.models.email import EmailThread, EmailMessage
from app.models.document import InquiryDocument
from app.models.party import Party
from app.enquiry_documents import ENQUIRY_DOCS_DIR, content_type_for, list_related_enquiry_documents, resolve_document_disk_path
from app.schemas import IngestMetadata, IngestResponse, DocumentOut

router = APIRouter(prefix="/api", tags=["enquiries"])


def _generate_internal_ref() -> str:
    # Auto-generated ref for cases created via ingestion without an
    # explicit internal_ref supplied. Prefixed "OTL-" (Outlook) so it's
    # visually distinguishable from manually-numbered legacy case IDs.
    return f"OTL-{int(time.time())}"


@router.post(
    "/enquiries/ingest",
    response_model=IngestResponse,
    dependencies=[Depends(verify_service_key)],
)
async def ingest_enquiry(
    metadata: str = Form(..., description="JSON-encoded IngestMetadata"),
    files: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
):
    """
    Called by the Outlook listener service (NOT by the React frontend)
    when a new enquiry email arrives. Creates the InquiryCase +
    EmailThread + EmailMessage, and stores any attached enquiry
    documents (PDFs etc).

    Auth: X-API-Key header (see INGESTION_API_KEY in .env), not a user JWT
    — this is a service-to-service call, no human is logged in.

    Does NOT create ExtractedLineItem / ProductRecommendation rows —
    that's the AI matching model's job, run separately after this.

    Example (curl):
        curl -X POST http://localhost:8000/api/enquiries/ingest \\
          -H "X-API-Key: <the key>" \\
          -F 'metadata={"mailbox":"enquiries@punetechtrol.com","subject":"RFQ Level Switch","sender_email":"buyer@customer.com","body_text":"..."}' \\
          -F "files=@enquiry.pdf"
    """
    try:
        meta = IngestMetadata.model_validate(json.loads(metadata))
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(400, f"Invalid metadata JSON: {e}")

    internal_ref = meta.internal_ref or _generate_internal_ref()
    if db.query(InquiryCase).filter_by(internal_ref=internal_ref).first():
        raise HTTPException(409, f"Case with internal_ref '{internal_ref}' already exists")

    customer_party_id = None
    if meta.customer_email:
        customer = db.query(Party).filter_by(email=meta.customer_email).first()
        if customer is None:
            customer = Party(
                party_type="CUSTOMER",
                display_name=meta.customer_name or meta.customer_email,
                email=meta.customer_email,
            )
            db.add(customer)
            db.flush()
        customer_party_id = customer.party_id

    case = InquiryCase(
        internal_ref=internal_ref,
        status="RECEIVED",
        project_name=meta.project_name,
        enq_no_customer=meta.enq_no_customer,
        enq_received_at=meta.received_at or datetime.now(timezone.utc),
        customer_party_id=customer_party_id,
        created_by="outlook-listener",
    )
    db.add(case)
    db.flush()

    thread = db.query(EmailThread).filter_by(graph_conversation_id=meta.graph_conversation_id).first() \
        if meta.graph_conversation_id else None
    if thread is None:
        thread = EmailThread(
            case_id=case.case_id,
            graph_conversation_id=meta.graph_conversation_id,
            subject_normalized=meta.subject,
            mailbox=meta.mailbox,
            first_message_at=meta.received_at or datetime.now(timezone.utc),
            last_message_at=meta.received_at or datetime.now(timezone.utc),
        )
        db.add(thread)
        db.flush()

    message = EmailMessage(
        thread_id=thread.thread_id,
        case_id=case.case_id,
        direction="INBOUND",
        sender_email=meta.sender_email,
        to_emails=meta.to_emails,
        cc_emails=meta.cc_emails,
        subject=meta.subject,
        body_text=meta.body_text,
        received_at=meta.received_at or datetime.now(timezone.utc),
        has_attachments=len(files) > 0,
    )
    db.add(message)
    db.flush()

    case_doc_dir = os.path.join(ENQUIRY_DOCS_DIR, str(case.case_id))
    os.makedirs(case_doc_dir, exist_ok=True)

    saved_count = 0
    for f in files:
        if not f.filename:
            continue
        dest_path = os.path.join(case_doc_dir, f.filename)
        content = await f.read()
        with open(dest_path, "wb") as out:
            out.write(content)

        doc = InquiryDocument(
            case_id=case.case_id,
            message_id=message.message_id,
            file_name=f.filename,
            relative_path=os.path.join("enquiry_docs", str(case.case_id), f.filename),
            blob_uri=os.path.join("enquiry_docs", str(case.case_id), f.filename),
            doc_role="ENQUIRY",
            content_type=f.content_type or content_type_for(f.filename),
            size_bytes=len(content),
        )
        db.add(doc)
        saved_count += 1

    db.commit()

    return IngestResponse(
        case_id=case.case_id,
        internal_ref=case.internal_ref,
        thread_id=thread.thread_id,
        message_id=message.message_id,
        documents_saved=saved_count,
    )


@router.get("/cases/{case_id}/documents", response_model=List[DocumentOut], dependencies=[Depends(get_current_user)])
def list_case_documents(case_id: int, db: Session = Depends(get_db)):
    case = db.get(InquiryCase, case_id)
    if case is None:
        raise HTTPException(404, "Case not found")
    return list_related_enquiry_documents(db, case)


@router.get("/documents/download/{document_id}", dependencies=[Depends(get_current_user)])
def download_document(document_id: int, db: Session = Depends(get_db)):
    doc = db.get(InquiryDocument, document_id)
    if doc is None:
        raise HTTPException(404, "Document not found")
    full_path = resolve_document_disk_path(doc)
    if not full_path:
        raise HTTPException(404, "File missing on disk")
    return FileResponse(full_path, filename=doc.file_name, media_type=doc.content_type or "application/octet-stream")
