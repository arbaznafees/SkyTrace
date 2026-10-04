"""
Unit Test: Seed Data Generation Integrity
-----------------------------------------
Validates:
1. Generation of 130+ records
2. Coverage of all 7 categories
3. Synthetic ground-truth label distribution (0 and 1)
4. has_verifiable_media boolean typing
5. Geolocation bounding boxes in India
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

from backend.app.services.seed_data import generate_seed_dataset, CATEGORY_TEMPLATES


def test_seed_generation():
    events, raw_reports = generate_seed_dataset(target_count=135)
    
    assert len(events) == 135, f"Expected 135 events, got {len(events)}"
    assert len(raw_reports) >= 135, f"Expected >= 135 raw reports, got {len(raw_reports)}"
    
    categories_present = set(e["primary_category"] for e in events)
    expected_categories = set(CATEGORY_TEMPLATES.keys())
    assert categories_present == expected_categories, f"Missing categories: {expected_categories - categories_present}"
    
    # Requirement Addition #1 check: synthetic_ground_truth is 0 or 1
    gt_labels = set(e["synthetic_ground_truth"] for e in events)
    assert gt_labels == {0, 1}, f"Synthetic ground truth must contain both 0 and 1, got {gt_labels}"
    
    # Requirement Addition #2 check: has_verifiable_media is boolean
    for e in events:
        assert isinstance(e["has_verifiable_media"], bool), "has_verifiable_media must be bool"
        assert 8.0 <= e["latitude"] <= 36.0, f"Latitude {e['latitude']} outside India bounding box"
        assert 68.0 <= e["longitude"] <= 98.0, f"Longitude {e['longitude']} outside India bounding box"
        assert 0.0 <= e["trust_score"] <= 1.0, f"Trust score {e['trust_score']} out of range"
        assert e["verification_status"] in ["verified", "pending_triage", "rejected"]
        
    for r in raw_reports:
        assert isinstance(r["has_verifiable_media"], bool)
        assert r["source_type"] in ["citizen", "social", "imd_aws", "traffic_cctv", "emergency_112"]

    from collections import Counter
    status_counts = Counter(e["verification_status"] for e in events)
    assert set(status_counts.keys()) == {"verified", "pending_triage", "rejected"}, "Must contain all 3 status states"
    
    # Assert roughly 65% verified (60-75%), 25% pending (18-30%), 10% rejected (6-15%)
    verified_pct = status_counts["verified"] / len(events)
    pending_pct = status_counts["pending_triage"] / len(events)
    rejected_pct = status_counts["rejected"] / len(events)
    assert 0.60 <= verified_pct <= 0.75, f"Verified % unexpected: {verified_pct:.1%}"
    assert 0.18 <= pending_pct <= 0.30, f"Pending % unexpected: {pending_pct:.1%}"
    assert 0.05 <= rejected_pct <= 0.15, f"Rejected % unexpected: {rejected_pct:.1%}"

    print("[SUCCESS] All 135 seed events and raw reports validated successfully!")
    print(f"- Categories covered: {len(categories_present)}/7")
    print(f"- Verification Status Breakdown:")
    print(f"  • Verified Ground Truth: {status_counts['verified']} ({verified_pct:.1%})")
    print(f"  • Pending Human Triage:  {status_counts['pending_triage']} ({pending_pct:.1%})")
    print(f"  • Filtered / Rejected:   {status_counts['rejected']} ({rejected_pct:.1%})")
    print(f"- Ground-truth positive (1): {sum(1 for e in events if e['synthetic_ground_truth'] == 1)}")
    print(f"- Ground-truth negative (0): {sum(1 for e in events if e['synthetic_ground_truth'] == 0)}")
    print(f"- Events with verifiable media: {sum(1 for e in events if e['has_verifiable_media'])}")


if __name__ == "__main__":
    test_seed_generation()
