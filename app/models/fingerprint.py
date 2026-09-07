from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, utcnow


class FingerprintIndex(Base):
    __tablename__ = "fingerprint_index"

    fingerprint_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    fingerprint_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    case_id: Mapped[int] = mapped_column(
        ForeignKey("inquiry_case.case_id", ondelete="CASCADE"), nullable=False, index=True
    )
    customer_key: Mapped[str | None] = mapped_column(String(120), nullable=True)
    subject_core: Mapped[str | None] = mapped_column(String(300), nullable=True)
    attachment_hash_set: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    time_bucket: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
