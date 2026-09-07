from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, utcnow


class FeedbackEvent(Base):
    __tablename__ = "feedback_event"

    feedback_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    case_id: Mapped[int] = mapped_column(
        ForeignKey("inquiry_case.case_id", ondelete="CASCADE"), nullable=False, index=True
    )
    line_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("extracted_line_item.line_item_id"), nullable=True
    )
    recommendation_id: Mapped[int | None] = mapped_column(
        ForeignKey("product_recommendation.recommendation_id"), nullable=True
    )
    ai_model_code: Mapped[str | None] = mapped_column(String(120), nullable=True)
    engineer_model_code: Mapped[str | None] = mapped_column(String(120), nullable=True)
    reason_code: Mapped[str | None] = mapped_column(String(60), nullable=True)
    comment: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_by: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
