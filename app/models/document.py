from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, utcnow


class InquiryDocument(Base):
    __tablename__ = "inquiry_document"

    document_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    case_id: Mapped[int] = mapped_column(
        ForeignKey("inquiry_case.case_id", ondelete="CASCADE"), nullable=False, index=True
    )
    message_id: Mapped[int | None] = mapped_column(
        ForeignKey("email_message.message_id"), nullable=True
    )
    file_name: Mapped[str] = mapped_column(String(260), nullable=False)
    relative_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    blob_uri: Mapped[str | None] = mapped_column(String(500), nullable=True)
    doc_role: Mapped[str] = mapped_column(String(30), nullable=False, default="OTHER", index=True)
    content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    content_hash_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    ocr_status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING")
    extracted_text_chars: Mapped[int | None] = mapped_column(Integer, nullable=True)
    extracted_text_uri: Mapped[str | None] = mapped_column(String(500), nullable=True)
    revision_tag: Mapped[str | None] = mapped_column(String(10), nullable=True)
    is_docx_skipped: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    case: Mapped["InquiryCase"] = relationship(back_populates="documents")
    message: Mapped["EmailMessage | None"] = relationship(back_populates="documents")
