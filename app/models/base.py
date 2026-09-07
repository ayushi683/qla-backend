"""QLA SQLAlchemy models — production schema (email → quote → send → ERP)."""

from datetime import datetime, timezone

from sqlalchemy.orm import DeclarativeBase


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    """Shared declarative base for all QLA tables."""

    pass
