import uuid
from datetime import datetime, timezone, date
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Date, Text, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from geoalchemy2 import Geometry
from backend.app.core.database import Base


class Event(Base):
    __tablename__ = "events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_code = Column(String(50), unique=True, index=True, nullable=False)  # EVT-9042, etc.
    
    # 7 Canonical Atmospheric Categories
    primary_category = Column(String(50), nullable=False, index=True)  # rainfall, thunderstorm, flooding, heatwave, fog, dust_storm, strong_wind
    severity = Column(String(30), default="moderate", index=True)  # mild, moderate, severe
    
    # Geographic Spatial Representation
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    geom = Column(Geometry("POINT", srid=4326), nullable=True)
    location_name = Column(String(255), nullable=True)
    district = Column(String(100), nullable=True, index=True)
    state = Column(String(100), nullable=True, index=True)
    
    # Deduplication & Corroboration Metrics
    report_count = Column(Integer, default=1)
    dedup_centroid_embedding = Column(Vector(384), nullable=True)
    
    # Verification & Trust Scoring
    trust_score = Column(Float, default=0.50)  # 0.00 to 1.00
    verification_status = Column(String(30), default="pending_triage", index=True)  # verified, pending_triage, rejected
    
    # Requirement Addition #1: Synthetic ground-truth label (0 or 1) for Phase 3 Logistic Regression training
    synthetic_ground_truth = Column(Integer, default=0)
    
    # Requirement Addition #2: Boolean media presence
    has_verifiable_media = Column(Boolean, default=False)
    
    # Operational Intelligence Text
    headline = Column(String(255), nullable=False)
    summary = Column(Text, nullable=True)
    conflict_note = Column(Text, nullable=True)
    sensor_ref = Column(String(255), nullable=True)  # e.g., "RADAR: PARADIP-DOPPLER 58dBZ"
    
    # Actions & Dispatches (Simulated NDMA / SACHET per Requirement Addition #3)
    action_taken = Column(String(50), default="none")  # none, ndma_escalated, sachet_broadcast
    
    first_reported_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    event_date = Column(Date, default=lambda: datetime.now(timezone.utc).date(), index=True)

    # Relationships
    reports = relationship("EventReport", back_populates="event", cascade="all, delete-orphan")


class EventReport(Base):
    __tablename__ = "event_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    raw_report_id = Column(UUID(as_uuid=True), ForeignKey("raw_reports.id", ondelete="CASCADE"), nullable=False, index=True)
    
    similarity_score = Column(Float, default=1.0)
    distance_km = Column(Float, default=0.0)
    merged_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    event = relationship("Event", back_populates="reports")
    raw_report = relationship("RawReport")
