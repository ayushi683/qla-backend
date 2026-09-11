from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, utcnow


class CatalogueProduct(Base):
    __tablename__ = "catalogue_product"

    catalogue_product_id: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, autoincrement=True
    )
    model_code_prefix: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    brand_owner: Mapped[str] = mapped_column(String(40), nullable=False, default="TECHTROL")
    category: Mapped[str | None] = mapped_column(String(80), nullable=True)
    subcategory: Mapped[str | None] = mapped_column(String(80), nullable=True)
    sensing_principle: Mapped[str | None] = mapped_column(String(80), nullable=True)
    is_configurable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    doc_code: Mapped[str | None] = mapped_column(String(80), nullable=True)
    source_pdf_name: Mapped[str | None] = mapped_column(String(260), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class ProductRecommendation(Base):
    __tablename__ = "product_recommendation"

    recommendation_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    case_id: Mapped[int] = mapped_column(
        ForeignKey("inquiry_case.case_id"), nullable=False, index=True
    )
    line_item_id: Mapped[int] = mapped_column(
        ForeignKey("extracted_line_item.line_item_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rank_no: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    match_level: Mapped[str] = mapped_column(String(5), nullable=False)
    catalogue_product_id: Mapped[int | None] = mapped_column(
        ForeignKey("catalogue_product.catalogue_product_id"), nullable=True
    )
    family_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    model_code: Mapped[str | None] = mapped_column(String(120), nullable=True)
    confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 4), nullable=True)
    rationale: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    is_selected_by_engineer: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    decided_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    line_item: Mapped["ExtractedLineItem"] = relationship(back_populates="recommendations")
    citations: Mapped[list["EvidenceCitation"]] = relationship(
        back_populates="recommendation", cascade="all, delete-orphan"
    )


class EvidenceCitation(Base):
    __tablename__ = "evidence_citation"

    citation_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    recommendation_id: Mapped[int] = mapped_column(
        ForeignKey("product_recommendation.recommendation_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_type: Mapped[str] = mapped_column(String(30), nullable=False)
    document_id: Mapped[int | None] = mapped_column(
        ForeignKey("inquiry_document.document_id"), nullable=True
    )
    catalogue_product_id: Mapped[int | None] = mapped_column(
        ForeignKey("catalogue_product.catalogue_product_id"), nullable=True
    )
    page_no: Mapped[int | None] = mapped_column(Integer, nullable=True)
    section_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    snippet: Mapped[str | None] = mapped_column(String(500), nullable=True)
    score: Mapped[Decimal | None] = mapped_column(Numeric(5, 4), nullable=True)

    recommendation: Mapped[ProductRecommendation] = relationship(back_populates="citations")
