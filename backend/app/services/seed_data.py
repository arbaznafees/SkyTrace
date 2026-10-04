"""
SkyTrace Phase 1 Synthetic Seed Data Generator
----------------------------------------------
Generates a realistic, meteorologically grounded dataset of 130+ weather incident
reports and canonical merged events across diverse Indian states and all 7 IMD categories.

REQUIREMENT ADDITION #1:
Assigns a synthetic ground-truth trust label (0 or 1) to each record based on
source type credibility and corroboration count with deliberate probabilistic noise (~10%).
This labeled set is what the Phase 3 Logistic Regression trust classifier will train on,
providing an explainable training baseline in the absence of external historical ground truth.

REQUIREMENT ADDITION #2:
Uses boolean `has_verifiable_media` (True/False) for trust modeling rather than an arbitrary CV score.
"""

import random
import uuid
from datetime import datetime, timezone, timedelta

# Realistic Indian meteorological regions with representative coordinates
INDIAN_REGIONS = [
    {
        "state": "Odisha",
        "districts": [
            {"name": "Puri", "lat": 19.8135, "lon": 85.8312, "loc": "Puri Coastal Marine Drive"},
            {"name": "Balasore", "lat": 21.4934, "lon": 86.9135, "loc": "Chandipur Interceptor Belt"},
            {"name": "Khurda", "lat": 20.2961, "lon": 85.8245, "loc": "Bhubaneswar Urban Drainage Canal"},
            {"name": "Ganjam", "lat": 19.3149, "lon": 84.7941, "loc": "Gopalpur Port Corridor"},
        ],
        "primary_risks": ["flooding", "thunderstorm", "strong_wind", "rainfall"],
        "radar": "PARADIP-DOPPLER 58dBZ"
    },
    {
        "state": "West Bengal",
        "districts": [
            {"name": "Kolkata", "lat": 22.5726, "lon": 88.3639, "loc": "EM Bypass / Salt Lake Sector V"},
            {"name": "South 24 Parganas", "lat": 22.1452, "lon": 88.5831, "loc": "Sundarbans Delta Coastal Wall"},
            {"name": "Darjeeling", "lat": 27.0410, "lon": 88.2663, "loc": "Rohini Hill Road Sector 4"},
        ],
        "primary_risks": ["thunderstorm", "rainfall", "flooding", "fog"],
        "radar": "KOLKATA-DWR 52dBZ"
    },
    {
        "state": "Jharkhand",
        "districts": [
            {"name": "Ranchi", "lat": 23.3441, "lon": 85.3096, "loc": "Subarnarekha River Basin"},
            {"name": "East Singhbhum", "lat": 22.8046, "lon": 86.2029, "loc": "Jamshedpur Industrial Outer Belt"},
            {"name": "Dhanbad", "lat": 23.7957, "lon": 86.4304, "loc": "Jharia Mining Drainage Cut"},
        ],
        "primary_risks": ["thunderstorm", "strong_wind", "heatwave"],
        "radar": "RANCHI-AWS METAR"
    },
    {
        "state": "Maharashtra",
        "districts": [
            {"name": "Mumbai City", "lat": 18.9220, "lon": 72.8347, "loc": "Colaba Tidal Inundation Zone"},
            {"name": "Mumbai Suburban", "lat": 19.0760, "lon": 72.8777, "loc": "Mithi River / Milan Subway Underpass"},
            {"name": "Thane", "lat": 19.2183, "lon": 72.9781, "loc": "Ghopbunder Road Low Corridor"},
            {"name": "Nagpur", "lat": 21.1458, "lon": 79.0882, "loc": "Vidarbha Agro-Climatic Belt"},
        ],
        "primary_risks": ["flooding", "rainfall", "heatwave", "strong_wind"],
        "radar": "MUMBAI-DWR S-BAND"
    },
    {
        "state": "Assam",
        "districts": [
            {"name": "Kamrup Metropolitan", "lat": 26.1445, "lon": 91.7362, "loc": "Guwahati Bharalu Basin"},
            {"name": "Dibrugarh", "lat": 27.4728, "lon": 94.9120, "loc": "Brahmaputra South Dyke Embankment"},
            {"name": "Cachar", "lat": 24.8333, "lon": 92.7789, "loc": "Silchar Barak River Overflow"},
        ],
        "primary_risks": ["flooding", "rainfall", "thunderstorm"],
        "radar": "GUWAHATI-DWR 48dBZ"
    },
    {
        "state": "Delhi NCR",
        "districts": [
            {"name": "New Delhi", "lat": 28.6139, "lon": 77.2090, "loc": "Ring Road Minto Bridge Underpass"},
            {"name": "South Delhi", "lat": 28.5355, "lon": 77.2410, "loc": "Mehrauli-Gurugram Border Cut"},
            {"name": "North Delhi", "lat": 28.7041, "lon": 77.1025, "loc": "Yamuna Floodplain Marginal Bund"},
        ],
        "primary_risks": ["dust_storm", "fog", "heatwave", "flooding"],
        "radar": "PALAM-DWR POLARIMETRIC"
    },
    {
        "state": "Rajasthan",
        "districts": [
            {"name": "Jodhpur", "lat": 26.2389, "lon": 73.0243, "loc": "Marwar Desert Rim Sector 2"},
            {"name": "Bikaner", "lat": 28.0229, "lon": 73.3119, "loc": "Thar High Particulate Wall"},
            {"name": "Churu", "lat": 28.2900, "lon": 74.9600, "loc": "Shekhawati Heat Incline Core"},
        ],
        "primary_risks": ["dust_storm", "heatwave", "strong_wind"],
        "radar": "JAIPUR-DWR RADAR"
    },
    {
        "state": "Gujarat",
        "districts": [
            {"name": "Kutch", "lat": 23.7337, "lon": 69.8597, "loc": "Kandla Port Tidal Creek"},
            {"name": "Surat", "lat": 21.1702, "lon": 72.8311, "loc": "Tapi River Causeway Submersion"},
            {"name": "Ahmedabad", "lat": 23.0225, "lon": 72.5714, "loc": "Sabarmati Riverfront Low Underpass"},
        ],
        "primary_risks": ["strong_wind", "flooding", "rainfall", "heatwave"],
        "radar": "BHUJ-DOPPLER SYSTEM"
    }
]

# Source credibility weights
SOURCE_TYPES = [
    ("imd_aws", 0.98, "@IMD_WeatherStation"),
    ("traffic_cctv", 0.88, "TrafficPolice_ControlRoom"),
    ("emergency_112", 0.94, "State_112_CAD_Relay"),
    ("citizen", 0.72, "#CIT-"),
    ("social", 0.45, "@CycloneTrack_Ind"),
]

# Incident categories with authentic meteorological text templates
CATEGORY_TEMPLATES = {
    "flooding": [
        ("Flash Flooding & Roadway Inundation", "Water depth exceeding 1.5 feet covering arterial road. Vehicles stalled, drainage sluice gates overflowed into low-lying settlements.", "severe"),
        ("Urban Waterlogging in Underpass", "Subway underpass completely submerged. Barricades deployed by local police; traffic rerouted.", "moderate"),
        ("Riverine Embankment Breach Alert", "Rising river levels approaching danger mark. Ground spotters confirm agricultural fields inundated on peripheral boundary.", "severe"),
    ],
    "thunderstorm": [
        ("Severe Kalbaishakhi Supercell with Intense Lightning", "Rapid mesocyclone formation with violent cloud-to-ground lightning clusters and squall winds.", "severe"),
        ("Convective Thunderstorm Line with Hail", "Strong convective thunder cell accompanied by heavy localized precipitation and structural roof damage.", "moderate"),
        ("Pre-Monsoon Thunder Squall", "Squall front advancing at 45 km/h with sudden pressure drop and lightning strikes on open terrain.", "moderate"),
    ],
    "rainfall": [
        ("Extremely Heavy Rainfall (Torrential Cloudburst)", "Automatic rain gauge recording >65 mm/hr continuous rainfall. Local stormwater drains breached capacity.", "severe"),
        ("Persistent Heavy Monsoon Downpour", "Widespread active rainfall band with continuous accumulation over last 4 hours impacting visibility.", "moderate"),
        ("Localized Moderate Rain Surge", "Consistent rainfall causing surface pooling on highway shoulders; traffic moving at reduced speeds.", "mild"),
    ],
    "heatwave": [
        ("Severe Heatwave Wave Surge (Loo Winds)", "Surface temperatures crossing 46.5°C with intense desiccating dry winds. Heat index alert declared for vulnerable populations.", "severe"),
        ("Extreme Heat Condition Alert", "Maximum temperature exceeding normal by 5.2°C; public advised to avoid outdoor exposure between 12:00-15:00 hrs.", "moderate"),
        ("Elevated Nighttime Heat Index", "Unusually high minimum temperature (33°C) with persistent thermal distress in urban core.", "moderate"),
    ],
    "fog": [
        ("Dense Advection Winter Fog (Zero Visibility)", "Runway and highway visibility dropped below 50 meters. Rail transit severely delayed along northern corridor.", "severe"),
        ("Moderate Morning Radiation Fog", "Visibility restricted to 200-300 meters across rural lowlands; caution advised on expressways.", "moderate"),
        ("Localized Riverine Mist & Fog", "Dense thermal mist rising from river basin obscuring ferry transit routes.", "mild"),
    ],
    "dust_storm": [
        ("Severe Andhi / High-Velocity Dust Squall", "Towering wall of sand and particulate matter advancing across urban sector. Visibility dropped instantaneously to <100m.", "severe"),
        ("Particulate Dust Surge & High Gusts", "Strong gust front carrying dense desert dust with wind velocities exceeding 60 km/h.", "moderate"),
        ("Dry Wind Dust Whirlwind", "Localized dust swirl causing reduced visibility and air quality index degradation.", "mild"),
    ],
    "strong_wind": [
        ("Gale-Force Coastal Wind Front (Squall 65kt)", "Deep cyclonic depression generating sustained gale-force winds with downed trees and power utility disruptions.", "severe"),
        ("High-Velocity Gust Front", "Damaging wind gusts recorded at automated station; commercial hoardings and light structures compromised.", "moderate"),
        ("Gusty Offshore Surface Breeze", "Wind speeds averaging 35-45 km/h with choppy waters; small fishing craft warned to stay near shore.", "mild"),
    ]
}


def generate_seed_dataset(target_count=135):
    """
    Generates structured seed records for both `raw_reports` and `events`.
    Enforces Requirement Additions #1 and #2:
    - `synthetic_ground_truth` (0 or 1) assigned via deterministic rule + probabilistic noise.
    - `has_verifiable_media` (bool) used for trust modeling.
    """
    random.seed(42)  # Deterministic seed for reproducible testing
    now = datetime.now(timezone.utc)
    
    events_data = []
    raw_reports_data = []
    
    categories = list(CATEGORY_TEMPLATES.keys())
    
    for i in range(1, target_count + 1):
        event_code = f"EVT-{9000 + i}"
        region = random.choice(INDIAN_REGIONS)
        district_info = random.choice(region["districts"])
        
        # Select category biased towards region's primary risks
        if random.random() < 0.70:
            category = random.choice(region["primary_risks"])
        else:
            category = random.choice(categories)
            
        template_title, template_desc, default_sev = random.choice(CATEGORY_TEMPLATES[category])
        
        # Corroboration report count: between 1 and 28 reports
        report_count = random.choices([1, 2, 3, 5, 8, 14, 22], weights=[20, 25, 20, 15, 10, 6, 4])[0]
        
        # Requirement Addition #2: Boolean media presence
        has_verifiable_media = random.random() < (0.75 if category in ["flooding", "thunderstorm", "dust_storm"] else 0.35)
        
        # Select dominant source type
        if report_count >= 5:
            primary_src_type, src_cred, src_prefix = random.choice([SOURCE_TYPES[0], SOURCE_TYPES[1], SOURCE_TYPES[2]])
        elif report_count >= 2:
            primary_src_type, src_cred, src_prefix = random.choice([SOURCE_TYPES[3], SOURCE_TYPES[0]])
        else:
            primary_src_type, src_cred, src_prefix = random.choice([SOURCE_TYPES[3], SOURCE_TYPES[4]])
            
        # Time distribution: from 5 minutes ago to 36 hours ago
        minutes_ago = random.randint(4, 36 * 60)
        first_reported = now - timedelta(minutes=minutes_ago)
        last_updated = first_reported + timedelta(minutes=min(minutes_ago - 1, random.randint(2, 45)))
        
        # Slight coordinate jitter for merged reports centroid
        lat = district_info["lat"] + random.uniform(-0.03, 0.03)
        lon = district_info["lon"] + random.uniform(-0.03, 0.03)
        
        # Base trust score calculation:
        # Weighted combination of source credibility (50%), corroboration volume (35%), and media presence (15%)
        corrob_factor = min(1.0, report_count / 8.0)
        media_factor = 1.0 if has_verifiable_media else 0.0
        
        raw_trust = (0.50 * src_cred) + (0.35 * corrob_factor) + (0.15 * media_factor)
        # Add realistic noise (-0.08 to +0.08)
        trust_score = round(max(0.12, min(0.99, raw_trust + random.uniform(-0.08, 0.08))), 3)
        
        # REQUIREMENT ADDITION #1: Synthetic ground-truth label (0 or 1) for Phase 3 ML training
        # Assigned based on authoritative source or strong corroboration + deliberate ~8% noise
        ground_truth_rule = 1 if (primary_src_type in ["imd_aws", "emergency_112"] or report_count >= 5 or (report_count >= 2 and has_verifiable_media)) else 0
        if random.random() < 0.08:
            synthetic_ground_truth = 1 - ground_truth_rule  # Deliberate label flip / noise
        else:
            synthetic_ground_truth = ground_truth_rule
            
        # Independent 3-way platform verification status assignment
        # Ensures roughly 65% verified, 25% pending_triage, 10% rejected across the dataset
        # so Analyst Dashboard, Admin Review Queue, and Event Detail screens have events in all 3 badge states
        status_roll = random.random()
        if status_roll < 0.58:
            verification_status = "verified"
            trust_score = round(random.uniform(0.80, 0.98), 3)
            conflict_note = None
        elif status_roll < 0.88:  # 0.58 to 0.88 (~30%)
            verification_status = "pending_triage"
            trust_score = round(random.uniform(0.55, 0.77), 3)
            conflict_note = random.choice([
                "Conflicting telemetry: IMD AWS shows normal baseline but 2 citizen photos claim zero visibility.",
                "Borderline corroboration count; awaiting automated second-pass sensor triangulation.",
                "Single social media mention with unverified GPS lock; radar sweep indicates convective cell at boundary.",
                "Citizen report indicates deep roadway water; district canal gauge currently reporting stable margin."
            ])
        else:  # 0.88 to 1.00 (~12%)
            verification_status = "rejected"
            trust_score = round(random.uniform(0.18, 0.49), 3)
            conflict_note = "Filtered as noise / uncorroborated single-source post below confidence gate."
            
        # Severe alert threshold for life-safety items
        if default_sev == "severe" and verification_status == "verified" and random.random() < 0.35:
            action_taken = random.choice(["ndma_escalated", "sachet_broadcast"])
        else:
            action_taken = "none"
            
        headline = f"{template_title} - {district_info['name']}"
        summary = f"{template_desc} Reported locus near {district_info['loc']}, {region['state']}."
        
        event_record = {
            "id": uuid.uuid4(),
            "event_code": event_code,
            "primary_category": category,
            "severity": default_sev,
            "latitude": round(lat, 5),
            "longitude": round(lon, 5),
            "location_name": f"{district_info['loc']}, {district_info['name']}",
            "district": district_info["name"],
            "state": region["state"],
            "report_count": report_count,
            "trust_score": trust_score,
            "verification_status": verification_status,
            "synthetic_ground_truth": synthetic_ground_truth,
            "has_verifiable_media": has_verifiable_media,
            "headline": headline,
            "summary": summary,
            "conflict_note": conflict_note,
            "sensor_ref": f"IMD-GRID // {region['radar']}",
            "action_taken": action_taken,
            "first_reported_at": first_reported,
            "last_updated_at": last_updated,
            "event_date": first_reported.date(),
        }
        events_data.append(event_record)
        
        # Generate constituent raw reports feeding into this event
        for r_idx in range(report_count):
            r_type, r_cred, r_pref = random.choice(SOURCE_TYPES) if r_idx > 0 else (primary_src_type, src_cred, src_prefix)
            handle = f"{r_pref}{random.randint(1000, 9999)}" if "-" in r_pref else r_pref
            
            raw_reports_data.append({
                "id": uuid.uuid4(),
                "event_id": event_record["id"],
                "source_type": r_type,
                "source_handle": handle,
                "source_credibility": r_cred,
                "raw_text": f"[{category.upper()}] {template_desc} Observed at {district_info['loc']}. #IMD #WeatherAlert",
                "language": random.choice(["en", "en", "hi", "or"] if region["state"] == "Odisha" else ["en", "hi"]),
                "has_verifiable_media": has_verifiable_media if r_idx == 0 else (random.random() < 0.25),
                "media_urls": [f"https://skytrace.in/media/{event_code}_{r_idx}.jpg"] if has_verifiable_media else [],
                "reported_at": first_reported + timedelta(minutes=r_idx * random.randint(1, 10)),
                "latitude": round(lat + random.uniform(-0.01, 0.01), 5),
                "longitude": round(lon + random.uniform(-0.01, 0.01), 5),
                "location_name": district_info["loc"],
                "district": district_info["name"],
                "state": region["state"],
                "status": "merged" if verification_status != "rejected" else "rejected",
            })
            
    return events_data, raw_reports_data
