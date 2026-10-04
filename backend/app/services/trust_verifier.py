"""
SkyTrace Trust & Verification Service (Phase 3)
-----------------------------------------------
Implements an explainable Scikit-learn Logistic Regression classifier trained on the
Phase 1 synthetic seed dataset (`synthetic_ground_truth` target 0 or 1).

Features:
1. `source_credibility`: Base credibility of primary reporting source (0.45 - 0.98)
2. `corroboration_log`: Log-scaled corroboration volume ln(1 + report_count)
3. `has_verifiable_media`: 1 if verified imagery is present, 0 otherwise
4. `sensor_agreement`: 1.0 if corroborated by IMD/Doppler telemetry, 0.5 neutral, 0.0 contradiction

Tri-band Triage Thresholds:
- >= 0.80: `verified` (Instant Trusted badge, #17B8A6)
- 0.50 - 0.79: `pending_triage` (Gemini second-pass / Analyst Review Queue, #F2A93B)
- < 0.50: `rejected` (Filtered out as noise, #E5484D)
"""

import math
import numpy as np
from typing import Dict, Any, Tuple, Optional
from sklearn.linear_model import LogisticRegression

from backend.app.core.config import settings
from backend.app.services.seed_data import generate_seed_dataset

# Global trained model cache
_trust_model: Optional[LogisticRegression] = None
_training_stats: Dict[str, Any] = {}


def extract_features(
    source_credibility: float,
    report_count: int,
    has_verifiable_media: bool,
    sensor_agreement: float = 0.5
) -> np.ndarray:
    """Extracts the 4 normalized features for the Logistic Regression model."""
    corroboration_log = math.log(1.0 + max(1, report_count))
    media_int = 1.0 if has_verifiable_media else 0.0
    return np.array([
        source_credibility,
        corroboration_log,
        media_int,
        sensor_agreement
    ], dtype=np.float32)


def train_trust_model() -> LogisticRegression:
    """
    Trains Scikit-learn Logistic Regression model on the 135 seed records
    using `synthetic_ground_truth` (0 or 1) as training target.
    """
    global _trust_model, _training_stats
    events, raw_reports = generate_seed_dataset(target_count=135)

    X_train = []
    y_train = []

    # Map raw_reports to events to derive sensor agreement and source credibility
    for e in events:
        # Determine source credibility proxy from category & report count
        if e["report_count"] >= 5:
            cred = 0.95
            sensor = 0.90
        elif e["report_count"] >= 2:
            cred = 0.72
            sensor = 0.65
        else:
            cred = 0.50
            sensor = 0.40

        feat = extract_features(
            source_credibility=cred,
            report_count=e["report_count"],
            has_verifiable_media=e["has_verifiable_media"],
            sensor_agreement=sensor
        )
        X_train.append(feat)
        y_train.append(e["synthetic_ground_truth"])

    X = np.array(X_train)
    y = np.array(y_train)

    # Evaluate out-of-fold generalization via Stratified 5-Fold Cross Validation
    from sklearn.model_selection import StratifiedKFold, cross_val_score
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_clf = LogisticRegression(class_weight="balanced", random_state=42, C=1.5)
    cv_scores = cross_val_score(cv_clf, X, y, cv=skf, scoring="accuracy")

    # Fit final model on full seed dataset
    clf = LogisticRegression(class_weight="balanced", random_state=42, C=1.5)
    clf.fit(X, y)

    train_acc = float(clf.score(X, y))
    coefs = clf.coef_[0].tolist()
    intercept = float(clf.intercept_[0])

    _training_stats = {
        "sample_count": len(y),
        "positive_samples": int(np.sum(y == 1)),
        "negative_samples": int(np.sum(y == 0)),
        "train_accuracy": round(train_acc, 3),
        "cv_5fold_accuracy": round(float(np.mean(cv_scores)), 3),
        "cv_5fold_std": round(float(np.std(cv_scores)), 3),
        "cv_scores": [round(float(s), 3) for s in cv_scores],
        "intercept": round(intercept, 3),
        "weights": {
            "source_credibility": round(coefs[0], 3),
            "corroboration_log": round(coefs[1], 3),
            "has_verifiable_media": round(coefs[2], 3),
            "sensor_agreement": round(coefs[3], 3),
        }
    }
    _trust_model = clf
    return clf


def get_trust_model() -> LogisticRegression:
    """Lazy-initializes and returns the trained Logistic Regression model."""
    global _trust_model
    if _trust_model is None:
        _trust_model = train_trust_model()
    return _trust_model


def get_training_stats() -> Dict[str, Any]:
    """Returns training statistics and explainability weights."""
    if not _training_stats:
        get_trust_model()
    return _training_stats


def evaluate_trust(
    source_credibility: float,
    report_count: int,
    has_verifiable_media: bool,
    sensor_agreement: float = 0.5,
    event_headline: str = "",
    event_summary: str = ""
) -> Dict[str, Any]:
    """
    Evaluates incident trust score using trained model and routes to tri-band status:
    >= 0.80 -> verified
    0.50 - 0.79 -> pending_triage (Gemini second-pass / Admin Queue)
    < 0.50 -> rejected
    """
    model = get_trust_model()
    feat = extract_features(
        source_credibility=source_credibility,
        report_count=report_count,
        has_verifiable_media=has_verifiable_media,
        sensor_agreement=sensor_agreement
    )
    
    # Predict probability of ground truth = 1
    prob_authentic = float(model.predict_proba([feat])[0][1])
    trust_score = round(prob_authentic, 3)

    # Feature attribution breakdown
    coefs = model.coef_[0]
    intercept = model.intercept_[0]
    contributions = {
        "baseline_intercept": round(float(intercept), 3),
        "source_credibility_contrib": round(float(feat[0] * coefs[0]), 3),
        "corroboration_volume_contrib": round(float(feat[1] * coefs[1]), 3),
        "media_presence_contrib": round(float(feat[2] * coefs[2]), 3),
        "sensor_telemetry_contrib": round(float(feat[3] * coefs[3]), 3),
    }

    # Tri-band triage determination
    conflict_note = None
    if trust_score >= 0.80:
        status = "verified"
    elif trust_score >= 0.50:
        status = "pending_triage"
        # Optional second-pass AI evaluation for borderline events
        if settings.GEMINI_API_KEY and event_summary:
            second_pass = run_borderline_ai_triage(event_headline, event_summary, trust_score)
            if second_pass.get("recommendation") == "verify":
                status = "verified"
                trust_score = max(0.81, round(trust_score + 0.15, 3))
            elif second_pass.get("recommendation") == "reject":
                status = "rejected"
                trust_score = min(0.48, round(trust_score - 0.15, 3))
            conflict_note = second_pass.get("reasoning")
        else:
            conflict_note = (
                f"Borderline corroboration ({report_count} reports, "
                f"media={'verified' if has_verifiable_media else 'none'}). "
                "Assigned to Admin Review Queue for human analyst triage."
            )
    else:
        status = "rejected"
        conflict_note = "Confidence below 0.50 operational gate. Flagged as uncorroborated single-source report."

    return {
        "trust_score": trust_score,
        "verification_status": status,
        "feature_attribution": contributions,
        "conflict_note": conflict_note,
        "model_engine": "logistic_regression_explainable_v1"
    }


def run_borderline_ai_triage(headline: str, summary: str, initial_trust: float) -> Dict[str, str]:
    """Gemini second-pass review for events scoring in 0.50 - 0.79 band."""
    try:
        from google import genai
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        prompt = (
            f"You are a Senior Meteorological Analyst at the India National Emergency Operation Centre.\n"
            f"An automated sensor pipeline scored this borderline weather report at trust {initial_trust:.2f}.\n"
            f"Headline: {headline}\n"
            f"Details: {summary}\n\n"
            f"Evaluate the plausibility of this report against typical Indian monsoon/cyclonic meteorology.\n"
            f"Output JSON with keys:\n"
            f"- 'recommendation': 'verify' (promote to trusted), 'hold' (keep in review queue), or 'reject' (flag as fake/spam)\n"
            f"- 'reasoning': 1 concise sentence explaining your meteorological verdict."
        )
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        import json
        clean = response.text.strip().replace("```json", "").replace("```", "")
        return json.loads(clean)
    except Exception as e:
        return {
            "recommendation": "hold",
            "reasoning": f"Awaiting manual analyst verification (Automated second pass unavailable: {str(e)})"
        }
