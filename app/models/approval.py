from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, utcnow


class ApprovalRecord(Base):
    __tablename__ = "approval_record"

    approval_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    case_id: Mapped[int] = mapped_column(
        ForeignKey("inquiry_case.case_id", ondelete="CASCADE"), nullable=False, index=True
    )
    draft_id: Mapped[int | None] = mapped_column(ForeignKey("quotation_draft.draft_id"), nullable=True)
    approver_party_id: Mapped[int | None] = mapped_column(ForeignKey("party.party_id"), nullable=True)
    decision: Mapped[str] = mapped_column(String(20), nullable=False)
    identity_ok: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    product_ok: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    price_ok: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    reason: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
