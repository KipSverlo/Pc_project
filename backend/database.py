import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
url = os.getenv("DATABASE_URL", f"sqlite:///{ROOT / 'store.db'}")
engine = create_engine(url, connect_args={"check_same_thread": False, "timeout": 20})
@event.listens_for(engine, "connect")
def configure_sqlite(connection, record):
    connection.execute("PRAGMA foreign_keys=ON")

SessionLocal = sessionmaker(engine)
class Base(DeclarativeBase):
    pass

