from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, utcnow


class PortalSubmission(Base):
    """Portal exception completion — never store passwords."""

    __tablename__ = "portal_submission"

    portal_submission_id: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, autoincrement=True
    )
    case_id: Mapped[int] = mapped_column(
        ForeignKey("inquiry_case.case_id", ondelete="CASCADE"), nullable=False, index=True
    )
    portal_type: Mapped[str | None] = mapped_column(String(60), nullable=True)
    submitted_by: Mapped[str] = mapped_column(String(80), nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    qtnno: Mapped[str | None] = mapped_column(String(20), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    evidence_document_id: Mapped[int | None] = mapped_column(
        ForeignKey("inquiry_document.document_id"), nullable=True
    )
