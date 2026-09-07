from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, utcnow


class QuotationDraft(Base):
    __tablename__ = "quotation_draft"

    draft_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    case_id: Mapped[int] = mapped_column(
        ForeignKey("inquiry_case.case_id", ondelete="CASCADE"), nullable=False, index=True
    )
    revision_no: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    template_id: Mapped[str | None] = mapped_column(String(60), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="DRAFT", index=True)
    pricing_blank: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    technical_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    engineer_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    pdf_blob_uri: Mapped[str | None] = mapped_column(String(500), nullable=True)
    docx_blob_uri: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_by: Mapped[str | None] = mapped_column(String(80), default="agent1")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    case: Mapped["InquiryCase"] = relationship(back_populates="drafts")
    lines: Mapped[list["QuotationLine"]] = relationship(
        back_populates="draft", cascade="all, delete-orphan"
    )


class QuotationLine(Base):
    __tablename__ = "quotation_line"

    quote_line_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    draft_id: Mapped[int] = mapped_column(
        ForeignKey("quotation_draft.draft_id", ondelete="CASCADE"), nullable=False, index=True
    )
    line_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("extracted_line_item.line_item_id"), nullable=True
    )
    line_no: Mapped[int] = mapped_column(Integer, nullable=False)
    model_code: Mapped[str | None] = mapped_column(String(120), nullable=True)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    qty: Mapped[str | None] = mapped_column(String(40), nullable=True)
    uom: Mapped[str | None] = mapped_column(String(20), default="NOS")
    technical_spec_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    draft: Mapped[QuotationDraft] = relationship(back_populates="lines")
