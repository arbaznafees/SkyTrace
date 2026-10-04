"""
SkyTrace Database Initialization & Seed Script
----------------------------------------------
Initializes PostgreSQL with PostGIS and pgvector extensions, creates all tables,
registers default analyst/admin users, and populates the database with 135+
synthetic Indian weather events with synthetic ground-truth trust labels.
"""

import sys
import os
from sqlalchemy import text
from passlib.context import CryptContext

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../")))

from backend.app.core.database import engine, SessionLocal, Base
from backend.app.models.user import User
from backend.app.models.event import Event, EventReport
from backend.app.models.raw_report import RawReport
from backend.app.models.audit_log import AuditLog
from backend.app.services.seed_data import generate_seed_dataset

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def init_extensions_and_tables():
    """Initializes PostGIS and pgvector extensions and creates schema tables."""
    print("Connecting to database...")
    with engine.connect() as conn:
        print("Ensuring PostGIS and pgvector extensions are active...")
        try:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            conn.commit()
            print("Extensions verified successfully.")
        except Exception as e:
            print(f"Extension initialization note: {e}")
            conn.rollback()

    print("Creating all tables via SQLAlchemy metadata...")
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully.")


def seed_users(db):
    """Creates default analyst and admin accounts for RBAC authentication."""
    users_to_seed = [
        {
            "email": "analyst@skytrace.gov.in",
            "full_name": "Cmdr. S. Vance",
            "password": "analyst_duty_pass_2026",
            "role": "analyst",
            "station_id": "#EOC-ODISHA-01"
        },
        {
            "email": "admin@skytrace.gov.in",
            "full_name": "Dr. R. Sengupta (Watch Director)",
            "password": "admin_duty_pass_2026",
            "role": "admin",
            "station_id": "#NDMA-HQ-DELHI"
        },
        {
            "email": "duty.analyst@noaa.gov",  # Matches reference login screen example
            "full_name": "Senior Met Specialist Vance",
            "password": "analyst_duty_pass_2026",
            "role": "analyst",
            "station_id": "#EOC-EAST-DECK"
        }
    ]

    for u_data in users_to_seed:
        existing = db.query(User).filter(User.email == u_data["email"]).first()
        if not existing:
            new_user = User(
                email=u_data["email"],
                full_name=u_data["full_name"],
                hashed_password=pwd_context.hash(u_data["password"]),
                role=u_data["role"],
                station_id=u_data["station_id"]
            )
            db.add(new_user)
            print(f"Created default user: {u_data['email']} [{u_data['role']}]")
    db.commit()


def seed_database():
    """Populates the database with the Phase 1 seed dataset."""
    db = SessionLocal()
    try:
        # Check existing count
        existing_count = db.query(Event).count()
        if existing_count > 0:
            print(f"Database already contains {existing_count} events. Skipping redundant seed.")
            return

        print("Generating 135 synthetic Indian weather reports & canonical events...")
        events_data, raw_reports_data = generate_seed_dataset(target_count=135)

        raw_reports_map = {}
        for r_data in raw_reports_data:
            report_obj = RawReport(
                id=r_data["id"],
                source_type=r_data["source_type"],
                source_handle=r_data["source_handle"],
                source_credibility=r_data["source_credibility"],
                raw_text=r_data["raw_text"],
                language=r_data["language"],
                has_verifiable_media=r_data["has_verifiable_media"],
                media_urls=r_data["media_urls"],
                reported_at=r_data["reported_at"],
                latitude=r_data["latitude"],
                longitude=r_data["longitude"],
                location_name=r_data["location_name"],
                district=r_data["district"],
                state=r_data["state"],
                status=r_data["status"],
            )
            db.add(report_obj)
            raw_reports_map[r_data["id"]] = r_data["event_id"]

        db.flush()
        print(f"Staged {len(raw_reports_data)} raw reports.")

        for e_data in events_data:
            # PostGIS point geometry: POINT(longitude latitude)
            geom_wkt = f"SRID=4326;POINT({e_data['longitude']} {e_data['latitude']})"
            
            event_obj = Event(
                id=e_data["id"],
                event_code=e_data["event_code"],
                primary_category=e_data["primary_category"],
                severity=e_data["severity"],
                latitude=e_data["latitude"],
                longitude=e_data["longitude"],
                geom=geom_wkt,
                location_name=e_data["location_name"],
                district=e_data["district"],
                state=e_data["state"],
                report_count=e_data["report_count"],
                trust_score=e_data["trust_score"],
                verification_status=e_data["verification_status"],
                synthetic_ground_truth=e_data["synthetic_ground_truth"],
                has_verifiable_media=e_data["has_verifiable_media"],
                headline=e_data["headline"],
                summary=e_data["summary"],
                conflict_note=e_data["conflict_note"],
                sensor_ref=e_data["sensor_ref"],
                action_taken=e_data["action_taken"],
                first_reported_at=e_data["first_reported_at"],
                last_updated_at=e_data["last_updated_at"],
                event_date=e_data["event_date"],
            )
            db.add(event_obj)

        db.flush()

        # Link junction table records
        for raw_id, evt_id in raw_reports_map.items():
            junction = EventReport(
                event_id=evt_id,
                raw_report_id=raw_id,
                similarity_score=1.0,
                distance_km=0.0
            )
            db.add(junction)

        db.commit()
        print(f"Successfully seeded {len(events_data)} canonical events into database.")

        # Log simulated dispatch audit records for events marked with action_taken
        for e_data in events_data:
            if e_data["action_taken"] != "none":
                action_name = "SIMULATED_SACHET_BROADCAST" if e_data["action_taken"] == "sachet_broadcast" else "SIMULATED_NDMA_ESCALATION"
                audit = AuditLog(
                    event_id=e_data["id"],
                    action=action_name,
                    actor="system_auto_dispatch@skytrace.gov.in",
                    payload={
                        "event_code": e_data["event_code"],
                        "category": e_data["primary_category"],
                        "district": e_data["district"],
                        "state": e_data["state"],
                        "trust_score": e_data["trust_score"],
                        "simulation": True,
                        "disclaimer": "Simulated dispatch for operational exercise; external live systems not triggered."
                    },
                    notes=f"Automated test dispatch logged for {e_data['event_code']} based on high trust score."
                )
                db.add(audit)
        db.commit()

        # Seed users
        seed_users(db)

        # Print summary distribution
        verified_count = sum(1 for e in events_data if e["verification_status"] == "verified")
        pending_count = sum(1 for e in events_data if e["verification_status"] == "pending_triage")
        rejected_count = sum(1 for e in events_data if e["verification_status"] == "rejected")
        print("\n--- SEED DATASET SUMMARY ---")
        print(f"Total Canonical Events: {len(events_data)}")
        print(f"Total Constituent Raw Reports: {len(raw_reports_data)}")
        print(f"Verified Ground Truth: {verified_count}")
        print(f"Pending Human Triage: {pending_count}")
        print(f"Noise / Rejected: {rejected_count}")
        print(f"Synthetic Ground Truth Positive (1): {sum(1 for e in events_data if e['synthetic_ground_truth'] == 1)}")
        print(f"Synthetic Ground Truth Negative (0): {sum(1 for e in events_data if e['synthetic_ground_truth'] == 0)}")
        print("----------------------------\n")

    finally:
        db.close()


if __name__ == "__main__":
    init_extensions_and_tables()
    db = SessionLocal()
    seed_users(db)
    db.close()
    seed_database()
