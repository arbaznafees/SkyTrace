"""
SkyTrace Deduplication Engine
-----------------------------
Deduplicates incoming raw weather reports against active events using:
1. Spatial candidate filtering: Haversine distance <= 25.0 km
2. Temporal window filtering: Delta t <= 6.0 hours
3. Dense vector cosine similarity: >= 0.72 threshold on 384-dim embeddings

Merges duplicate reports into a single canonical `Event` record, incrementing `report_count`,
updating the centroid coordinates, recalculating the embedding centroid, and linking junction records.
"""

import uuid
from datetime import datetime, timezone, timedelta
from typing import Tuple, Optional
import numpy as np
from sqlalchemy.orm import Session

from backend.app.models.raw_report import RawReport
from backend.app.models.event import Event, EventReport
from backend.app.services.preprocessor import haversine_distance, get_source_credibility
from backend.app.services.embedding import cosine_similarity, embed_text
from backend.app.services.classifier import classify_incident
from backend.app.services.trust_verifier import evaluate_trust


SPATIAL_THRESHOLD_KM = 25.0
TEMPORAL_WINDOW_HOURS = 6.0
SEMANTIC_SIMILARITY_THRESHOLD = 0.70


def derive_live_sensor_agreement(
    db: Session,
    latitude: float,
    longitude: float,
    reported_at: datetime,
    matched_event: Optional[Event] = None,
    incoming_source_type: str = "citizen"
) -> float:
    """
    Derives sensor_agreement (0.0 to 1.0) dynamically at inference time for live incoming reports:
    1. If incoming report is directly an authoritative sensor (imd_aws) -> 0.95
    2. If incoming report is 112 emergency dispatch -> 0.90
    3. If matched_event already has an IMD AWS reading merged into it -> 0.95
    4. Searches database for co-located IMD AWS raw reports within spatial (<= 25 km)
       and temporal (<= 6 hours) windows -> 0.90 (active sensor corroboration)
    5. Baseline default if no co-located sensor report exists -> 0.50 (neutral, no telemetry)
    """
    stype = (incoming_source_type or "").lower()
    if stype == "imd_aws":
        return 0.95
    if stype == "emergency_112":
        return 0.90

    # 1. Check if matched event already contains an IMD AWS reading in its junction
    if matched_event:
        try:
            junction_reports = (
                db.query(RawReport)
                .join(EventReport, EventReport.raw_report_id == RawReport.id)
                .filter(EventReport.event_id == matched_event.id)
                .all()
            )
            for r in junction_reports:
                if r.source_type == "imd_aws":
                    return 0.95
                if r.source_type == "emergency_112":
                    return 0.90
        except Exception:
            pass

    # 2. Query database for co-located IMD AWS raw reports within spatial (<= 25km) & temporal (<= 6h) window
    t_start = reported_at - timedelta(hours=TEMPORAL_WINDOW_HOURS)
    t_end = reported_at + timedelta(hours=TEMPORAL_WINDOW_HOURS)
    try:
        nearby_sensors = (
            db.query(RawReport)
            .filter(
                RawReport.source_type == "imd_aws",
                RawReport.reported_at >= t_start,
                RawReport.reported_at <= t_end
            )
            .all()
        )
        for s in nearby_sensors:
            dist = haversine_distance(latitude, longitude, s.latitude, s.longitude)
            if dist <= SPATIAL_THRESHOLD_KM:
                return 0.90
    except Exception:
        pass

    return 0.50


def process_report_deduplication(db: Session, raw_report: RawReport) -> Tuple[Event, bool]:
    """
    Deduplicates a preprocessed RawReport against existing events in the database.
    Returns (event, is_new_event).
    """
    # Ensure embedding exists
    if not raw_report.embedding:
        raw_report.embedding = embed_text(raw_report.raw_text)

    report_vec = list(raw_report.embedding)
    report_time = raw_report.reported_at or datetime.now(timezone.utc)
    window_start = report_time - timedelta(hours=TEMPORAL_WINDOW_HOURS)
    window_end = report_time + timedelta(hours=TEMPORAL_WINDOW_HOURS)

    # 1. Query candidate events within temporal window
    candidates = db.query(Event).filter(
        Event.last_updated_at >= window_start,
        Event.first_reported_at <= window_end
    ).all()

    best_match_event: Optional[Event] = None
    highest_similarity = -1.0
    best_distance = float("inf")

    # 2. Evaluate spatial distance and semantic vector similarity
    for candidate in candidates:
        dist_km = haversine_distance(
            raw_report.latitude, raw_report.longitude,
            candidate.latitude, candidate.longitude
        )

        if dist_km <= SPATIAL_THRESHOLD_KM:
            if candidate.dedup_centroid_embedding is not None:
                sim = cosine_similarity(report_vec, list(candidate.dedup_centroid_embedding))
            else:
                sim = 0.75  # Fallback if initial centroid wasn't serialized

            # High semantic similarity or very close proximity with moderate similarity
            is_match = (sim >= SEMANTIC_SIMILARITY_THRESHOLD) or (dist_km <= 3.0 and sim >= 0.60)
            
            if is_match and sim > highest_similarity:
                highest_similarity = sim
                best_distance = dist_km
                best_match_event = candidate

    # 3. Merge into existing event
    if best_match_event is not None:
        prev_count = best_match_event.report_count
        new_count = prev_count + 1
        best_match_event.report_count = new_count

        # Recalculate spatial centroid (weighted average)
        best_match_event.latitude = round(
            (best_match_event.latitude * prev_count + raw_report.latitude) / new_count, 5
        )
        best_match_event.longitude = round(
            (best_match_event.longitude * prev_count + raw_report.longitude) / new_count, 5
        )

        # Update PostGIS geometry string
        best_match_event.geom = f"SRID=4326;POINT({best_match_event.longitude} {best_match_event.latitude})"
        best_match_event.last_updated_at = report_time

        # Update media presence
        if raw_report.has_verifiable_media:
            best_match_event.has_verifiable_media = True

        # Re-average centroid embedding
        if best_match_event.dedup_centroid_embedding is not None:
            old_emb = np.array(best_match_event.dedup_centroid_embedding, dtype=np.float32)
            new_emb = np.array(report_vec, dtype=np.float32)
            updated_emb = (old_emb * prev_count + new_emb) / new_count
            norm = np.linalg.norm(updated_emb) or 1.0
            best_match_event.dedup_centroid_embedding = [float(x / norm) for x in updated_emb]

        # Dynamic trust score recalculation via trained Logistic Regression model
        sensor_val = derive_live_sensor_agreement(
            db=db,
            latitude=best_match_event.latitude,
            longitude=best_match_event.longitude,
            reported_at=report_time,
            matched_event=best_match_event,
            incoming_source_type=raw_report.source_type
        )
        trust_res = evaluate_trust(
            source_credibility=max(best_match_event.trust_score, raw_report.source_credibility),
            report_count=new_count,
            has_verifiable_media=best_match_event.has_verifiable_media,
            sensor_agreement=sensor_val,
            event_headline=best_match_event.headline,
            event_summary=best_match_event.summary,
        )
        best_match_event.trust_score = trust_res["trust_score"]
        best_match_event.verification_status = trust_res["verification_status"]
        best_match_event.conflict_note = trust_res["conflict_note"]

        # Create EventReport junction record
        junction = EventReport(
            event_id=best_match_event.id,
            raw_report_id=raw_report.id,
            similarity_score=round(highest_similarity, 3),
            distance_km=round(best_distance, 2)
        )
        db.add(junction)
        raw_report.status = "merged"
        db.commit()
        db.refresh(best_match_event)
        return best_match_event, False

    # 4. No matching event found -> Instantiate new canonical Event
    next_code = f"EVT-{9000 + db.query(Event).count() + 1}"
    
    # Classify category and severity
    classification = classify_incident(raw_report.raw_text)
    inferred_cat = classification["primary_category"]
    severity = classification["severity"]

    # Derive sensor agreement dynamically for new report
    sensor_val = derive_live_sensor_agreement(
        db=db,
        latitude=raw_report.latitude,
        longitude=raw_report.longitude,
        reported_at=report_time,
        matched_event=None,
        incoming_source_type=raw_report.source_type
    )
    headline = f"Active {inferred_cat.title().replace('_', ' ')} Incident - {raw_report.district}"
    
    # Evaluate initial trust using Logistic Regression model
    trust_res = evaluate_trust(
        source_credibility=raw_report.source_credibility,
        report_count=1,
        has_verifiable_media=raw_report.has_verifiable_media,
        sensor_agreement=sensor_val,
        event_headline=headline,
        event_summary=raw_report.raw_text,
    )

    new_event = Event(
        id=uuid.uuid4(),
        event_code=next_code,
        primary_category=inferred_cat,
        severity=severity,
        latitude=raw_report.latitude,
        longitude=raw_report.longitude,
        geom=f"SRID=4326;POINT({raw_report.longitude} {raw_report.latitude})",
        location_name=raw_report.location_name or f"{raw_report.district}, {raw_report.state}",
        district=raw_report.district,
        state=raw_report.state,
        report_count=1,
        dedup_centroid_embedding=report_vec,
        trust_score=trust_res["trust_score"],
        verification_status=trust_res["verification_status"],
        conflict_note=trust_res["conflict_note"],
        synthetic_ground_truth=1 if (raw_report.source_credibility >= 0.85 or raw_report.source_type in ["imd_aws", "emergency_112"]) else 0,
        has_verifiable_media=raw_report.has_verifiable_media,
        headline=headline,
        summary=raw_report.raw_text,
        first_reported_at=report_time,
        last_updated_at=report_time,
        event_date=report_time.date(),
    )
    db.add(new_event)
    db.flush()

    junction = EventReport(
        event_id=new_event.id,
        raw_report_id=raw_report.id,
        similarity_score=1.0,
        distance_km=0.0
    )
    db.add(junction)
    raw_report.status = "merged"
    db.commit()
    db.refresh(new_event)
    return new_event, True
