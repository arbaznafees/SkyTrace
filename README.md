# SkyTrace — National Weather Intelligence & Verification Platform

## 🚀 Live Deployments & Documentation

* **Frontend Application (Vercel):** [https://sky-trace-drab.vercel.app](https://sky-trace-drab.vercel.app)
* **Backend API & Swagger Docs (Render):** [https://skytrace-ojb5.onrender.com/docs](https://skytrace-ojb5.onrender.com/docs)

SkyTrace is an end-to-end meteorological intelligence, deduplication, and verification platform built for **NDMA (National Disaster Management Authority)** and **IMD (India Meteorological Department)** analysts.

The system continuously ingests crowdsourced weather observations from social media (#IMD, #CycloneWarning), mobile citizen observers, and automated weather stations (IMD AWS / Doppler radar networks). An AI pipeline normalizes, embeds (cross-lingually across Indian languages), deduplicates, and scores the trust probability of incoming reports before surfacing them on a live operations map and a conversational assistant.

---

## 1. System Architecture

```
                    ┌──────────────────────────────────────────────┐
                    │            MULTI-SOURCE INTAKE CHANNELS      │
                    │  • Citizen Portal (/api/v1/ingest/citizen)   │
                    │  • Social Feeds   (/api/v1/ingest/social)    │
                    │  • IMD Sensors    (/api/v1/ingest/imd)       │
                    └───────────────────────┬──────────────────────┘
                                            │
                                            ▼
                    ┌──────────────────────────────────────────────┐
                    │               STAGING TABLE                  │
                    │         raw_reports (PostgreSQL)             │
                    └───────────────────────┬──────────────────────┘
                                            │
                                            ▼
                    ┌──────────────────────────────────────────────┐
                    │       CROSS-LINGUAL EMBEDDING PIPELINE       │
                    │   paraphrase-multilingual-MiniLM-L12-v2      │
                    │   384-dimensional dense semantic vectors     │
                    └───────────────────────┬──────────────────────┘
                                            │
                                            ▼
                    ┌──────────────────────────────────────────────┐
                    │     SPATIO-TEMPORAL DEDUPLICATION ENGINE     │
                    │   • Spatial buffer: PostGIS ST_DWithin, 25km │
                    │   • Time window: 6 hours                     │
                    │   • Category matching: exact / compatible    │
                    │   • Cosine similarity: pgvector >= 0.70      │
                    └───────────────────────┬──────────────────────┘
                                            │
                         ┌──────────────────┴──────────────────┐
                         ▼                                     ▼
                   [Match Found]                         [No Match]
               Corroborate into Event               Seed New Event Code
                         │                                     │
                         └──────────────────┬──────────────────┘
                                            │
                                            ▼
                    ┌──────────────────────────────────────────────┐
                    │      SCIKIT-LEARN TRUST VERIFIER MODEL       │
                    │   Logistic Regression (5-Fold CV: 83.0%)     │
                    │   • source_credibility  • sensor_agreement   │
                    │   • corroboration_count • has_verifiable_media│
                    └───────────────────────┬──────────────────────┘
                                            │
             ┌──────────────────────────────┼──────────────────────────────┐
             ▼                              ▼                              ▼
      [Score >= 0.80]              [0.50 <= Score < 0.80]           [Score < 0.50]
       VERIFIED                      PENDING TRIAGE                   REJECTED
    (Operations Map)              (Human Review Queue)            (Noise Suppression)
```

The 6-hour temporal window and 0.70 similarity threshold above are the exact `TEMPORAL_WINDOW_HOURS` and `SEMANTIC_SIMILARITY_THRESHOLD` constants in `deduplication.py`, confirmed directly against source.

---

## 2. Core Frontend Surfaces

SkyTrace uses a clean, light interface suited for an official government disaster-management platform — white/off-white canvas, a single professional blue accent for primary actions, Inter / IBM Plex Sans typography, and `lucide-react` SVG icons throughout (no icon-font dependency). Verification status (**verified** / **pending** / **rejected**) is shown as a color-coded 4px left-edge bar and badge on every event, consistently across all screens.

1. **Duty Officer Sign-In (`/login` & `/`)**
   - Live incident banner showing the current highest-severity verified event, queried directly from the API (not static).
   - Live-queried operational metrics: Reports Ingested, Noise Suppression, Verification Rate.
   - Role shortcuts (IMD Analyst, NDMA Admin, State EOC) that pre-fill demo credentials for evaluation.
   - Public Citizen Observer Portal entry point — no sign-in required to submit a ground report.

2. **Operations Dashboard (`/dashboard`)**
   - Interactive Leaflet map on free OpenStreetMap tiles (no API key, no watermark) showing all active events as color-coded pins.
   - Left sidebar: GIS Hazard Map, Live Telemetry Feed, Triage & Review, and Broadcast Alerts modules.
   - Filter panel: time window, verification status, geographic sector, and all 7 canonical IMD hazard categories (`flooding`, `rainfall`, `thunderstorm`, `strong_wind`, `heatwave`, `fog`, `dust_storm`).
   - Live Incident Stream panel with search and sort (Recency vs Threat Level), each card carrying its verification edge bar.
   - Clicking a pin or card opens the Event Detail drawer with full trust-score attribution and Approve / Reject / Escalate actions.

3. **Review & Incident Triage Queue (`/admin/review-queue`)**
   - Four live metric cards: Response Velocity, Triage Sample Size, Auto-Approval Rate, Noise Suppression — all computed from real `events` and `audit_logs` data, not placeholders.
   - Filter tabs: Awaiting Review, High Severity, Sensor Divergence, Citizen Photos.
   - Per-row Approve / Reject actions and a sticky batch action bar for bulk decisions.

4. **Citizen Ground Observation Report (`/citizen-report`)**
   - 4-step public submission form: weather phenomenon (7 canonical categories), severity, location (live GPS with Indian PIN code fallback), and optional photo evidence.
   - Two-tier citizen credibility: anonymous (`0.65`, `#CIT-ANON`) vs identified (`0.72`, `#CIT-8821`) — a fixed baseline per report, not a persistent cross-session trust history.
   - Submits directly into the live deduplication pipeline and returns a real event code and trust score.

5. **SkyTrace Disaster Intelligence Assistant (`/chat`)**
   - Conversational assistant grounded in the live verified-events database — answers are retrieved from real data, not generated from unretrieved model knowledge.
   - Dynamic location-resolution banner that updates per query (verified working across Puri/Odisha, Dibrugarh/Assam, Churu/Rajasthan).
   - Real-time 4-stage incremental retrieval progress feedback ticker (`Querying INSAT-3D Doppler...` → `Correlating spatial incident clusters...` → `Cross-referencing IMD ground-truth...` → `Synthesizing tactical briefing...`) with an animated progress bar.
   - Inline map snippet cards with dynamic color-coded verification badges (`VERIFIED`, `UNDER REVIEW`, `REJECTED`) and deep links to `/dashboard?event=${event_code}` and `/citizen-report`.

---

## 3. Data Integrity & Transparency Notes

All figures and features described here reflect what the code and data models actually compute. Where a feature is simulated or illustrative, it's labeled as such below rather than presented as live.

1. **Synthetic ground-truth trust labels.** No historical crowdsourced disaster trust data exists. Seed generation assigns synthetic ground-truth labels (`synthetic_ground_truth`: 0/1) based on source credibility, sensor proximity, and corroboration count, with ~8–10% deliberate label noise to simulate real-world reporting uncertainty. The Logistic Regression trust model trains on this set and achieves **83.0% ± 7.6%** on stratified 5-fold cross-validation.
2. **Media verification is a boolean signal.** `has_verifiable_media` (true/false) is a binary metadata indicator — whether photo/video evidence was attached — converted directly to a 0/1 feature for the trust model. There is no computer vision or image-analysis model in the ingest path; Gemini is used only for text tasks (incident classification, borderline-case reasoning, and the conversational assistant), never to inspect uploaded images.
3. **Emergency dispatch is simulated.** `POST /api/v1/admin/dispatch` (NDMA escalation / SACHET broadcast) logs a structured payload and transmission ID to `audit_logs`. It does **not** call any real external emergency-alert system.
4. **Citizen credibility is a fixed baseline, not a trust history.** `#CIT-8821` / `#CIT-ANON` style callsigns represent a fixed credibility tier (0.72 / 0.65) applied per report. The system does not currently track or accumulate a per-observer trust history across multiple submissions.
5. **Operational metric definitions:**
   - **Verification Rate** = `verified_count / (verified_count + rejected_count) × 100` (auto-approval ratio — not a statistical calibration measure).
   - **Noise Suppression** = `(total_raw_reports − total_canonical_events) / total_raw_reports × 100` (deduplication suppression ratio).
   - **Response Velocity** = average triage latency across real `audit_logs` triage records.

---

## 4. Quickstart & Local Setup

### Prerequisites
- Python 3.10+
- Node.js 18+ (20+ recommended)
- Hosted PostgreSQL with `PostGIS` and `pgvector` enabled — Supabase **session pooler**, port 5432 (not the transaction pooler on 6543, which requires disabling SQLAlchemy prepared-statement caching).

### Environment Configuration

**Backend (`backend/.env`):**
```env
DATABASE_URL=postgresql://postgres.xxx:password@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
GEMINI_API_KEY=your_gemini_api_key_here
JWT_SECRET_KEY=your_jwt_secret_key_here
```

**Frontend (`frontend/.env.local`):**
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Both `.env` files are gitignored; see `.env.example` in each directory for the variable names only.

### Running the Backend
```bash
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```
API docs: `http://localhost:8000/docs`


### Running the Frontend
```bash
cd frontend
npm install
npm run dev
``` 
Open `http://localhost:3000`.

### Demo Sign-In Credentials

The sign-in portal (`/login`) includes one-click role buttons that pre-fill these credentials:

| Role | Email | Password | Landed Interface |
|---|---|---|---|
| **IMD Analyst** | `analyst@imd.gov.in` | `SkyTrace@2026!` | Operations Dashboard (`/dashboard`) |
| **NDMA Admin** | `admin@ndma.gov.in` | `SkyTrace@2026!` | Review & Incident Triage Queue (`/admin/review-queue`) |
| **State EOC** | `eoc.duty@odisha.gov.in` | `SkyTrace@2026!` | Operations Dashboard (`/dashboard`) |

### Role-Based Access Control (RBAC) Matrix

| Capability / Endpoint | NDMA Admin (`admin`) | IMD Analyst (`analyst`) | State EOC (`eoc`) | Public / Guest |
|---|:---:|:---:|:---:|:---:|
| **View Dashboard & Telemetry** (`/dashboard`, `/events`) | Allowed | Allowed | Allowed | Allowed |
| **Citizen & AWS Ingestion** (`/ingest/*`) | Allowed | Allowed | Allowed | Allowed |
| **Assistant Chat** (`/chat`) | Allowed | Allowed | Allowed | Allowed |
| **Single Incident Triage** (`/admin/triage/{id}`) | Allowed | Allowed | Allowed | 401 Unauthorized |
| **Batch Triage Overrides** (`/admin/batch`) | Allowed | 403 Forbidden | 403 Forbidden | 401 Unauthorized |
| **Tactical Alert Dispatch** (`/admin/dispatch`) | Allowed | 403 Forbidden | 403 Forbidden | 401 Unauthorized |
| **Review Queue Access** (`/admin/review-queue`) | Full Access | Redirected | Redirected | Redirected |

> **Note:** The Public Citizen Observer Portal (`/citizen-report`) and Disaster Intelligence Assistant (`/chat`) require no authentication and can be accessed directly.

---

## 5. API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/auth/login` | POST | Authenticate and issue a signed JWT |
| `/api/v1/events` | GET | Query canonical events with spatial & category filters |
| `/api/v1/events/{id}` | GET | Fetch a single event with linked raw-report evidence |
| `/api/v1/events/stats` | GET | Live operational metrics (triage velocity, suppression, verification rate) |
| `/api/v1/ingest/citizen` | POST | Ingest a civic weather observation |
| `/api/v1/ingest/social` | POST | Ingest a social media weather report |
| `/api/v1/ingest/imd` | POST | Ingest automated weather-station (AWS) telemetry |
| `/api/v1/admin/triage/{id}` | POST | Human analyst verification override |
| `/api/v1/admin/batch` | POST | Batch triage approval/rejection |
| `/api/v1/admin/dispatch` | POST | Simulated NDMA escalation / SACHET broadcast |
| `/api/v1/chat` | POST | Conversational assistant with dynamic location resolution |

---

## 6. Automated Test Suite

```bash
python -m pytest backend/tests/
```

Validates:
1. Synthetic ground-truth distribution and spatial bounding boxes across 8 monitored Indian states.
2. Cross-lingual embedding quality — confirmed English/Hindi/Marathi paraphrase matching (0.80–0.85 cosine similarity range). *(Odia has not yet been explicitly tested despite Odisha being a primary seed region — worth adding given the platform's stated multilingual scope.)*
3. Semantic deduplication clustering at the `≥0.70` threshold, including a negative test confirming two distinct nearby events are correctly kept separate.
4. Stratified 5-fold cross-validation of the trust model (83.0% ± 7.6%).
5. Simulated dispatch logging with no external side effects.
