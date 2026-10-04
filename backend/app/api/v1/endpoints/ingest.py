"""
SkyTrace Ingestion Endpoints
----------------------------
Receives raw weather reports from multiple intake channels:
1. Citizen Mobile Reporting Portal (/ingest/citizen)
2. Social Media Weather Feeds & Hashtags (/ingest/social)
3. IMD Automated Weather Stations & Radar Streams (/ingest/imd)

Every payload is staged in `raw_reports` before being processed through
the Deduplication & Preprocessing pipeline into canonical `events`.
"""

from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models.raw_report import RawReport
from backend.app.services.preprocessor import (
    normalize_utc_timestamp,
    detect_report_language,
    resolve_district_and_state,
    get_source_credibility,
)
from backend.app.services.embedding import embed_text
from backend.app.services.deduplication import process_report_deduplication

router = APIRouter(prefix="/ingest", tags=["Ingestion"])


# Pydantic Schemas
class CitizenReportIn(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0, description="GPS Latitude")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="GPS Longitude")
    raw_text: str = Field(..., min_length=5, description="Observed weather hazard description")
    category_hint: Optional[str] = None
    severity_hint: Optional[str] = "moderate"
    has_verifiable_media: bool = False
    media_urls: List[str] = []
    reporter_handle: Optional[str] = "#CIT-FIELD"
    is_anonymous: bool = False
    location_name: Optional[str] = None


class SocialReportIn(BaseModel):
    handle: str
    post_text: str
    latitude: float
    longitude: float
    has_verifiable_media: bool = False
    media_urls: List[str] = []
    source_platform: Optional[str] = "X/Twitter"


class IMDReportIn(BaseModel):
    station_code: str
    sensor_type: str  # e.g. "DOPPLER_RADAR", "AWS_RAIN_GAUGE", "ANEMOMETER"
    reading_summary: str
    latitude: float
    longitude: float
    recorded_at: Optional[datetime] = None


class IngestionResponse(BaseModel):
    raw_report_id: str
    event_id: str
    event_code: str
    verification_status: str
    trust_score: float
    report_count: int
    is_new_event: bool
    district: str
    state: str
    message: str


@router.post("/citizen", response_model=IngestionResponse, status_code=status.HTTP_201_CREATED)
def ingest_citizen_report(payload: CitizenReportIn, db: Session = Depends(get_db)):
    """Ingests, stages, and deduplicates a civic weather report from the public observer portal."""
    now_utc = normalize_utc_timestamp()
    lang = detect_report_language(payload.raw_text)
    district, state = resolve_district_and_state(payload.latitude, payload.longitude, payload.raw_text)

    # 1. Stage in raw_reports with two-tier credibility (0.65 for anonymous, 0.72 for identified observer handle)
    embedding_vec = embed_text(payload.raw_text)
    cred = get_source_credibility("citizen", is_anonymous=payload.is_anonymous)
    handle = "#CIT-ANON" if payload.is_anonymous else (payload.reporter_handle or "#CIT-FIELD")
    raw_report = RawReport(
        source_type="citizen",
        source_handle=handle,
        source_credibility=cred,
        raw_text=payload.raw_text,
        language=lang,
        has_verifiable_media=payload.has_verifiable_media,
        media_urls=payload.media_urls,
        reported_at=now_utc,
        latitude=payload.latitude,
        longitude=payload.longitude,
        location_name=payload.location_name or f"{district}, {state}",
        district=district,
        state=state,
        status="pending",
        embedding=embedding_vec
    )
    db.add(raw_report)
    db.flush()

    # 2. Run through Deduplication Engine
    canonical_event, is_new = process_report_deduplication(db, raw_report)

    return IngestionResponse(
        raw_report_id=str(raw_report.id),
        event_id=str(canonical_event.id),
        event_code=canonical_event.event_code,
        verification_status=canonical_event.verification_status,
        trust_score=canonical_event.trust_score,
        report_count=canonical_event.report_count,
        is_new_event=is_new,
        district=canonical_event.district or district,
        state=canonical_event.state or state,
        message="Citizen report successfully ingested and corroborated into canonical event stream."
    )


@router.post("/social", response_model=IngestionResponse, status_code=status.HTTP_201_CREATED)
def ingest_social_report(payload: SocialReportIn, db: Session = Depends(get_db)):
    """Ingests simulated weather report tagged from social platforms (#IMD, #CycloneWarning)."""
    now_utc = normalize_utc_timestamp()
    lang = detect_report_language(payload.post_text)
    district, state = resolve_district_and_state(payload.latitude, payload.longitude, payload.post_text)

    embedding_vec = embed_text(payload.post_text)
    cred = get_source_credibility("social")
    raw_report = RawReport(
        source_type="social",
        source_handle=payload.handle,
        source_credibility=cred,
        raw_text=payload.post_text,
        language=lang,
        has_verifiable_media=payload.has_verifiable_media,
        media_urls=payload.media_urls,
        reported_at=now_utc,
        latitude=payload.latitude,
        longitude=payload.longitude,
        location_name=f"{district}, {state}",
        district=district,
        state=state,
        status="pending",
        embedding=embedding_vec
    )
    db.add(raw_report)
    db.flush()

    canonical_event, is_new = process_report_deduplication(db, raw_report)

    return IngestionResponse(
        raw_report_id=str(raw_report.id),
        event_id=str(canonical_event.id),
        event_code=canonical_event.event_code,
        verification_status=canonical_event.verification_status,
        trust_score=canonical_event.trust_score,
        report_count=canonical_event.report_count,
        is_new_event=is_new,
        district=canonical_event.district or district,
        state=canonical_event.state or state,
        message="Social post staged and deduplicated into operational stream."
    )


@router.post("/imd", response_model=IngestionResponse, status_code=status.HTTP_201_CREATED)
def ingest_imd_telemetry(payload: IMDReportIn, db: Session = Depends(get_db)):
    """Ingests official IMD AWS gauge or radar telemetry feed."""
    event_time = normalize_utc_timestamp(payload.recorded_at)
    district, state = resolve_district_and_state(payload.latitude, payload.longitude, payload.reading_summary)

    embedding_vec = embed_text(payload.reading_summary)
    cred = get_source_credibility("imd_aws")
    raw_report = RawReport(
        source_type="imd_aws",
        source_handle=f"IMD-{payload.station_code}",
        source_credibility=cred,
        raw_text=f"[IMD {payload.sensor_type}] {payload.reading_summary}",
        language="en",
        has_verifiable_media=False,
        media_urls=[],
        reported_at=event_time,
        latitude=payload.latitude,
        longitude=payload.longitude,
        location_name=f"IMD AWS {payload.station_code}, {district}",
        district=district,
        state=state,
        status="pending",
        embedding=embedding_vec
    )
    db.add(raw_report)
    db.flush()

    canonical_event, is_new = process_report_deduplication(db, raw_report)

    return IngestionResponse(
        raw_report_id=str(raw_report.id),
        event_id=str(canonical_event.id),
        event_code=canonical_event.event_code,
        verification_status=canonical_event.verification_status,
        trust_score=canonical_event.trust_score,
        report_count=canonical_event.report_count,
        is_new_event=is_new,
        district=canonical_event.district or district,
        state=canonical_event.state or state,
        message="Authoritative IMD sensor reading merged into active ground-truth layer."
    )
