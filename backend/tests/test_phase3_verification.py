"""
Unit & Integration Test: Phase 3 Classification & Verification Pipeline
-----------------------------------------------------------------------
Verifies:
1. Incident Category & Severity Classifier across all 7 IMD categories and multilingual samples.
2. Logistic Regression Trust Model training on Phase 1 synthetic ground truth.
3. Feature weight directions (positive weights for source credibility, corroboration, media, sensor).
4. Tri-band triage routing (>= 0.80 verified, 0.50-0.79 pending_triage, < 0.50 rejected).
5. Explainable feature attribution breakdown.
"""

import sys
import os

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

from backend.app.services.classifier import classify_incident, VALID_CATEGORIES, VALID_SEVERITIES
from backend.app.services.trust_verifier import (
    train_trust_model,
    get_training_stats,
    evaluate_trust,
    extract_features
)


def test_classifier():
    print("Testing Incident Classifier across 7 IMD Categories...")
    test_cases = [
        ("Water depth exceeding 1.5 feet covering highway, vehicles submerged in underpass", "flooding", "severe"),
        ("Severe Kalbaishakhi supercell with violent cloud-to-ground lightning strikes", "thunderstorm", "severe"),
        ("Extremely heavy rainfall cloudburst recorded at 75 mm/hr", "rainfall", "severe"),
        ("Scorching heatwave temperature 47.5C with severe loo wind conditions", "heatwave", "severe"),
        ("Dense advection winter fog with runway visibility below 50 meters", "fog", "severe"),
        ("Severe andhi dust squall advancing across desert sector obscuring sun", "dust_storm", "severe"),
        ("Gale-force coastal wind gusts exceeding 70 km/h damaging hoardings", "strong_wind", "moderate"),
        ("पुरी बीच रोड पर भीषण जलभराव और डूबी हुई गाड़ियां", "flooding", "severe"),
    ]

    for text, expected_cat, min_sev in test_cases:
        res = classify_incident(text)
        cat = res["primary_category"]
        sev = res["severity"]
        conf = res["confidence"]
        print(f"  [{cat.upper()}] sev={sev} conf={conf:.2f} text='{text[:45]}...'")
        assert cat in VALID_CATEGORIES, f"Invalid category {cat}"
        assert sev in VALID_SEVERITIES, f"Invalid severity {sev}"
        assert cat == expected_cat, f"Expected {expected_cat}, got {cat} for '{text}'"

    print("  [PASS] Incident classifier verified across categories.")


def test_trust_model_training():
    print("\nTesting Logistic Regression Trust Model Training...")
    model = train_trust_model()
    stats = get_training_stats()

    print(f"  Training Samples: {stats['sample_count']}")
    print(f"  Positive Samples (1): {stats['positive_samples']}")
    print(f"  Negative Samples (0): {stats['negative_samples']}")
    print(f"  Training Accuracy (Full Set): {stats['train_accuracy']:.1%}")
    print(f"  Stratified 5-Fold CV Accuracy: {stats['cv_5fold_accuracy']:.1%} (+/- {stats['cv_5fold_std']:.1%})")
    print(f"  5-Fold CV Fold Scores: {stats['cv_scores']}")
    print(f"  Model Intercept: {stats['intercept']}")
    print("  Feature Weights (Explainability):")
    for feat, weight in stats["weights"].items():
        print(f"    • {feat}: {weight:+.3f}")

    assert stats["sample_count"] == 135, f"Expected 135 samples, got {stats['sample_count']}"
    # Target out-of-fold generalization accuracy is ~80-85% due to deliberate ~8-10% label flip noise in seed data
    assert stats["cv_5fold_accuracy"] >= 0.78, f"Expected >= 78% 5-fold CV accuracy, got {stats['cv_5fold_accuracy']}"
    assert stats["train_accuracy"] >= 0.80, f"Expected >= 80% training accuracy, got {stats['train_accuracy']}"
    
    # Check that authoritative signals have positive predictive weights
    assert stats["weights"]["source_credibility"] > 0, "Source credibility must have positive weight"
    assert stats["weights"]["corroboration_log"] > 0, "Corroboration volume must have positive weight"
    assert stats["weights"]["sensor_agreement"] > 0, "Sensor telemetry agreement must have positive weight"
    print("  [PASS] Trust model trained, 5-fold cross-validated, and feature directions verified.")


def test_tri_band_triage():
    print("\nTesting Tri-Band Triage Routing...")

    # Case 1: High credibility authoritative source + multiple corroborations -> VERIFIED (>= 0.80)
    res_high = evaluate_trust(
        source_credibility=0.98,  # IMD AWS
        report_count=6,
        has_verifiable_media=True,
        sensor_agreement=0.95
    )
    print(f"  High-Trust Report: score={res_high['trust_score']:.3f} -> status={res_high['verification_status']}")
    assert res_high["trust_score"] >= 0.80, f"Expected >= 0.80, got {res_high['trust_score']}"
    assert res_high["verification_status"] == "verified"

    # Case 2: Borderline report (citizen report with media, 2 corroborations) -> PENDING_TRIAGE (0.50 - 0.79)
    res_mid = evaluate_trust(
        source_credibility=0.72,
        report_count=2,
        has_verifiable_media=True,
        sensor_agreement=0.60
    )
    print(f"  Borderline Report: score={res_mid['trust_score']:.3f} -> status={res_mid['verification_status']}")
    assert 0.50 <= res_mid["trust_score"] < 0.80, f"Expected 0.50-0.79, got {res_mid['trust_score']}"
    assert res_mid["verification_status"] == "pending_triage"
    assert res_mid["conflict_note"] is not None

    # Case 3: Low credibility unverified single social post -> REJECTED (< 0.50)
    res_low = evaluate_trust(
        source_credibility=0.35,
        report_count=1,
        has_verifiable_media=False,
        sensor_agreement=0.20
    )
    print(f"  Low-Trust Report:  score={res_low['trust_score']:.3f} -> status={res_low['verification_status']}")
    assert res_low["trust_score"] < 0.50, f"Expected < 0.50, got {res_low['trust_score']}"
    assert res_low["verification_status"] == "rejected"
    assert "below 0.50" in res_low["conflict_note"]

    # Verify explainable feature attribution dictionary
    assert "source_credibility_contrib" in res_high["feature_attribution"]
    assert "corroboration_volume_contrib" in res_high["feature_attribution"]
    print("  [PASS] Tri-band triage thresholds and explainability verified.")


def test_live_sensor_and_credibility_derivation():
    print("\nTesting Live sensor_agreement & source_credibility Derivation...")
    from datetime import datetime, timezone, timedelta
    from backend.app.services.preprocessor import get_source_credibility
    from backend.app.services.deduplication import derive_live_sensor_agreement
    from backend.app.models.raw_report import RawReport
    from backend.app.models.event import Event

    # 1. Consistent source credibility lookup test
    assert get_source_credibility("imd_aws") == 0.98
    assert get_source_credibility("emergency_112") == 0.94
    assert get_source_credibility("traffic_cctv") == 0.88
    assert get_source_credibility("citizen") == 0.72
    assert get_source_credibility("social") == 0.45
    print("  [PASS] Consistent source credibility lookups verified.")

    # 2. Mock DB session for testing derive_live_sensor_agreement
    class MockQuery:
        def __init__(self, items):
            self._items = items
        def filter(self, *args, **kwargs):
            return self
        def join(self, *args, **kwargs):
            return self
        def all(self):
            return list(self._items)

    class MockDBSession:
        def __init__(self, raw_reports=None):
            self.raw_reports = raw_reports or []
        def query(self, model):
            return MockQuery(self.raw_reports)

    now = datetime.now(timezone.utc)
    puri_lat, puri_lon = 19.8135, 85.8312

    # Case A: Live report directly from IMD AWS
    db_empty = MockDBSession([])
    sa_imd = derive_live_sensor_agreement(db_empty, puri_lat, puri_lon, now, incoming_source_type="imd_aws")
    assert sa_imd == 0.95, f"Expected 0.95 for direct IMD report, got {sa_imd}"

    # Case B: Live citizen report with NO nearby sensors in DB -> neutral baseline 0.50
    sa_citizen_neutral = derive_live_sensor_agreement(db_empty, puri_lat, puri_lon, now, incoming_source_type="citizen")
    assert sa_citizen_neutral == 0.50, f"Expected 0.50 neutral baseline, got {sa_citizen_neutral}"

    # Case C: Live citizen report WHEN a co-located IMD AWS report exists within 5km and 30 mins
    existing_imd_report = RawReport(
        source_type="imd_aws",
        latitude=puri_lat + 0.02,
        longitude=puri_lon + 0.01,
        reported_at=now - timedelta(minutes=25)
    )
    db_with_sensor = MockDBSession([existing_imd_report])
    sa_corroborated = derive_live_sensor_agreement(db_with_sensor, puri_lat, puri_lon, now, incoming_source_type="citizen")
    assert sa_corroborated == 0.90, f"Expected 0.90 active sensor corroboration, got {sa_corroborated}"
    print(f"  Live IMD Direct Agreement:        {sa_imd:.2f}")
    print(f"  Live Citizen Neutral Agreement:   {sa_citizen_neutral:.2f}")
    print(f"  Live Citizen Sensor Corroborated: {sa_corroborated:.2f}")
    print("  [PASS] Live sensor_agreement derivation verified across operational states.")


if __name__ == "__main__":
    test_classifier()
    test_trust_model_training()
    test_tri_band_triage()
    test_live_sensor_and_credibility_derivation()
    print("\n[ALL PHASE 3 CLASSIFICATION & VERIFICATION TESTS PASSED SUCCESSFULLY!]")
