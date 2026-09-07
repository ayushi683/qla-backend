"""Legacy backlog tables — kept for existing backlog API compatibility."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.models.base import Base, utcnow


class BacklogCase(Base):
    __tablename__ = "backlog_cases"
    __table_args__ = (UniqueConstraint("qtnno", "source_folder", name="uq_qtnno_folder"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    qtnno: Mapped[str] = mapped_column(String(32), index=True)
    fyear: Mapped[str | None] = mapped_column(String(16), nullable=True)
    mode: Mapped[str] = mapped_column(String(16), default="BACKLOG")
    flow: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    queue: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(32), default="INGESTED", index=True)
    exception_type: Mapped[str] = mapped_column(String(64), default="NONE")
    preby: Mapped[str | None] = mapped_column(String(32), nullable=True)
    source_folder: Mapped[str] = mapped_column(String(512))
    portal_signals: Mapped[list] = mapped_column(JSON, default=list)
    detection_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    completed_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    documents: Mapped[list["CaseDocument"]] = relationship(
        back_populates="case", cascade="all, delete-orphan"
    )
    events: Mapped[list["CaseEvent"]] = relationship(
        back_populates="case", cascade="all, delete-orphan"
    )


class CaseDocument(Base):
    __tablename__ = "case_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("backlog_cases.id", ondelete="CASCADE"))
    file_name: Mapped[str] = mapped_column(String(512))
    relative_path: Mapped[str] = mapped_column(String(1024))
    doc_role: Mapped[str] = mapped_column(String(64), default="OTHER")
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    case: Mapped[BacklogCase] = relationship(back_populates="documents")


class CaseEvent(Base):
    __tablename__ = "case_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("backlog_cases.id", ondelete="CASCADE"))
    event_type: Mapped[str] = mapped_column(String(64))
    actor: Mapped[str] = mapped_column(String(120), default="system")
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    case: Mapped[BacklogCase] = relationship(back_populates="events")
