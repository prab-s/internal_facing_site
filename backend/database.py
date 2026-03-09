"""
Database configuration. Uses relative path so backend points to SQLite at
../data/fans.db when run from backend/. TODO: units could be standardised later
(e.g. flow in m³/s, pressure in Pa) in a migration or config layer.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Resolve path: from backend/ we use ../data/fans.db
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(os.path.dirname(BASE_DIR), "data")
os.makedirs(DATA_DIR, exist_ok=True)
DB_PATH = os.path.join(DATA_DIR, "fans.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables if they do not exist. MVP: no migrations, just create on startup."""
    from backend import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
