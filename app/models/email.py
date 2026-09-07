from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.models.base import Base, utcnow


class EmailThread(Base):
    __tablename__ = "email_thread"

    thread_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    case_id: Mapped[int | None] = mapped_column(
        ForeignKey("inquiry_case.case_id"), nullable=True, index=True
    )
    graph_conversation_id: Mapped[str | None] = mapped_column(String(200), unique=True, nullable=True)
    subject_normalized: Mapped[str | None] = mapped_column(String(300), nullable=True)
    mailbox: Mapped[str] = mapped_column(String(120), nullable=False)
    first_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_incomplete_thread: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    messages: Mapped[list["EmailMessage"]] = relationship(
        back_populates="thread", cascade="all, delete-orphan"
    )


class EmailMessage(Base):
    __tablename__ = "email_message"

    message_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    thread_id: Mapped[int] = mapped_column(
        ForeignKey("email_thread.thread_id", ondelete="CASCADE"), nullable=False, index=True
    )
    case_id: Mapped[int | None] = mapped_column(
        ForeignKey("inquiry_case.case_id"), nullable=True, index=True
    )
    graph_message_id: Mapped[str | None] = mapped_column(String(200), unique=True, nullable=True)
    internet_message_id: Mapped[str | None] = mapped_column(String(300), nullable=True, index=True)
    in_reply_to: Mapped[str | None] = mapped_column(String(300), nullable=True)
    direction: Mapped[str] = mapped_column(String(10), nullable=False)
    sender_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sender_party_id: Mapped[int | None] = mapped_column(ForeignKey("party.party_id"), nullable=True)
    sender_role_hint: Mapped[str | None] = mapped_column(String(40), nullable=True)
    to_emails: Mapped[list | None] = mapped_column(JSON, nullable=True)
    cc_emails: Mapped[list | None] = mapped_column(JSON, nullable=True)
    subject: Mapped[str | None] = mapped_column(String(500), nullable=True)
    body_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    body_html: Mapped[str | None] = mapped_column(Text, nullable=True)
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    has_attachments: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    importance: Mapped[str | None] = mapped_column(String(20), nullable=True)
    raw_blob_uri: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    thread: Mapped[EmailThread] = relationship(back_populates="messages")
    documents: Mapped[list["InquiryDocument"]] = relationship(back_populates="message")
