from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, utcnow


class InquiryCase(Base):
    __tablename__ = "inquiry_case"

    case_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    internal_ref: Mapped[str] = mapped_column(String(40), unique=True, nullable=False, index=True)
    qtnno: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    fyear: Mapped[str | None] = mapped_column(String(10), nullable=True, index=True)
    mode: Mapped[str] = mapped_column(String(20), nullable=False, default="NEW")
    flow: Mapped[str] = mapped_column(String(40), nullable=False, default="STANDARD")
    queue: Mapped[str] = mapped_column(String(40), nullable=False, default="STANDARD_REVIEW")
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="RECEIVED", index=True)
    exception_type: Mapped[str] = mapped_column(String(40), nullable=False, default="NONE")
    revision_no: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    folder_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    source_folder_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    customer_party_id: Mapped[int | None] = mapped_column(
        ForeignKey("party.party_id"), nullable=True
    )
    agent_party_id: Mapped[int | None] = mapped_column(ForeignKey("party.party_id"), nullable=True)
    end_user_party_id: Mapped[int | None] = mapped_column(
        ForeignKey("party.party_id"), nullable=True
    )
    preby_party_id: Mapped[int | None] = mapped_column(ForeignKey("party.party_id"), nullable=True)
    project_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    category: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    # which business category this enquiry falls under — used to filter engineer dashboards
    enq_no_customer: Mapped[str | None] = mapped_column(String(80), nullable=True)
    enq_received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    export_yn: Mapped[str | None] = mapped_column(String(1), default="N")
    currency_code: Mapped[str | None] = mapped_column(String(3), default="INR")
    fingerprint_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    identity_confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 4), nullable=True)
    match_confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 4), nullable=True)
    completeness_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 4), nullable=True)
    portal_detected: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    portal_type: Mapped[str | None] = mapped_column(String(60), nullable=True)
    cutover_batch_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    erp_bound_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    dispatched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
    created_by: Mapped[str | None] = mapped_column(String(80), default="system")
    updated_by: Mapped[str | None] = mapped_column(String(80), default="system")

    customer: Mapped["Party | None"] = relationship(
        foreign_keys=[customer_party_id], back_populates="cases_as_customer"
    )
    status_history: Mapped[list["CaseStatusHistory"]] = relationship(
        back_populates="case", cascade="all, delete-orphan"
    )
    documents: Mapped[list["InquiryDocument"]] = relationship(
        back_populates="case", cascade="all, delete-orphan"
    )
    line_items: Mapped[list["ExtractedLineItem"]] = relationship(
        back_populates="case", cascade="all, delete-orphan"
    )
    drafts: Mapped[list["QuotationDraft"]] = relationship(
        back_populates="case", cascade="all, delete-orphan"
    )


class CaseStatusHistory(Base):
    __tablename__ = "case_status_history"

    history_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    case_id: Mapped[int] = mapped_column(
        ForeignKey("inquiry_case.case_id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_status: Mapped[str | None] = mapped_column(String(40), nullable=True)
    to_status: Mapped[str] = mapped_column(String(40), nullable=False)
    changed_by: Mapped[str] = mapped_column(String(80), nullable=False)
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    case: Mapped[InquiryCase] = relationship(back_populates="status_history")
