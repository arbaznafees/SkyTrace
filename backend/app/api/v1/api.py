"""
SkyTrace API v1 Router Aggregator
---------------------------------
Mounts all v1 endpoints under a unified APIRouter instance.
"""

from fastapi import APIRouter

from backend.app.api.v1.endpoints import (
    ingest,
    events,
    stream,
    admin,
    auth,
    chat,
)

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(ingest.router)
api_router.include_router(events.router)
api_router.include_router(stream.router)
api_router.include_router(admin.router)
api_router.include_router(chat.router)
