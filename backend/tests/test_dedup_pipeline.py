"""
Integration Test: Ingestion, Preprocessing & Deduplication Pipeline (Phase 2)
-----------------------------------------------------------------------------
Verifies:
1. Preprocessor timestamp UTC normalization, language detection, and district geocoding.
2. Embedding generation and vector cosine similarity.
3. Multi-source report deduplication: 3 reports of the same event in Puri, Odisha
   are merged into 1 canonical Event with `report_count = 3`.
4. Spatial isolation: A distant report in Mumbai creates a separate Event.
"""

import sys
import os
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.app.core.database import Base
from backend.app.models.raw_report import RawReport
from backend.app.models.event import Event, EventReport
from backend.app.services.preprocessor import (
    normalize_utc_timestamp,
    detect_report_language,
    resolve_district_and_state,
    haversine_distance,
)
from backend.app.services.embedding import embed_text, cosine_similarity
from backend.app.services.deduplication import process_report_deduplication


def test_preprocessor():
    print("Testing Preprocessor...")
    # 1. UTC normalization
    t1 = normalize_utc_timestamp("2026-09-30T14:30:00Z")
    assert t1.tzinfo == timezone.utc
    assert t1.hour == 14 and t1.minute == 30

    # 2. Language detection
    assert detect_report_language("Heavy rain in Puri beach road") == "en"
    assert detect_report_language("भारी बारिश और जलभराव") == "hi"
    assert detect_report_language("ପୁରୀରେ ପ୍ରବଳ ବର୍ଷା ଏବଂ ବନ୍ୟା") == "or"

    # 3. Geocoding
    district, state = resolve_district_and_state(19.8135, 85.8312)
    assert district == "Puri" and state == "Odisha"
    print("  [PASS] Preprocessor verified.")


def test_embedding_and_similarity():
    print("Testing Embedding & Cosine Similarity...")
    # 1. English duplicate reports of same event
    en1 = "Severe waterlogging on Puri beach road. Water rising fast over car wheels."
    en2 = "Major road flooded near Puri beach! Traffic stopped due to knee-deep water. #PuriRain"
    # 2. Cross-language Hindi duplicate of same event
    hi1 = "पुरी बीच रोड पर भीषण जलभराव। पानी कारों के पहियों के ऊपर बह रहा है।"
    # 3. Completely different hazard category
    v_heat = embed_text("Extreme heatwave temperature 47 degrees in Rajasthan desert")
    # 4. DIFFERENT nearby event of SAME category (flooding) in same district
    diff_flood = "Bhargavi river embankment seepage flooding rural agricultural paddy fields in Pipili block."

    v_en1 = embed_text(en1)
    v_en2 = embed_text(en2)
    v_hi1 = embed_text(hi1)
    v_diff_flood = embed_text(diff_flood)

    assert len(v_en1) == 384, f"Expected 384 dims, got {len(v_en1)}"
    assert len(v_en2) == 384

    sim_en_en = cosine_similarity(v_en1, v_en2)
    sim_en_hi = cosine_similarity(v_en1, v_hi1)
    sim_diff_flood = cosine_similarity(v_en1, v_diff_flood)
    sim_heat = cosine_similarity(v_en1, v_heat)

    print(f"  Similarity (Same Event EN-EN):        {sim_en_en:.3f}")
    print(f"  Similarity (Same Event EN-HI):        {sim_en_hi:.3f}")
    print(f"  Similarity (Different Nearby Flood):  {sim_diff_flood:.3f}")
    print(f"  Similarity (Flood vs Heatwave):       {sim_heat:.3f}")

    # Validate that duplicates score high (>= 0.75)
    assert sim_en_en >= 0.75, f"Expected EN-EN duplicate similarity >= 0.75, got {sim_en_en:.3f}"
    assert sim_en_hi >= 0.75, f"Expected EN-HI duplicate similarity >= 0.75, got {sim_en_hi:.3f}"

    # Validate that different nearby same-category events score well below threshold (<= 0.55)
    assert sim_diff_flood <= 0.55, f"Expected different nearby flood similarity <= 0.55, got {sim_diff_flood:.3f}"
    assert sim_en_en - sim_diff_flood > 0.20, "Wide separation margin required between duplicates and distinct incidents"
    print("  [PASS] Multilingual embedding and distinction margins verified.")


def test_dedup_merging():
    print("Testing Deduplication & Clustering Engine...")
    # Pure unit isolation test session for deduplication logic
    class MockQuery:
        def __init__(self, items):
            self._items = items
        def filter(self, *args, **kwargs):
            return self
        def all(self):
            return list(self._items)
        def count(self):
            return len(self._items)

    class MockDB:
        def __init__(self):
            self.events = []
            self.reports = []
            self.junctions = []
        def query(self, model):
            if model == Event:
                return MockQuery(self.events)
            return MockQuery(self.reports)
        def add(self, obj):
            if isinstance(obj, Event):
                if obj not in self.events:
                    self.events.append(obj)
            elif isinstance(obj, RawReport):
                self.reports.append(obj)
            elif isinstance(obj, EventReport):
                self.junctions.append(obj)
        def commit(self):
            pass
        def flush(self):
            pass
        def refresh(self, obj):
            pass
        def close(self):
            pass

    db = MockDB()

    now = datetime.now(timezone.utc)
    puri_lat, puri_lon = 19.8135, 85.8312

    # REPORT 1: Citizen report in Puri
    r1 = RawReport(
        source_type="citizen",
        source_handle="#CIT-4401",
        source_credibility=0.72,
        raw_text="Severe waterlogging on Puri beach road. Water rising fast over car wheels.",
        has_verifiable_media=True,
        reported_at=now - timedelta(minutes=15),
        latitude=puri_lat,
        longitude=puri_lon,
        location_name="Puri Marine Drive",
        district="Puri",
        state="Odisha",
        embedding=embed_text("Severe waterlogging on Puri beach road. Water rising fast over car wheels.")
    )
    db.add(r1)
    db.flush()

    evt1, is_new1 = process_report_deduplication(db, r1)
    assert is_new1 is True, "First report should create new canonical Event"
    assert evt1.report_count == 1
    initial_trust = evt1.trust_score
    print(f"  Report 1 created Event {evt1.event_code} (count={evt1.report_count}, trust={initial_trust})")

    # REPORT 2: Social media report 8 minutes later, 500m away in Puri
    r2 = RawReport(
        source_type="social",
        source_handle="@OdishaWeatherWatch",
        source_credibility=0.45,
        raw_text="Major road flooded near Puri beach! Traffic stopped due to knee-deep water. #PuriRain",
        has_verifiable_media=False,
        reported_at=now - timedelta(minutes=7),
        latitude=puri_lat + 0.003,
        longitude=puri_lon + 0.002,
        location_name="Puri Beach Area",
        district="Puri",
        state="Odisha",
        embedding=embed_text("Major road flooded near Puri beach! Traffic stopped due to knee-deep water. #PuriRain")
    )
    db.add(r2)
    db.flush()

    evt2, is_new2 = process_report_deduplication(db, r2)
    assert is_new2 is False, "Second report in same location & time must be merged"
    assert evt2.id == evt1.id, "Must merge into the exact same Event ID"
    assert evt2.report_count == 2, f"Expected report_count = 2, got {evt2.report_count}"
    print(f"  Report 2 merged into Event {evt2.event_code} (count={evt2.report_count})")

    # REPORT 3: IMD AWS station confirms heavy inundation 2 minutes later
    r3 = RawReport(
        source_type="imd_aws",
        source_handle="IMD-AWS-PURI",
        source_credibility=0.98,
        raw_text="[IMD AWS Alert] Flash flood inundation and severe waterlogging confirmed on Puri beach road.",
        has_verifiable_media=False,
        reported_at=now - timedelta(minutes=2),
        latitude=puri_lat - 0.001,
        longitude=puri_lon + 0.001,
        location_name="Puri IMD Station",
        district="Puri",
        state="Odisha",
        embedding=embed_text("[IMD AWS Alert] Flash flood inundation and severe waterlogging confirmed on Puri beach road.")
    )
    db.add(r3)
    db.flush()

    evt3, is_new3 = process_report_deduplication(db, r3)
    assert is_new3 is False, "Third report must also merge into existing Event"
    assert evt3.id == evt1.id
    assert evt3.report_count == 3, f"Expected report_count = 3, got {evt3.report_count}"
    assert evt3.trust_score > initial_trust, f"Corroboration must increase trust score from {initial_trust} to {evt3.trust_score}"
    print(f"  Report 3 merged into Event {evt3.event_code} (count={evt3.report_count}, trust={evt3.trust_score})")

    # NEGATIVE TEST CASE (Item 1): Nearby SAME-DISTRICT, SAME-CATEGORY (flooding) event within 14 km & 10 mins
    # Spatial distance: 13.8 km (<= 25 km threshold)
    # Temporal distance: 10 mins (<= 6 hr threshold)
    # Different specifics: River embankment seepage in rural Pipili vs Beach road urban inundation
    pipili_lat, pipili_lon = 19.9320, 85.8340
    r_diff_nearby = RawReport(
        source_type="citizen",
        source_handle="#CIT-PIPIL",
        source_credibility=0.72,
        raw_text="Bhargavi river embankment seepage flooding rural agricultural paddy fields in Pipili block.",
        has_verifiable_media=True,
        reported_at=now - timedelta(minutes=10),
        latitude=pipili_lat,
        longitude=pipili_lon,
        location_name="Pipili Rural Canal Zone",
        district="Puri",
        state="Odisha",
        embedding=embed_text("Bhargavi river embankment seepage flooding rural agricultural paddy fields in Pipili block.")
    )
    db.add(r_diff_nearby)
    db.flush()

    evt_diff, is_new_diff = process_report_deduplication(db, r_diff_nearby)
    assert is_new_diff is True, "Nearby distinct flood incident must NOT falsely merge into beach road event!"
    assert evt_diff.id != evt1.id, "Must be instantiated as a separate canonical Event"
    assert evt_diff.report_count == 1
    print(f"  [NEGATIVE TEST PASS] Nearby distinct flood ({r_diff_nearby.location_name}) correctly isolated as new Event {evt_diff.event_code}")

    # REPORT 4: Spatially distinct report in Mumbai (> 1300 km away)
    r4 = RawReport(
        source_type="citizen",
        source_handle="#CIT-9901",
        source_credibility=0.72,
        raw_text="Milan subway underpass flooded in Mumbai. Vehicles stranded.",
        has_verifiable_media=True,
        reported_at=now,
        latitude=19.0760,
        longitude=72.8777,
        location_name="Milan Subway, Mumbai",
        district="Mumbai Suburban",
        state="Maharashtra",
        embedding=embed_text("Milan subway underpass flooded in Mumbai. Vehicles stranded.")
    )
    db.add(r4)
    db.flush()

    evt4, is_new4 = process_report_deduplication(db, r4)
    assert is_new4 is True, "Report in Mumbai must create a completely new Event"
    assert evt4.id != evt1.id
    assert evt4.report_count == 1
    assert evt4.district == "Mumbai Suburban"
    print(f"  Distant Report 4 created separate Event {evt4.event_code} in {evt4.district} (count={evt4.report_count})")

    db.close()
    print("  [PASS] Multi-source deduplication pipeline verified!")


if __name__ == "__main__":
    test_preprocessor()
    test_embedding_and_similarity()
    test_dedup_merging()
    print("\n[ALL PHASE 2 PIPELINE INTEGRATION TESTS PASSED SUCCESSFULLY!]")
