"""
SkyTrace Incident Category & Severity Classifier
------------------------------------------------
Classifies raw incident descriptions into one of the 7 IMD weather hazard categories:
1. flooding
2. thunderstorm
3. rainfall
4. heatwave
5. fog
6. dust_storm
7. strong_wind

Provides severity grading ('mild', 'moderate', 'severe') and confidence score.
Uses Gemini structured output when GEMINI_API_KEY is configured, with a comprehensive
deterministic meteorological rule-based engine as fallback for offline execution.
"""

import json
import re
from typing import Dict, Any, Tuple
from backend.app.core.config import settings

VALID_CATEGORIES = [
    "flooding",
    "thunderstorm",
    "rainfall",
    "heatwave",
    "fog",
    "dust_storm",
    "strong_wind",
]

VALID_SEVERITIES = ["mild", "moderate", "severe"]

# Meteorological pattern indicators for deterministic classification
CATEGORY_PATTERNS = {
    "flooding": [
        r"\b(flood|flooding|waterlog|waterlogging|inundat|submerg|deluge|embankment breach|sluice gate|underpass.*submerged|water depth|knee-deep)\b",
        r"(जलभराव|बाढ़|डूबा|जलमग्न|ଜଳବନ୍ଦୀ|ବନ୍ୟା)",
    ],
    "thunderstorm": [
        r"\b(thunder|thunderstorm|lightning|kalbaishakhi|nor'wester|squall.*lightning|mesocyclone|thunder squall|hail|hailstorm|lightning strike)\b",
        r"(तूफान|बिजली|आंधी|ବଜ୍ରପାତ|କାଳବୈଶାଖୀ)",
    ],
    "rainfall": [
        r"\b(rain|rainfall|downpour|cloudburst|torrential|precipitation|heavy rain|continuous rain|monsoon shower|rain gauge|mm/hr)\b",
        r"(बारिश|वर्षा|बरसात|ପ୍ରବଳ ବର୍ଷା)",
    ],
    "heatwave": [
        r"\b(heatwave|heat wave|loo|extreme heat|temperature.*4[0-9]|scorching|thermal distress|heat stroke|high particulate heat)\b",
        r"(लू|भीषण गर्मी|लू के थपेड़े|ଅଂଶୁଘାତ)",
    ],
    "fog": [
        r"\b(fog|dense fog|smog|radiation fog|advection fog|zero visibility|mist|haze.*visibility < 50m|runway.*visibility)\b",
        r"(कोहरा|धुंध|ଘନ କୁହୁଡ଼ି)",
    ],
    "dust_storm": [
        r"\b(dust storm|duststorm|andhi|sandstorm|haboob|particulate wall|dust squall|air quality index.*dust)\b",
        r"(धूल भरी आंधी|अंधी|ବାଲି ଝଡ଼)",
    ],
    "strong_wind": [
        r"\b(gale|strong wind|high wind|gust|cyclonic wind|deep depression|squall.*km/h|downed trees|wind velocity)\b",
        r"(तेज हवाएं|चक्रवात|ପବନ)",
    ],
}

SEVERITY_PATTERNS = {
    "severe": [
        r"\b(severe|torrential|cloudburst|breach|death|fatal|trapped|evacuat|danger mark|emergency|catastroph|exceeding 60|zero visibility|red alert)\b",
        r"(खतरनाक|भीषण|अति गंभीर|ଭୟଙ୍କର)",
    ],
    "moderate": [
        r"\b(moderate|waterlogged|diverted|delayed|damaged roof|caution|yellow alert|reduced speed|stalled|warning)\b",
        r"(मध्यम|चेतावनी)",
    ],
    "mild": [
        r"\b(mild|light|slight|minor|surface pooling|drizzle|caution advised|intermittent)\b",
        r"(हल्का|मामूली)",
    ],
}


def rule_based_classify(text: str) -> Dict[str, Any]:
    """Deterministic meteorological classification fallback."""
    text_lower = text.lower()
    scores = {cat: 0 for cat in VALID_CATEGORIES}

    for cat, patterns in CATEGORY_PATTERNS.items():
        for pat in patterns:
            matches = re.findall(pat, text_lower)
            scores[cat] += len(matches) * 2

    # Specific contextual biases
    if "flash flood" in text_lower or "water depth" in text_lower or "embankment" in text_lower:
        scores["flooding"] += 3
    if "lightning" in text_lower or "kalbaishakhi" in text_lower:
        scores["thunderstorm"] += 3
    if "cloudburst" in text_lower or "torrential" in text_lower:
        scores["rainfall"] += 2
    if "46" in text_lower or "47" in text_lower or "loo" in text_lower:
        scores["heatwave"] += 3
    if "visibility below 50" in text_lower or "zero visibility" in text_lower:
        scores["fog"] += 3
    if "dust squall" in text_lower or "andhi" in text_lower:
        scores["dust_storm"] += 3

    # Pick top category
    sorted_cats = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    best_cat, best_score = sorted_cats[0]
    
    if best_score == 0:
        best_cat = "rainfall"
        confidence = 0.50
    else:
        confidence = min(0.95, round(0.60 + (best_score * 0.08), 2))

    # Determine severity
    sev_scores = {"severe": 0, "moderate": 0, "mild": 0}
    for sev, patterns in SEVERITY_PATTERNS.items():
        for pat in patterns:
            matches = re.findall(pat, text_lower)
            sev_scores[sev] += len(matches)

    if sev_scores["severe"] > 0:
        severity = "severe"
    elif sev_scores["moderate"] > 0:
        severity = "moderate"
    elif sev_scores["mild"] > 0:
        severity = "mild"
    else:
        severity = "moderate"

    return {
        "primary_category": best_cat,
        "severity": severity,
        "confidence": confidence,
        "engine": "deterministic_rule_engine",
        "explanation": f"Matched meteorological markers for {best_cat} with {severity} intensity."
    }


def classify_incident(text: str) -> Dict[str, Any]:
    """
    Classifies an incident text into category & severity.
    Attempts Gemini structured generation if API key is present; otherwise falls back.
    """
    if settings.GEMINI_API_KEY:
        try:
            from google import genai
            client = genai.Client(api_key=settings.GEMINI_API_KEY, http_options={"timeout": 12000})
            prompt = (
                f"You are an IMD disaster meteorological analyst. Classify this weather incident text into:\n"
                f"- category: exactly one of {VALID_CATEGORIES}\n"
                f"- severity: exactly one of {VALID_SEVERITIES}\n"
                f"- confidence: float from 0.0 to 1.0\n"
                f"- explanation: brief 1-sentence meteorological reason\n\n"
                f"Incident text: \"{text}\"\n\n"
                f"Return JSON strictly with keys: category, severity, confidence, explanation."
            )
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
            )
            parsed = json.loads(response.text.strip().replace("```json", "").replace("```", ""))
            cat = parsed.get("category", "").lower().strip()
            sev = parsed.get("severity", "").lower().strip()
            if cat in VALID_CATEGORIES and sev in VALID_SEVERITIES:
                return {
                    "primary_category": cat,
                    "severity": sev,
                    "confidence": float(parsed.get("confidence", 0.90)),
                    "engine": settings.GEMINI_MODEL,
                    "explanation": parsed.get("explanation", "Classified via Gemini AI.")
                }
        except Exception as e:
            print(f"Gemini classification fallback triggered: {e}")

    return rule_based_classify(text)
