from datetime import datetime
from decimal import Decimal
from typing import Optional, List

from pydantic import BaseModel, ConfigDict

# Every schema below uses protected_namespaces=() because several fields
# are named "model_code" — Pydantic reserves the "model_" prefix for its
# own internals by default, so this just silences that (harmless) warning.
_CONFIG = ConfigDict(from_attributes=True, protected_namespaces=())


class LoginRequest(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    model_config = _CONFIG
    user_id: int
    email: str
    display_name: str
    role: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class RecommendationOut(BaseModel):
    model_config = _CONFIG
    recommendation_id: int
    line_item_id: int
    case_id: int
    rank_no: int
    model_code: Optional[str] = None
    family_code: Optional[str] = None
    confidence: Optional[Decimal] = None
    rationale: Optional[str] = None
    is_selected_by_engineer: Optional[bool] = None


class LineItemOut(BaseModel):
    model_config = _CONFIG
    line_item_id: int
    case_id: int
    line_no: int
    customer_tag_no: Optional[str] = None
    description: Optional[str] = None
    equipment_name: Optional[str] = None
    product_type: Optional[str] = None
    qty: Optional[Decimal] = None
    uom: Optional[str] = None
    range_text: Optional[str] = None
    moc: Optional[str] = None
    recommendations: List[RecommendationOut] = []

class StatusHistoryEntry(BaseModel):
    model_config = _CONFIG
    from_status: Optional[str] = None
    to_status: str
    changed_at: datetime

class CaseOut(BaseModel):
    model_config = _CONFIG
    case_id: int
    internal_ref: str
    status: str
    project_name: Optional[str] = None
    enq_no_customer: Optional[str] = None
    enq_received_at: Optional[datetime] = None
    match_confidence: Optional[Decimal] = None
    customer_name: Optional[str] = None
    status_history: list[StatusHistoryEntry] = []


class QuotationLineOut(BaseModel):
    model_config = _CONFIG
    line_item_id: int
    line_no: int
    model_code: Optional[str] = None
    description: Optional[str] = None
    qty: Optional[str] = None
    uom: Optional[str] = None
    technical_spec_text: Optional[str] = None


class DocumentOut(BaseModel):
    model_config = _CONFIG
    document_id: int
    case_id: int
    file_name: str
    doc_role: str
    content_type: Optional[str] = None
    size_bytes: Optional[int] = None
    created_at: datetime


class IngestMetadata(BaseModel):
    """The JSON metadata part of an ingestion request. Sent as a form
    field named 'metadata' (JSON-encoded string) alongside file uploads,
    since this endpoint accepts multipart/form-data (needed for the
    attached enquiry PDFs)."""
    mailbox: str
    internal_ref: Optional[str] = None  # auto-generated if not supplied
    graph_conversation_id: Optional[str] = None
    subject: Optional[str] = None
    sender_email: Optional[str] = None
    sender_name: Optional[str] = None
    body_text: Optional[str] = None
    to_emails: Optional[List[str]] = None
    cc_emails: Optional[List[str]] = None
    received_at: Optional[datetime] = None
    project_name: Optional[str] = None
    enq_no_customer: Optional[str] = None
    customer_email: Optional[str] = None
    customer_name: Optional[str] = None


class IngestResponse(BaseModel):
    case_id: int
    internal_ref: str
    thread_id: int
    message_id: int
    documents_saved: int


class QuotationOut(BaseModel):
    model_config = _CONFIG
    draft_id: int
    revision_no: int
    status: str
    pricing_blank: bool
    docx_blob_uri: Optional[str] = None


class OutboundMessageOut(BaseModel):
    model_config = _CONFIG
    outbound_id: int
    to_emails: Optional[list] = None
    subject: Optional[str] = None
    body_text: Optional[str] = None
    send_status: str


class CaseDetailOut(CaseOut):
    line_items: List[LineItemOut] = []
    quotation: Optional[QuotationOut] = None


class QuotationDetailOut(BaseModel):
    case: CaseOut
    quotation: QuotationOut
    lines: List[QuotationLineOut]
    outbound: Optional[OutboundMessageOut] = None


class EditRecommendationRequest(BaseModel):
    model_config = _CONFIG
    model_code: Optional[str] = None
    rationale: Optional[str] = None

class CaseSummaryOut(BaseModel):
    model_config = _CONFIG
    case_id: int
    internal_ref: str
    customer_name: Optional[str] = None
    project_name: Optional[str] = None
    items_count: int
    top_confidence: Optional[Decimal] = None
    has_pending: bool
    has_rejected: bool

class EnquiryEmailOut(BaseModel):
    model_config = _CONFIG
    subject: Optional[str] = None
    sender_email: Optional[str] = None
    body_text: Optional[str] = None
    received_at: Optional[datetime] = None

class UserCreateRequest(BaseModel):
    email: str
    display_name: str
    role: str = "ENGINEER"


class UserUpdateRequest(BaseModel):
    role: Optional[str] = None
    is_enabled: Optional[bool] = None


class UserListOut(BaseModel):
    model_config = _CONFIG
    user_id: int
    email: str
    display_name: str
    role: str
    is_enabled: bool
    last_login_at: Optional[datetime] = None
    category: Optional[str] = None

class EmailUpdateRequest(BaseModel):
    subject: Optional[str] = None
    body_text: Optional[str] = None

class RevisionSummary(BaseModel):
    model_config = _CONFIG
    case_id: int
    internal_ref: str
    revision_no: int
    status: str
    enq_received_at: Optional[datetime] = None

class QtnGroupOut(BaseModel):
    qtnno: Optional[str] = None
    fyear: Optional[str] = None
    revisions: list[RevisionSummary] = []
    documents: list[DocumentOut] = []

class QuotationLineUpdateRequest(BaseModel):
    model_code: Optional[str] = None
    description: Optional[str] = None
    qty: Optional[str] = None
    technical_spec_text: Optional[str] = None

class PricingLineInput(BaseModel):
    quote_line_id: int
    unit_price: Optional[Decimal] = None
    discount_pct: Optional[Decimal] = None


class PricingUpdateRequest(BaseModel):
    currency_code: str = "INR"
    discount_pct: Optional[Decimal] = None
    tax_pct: Optional[Decimal] = None
    freight_amount: Optional[Decimal] = None
    validity_days: Optional[int] = None
    notes: Optional[str] = None
    lines: list[PricingLineInput] = []


class PricingLineOut(BaseModel):
    model_config = _CONFIG
    pricing_line_id: int
    quote_line_id: Optional[int] = None
    unit_price: Optional[Decimal] = None
    line_total: Optional[Decimal] = None
    discount_pct: Optional[Decimal] = None


class PricingSnapshotOut(BaseModel):
    model_config = _CONFIG
    pricing_id: int
    currency_code: str
    discount_pct: Optional[Decimal] = None
    tax_pct: Optional[Decimal] = None
    freight_amount: Optional[Decimal] = None
    grand_total: Optional[Decimal] = None
    validity_days: Optional[int] = None
    notes: Optional[str] = None
    entered_by: str
    lines: list[PricingLineOut] = []

class PricingLineInput(BaseModel):
    quote_line_id: int
    unit_price: Optional[Decimal] = None
    discount_pct: Optional[Decimal] = None


class PricingUpdateRequest(BaseModel):
    currency_code: str = "INR"
    discount_pct: Optional[Decimal] = None
    tax_pct: Optional[Decimal] = None
    freight_amount: Optional[Decimal] = None
    validity_days: Optional[int] = None
    notes: Optional[str] = None
    lines: list[PricingLineInput] = []


class PricingLineOut(BaseModel):
    model_config = _CONFIG
    pricing_line_id: int
    quote_line_id: Optional[int] = None
    unit_price: Optional[Decimal] = None
    line_total: Optional[Decimal] = None
    discount_pct: Optional[Decimal] = None


class PricingSnapshotOut(BaseModel):
    model_config = _CONFIG
    pricing_id: int
    currency_code: str
    discount_pct: Optional[Decimal] = None
    tax_pct: Optional[Decimal] = None
    freight_amount: Optional[Decimal] = None
    grand_total: Optional[Decimal] = None
    validity_days: Optional[int] = None
    notes: Optional[str] = None
    entered_by: str
    lines: list[PricingLineOut] = []