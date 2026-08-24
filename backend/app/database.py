import logging
import sqlite3
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.config import settings
from app.models import Base

logger = logging.getLogger("razorpay_sequencer")

# Async SQLite engine
async_engine = create_async_engine(settings.DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)

# Sync SQLite engine for Streamlit & CLI scripts
sync_engine = create_engine(settings.SYNC_DATABASE_URL, echo=False)
SyncSessionLocal = sessionmaker(bind=sync_engine, expire_on_commit=False)


def run_migrations_sync():
    """Ensure all required columns exist in SQLite database without losing data."""
    try:
        # Extract sqlite path from SYNC_DATABASE_URL (e.g. sqlite:///./sequencer.db -> ./sequencer.db)
        db_path = settings.SYNC_DATABASE_URL.replace("sqlite:///", "")
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # 1. Create tables if not exist
        Base.metadata.create_all(bind=sync_engine)

        # 2. Check and alter mandate_failures table
        cursor.execute("PRAGMA table_info(mandate_failures)")
        mf_cols = {row[1] for row in cursor.fetchall()}
        if "payment_method" not in mf_cols:
            cursor.execute("ALTER TABLE mandate_failures ADD COLUMN payment_method TEXT DEFAULT 'upi_autopay'")

        # 3. Check and alter decisions table
        cursor.execute("PRAGMA table_info(decisions)")
        dec_cols = {row[1] for row in cursor.fetchall()}
        if "regulatory_framework" not in dec_cols:
            cursor.execute("ALTER TABLE decisions ADD COLUMN regulatory_framework TEXT DEFAULT 'NPCI UPI Autopay (4-Attempt Bound)'")
        if "payment_method" not in dec_cols:
            cursor.execute("ALTER TABLE decisions ADD COLUMN payment_method TEXT DEFAULT 'upi_autopay'")
        if "notice_sent_at" not in dec_cols:
            cursor.execute("ALTER TABLE decisions ADD COLUMN notice_sent_at TIMESTAMP")
        if "earliest_retry_at" not in dec_cols:
            cursor.execute("ALTER TABLE decisions ADD COLUMN earliest_retry_at TIMESTAMP")
        if "is_non_peak_scheduled" not in dec_cols:
            cursor.execute("ALTER TABLE decisions ADD COLUMN is_non_peak_scheduled BOOLEAN DEFAULT 0")
        if "expected_value_inr" not in dec_cols:
            cursor.execute("ALTER TABLE decisions ADD COLUMN expected_value_inr FLOAT")
        if "attempt_cost_inr" not in dec_cols:
            cursor.execute("ALTER TABLE decisions ADD COLUMN attempt_cost_inr FLOAT DEFAULT 2.50")
        if "razorpay_order_id" not in dec_cols:
            cursor.execute("ALTER TABLE decisions ADD COLUMN razorpay_order_id TEXT")

        # 4. Check and alter audit_entries table
        cursor.execute("PRAGMA table_info(audit_entries)")
        audit_cols = {row[1] for row in cursor.fetchall()}
        if "llm_model" not in audit_cols:
            cursor.execute("ALTER TABLE audit_entries ADD COLUMN llm_model TEXT")
        if "prev_hash" not in audit_cols:
            cursor.execute("ALTER TABLE audit_entries ADD COLUMN prev_hash TEXT")
        if "row_hash" not in audit_cols:
            cursor.execute("ALTER TABLE audit_entries ADD COLUMN row_hash TEXT")

        conn.commit()
        conn.close()
    except Exception as e:
        logger.warning(f"Auto-migration warning: {e}")


async def init_db():
    run_migrations_sync()
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


def init_db_sync():
    run_migrations_sync()
    Base.metadata.create_all(bind=sync_engine)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
