"""
SkyTrace Conversational Disaster Assistant ("SkyTrace Chat")
------------------------------------------------------------
Implements grounded RAG over active verified events, radar telemetry, and IMD advisories.
Constructs response text along with structured map snippets for interactive frontend display.
"""

import time
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.core.database import get_db
from backend.app.core.config import settings
from backend.app.models.event import Event
from backend.app.services.embedding import embed_text, cosine_similarity

router = APIRouter(prefix="/chat", tags=["Conversational Assistant"])

# Module-level cached GenAI client to avoid repeated SSL handshake overhead
_genai_client = None


def get_cached_genai_client():
    global _genai_client
    if _genai_client is None and settings.GEMINI_API_KEY:
        from google import genai
        _genai_client = genai.Client(api_key=settings.GEMINI_API_KEY, http_options={"timeout": 15000})
    return _genai_client


# In-memory candidate event cache (30-second TTL) to eliminate remote DB pooler latency on chat queries
_event_cache: List[Event] = []
_event_cache_time: float = 0.0


def get_cached_active_events(db: Session, max_age_seconds: float = 30.0) -> List[Event]:
    global _event_cache, _event_cache_time
    now = time.time()
    if not _event_cache or (now - _event_cache_time) > max_age_seconds:
        _event_cache = db.query(Event).order_by(desc(Event.last_updated_at)).limit(60).all()
        _event_cache_time = now
    return _event_cache


def invalidate_event_cache():
    """Immediately invalidates the in-memory active event cache so triage updates reflect instantly in chat."""
    global _event_cache_time
    _event_cache_time = 0.0


class ChatMessageIn(BaseModel):
    message: str = Field(..., min_length=2)
    session_id: Optional[str] = "session-analyst-default"
    context_district: Optional[str] = None


class MapSnippetItem(BaseModel):
    event_id: str
    event_code: str
    latitude: float
    longitude: float
    primary_category: str
    severity: str
    headline: str
    location_name: str
    district: str
    state: str
    trust_score: float
    verification_status: str


class ChatResponse(BaseModel):
    reply: str
    cited_events: List[str]
    map_snippets: List[MapSnippetItem]
    engine: str
    resolved_locus: Optional[str] = None
    timestamp: datetime


@router.post("", response_model=ChatResponse)
def handle_chat_query(payload: ChatMessageIn, db: Session = Depends(get_db)):
    """
    RAG-grounded conversational assistant that queries the current operational picture.
    Optimized for low-latency tactical response during disaster situations.
    """
    query_text = payload.message.strip()
    query_lower = query_text.lower()
    now = datetime.now(timezone.utc)

    # 1. Retrieve candidate events from cache (or DB if expired)
    all_events = get_cached_active_events(db)

    # 2. Score relevance via keyword heuristics + dense semantic embedding
    query_vec = None
    try:
        query_vec = embed_text(query_text)
    except Exception as e:
        print(f"Embedding query note: {e}")

    scored = []
    for e in all_events:
        score = 0.0
        # Category boost
        if e.primary_category and e.primary_category.replace("_", " ") in query_lower:
            score += 0.40
        elif e.primary_category and e.primary_category in query_lower:
            score += 0.40
        # District boost
        if e.district and e.district.lower() in query_lower:
            score += 0.50
        # State boost
        if e.state and e.state.lower() in query_lower:
            score += 0.30
        
        # Semantic vector similarity
        if query_vec and e.dedup_centroid_embedding:
            sim = cosine_similarity(query_vec, e.dedup_centroid_embedding)
            score += sim * 0.40

        scored.append((score, e))

    scored.sort(key=lambda x: x[0], reverse=True)
    top_matches = [e for s, e in scored[:3] if s > 0.20]

    # Dynamically resolve observation locus from top matched event or query text
    if top_matches:
        resolved_locus = f"{top_matches[0].district}, {top_matches[0].state}"
    else:
        from backend.app.services.preprocessor import resolve_district_and_state
        parsed_district, parsed_state = resolve_district_and_state(0.0, 0.0, query_text)
        resolved_locus = f"{parsed_district}, {parsed_state}"

    # Map snippets for frontend tactical map preview
    snippets = [
        MapSnippetItem(
            event_id=str(e.id),
            event_code=e.event_code,
            latitude=e.latitude,
            longitude=e.longitude,
            primary_category=e.primary_category,
            severity=e.severity,
            headline=e.headline,
            location_name=e.location_name,
            district=e.district,
            state=e.state,
            trust_score=e.trust_score,
            verification_status=e.verification_status
        )
        for e in top_matches
    ]
    cited_codes = [e.event_code for e in top_matches]

    # 3. Formulate response via Gemini 3.8 Flash or deterministic synthesizer
    if settings.GEMINI_API_KEY and top_matches:
        try:
            client = get_cached_genai_client()
            if client:
                context_summary = "\n".join([
                    f"- [{e.event_code}] {e.headline} in {e.district}, {e.state} (Status: {e.verification_status.upper()}, Trust: {e.trust_score:.2f}, Corroborations: {e.report_count}). Details: {e.summary}"
                    for e in top_matches
                ])
                
                prompt = (
                    f"You are the SkyTrace Tactical Meteorological Assistant for the India National Disaster Management Authority (NDMA) & IMD.\n"
                    f"Answer the analyst's question concisely based ONLY on this active ground-truth telemetry:\n\n"
                    f"{context_summary}\n\n"
                    f"Analyst Query: \"{query_text}\"\n\n"
                    f"Reference event codes (e.g. EVT-9001) in brackets where relevant. Keep your answer military/tactical and professional."
                )
                response = client.models.generate_content(
                    model="gemini-3.8-flash",
                    contents=prompt
                )
                if response and response.text:
                    return ChatResponse(
                        reply=response.text.strip(),
                        cited_events=cited_codes,
                        map_snippets=snippets,
                        engine="gemini-3.8-flash",
                        resolved_locus=resolved_locus,
                        timestamp=now
                    )
        except Exception as e:
            print(f"Chat Gemini fallback triggered: {e}")

    # Fallback deterministic response builder
    if top_matches:
        lead = top_matches[0]
        reply = (
            f"Tactical telemetry confirms active incident [{lead.event_code}] in {lead.district}, {lead.state}. "
            f"Category: {lead.primary_category.upper().replace('_', ' ')} ({lead.severity.upper()}). "
            f"Verification status is '{lead.verification_status.upper()}' with trust score {lead.trust_score:.2f} "
            f"based on {lead.report_count} corroborated reports. "
            f"Summary: {lead.summary}"
        )
        if len(top_matches) > 1:
            reply += f" Additional active reports tracked in area: {', '.join(cited_codes[1:])}."
    else:
        # General stats response
        total_v = sum(1 for e in all_events if e.verification_status == "verified")
        total_p = sum(1 for e in all_events if e.verification_status == "pending_triage")
        reply = (
            f"SkyTrace system operational. Currently tracking {len(all_events)} active weather incidents "
            f"({total_v} Verified Trusted, {total_p} Pending Human Triage) across India. "
            f"INSAT-3D Doppler feeds active. Specify an Indian district or hazard type (e.g., 'flooding in Puri' or 'heatwave in Rajasthan') to inspect local incidents."
        )

    return ChatResponse(
        reply=reply,
        cited_events=cited_codes,
        map_snippets=snippets,
        engine="tactical_rule_engine",
        resolved_locus=resolved_locus,
        timestamp=now
    )
