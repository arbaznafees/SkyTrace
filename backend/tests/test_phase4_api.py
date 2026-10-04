"""
Integration Test Suite: Phase 4 API Layer & Endpoints
-----------------------------------------------------
Verifies:
1. System Health Check (/health)
2. Authentication & JWT issuance (/api/v1/auth/login)
3. Event Queries & Geospatial Bounding Box Filters (/api/v1/events)
4. Telemetry Summary Metrics for Top-Bar Tickers (/api/v1/events/stats)
5. Multi-Source Ingestion & Deduplication (/api/v1/ingest/citizen)
6. Analyst Human Triage Review (/api/v1/admin/triage/{id})
7. Simulated NDMA/SACHET Tactical Dispatch (/api/v1/admin/dispatch)
8. Conversational Assistant with Map Snippet Payload (/api/v1/chat)
"""

import sys
import os
import uuid

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.core.database import get_db
from backend.app.models.event import Event, EventReport
from backend.app.models.raw_report import RawReport
from backend.app.models.audit_log import AuditLog
from backend.app.models.user import User
from backend.app.services.seed_data import generate_seed_dataset


# In-Memory Mock Database for Fast, Self-Contained Testing
class MockQuery:
    def __init__(self, items):
        self._items = list(items)

    def filter(self, *criteria):
        filtered = []
        for item in self._items:
            match = True
            for crit in criteria:
                try:
                    col_name = crit.left.name
                    val = getattr(item, col_name)
                    op = crit.operator.__name__
                    target = crit.right.value if hasattr(crit.right, "value") else crit.right
                    
                    if op == "eq":
                        if val != target: match = False; break
                    elif op == "ge":
                        if val < target: match = False; break
                    elif op == "le":
                        if val > target: match = False; break
                    elif op in ("like_op", "ilike_op"):
                        pat = str(target).replace("%", "").lower()
                        if pat not in str(val).lower(): match = False; break
                except Exception:
                    pass
            if match:
                filtered.append(item)
        return MockQuery(filtered)

    def order_by(self, *args):
        return self

    def offset(self, n):
        return MockQuery(self._items[n:])

    def limit(self, n):
        return MockQuery(self._items[:n])

    def count(self):
        return len(self._items)

    def all(self):
        return list(self._items)

    def first(self):
        return self._items[0] if self._items else None

    def join(self, *args, **kwargs):
        return self


class MockDB:
    def __init__(self):
        self.events = []
        self.reports = []
        self.audit_logs = []
        self.users = []
        self.event_reports = []

    def query(self, model):
        if model == Event:
            return MockQuery(self.events)
        elif model == RawReport:
            return MockQuery(self.reports)
        elif model == AuditLog:
            return MockQuery(self.audit_logs)
        elif model == User:
            return MockQuery(self.users)
        elif model == EventReport:
            return MockQuery(self.event_reports)
        return MockQuery([])

    def add(self, obj):
        if isinstance(obj, Event):
            if not getattr(obj, "id", None): obj.id = uuid.uuid4()
            if obj not in self.events: self.events.append(obj)
        elif isinstance(obj, RawReport):
            if not getattr(obj, "id", None): obj.id = uuid.uuid4()
            if obj not in self.reports: self.reports.append(obj)
        elif isinstance(obj, AuditLog):
            if not getattr(obj, "id", None): obj.id = uuid.uuid4()
            if obj not in self.audit_logs: self.audit_logs.append(obj)
        elif isinstance(obj, User):
            if not getattr(obj, "id", None): obj.id = uuid.uuid4()
            if obj not in self.users: self.users.append(obj)
        elif isinstance(obj, EventReport):
            if obj not in self.event_reports: self.event_reports.append(obj)

    def commit(self): pass
    def flush(self): pass
    def rollback(self): pass
    def refresh(self, obj): pass
    def close(self): pass


# Pre-seed mock repository with the 135 canonical seed events
mock_db_instance = MockDB()
events_data, raw_reports_data = generate_seed_dataset(135)
for ed in events_data:
    ed_c = dict(ed)
    if "id" not in ed_c: ed_c["id"] = uuid.uuid4()
    mock_db_instance.add(Event(**ed_c))
for rd in raw_reports_data:
    rd_c = dict(rd)
    ev_id = rd_c.pop("event_id", None)
    if "id" not in rd_c: rd_c["id"] = uuid.uuid4()
    raw_obj = RawReport(**rd_c)
    mock_db_instance.add(raw_obj)
    if ev_id:
        mock_db_instance.add(EventReport(event_id=ev_id, raw_report_id=raw_obj.id))

# Wire dependency override
def override_get_db():
    yield mock_db_instance

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


def test_health_check():
    print("Testing Health Check Endpoint...")
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "HEALTHY"
    assert "INSAT-3D" in data["radar_feed"]
    print(f"  [PASS] Health check verified: {data['status']}")


ANALYST_TOKEN = ""
ADMIN_TOKEN = ""
EOC_TOKEN = ""


def test_auth_login():
    global ANALYST_TOKEN, ADMIN_TOKEN, EOC_TOKEN
    print("\nTesting Authentication Endpoint...")
    # 1. Analyst login
    res_analyst = client.post(
        "/api/v1/auth/login",
        json={"email": "analyst@imd.gov.in", "password": "SkyTrace@2026!"}
    )
    assert res_analyst.status_code == 200
    d_analyst = res_analyst.json()
    assert d_analyst["role"] == "analyst"
    assert len(d_analyst["access_token"]) > 20
    ANALYST_TOKEN = d_analyst["access_token"]
    print(f"  [PASS] Analyst login verified: {d_analyst['full_name']} (token issued)")

    # 2. Admin login
    res_admin = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@ndma.gov.in", "password": "SkyTrace@2026!"}
    )
    assert res_admin.status_code == 200
    d_admin = res_admin.json()
    assert d_admin["role"] == "admin"
    ADMIN_TOKEN = d_admin["access_token"]
    print(f"  [PASS] Admin login verified: {d_admin['full_name']}")

    # 3. State EOC Duty login
    res_eoc = client.post(
        "/api/v1/auth/login",
        json={"email": "eoc.duty@odisha.gov.in", "password": "SkyTrace@2026!"}
    )
    assert res_eoc.status_code == 200
    d_eoc = res_eoc.json()
    assert d_eoc["role"] == "eoc"
    EOC_TOKEN = d_eoc["access_token"]
    print(f"  [PASS] State EOC login verified: {d_eoc['full_name']} (role: {d_eoc['role']})")


def test_events_and_stats():
    print("\nTesting Event Query & Stats Endpoints...")
    # Stats
    res_stats = client.get("/api/v1/events/stats")
    assert res_stats.status_code == 200
    stats = res_stats.json()
    assert stats["total_active_events"] >= 135
    assert stats["verified_trusted_count"] > 0
    assert stats["pending_triage_count"] > 0
    assert stats["rejected_count"] > 0
    print(f"  Stats: Total={stats['total_active_events']}, Verified={stats['verified_trusted_count']}, Pending={stats['pending_triage_count']}")

    # Event query with category filter
    res_flood = client.get("/api/v1/events?category=flooding&limit=10")
    assert res_flood.status_code == 200
    floods = res_flood.json()
    print(f"  Flooding Query: Found {len(floods)} events")
    assert len(floods) > 0
    for f in floods:
        assert f["primary_category"] == "flooding"

    # Geospatial bounding-box query (Odisha region: ~19-21N, 84-87E)
    res_bbox = client.get("/api/v1/events?min_lat=18.5&max_lat=22.0&min_lon=84.0&max_lon=88.0&limit=15")
    assert res_bbox.status_code == 200
    bbox_events = res_bbox.json()
    print(f"  Geospatial Bounding Box: Found {len(bbox_events)} events in Odisha corridor")
    assert len(bbox_events) > 0
    for be in bbox_events:
        assert 18.5 <= be["latitude"] <= 22.0
        assert 84.0 <= be["longitude"] <= 88.0
    print("  [PASS] Event filters & bounding box verified.")


def test_citizen_ingest_and_triage():
    print("\nTesting Citizen Ingest & Admin Triage...")
    # Ingest a new citizen report in Puri
    payload = {
        "latitude": 19.8135,
        "longitude": 85.8312,
        "raw_text": "Waterlogging 2 feet high at Puri beach road intersection. Traffic diverted.",
        "has_verifiable_media": True,
        "reporter_handle": "#CIT-LIVE-TEST",
        "location_name": "Puri Beach Intersection"
    }
    res_ingest = client.post("/api/v1/ingest/citizen", json=payload)
    assert res_ingest.status_code == 201
    ingest_data = res_ingest.json()
    event_code = ingest_data["event_code"]
    print(f"  Ingest Result: {event_code} (Status: {ingest_data['verification_status']}, Trust: {ingest_data['trust_score']:.2f})")

    triage_payload = {
        "action": "verify",
        "analyst_note": "Confirmed by ground spotters at coastal marine drive station."
    }

    # Security check 1: Unauthenticated request MUST fail with 401
    res_unauth = client.post(f"/api/v1/admin/triage/{event_code}", json=triage_payload)
    assert res_unauth.status_code == 401, f"Expected 401 for missing token, got {res_unauth.status_code}"
    print("  [PASS] Security Check: Anonymous triage request rejected with 401 Unauthorized")

    # Security check 2: Malformed Bearer token MUST fail with 401
    res_bad_token = client.post(
        f"/api/v1/admin/triage/{event_code}",
        json=triage_payload,
        headers={"Authorization": "Bearer bad-token-xyz"}
    )
    assert res_bad_token.status_code == 401
    print("  [PASS] Security Check: Malformed token rejected with 401 Unauthorized")

    # Triage by Analyst: Allowed (200)
    res_analyst_triage = client.post(
        f"/api/v1/admin/triage/{event_code}",
        json=triage_payload,
        headers={"Authorization": f"Bearer {ANALYST_TOKEN}"}
    )
    assert res_analyst_triage.status_code == 200
    triage_data = res_analyst_triage.json()
    assert triage_data["new_status"] == "verified"
    assert "audit_log_id" in triage_data
    print(f"  [PASS] Analyst triage verified: {triage_data['message']}")

    # Triage by State EOC: Allowed (200)
    eoc_triage_payload = {
        "action": "reject",
        "analyst_note": "State EOC ground observation update."
    }
    res_eoc_triage = client.post(
        f"/api/v1/admin/triage/{event_code}",
        json=eoc_triage_payload,
        headers={"Authorization": f"Bearer {EOC_TOKEN}"}
    )
    assert res_eoc_triage.status_code == 200
    print("  [PASS] State EOC triage verified (200 OK)")


def test_simulated_dispatch_and_batch():
    print("\nTesting Simulated NDMA Escalation / SACHET Broadcast & Batch Triage...")
    dispatch_payload = {
        "event_id": "EVT-9001",
        "dispatch_type": "sachet_broadcast",
        "target_districts": ["Puri", "Khurda"],
        "alert_severity": "severe",
        "broadcast_message": "[IMD/NDMA SACHET ALERT] Severe storm inundation predicted along Puri coast. Relocate to cyclone shelters immediately.",
        "analyst_callsign": "DUTY-ANALYST-PATNAIK"
    }

    # Security check 1: Unauthenticated dispatch returns 401
    res_unauth = client.post("/api/v1/admin/dispatch", json=dispatch_payload)
    assert res_unauth.status_code == 401
    print("  [PASS] Security Check: Anonymous dispatch rejected with 401")

    # Security check 2: Analyst cannot dispatch (403 Forbidden)
    res_analyst_disp = client.post(
        "/api/v1/admin/dispatch",
        json=dispatch_payload,
        headers={"Authorization": f"Bearer {ANALYST_TOKEN}"}
    )
    assert res_analyst_disp.status_code == 403
    print("  [PASS] RBAC Check: IMD Analyst forbidden from dispatch (403)")

    # Security check 3: State EOC cannot dispatch (403 Forbidden)
    res_eoc_disp = client.post(
        "/api/v1/admin/dispatch",
        json=dispatch_payload,
        headers={"Authorization": f"Bearer {EOC_TOKEN}"}
    )
    assert res_eoc_disp.status_code == 403
    print("  [PASS] RBAC Check: State EOC forbidden from dispatch (403)")

    # Security check 4: NDMA Admin CAN dispatch (202 Accepted)
    res_admin_disp = client.post(
        "/api/v1/admin/dispatch",
        json=dispatch_payload,
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"}
    )
    assert res_admin_disp.status_code == 202
    disp_data = res_admin_disp.json()
    assert disp_data["is_simulation"] is True
    assert "SIM-DISPATCH-" in disp_data["transmission_id"]
    assert "audit_log_id" in disp_data
    print(f"  [PASS] NDMA Admin Dispatch: {disp_data['transmission_id']} ({disp_data['message'][:80]}...)")

    # Batch Triage:
    batch_payload = {
        "event_ids": ["EVT-9001"],
        "action": "verify",
        "batch_note": "Batch administrative verification test"
    }
    # Analyst cannot batch (403)
    res_analyst_batch = client.post(
        "/api/v1/admin/batch",
        json=batch_payload,
        headers={"Authorization": f"Bearer {ANALYST_TOKEN}"}
    )
    assert res_analyst_batch.status_code == 403
    print("  [PASS] RBAC Check: Analyst forbidden from batch triage (403)")

    # State EOC cannot batch (403)
    res_eoc_batch = client.post(
        "/api/v1/admin/batch",
        json=batch_payload,
        headers={"Authorization": f"Bearer {EOC_TOKEN}"}
    )
    assert res_eoc_batch.status_code == 403
    print("  [PASS] RBAC Check: State EOC forbidden from batch triage (403)")

    # Admin CAN batch (200)
    res_admin_batch = client.post(
        "/api/v1/admin/batch",
        json=batch_payload,
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"}
    )
    assert res_admin_batch.status_code == 200
    print("  [PASS] RBAC Check: NDMA Admin batch triage executed (200 OK)")


def test_chat_assistant():
    print("\nTesting Conversational Assistant with Map Snippet...")
    chat_payload = {
        "message": "Is there any active flooding reported in Puri?",
        "session_id": "test-session-1"
    }
    res_chat = client.post("/api/v1/chat", json=chat_payload)
    assert res_chat.status_code == 200
    chat_data = res_chat.json()
    assert len(chat_data["reply"]) > 20
    print(f"  Chat Reply: \"{chat_data['reply'][:100]}...\"")
    print(f"  Cited Events: {chat_data['cited_events']}")
    print(f"  Map Snippets: {len(chat_data['map_snippets'])} attached")
    if chat_data["map_snippets"]:
        first = chat_data["map_snippets"][0]
        assert "event_code" in first and "latitude" in first and "longitude" in first
    print("  [PASS] Conversational assistant & map snippets verified.")


if __name__ == "__main__":
    test_health_check()
    test_auth_login()
    test_events_and_stats()
    test_citizen_ingest_and_triage()
    test_simulated_dispatch_and_batch()
    test_chat_assistant()
    print("\n[ALL PHASE 4 API LAYER INTEGRATION TESTS PASSED SUCCESSFULLY!]")
