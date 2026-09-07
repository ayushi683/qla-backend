from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.models.base import Base, utcnow


class OutboundMessage(Base):
    __tablename__ = "outbound_message"

    outbound_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    case_id: Mapped[int] = mapped_column(
        ForeignKey("inquiry_case.case_id", ondelete="CASCADE"), nullable=False, index=True
    )
    draft_id: Mapped[int | None] = mapped_column(ForeignKey("quotation_draft.draft_id"), nullable=True)
    thread_id: Mapped[int | None] = mapped_column(ForeignKey("email_thread.thread_id"), nullable=True)
    channel: Mapped[str] = mapped_column(String(20), nullable=False, default="EMAIL")
    to_emails: Mapped[list | None] = mapped_column(JSON, nullable=True)
    cc_emails: Mapped[list | None] = mapped_column(JSON, nullable=True)
    subject: Mapped[str | None] = mapped_column(String(500), nullable=True)
    body_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    attachment_document_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)
    send_status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING", index=True)
    provider_message_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_detail: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_by: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
