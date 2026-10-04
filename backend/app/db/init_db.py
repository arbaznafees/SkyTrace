"""
SkyTrace Database Initialization & Extension Verification
---------------------------------------------------------
Enables PostGIS and pgvector extensions on Supabase PostgreSQL prior to schema creation.
"""

from sqlalchemy import text
from backend.app.core.database import engine, Base
# Import all models to register metadata
from backend.app.models import event, raw_report, audit_log, user


def init_db():
    """Initializes extensions and metadata tables on the connected database."""
    print("[SUPABASE INIT] Verifying postgis and vector extensions...")
    with engine.connect() as conn:
        try:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            conn.commit()
            print("[SUPABASE INIT] PostGIS & pgvector extensions enabled successfully.")
        except Exception as ext_err:
            print(f"[SUPABASE NOTE] Extension check: {ext_err}")

    print("[SUPABASE INIT] Creating application tables if not existing...")
    Base.metadata.create_all(bind=engine)
    print("[SUPABASE INIT] Database schema ready.")


if __name__ == "__main__":
    init_db()
