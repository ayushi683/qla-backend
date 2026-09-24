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

if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine = create_engine(DATABASE_URL, connect_args=connect_args)
else:
    # pyodbc login timeout (seconds) — a hung SQL handshake used to freeze /api/auth/login
    connect_args = {"timeout": 8}
    engine = create_engine(
        DATABASE_URL,
        connect_args=connect_args,
        pool_pre_ping=True,
        pool_timeout=10,
        pool_recycle=1800,
    )
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
