"""
SkyTrace Main FastAPI Application
---------------------------------
Tactical disaster weather verification platform backend.
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.core.config import settings
from backend.app.core.database import engine, Base, SessionLocal
from backend.app.api.v1.api import api_router
from backend.app.models.event import Event
from backend.app.services.seed_data import generate_seed_dataset
from backend.app.models.raw_report import RawReport
from backend.app.models.user import User
from backend.app.core.security import get_password_hash


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initializes tables, provisions seed accounts and seed dataset if empty."""
    print("[STARTUP] Initializing SkyTrace Tactical Backend...")
    try:
        # Create tables
        Base.metadata.create_all(bind=engine)
        
        # Check if database needs initial seeding
        db = SessionLocal()
        try:
            event_count = db.query(Event).count()
            if event_count == 0:
                print("[SEED] Active events table is empty. Seeding 135 canonical weather incidents...")
                events_data, raw_reports_data = generate_seed_dataset(target_count=135)
                
                # Insert events
                for ed in events_data:
                    ev = Event(**ed)
                    db.add(ev)
                
                from backend.app.models.event import EventReport
                # Insert raw reports and link junctions
                for rd in raw_reports_data:
                    rd_copy = dict(rd)
                    ev_id = rd_copy.pop("event_id", None)
                    rr = RawReport(**rd_copy)
                    db.add(rr)
                    if ev_id:
                        db.add(EventReport(event_id=ev_id, raw_report_id=rr.id))
                
                print(f"[SEED SUCCESS] Seeded {len(events_data)} events and {len(raw_reports_data)} raw reports.")
            else:
                print(f"[DATABASE READY] Database already populated with {event_count} active events.")

            # Ensure all tactical personnel accounts exist in the database with their designated roles
            tactical_users = [
                {
                    "email": "analyst@imd.gov.in",
                    "hashed_password": get_password_hash("SkyTrace@2026!"),
                    "full_name": "S. Patnaik (Lead Meteorological Analyst)",
                    "role": "analyst",
                    "station_id": "#EOC-ODISHA-01"
                },
                {
                    "email": "admin@ndma.gov.in",
                    "hashed_password": get_password_hash("SkyTrace@2026!"),
                    "full_name": "Dr. V. Sharma (Disaster Response Commander)",
                    "role": "admin",
                    "station_id": "#NDMA-HQ-DELHI"
                },
                {
                    "email": "eoc.duty@odisha.gov.in",
                    "hashed_password": get_password_hash("SkyTrace@2026!"),
                    "full_name": "R. Mohanty (State EOC Duty Officer)",
                    "role": "eoc",
                    "station_id": "#SEOC-BHUBANESWAR"
                }
            ]
            for u in tactical_users:
                existing = db.query(User).filter(User.email == u["email"]).first()
                if not existing:
                    db.add(User(**u))
                else:
                    existing.hashed_password = u["hashed_password"]
                    if existing.role != u["role"]:
                        existing.role = u["role"]
            db.commit()
            print("[PERSONNEL READY] Tactical personnel accounts verified (Analyst, Admin, State EOC).")

            # Warm up ML embedding model safely outside Render to prevent memory exhaustion crashes
            if os.getenv("RENDER") is None:
                import threading
                def warmup_embedding():
                    try:
                        from backend.app.services.embedding import get_embedding_model
                        print("[WARMUP] Pre-loading SentenceTransformers embedding model...")
                        get_embedding_model()
                        print("[WARMUP READY] Embedding model loaded into memory for zero-latency queries.")
                    except Exception as w_err:
                        print(f"[WARMUP NOTE] Embedding warmup note: {w_err}")
                threading.Thread(target=warmup_embedding, daemon=True).start()
            else:
                print("[WARMUP SKIPPED] Skipping model pre-load on Render instance to conserve memory.")

        except Exception as seed_err:
            db.rollback()
            print(f"[STARTUP NOTE] DB seed skipped or already configured: {seed_err}")
        finally:
            db.close()
    except Exception as e:
        print(f"[STARTUP WARNING] DB connection note: {e}")

    yield
    print("[SHUTDOWN] Terminating SkyTrace Tactical Backend...")


app = FastAPI(
    title="SkyTrace Tactical Disaster Intelligence API",
    description="Operational weather report verification, deduplication, and triage platform for NDMA & IMD.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://skytrace.vercel.app",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API v1 router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["System"])
def health_check():
    """Operational health ping for orchestrator and uptime monitoring."""
    return {
        "status": "HEALTHY",
        "service": "SkyTrace Tactical Disaster Intelligence Platform",
        "version": "1.0.0",
        "radar_feed": "INSAT-3D DOPPLER ONLINE",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
