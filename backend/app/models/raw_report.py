import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Boolean, DateTime, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from pgvector.sqlalchemy import Vector
from backend.app.core.database import Base


class RawReport(Base):
    __tablename__ = "raw_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_type = Column(String(50), nullable=False)  # citizen, social, imd_aws, traffic_cctv, emergency_112
    source_handle = Column(String(100), nullable=True)  # @IndWeatherWatch, #CIT-8821, IMD-AWS-PURI
    source_credibility = Column(Float, default=0.5)  # 0.0 to 1.0 based on tier
    raw_text = Column(Text, nullable=False)
    language = Column(String(10), default="en")  # en, hi, or
    
    # Requirement addition #2: boolean has_verifiable_media replacing undefined cv score
    has_verifiable_media = Column(Boolean, default=False)
    media_urls = Column(JSON, default=list)
    
    reported_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    location_name = Column(String(255), nullable=True)
    district = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    
    status = Column(String(30), default="pending")  # pending, merged, rejected
    embedding = Column(Vector(384), nullable=True)  # 384-dim sentence-transformer embedding
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
