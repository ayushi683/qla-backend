from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.models.base import Base, utcnow


class ExtractedLineItem(Base):
    __tablename__ = "extracted_line_item"

    line_item_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    case_id: Mapped[int] = mapped_column(
        ForeignKey("inquiry_case.case_id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_document_id: Mapped[int | None] = mapped_column(
        ForeignKey("inquiry_document.document_id"), nullable=True
    )
    line_no: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    customer_tag_no: Mapped[str | None] = mapped_column(String(40), nullable=True)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    equipment_name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    product_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    techtrol_family_hint: Mapped[str | None] = mapped_column(String(20), nullable=True)
    model_code_stated: Mapped[str | None] = mapped_column(String(120), nullable=True)
    techtrol_model_code: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    is_techtrol_model: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    oem_manufacturer: Mapped[str | None] = mapped_column(String(120), nullable=True)
    oem_model_code: Mapped[str | None] = mapped_column(String(120), nullable=True)
    qty: Mapped[Decimal | None] = mapped_column(Numeric(18, 3), nullable=True)
    uom: Mapped[str | None] = mapped_column(String(20), default="NOS")
    range_text: Mapped[str | None] = mapped_column(String(120), nullable=True)
    media: Mapped[str | None] = mapped_column(String(120), nullable=True)
    specific_gravity: Mapped[str | None] = mapped_column(String(40), nullable=True)
    op_temp: Mapped[str | None] = mapped_column(String(80), nullable=True)
    op_pressure: Mapped[str | None] = mapped_column(String(80), nullable=True)
    moc: Mapped[str | None] = mapped_column(String(120), nullable=True)
    process_connection: Mapped[str | None] = mapped_column(String(120), nullable=True)
    cc_distance_mm: Mapped[Decimal | None] = mapped_column(Numeric(18, 3), nullable=True)
    tank_capacity_ltr: Mapped[Decimal | None] = mapped_column(Numeric(18, 3), nullable=True)
    size_or_range: Mapped[str | None] = mapped_column(String(80), nullable=True)
    location_site: Mapped[str | None] = mapped_column(String(200), nullable=True)
    missing_fields_json: Mapped[list | None] = mapped_column(JSON, nullable=True)
    extraction_confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 4), nullable=True)
    extraction_method: Mapped[str | None] = mapped_column(String(40), nullable=True)
    needs_attachment: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    case: Mapped["InquiryCase"] = relationship(back_populates="line_items")
    recommendations: Mapped[list["ProductRecommendation"]] = relationship(
        back_populates="line_item", cascade="all, delete-orphan"
    )
