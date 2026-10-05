"""
SkyTrace Conversational Disaster Assistant ("SkyTrace Chat")
------------------------------------------------------------
Implements Gemini 3.6 Flash conversational orchestration with on-demand
read-only SkyTrace RAG retrieval tool calling.
"""

import sys
import time
import re
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone

# Guard against Windows AppLocker DLL blocks on optional binary accelerators
if "ujson" not in sys.modules:
    sys.modules["ujson"] = None

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc
from google.genai import types

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
    intent: str = "CONVERSATIONAL"
    rag_used: bool = False
    cited_events: List[str] = []
    map_snippets: List[MapSnippetItem] = []
    engine: str
    resolved_locus: Optional[str] = None
    timestamp: datetime


def execute_skytrace_retrieval(query_text: str, db: Session) -> Dict[str, Any]:
    """
    Strictly read-only adapter around the existing SkyTrace RAG retrieval logic.
    Returns structured evidence dictionary safe for concurrent request execution.
    Enforces operational status grounding:
    - Normal operational query: VERIFIED -> yes, UNDER REVIEW -> qualified, REJECTED -> excluded.
    - Explicit event code: Retrieve that event and respect its actual verification status.
    """
    query_lower = query_text.lower().strip()
    all_events = get_cached_active_events(db)

    # Detect if user explicitly requested a specific event code or explicitly asked about rejected/debunked reports
    explicit_event_match = re.search(r'\b(EVT-\d+)\b', query_text, re.IGNORECASE)
    explicit_event_code = explicit_event_match.group(1).upper() if explicit_event_match else None
    asks_rejected_explicitly = any(w in query_lower for w in ["reject", "debunk", "unverified", "false alarm"])
    is_explicit_inspection = bool(explicit_event_code or asks_rejected_explicitly)

    # Status filtering:
    # Unless explicit inspection is requested, REJECTED reports are excluded from candidate pool
    if is_explicit_inspection:
        candidate_events = all_events
    else:
        candidate_events = [e for e in all_events if (e.verification_status or "").lower() != "rejected"]

    query_vec = None
    try:
        query_vec = embed_text(query_text)
    except Exception as e:
        print(f"Embedding query note: {e}")

    scored = []
    for e in candidate_events:
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
        # Direct event code match
        if e.event_code and e.event_code.lower() in query_lower:
            score += 1.00

        # Operational status weighting:
        v_status = (e.verification_status or "").lower()
        if v_status == "verified":
            score += 0.35
        elif v_status in ["pending_triage", "under_review"]:
            score += 0.05
        elif v_status == "rejected":
            score -= 0.50

        # Semantic vector similarity
        if query_vec and e.dedup_centroid_embedding:
            sim = cosine_similarity(query_vec, e.dedup_centroid_embedding)
            score += sim * 0.40

        scored.append((score, e))

    scored.sort(key=lambda x: x[0], reverse=True)
    top_matches = [e for s, e in scored[:3] if s > 0.20]

    # Resolve observation locus
    if top_matches:
        resolved_locus = f"{top_matches[0].district}, {top_matches[0].state}"
    else:
        from backend.app.services.preprocessor import resolve_district_and_state
        parsed_district, parsed_state = resolve_district_and_state(0.0, 0.0, query_text)
        resolved_locus = f"{parsed_district}, {parsed_state}"

    # For normal queries, only verified and qualified pending_triage events may enter map_snippets & cited_codes.
    # For explicit inspection, all retrieved candidates (including rejected) are surfaced with true status.
    eligible_snippets = [
        e for e in top_matches
        if is_explicit_inspection or (e.verification_status or "").lower() != "rejected"
    ]

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
        for e in eligible_snippets
    ]
    cited_codes = [e.event_code for e in eligible_snippets]

    summary_lines = []
    for e in top_matches:
        v_status = (e.verification_status or "").lower()
        last_seen = e.last_updated_at.isoformat() if e.last_updated_at else "N/A"
        if v_status == "rejected":
            summary_lines.append(
                f"- [REJECTED REPORT] [{e.event_code}] {e.headline} in {e.district}, {e.state} "
                f"(Status: REJECTED, Severity: {e.severity.upper()}, Trust: {e.trust_score:.2f}, Reports: {e.report_count}, Recorded: {last_seen}). "
                f"Details: {e.summary}. OPERATIONAL WARNING: Rejected report — not treated as verified operational intelligence."
            )
        elif v_status in ["pending_triage", "under_review"]:
            summary_lines.append(
                f"- [UNDER REVIEW REPORT] [{e.event_code}] {e.headline} in {e.district}, {e.state} "
                f"(Status: UNDER REVIEW, Severity: {e.severity.upper()}, Trust: {e.trust_score:.2f}, Reports: {e.report_count}, Recorded: {last_seen}). "
                f"Details: {e.summary}. OPERATIONAL NOTICE: Unverified report undergoing triage; qualify explicitly as 'Under Review' and not confirmed operational ground truth."
            )
        else:
            summary_lines.append(
                f"- [VERIFIED OBSERVATION] [{e.event_code}] {e.headline} in {e.district}, {e.state} "
                f"(Status: VERIFIED, Severity: {e.severity.upper()}, Trust: {e.trust_score:.2f}, Reports: {e.report_count}, Recorded: {last_seen}). "
                f"Details: {e.summary}."
            )

    if summary_lines:
        context_summary = "\n".join(summary_lines)
    else:
        context_summary = f"No active verified incidents matching '{query_text}' found in SkyTrace telemetry. Currently tracking {len(all_events)} active weather incidents across India."

    return {
        "evidence_summary": context_summary,
        "cited_events": cited_codes,
        "map_snippets": snippets,
        "resolved_locus": resolved_locus,
        "matched_event_count": len(top_matches)
    }


SYSTEM_INSTRUCTION = (
    "You are the SkyTrace Disaster Intelligence Assistant, serving meteorological analysts and national disaster response teams (IMD & NDMA).\n\n"
    "You handle both normal conversation and operational meteorological intelligence:\n\n"
    "1. For greetings, casual conversation, general questions, identity questions, capability questions, and general educational questions "
    "(such as 'What is flash flooding?' or 'What is Doppler radar?'), respond directly and politely from your general knowledge WITHOUT calling search_skytrace_intelligence.\n\n"
    "2. When the user asks for current, active, live, verified, location-specific, event-specific, or operational disaster/weather information across India, "
    "call search_skytrace_intelligence.\n\n"
    "3. Operational queries include: active weather alerts, flash floods, cyclones, rainfall incidents, severe weather, affected districts, road inundation, "
    "verified incidents, telemetry, or specific event codes (e.g. EVT-9001).\n\n"
    "4. EVENT STATUS AND OPERATIONAL GROUND TRUTH RULES:\n"
    "   - Base all operational claims strictly on the evidence returned by search_skytrace_intelligence. Reference event codes in brackets (e.g. [EVT-9001]).\n"
    "   - VERIFIED events are operational ground truth. You may present them directly and authoritatively.\n"
    "   - UNDER REVIEW / PENDING TRIAGE events must ALWAYS be explicitly qualified as unverified or under review (e.g., 'Awaiting field confirmation'). Never present them as confirmed facts.\n"
    "   - REJECTED reports must NEVER be presented as verified or current operational intelligence. If the user explicitly asks about a rejected event code or debunked report, clearly state: 'Rejected report — not treated as verified operational intelligence.'\n"
    "   - Do NOT silently upgrade unverified or rejected reports into active verified events.\n\n"
    "5. PASSAGE-TIME, ARRIVAL, AND ETA RULES:\n"
    "   - For queries asking when a storm, squall line, or weather system will pass, reach, or strike a location (e.g. 'When will the squall line pass Cachar?'):\n"
    "   - NEVER fabricate, invent, or guess an arrival time or passage time. Never infer an ETA solely from speed without movement direction and spatial distance.\n"
    "   - If the retrieved telemetry contains complete spatial trajectory data (observation timestamp, current coordinates/location, target coordinates/location, movement direction vector, and speed):\n"
    "     You may calculate a defensible telemetry-derived passage time, explicitly stating the calculation basis and noting: 'This is a telemetry-derived estimate, not an official IMD forecast.'\n"
    "   - If sufficient trajectory data does NOT exist (e.g., missing movement direction, missing distance, or unverified event):\n"
    "     You MUST explicitly state that SkyTrace currently does not have sufficient verified trajectory data to provide a reliable passage time for that location, and state what the latest verified observation indicates.\n"
    "   - Clearly distinguish between CURRENT VERIFIED OBSERVATIONS vs. TELEMETRY ESTIMATES vs. UNVERIFIED REPORTS."
)


@router.post("", response_model=ChatResponse)
def handle_chat_query(payload: ChatMessageIn, db: Session = Depends(get_db)):
    """
    Gemini 3.6 Flash conversational assistant with on-demand read-only SkyTrace RAG retrieval.
    Conversational queries respond directly; operational weather queries invoke native tool calling.
    """
    query_text = payload.message.strip()
    now = datetime.now(timezone.utc)
    model_name = settings.GEMINI_MODEL

    client = get_cached_genai_client()
    if not client:
        return ChatResponse(
            reply="The SkyTrace intelligence service is temporarily unavailable (AI engine offline). Please try again shortly.",
            intent="SERVICE_UNAVAILABLE",
            rag_used=False,
            cited_events=[],
            map_snippets=[],
            engine="offline",
            resolved_locus=None,
            timestamp=now
        )

    try:
        # Request-scoped container to explicitly receive structured retrieval evidence from tool
        retrieval_holder: Dict[str, Any] = {}

        def search_skytrace_intelligence(query: str) -> str:
            """
            Search the SkyTrace operational database for active, verified weather incidents,
            Doppler radar telemetry, flash floods, cyclones, severe alerts, affected districts,
            or specific event codes (e.g. EVT-9001).
            """
            res = execute_skytrace_retrieval(query_text=query, db=db)
            retrieval_holder["data"] = res
            return res["evidence_summary"]

        chat = client.chats.create(
            model=model_name,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                tools=[search_skytrace_intelligence],
                temperature=0.2,
            )
        )

        response = chat.send_message(query_text)

        reply_text = (response.text or "").strip()
        if not reply_text:
            reply_text = "I am the SkyTrace Disaster Intelligence Assistant. How can I help you today?"

        retrieval_data = retrieval_holder.get("data")
        if retrieval_data:
            return ChatResponse(
                reply=reply_text,
                intent="OPERATIONAL_WEATHER",
                rag_used=True,
                cited_events=retrieval_data["cited_events"],
                map_snippets=retrieval_data["map_snippets"],
                engine=model_name,
                resolved_locus=retrieval_data["resolved_locus"],
                timestamp=now
            )
        else:
            return ChatResponse(
                reply=reply_text,
                intent="CONVERSATIONAL",
                rag_used=False,
                cited_events=[],
                map_snippets=[],
                engine=model_name,
                resolved_locus=None,
                timestamp=now
            )

    except Exception as gemini_err:
        print(f"Gemini orchestrator failure: {gemini_err}")
        return ChatResponse(
            reply="The SkyTrace intelligence service is temporarily unavailable. Please try again shortly.",
            intent="SERVICE_UNAVAILABLE",
            rag_used=False,
            cited_events=[],
            map_snippets=[],
            engine=model_name,
            resolved_locus=None,
            timestamp=now
        )
