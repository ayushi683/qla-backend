from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, utcnow


class Party(Base):
    __tablename__ = "party"

    party_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    party_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    gstin: Mapped[str | None] = mapped_column(String(30), nullable=True)
    country: Mapped[str | None] = mapped_column(String(60), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    erp_sync_status: Mapped[str | None] = mapped_column(String(20), default="NONE")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    cases_as_customer: Mapped[list["InquiryCase"]] = relationship(
        back_populates="customer",
        foreign_keys="InquiryCase.customer_party_id",
    )


