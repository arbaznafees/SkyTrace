"""
SkyTrace Report Preprocessor
----------------------------
Normalizes incoming raw report payloads:
1. Enforces standard ISO-8601 UTC timestamps
2. Detects report language (English, Hindi, Odia, regional scripts)
3. Resolves Indian District and State from coordinates or text keywords
"""

import math
from datetime import datetime, timezone
from typing import Dict, Any, Tuple, Optional

# Indian administrative reference nodes for geographic reverse-resolution
DISTRICT_CENTROIDS = [
    {"district": "Puri", "state": "Odisha", "lat": 19.8135, "lon": 85.8312},
    {"district": "Balasore", "state": "Odisha", "lat": 21.4934, "lon": 86.9135},
    {"district": "Khurda", "state": "Odisha", "lat": 20.2961, "lon": 85.8245},
    {"district": "Ganjam", "state": "Odisha", "lat": 19.3149, "lon": 84.7941},
    {"district": "Kolkata", "state": "West Bengal", "lat": 22.5726, "lon": 88.3639},
    {"district": "South 24 Parganas", "state": "West Bengal", "lat": 22.1452, "lon": 88.5831},
    {"district": "Darjeeling", "state": "West Bengal", "lat": 27.0410, "lon": 88.2663},
    {"district": "Ranchi", "state": "Jharkhand", "lat": 23.3441, "lon": 85.3096},
    {"district": "East Singhbhum", "state": "Jharkhand", "lat": 22.8046, "lon": 86.2029},
    {"district": "Dhanbad", "state": "Jharkhand", "lat": 23.7957, "lon": 86.4304},
    {"district": "Mumbai City", "state": "Maharashtra", "lat": 18.9220, "lon": 72.8347},
    {"district": "Mumbai Suburban", "state": "Maharashtra", "lat": 19.0760, "lon": 72.8777},
    {"district": "Thane", "state": "Maharashtra", "lat": 19.2183, "lon": 72.9781},
    {"district": "Nagpur", "state": "Maharashtra", "lat": 21.1458, "lon": 79.0882},
    {"district": "Kamrup Metropolitan", "state": "Assam", "lat": 26.1445, "lon": 91.7362},
    {"district": "Dibrugarh", "state": "Assam", "lat": 27.4728, "lon": 94.9120},
    {"district": "Cachar", "state": "Assam", "lat": 24.8333, "lon": 92.7789},
    {"district": "New Delhi", "state": "Delhi NCR", "lat": 28.6139, "lon": 77.2090},
    {"district": "South Delhi", "state": "Delhi NCR", "lat": 28.5355, "lon": 77.2410},
    {"district": "North Delhi", "state": "Delhi NCR", "lat": 28.7041, "lon": 77.1025},
    {"district": "Jodhpur", "state": "Rajasthan", "lat": 26.2389, "lon": 73.0243},
    {"district": "Bikaner", "state": "Rajasthan", "lat": 28.0229, "lon": 73.3119},
    {"district": "Churu", "state": "Rajasthan", "lat": 28.2900, "lon": 74.9600},
    {"district": "Kutch", "state": "Gujarat", "lat": 23.7337, "lon": 69.8597},
    {"district": "Surat", "state": "Gujarat", "lat": 21.1702, "lon": 72.8311},
    {"district": "Ahmedabad", "state": "Gujarat", "lat": 23.0225, "lon": 72.5714},
]

# Source credibility weights mapping
SOURCE_CREDIBILITY_MAP = {
    "imd_aws": 0.98,
    "emergency_112": 0.94,
    "traffic_cctv": 0.88,
    "citizen": 0.72,
    "citizen_anonymous": 0.65,
    "social": 0.45,
}


def get_source_credibility(source_type: str, is_anonymous: bool = False) -> float:
    """Consistently resolves baseline credibility for any incoming report intake channel."""
    st = source_type.lower()
    if st == "citizen" and is_anonymous:
        return float(SOURCE_CREDIBILITY_MAP["citizen_anonymous"])
    return float(SOURCE_CREDIBILITY_MAP.get(st, 0.50))


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance in kilometers between two GPS coordinates."""
    r = 6371.0  # Earth's radius in kilometers
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


def normalize_utc_timestamp(ts: Optional[Any] = None) -> datetime:
    """Normalizes any incoming timestamp into an explicit timezone-aware UTC datetime."""
    if ts is None:
        return datetime.now(timezone.utc)
    if isinstance(ts, datetime):
        if ts.tzinfo is None:
            return ts.replace(tzinfo=timezone.utc)
        return ts.astimezone(timezone.utc)
    if isinstance(ts, str):
        try:
            # Handle ISO string (e.g. 2026-09-30T14:00:00Z)
            cleaned = ts.replace("Z", "+00:00")
            dt = datetime.fromisoformat(cleaned)
            if dt.tzinfo is None:
                return dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except Exception:
            return datetime.now(timezone.utc)
    return datetime.now(timezone.utc)


def detect_report_language(text: str) -> str:
    """Heuristic language detection based on unicode script ranges for Indian languages."""
    has_devanagari = any('\u0900' <= char <= '\u097F' for char in text)
    has_odia = any('\u0B00' <= char <= '\u0B7F' for char in text)
    has_bengali = any('\u0980' <= char <= '\u09FF' for char in text)

    if has_odia:
        return "or"
    if has_devanagari:
        return "hi"
    if has_bengali:
        return "bn"
    return "en"


def resolve_district_and_state(lat: float, lon: float, text: str = "") -> Tuple[str, str]:
    """
    Resolves district and state by finding the nearest geographic centroid.
    Falls back to keyword matching if coordinates are exactly zero.
    """
    # Keyword check in text for district or state
    lower_text = text.lower()
    for d in DISTRICT_CENTROIDS:
        if d["district"].lower() in lower_text:
            return d["district"], d["state"]
    for d in DISTRICT_CENTROIDS:
        if d["state"].lower() in lower_text:
            return d["district"], d["state"]

    # Minimum distance search against district centroids
    min_dist = float("inf")
    best_match = ("Unknown", "India")
    for d in DISTRICT_CENTROIDS:
        dist = haversine_distance(lat, lon, d["lat"], d["lon"])
        if dist < min_dist:
            min_dist = dist
            best_match = (d["district"], d["state"])

    return best_match
