"""Commercial pricing tables — ACL restricted; NEVER send to LLM."""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.models.base import Base, utcnow


class PricingSnapshot(Base):
    __tablename__ = "pricing_snapshot"

    pricing_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    case_id: Mapped[int] = mapped_column(
        ForeignKey("inquiry_case.case_id", ondelete="CASCADE"), nullable=False, index=True
    )
    draft_id: Mapped[int | None] = mapped_column(ForeignKey("quotation_draft.draft_id"), nullable=True)
    currency_code: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    validity_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    discount_pct: Mapped[Decimal | None] = mapped_column(Numeric(9, 4), nullable=True)
    tax_pct: Mapped[Decimal | None] = mapped_column(Numeric(9, 4), nullable=True)
    freight_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    grand_total: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    price_source: Mapped[str] = mapped_column(String(40), nullable=False, default="ENGINEER")
    source_document_id: Mapped[int | None] = mapped_column(
        ForeignKey("inquiry_document.document_id"), nullable=True
    )
    entered_by: Mapped[str] = mapped_column(String(80), nullable=False)
    entered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    is_reconfirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    lines: Mapped[list["PricingLine"]] = relationship(
        back_populates="snapshot", cascade="all, delete-orphan"
    )


class PricingLine(Base):
    __tablename__ = "pricing_line"

    pricing_line_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    pricing_id: Mapped[int] = mapped_column(
        ForeignKey("pricing_snapshot.pricing_id", ondelete="CASCADE"), nullable=False, index=True
    )
    quote_line_id: Mapped[int | None] = mapped_column(
        ForeignKey("quotation_line.quote_line_id"), nullable=True
    )
    unit_price: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    line_total: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    discount_pct: Mapped[Decimal | None] = mapped_column(Numeric(9, 4), nullable=True)
    calc_breakdown_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    snapshot: Mapped[PricingSnapshot] = relationship(back_populates="lines")
