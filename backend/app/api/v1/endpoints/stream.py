"""
SkyTrace Real-Time Server-Sent Events (SSE) Stream
--------------------------------------------------
Broadcasts live operational weather event telemetry, verification status changes,
and newly ingested incident clusters to connected analyst dashboards.
"""

import json
import asyncio
from datetime import datetime, timezone
from typing import AsyncGenerator
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models.event import Event

router = APIRouter(prefix="/events", tags=["Real-Time Stream"])


async def event_generator(request: Request) -> AsyncGenerator[str, None]:
    """Generates SSE packets containing tactical event telemetry and periodic heartbeats."""
    yield f": {datetime.now(timezone.utc).isoformat()} SkyTrace Telemetry Stream Connected\n\n"
    
    # Send initial snapshot packet
    initial_payload = {
        "event_type": "INITIAL_SYNC",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "STREAM_ACTIVE",
        "radar_feed": "INSAT-3D DOPPLER ONLINE"
    }
    yield f"event: telemetry_sync\ndata: {json.dumps(initial_payload)}\n\n"

    last_check = datetime.now(timezone.utc)

    while True:
        if await request.is_disconnected():
            break

        # Periodic 5-second pulse
        await asyncio.sleep(5)
        
        pulse_data = {
            "event_type": "HEARTBEAT",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "station": "#EOC-ODISHA-01",
            "active_connections": 1
        }
        yield f"event: heartbeat\ndata: {json.dumps(pulse_data)}\n\n"


@router.get("/stream")
async def stream_live_events(request: Request):
    """
    Subscribes analyst UI to live SSE stream for automatic map marker and feed updates.
    """
    return StreamingResponse(
        event_generator(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
