import sys
import os
from unittest.mock import patch

if "ujson" not in sys.modules:
    sys.modules["ujson"] = None

sys.path.insert(0, os.path.abspath("."))

from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

print("=== TESTING FAILURE SCENARIOS ===")

# Scenario 1: Gemini Unavailable
print("\n1. Testing Gemini Unavailable (Mocked API Failure)...")
with patch("backend.app.api.v1.endpoints.chat.get_cached_genai_client") as mock_client:
    # Simulate client returning None (API offline / unconfigured)
    mock_client.return_value = None
    res = client.post("/api/v1/chat", json={"message": "Are there any active floods in Puri?", "session_id": "fail-1"})
    assert res.status_code == 200
    data = res.json()
    assert data["rag_used"] is False
    assert data["intent"] == "SERVICE_UNAVAILABLE"
    assert len(data["map_snippets"]) == 0
    assert len(data["cited_events"]) == 0
    assert "temporarily unavailable" in data["reply"]
    assert "EVT-9001" not in data["reply"]
    print(f"   [PASS] Gemini Offline -> Clean service-unavailable response without fabricated events: \"{data['reply']}\"")

# Scenario 2: Gemini Throws Exception during execution
print("\n2. Testing Gemini Exception (503 / Network Error)...")
with patch("backend.app.api.v1.endpoints.chat.get_cached_genai_client") as mock_client:
    class FakeFailingClient:
        class models:
            @staticmethod
            def generate_content(*args, **kwargs):
                raise RuntimeError("Simulated Gemini API 503 Service Unavailable")
    mock_client.return_value = FakeFailingClient()
    res = client.post("/api/v1/chat", json={"message": "Are there any active floods in Puri?", "session_id": "fail-2"})
    assert res.status_code == 200
    data = res.json()
    assert data["rag_used"] is False
    assert data["intent"] == "SERVICE_UNAVAILABLE"
    assert len(data["map_snippets"]) == 0
    assert len(data["cited_events"]) == 0
    assert "temporarily unavailable" in data["reply"]
    assert "EVT-9001" not in data["reply"]
    print(f"   [PASS] Gemini Exception -> Clean service-unavailable response without fabricated events: \"{data['reply']}\"")

# Scenario 3: RAG / Database Unavailable after tool call
print("\n3. Testing RAG / DB Unavailable after tool call...")
with patch("backend.app.api.v1.endpoints.chat.execute_skytrace_retrieval") as mock_retrieval:
    mock_retrieval.side_effect = Exception("Simulated Database Connection Pool Error")
    res = client.post("/api/v1/chat", json={"message": "Are there any active floods in Puri?", "session_id": "fail-3"})
    assert res.status_code == 200
    data = res.json()
    assert data["rag_used"] is True
    assert len(data["map_snippets"]) == 0
    assert len(data["cited_events"]) == 0
    assert "Unable to retrieve operational event telemetry" in data["reply"]
    assert "EVT-9001" not in data["reply"]
    print(f"   [PASS] DB Failure -> Clean operational error notice: \"{data['reply']}\"")

# Scenario 4: Zero matching events for obscure query
print("\n4. Testing Zero Matching Events...")
from backend.app.api.v1.endpoints.chat import execute_skytrace_retrieval
from backend.app.core.database import SessionLocal
db = SessionLocal()
try:
    empty_result = execute_skytrace_retrieval("nonexistent_event_xyz_99999", db)
    assert empty_result["matched_event_count"] == 0
    assert len(empty_result["map_snippets"]) == 0
    assert len(empty_result["cited_events"]) == 0
    assert "No active verified incidents" in empty_result["evidence_summary"]
    print(f"   [PASS] Zero matching events -> Evidence summary accurately reports 0 matches: \"{empty_result['evidence_summary']}\"")
finally:
    db.close()

print("\n[ALL FAILURE SCENARIOS TESTED AND VERIFIED SUCCESSFULLY!]")
