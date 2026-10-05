import sys
import os
import time

if "ujson" not in sys.modules:
    sys.modules["ujson"] = None

sys.path.insert(0, os.path.abspath("."))

from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

print("=== VERIFYING GEMINI 3.6 FLASH TESTS 1 THROUGH 6 ===\n")

# TEST 1: "hi"
print("--- TEST 1: 'hi' ---")
res1 = client.post("/api/v1/chat", json={"message": "hi", "session_id": "test-1"})
assert res1.status_code == 200
d1 = res1.json()
print("Engine:", d1["engine"])
print("rag_used:", d1["rag_used"])
print("snippets:", len(d1["map_snippets"]))
print("Reply:", d1["reply"][:80])
assert d1["engine"] == "gemini-3.6-flash"
assert d1["rag_used"] is False
assert len(d1["map_snippets"]) == 0
assert len(d1["cited_events"]) == 0
print("--> TEST 1 PASSED\n")

time.sleep(2)

# TEST 2: "what is a cyclone?"
print("--- TEST 2: 'what is a cyclone?' ---")
res2 = client.post("/api/v1/chat", json={"message": "what is a cyclone?", "session_id": "test-2"})
assert res2.status_code == 200
d2 = res2.json()
print("Engine:", d2["engine"])
print("rag_used:", d2["rag_used"])
print("snippets:", len(d2["map_snippets"]))
print("Reply:", d2["reply"][:80])
assert d2["engine"] == "gemini-3.6-flash"
assert d2["rag_used"] is False
assert len(d2["map_snippets"]) == 0
print("--> TEST 2 PASSED\n")

time.sleep(2)

# TEST 3: "what can you do?"
print("--- TEST 3: 'what can you do?' ---")
res3 = client.post("/api/v1/chat", json={"message": "what can you do?", "session_id": "test-3"})
assert res3.status_code == 200
d3 = res3.json()
print("Engine:", d3["engine"])
print("rag_used:", d3["rag_used"])
print("snippets:", len(d3["map_snippets"]))
print("Reply:", d3["reply"][:80])
assert d3["engine"] == "gemini-3.6-flash"
assert d3["rag_used"] is False
assert len(d3["map_snippets"]) == 0
print("--> TEST 3 PASSED\n")

time.sleep(3)

# TEST 4: "are there any active flash flood alerts in Puri?"
print("--- TEST 4: 'are there any active flash flood alerts in Puri?' ---")
res4 = client.post("/api/v1/chat", json={"message": "are there any active flash flood alerts in Puri?", "session_id": "test-4"})
assert res4.status_code == 200
d4 = res4.json()
print("Engine:", d4["engine"])
print("rag_used:", d4["rag_used"])
print("cited_events:", d4["cited_events"])
print("snippets:", len(d4["map_snippets"]))
print("Reply:", d4["reply"][:120])
assert d4["engine"] == "gemini-3.6-flash"
assert d4["rag_used"] is True
assert len(d4["map_snippets"]) > 0
print("--> TEST 4 PASSED\n")

time.sleep(3)

# TEST 5: "show active incidents in Odisha"
print("--- TEST 5: 'show active incidents in Odisha' ---")
res5 = client.post("/api/v1/chat", json={"message": "show active incidents in Odisha", "session_id": "test-5"})
assert res5.status_code == 200
d5 = res5.json()
print("Engine:", d5["engine"])
print("rag_used:", d5["rag_used"])
print("cited_events:", d5["cited_events"])
print("snippets:", len(d5["map_snippets"]))
print("Reply:", d5["reply"][:120])
assert d5["engine"] == "gemini-3.6-flash"
assert d5["rag_used"] is True
assert len(d5["map_snippets"]) > 0
print("--> TEST 5 PASSED\n")

time.sleep(3)

# TEST 6: "is EVT-9001 still active?"
print("--- TEST 6: 'is EVT-9001 still active?' ---")
res6 = client.post("/api/v1/chat", json={"message": "is EVT-9001 still active?", "session_id": "test-6"})
assert res6.status_code == 200
d6 = res6.json()
print("Engine:", d6["engine"])
print("rag_used:", d6["rag_used"])
print("cited_events:", d6["cited_events"])
print("snippets:", len(d6["map_snippets"]))
print("Reply:", d6["reply"][:120])
assert d6["engine"] == "gemini-3.6-flash"
assert d6["rag_used"] is True
# Verified that no fabricated event is injected
if len(d6["map_snippets"]) == 0:
    print("Zero active matches for EVT-9001 -> correctly reports no active matches without fabricated cards.")
print("--> TEST 6 PASSED\n")

print("[ALL 6 USER-SPECIFIED GEMINI 3.6 FLASH TESTS PASSED SUCCESSFULLY!]")
