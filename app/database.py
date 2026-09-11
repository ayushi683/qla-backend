from dotenv import load_dotenv
load_dotenv()

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import sqlite_compat  # noqa: F401  (BigInteger -> INTEGER fix for SQLite)
from app.models.base import Base

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATABASE_URL = os.environ.get(
    "DATABASE_URL", f"sqlite:///{os.path.join(BASE_DIR, 'instance', 'qla.db')}"
)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    # Import every model so SQLAlchemy sees all tables before create_all().
    from app import models as _models  # noqa: F401
    Base.metadata.create_all(bind=engine)
