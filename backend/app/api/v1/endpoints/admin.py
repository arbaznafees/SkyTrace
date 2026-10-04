"""
SkyTrace Admin Review & Tactical Dispatch Endpoints
---------------------------------------------------
Implements:
1. Human-in-the-loop analyst triage for borderline events (/admin/triage/{id})
2. Batch triage approval and rejection (/admin/batch)
3. Simulated NDMA escalation & SACHET public alert broadcast (/admin/dispatch)
   - Stored in `audit_logs` table
   - Does NOT invoke actual telecom or external disaster alert systems
"""

import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models.event import Event
from backend.app.models.audit_log import AuditLog
from backend.app.models.user import User
from backend.app.api.deps import require_admin, require_triage_access
from backend.app.api.v1.endpoints.chat import invalidate_event_cache

router = APIRouter(prefix="/admin", tags=["Admin & Triage"])


class TriageDecisionIn(BaseModel):
    action: str = Field(..., description="'verify' | 'reject' | 'escalate'")
    analyst_note: str = Field(..., min_length=3, description="Justification for verification override")


class BatchTriageIn(BaseModel):
    event_ids: List[str]
    action: str = Field(..., description="'verify' | 'reject'")
    batch_note: str = "Batch administrative verification"


class DispatchSimulationIn(BaseModel):
    event_id: str
    dispatch_type: str = Field(..., description="'ndma_escalation' | 'sachet_broadcast' | 'imd_bulletin' | 'sdrf_deployment'")
    target_districts: List[str] = []
    alert_severity: str = "severe"
    broadcast_message: str = Field(..., min_length=10)
    analyst_callsign: Optional[str] = "LEAD-ANALYST"


class TriageResponse(BaseModel):
    event_id: str
    event_code: str
    new_status: str
    action_taken: str
    audit_log_id: str
    message: str


class DispatchResponse(BaseModel):
    audit_log_id: str
    event_id: str
    event_code: str
    dispatch_type: str
    is_simulation: bool = True
    transmission_id: str
    carrier_relays_simulated: List[str]
    timestamp: datetime
    message: str


@router.post("/triage/{event_id}", response_model=TriageResponse)
def execute_single_triage(
    event_id: str,
    decision: TriageDecisionIn,
    current_user: User = Depends(require_triage_access),
    db: Session = Depends(get_db)
):
    """Executes single event triage override and writes to audit logs."""
    try:
        uid = uuid.UUID(event_id)
        event = db.query(Event).filter(Event.id == uid).first()
    except ValueError:
        event = db.query(Event).filter(Event.event_code == event_id).first()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event '{event_id}' not found."
        )

    act = decision.action.lower()
    if act == "verify":
        event.verification_status = "verified"
        event.trust_score = max(0.85, event.trust_score)
        event.conflict_note = f"Human verified by {current_user.full_name}: {decision.analyst_note}"
    elif act == "reject":
        event.verification_status = "rejected"
        event.conflict_note = f"Human rejected by {current_user.full_name}: {decision.analyst_note}"
    elif act == "escalate":
        event.conflict_note = f"Escalated for senior review by {current_user.full_name}: {decision.analyst_note}"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Action must be 'verify', 'reject', or 'escalate'."
        )

    event.last_updated_at = datetime.now(timezone.utc)

    # Log to audit trail
    log = AuditLog(
        event_id=event.id,
        action=f"TRIAGE_{act.upper()}",
        actor=current_user.email,
        notes=decision.analyst_note,
        payload={
            "previous_status": event.verification_status,
            "new_status": event.verification_status,
            "analyst_station": current_user.station_id
        }
    )
    db.add(log)
    db.commit()
    invalidate_event_cache()
    db.refresh(event)
    db.refresh(log)

    return TriageResponse(
        event_id=str(event.id),
        event_code=event.event_code,
        new_status=event.verification_status,
        action_taken=act,
        audit_log_id=str(log.id),
        message=f"Event {event.event_code} successfully updated to '{event.verification_status}'."
    )


@router.post("/batch", status_code=status.HTTP_200_OK)
def execute_batch_triage(
    batch: BatchTriageIn,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Performs bulk approval or dismissal across selected queue items."""
    act = batch.action.lower()
    if act not in ["verify", "reject"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Batch action must be 'verify' or 'reject'."
        )

    updated_count = 0
    for eid in batch.event_ids:
        try:
            uid = uuid.UUID(eid)
            event = db.query(Event).filter(Event.id == uid).first()
        except ValueError:
            event = db.query(Event).filter(Event.event_code == eid).first()

        if event:
            event.verification_status = "verified" if act == "verify" else "rejected"
            event.conflict_note = f"Batch {act} by {current_user.full_name}: {batch.batch_note}"
            event.last_updated_at = datetime.now(timezone.utc)
            
            log = AuditLog(
                event_id=event.id,
                action=f"BATCH_TRIAGE_{act.upper()}",
                actor=current_user.email,
                notes=batch.batch_note,
                payload={"batch_size": len(batch.event_ids)}
            )
            db.add(log)
            updated_count += 1

    db.commit()
    invalidate_event_cache()
    return {
        "status": "success",
        "action": act,
        "processed_count": updated_count,
        "message": f"Successfully batch-processed {updated_count} incidents."
    }


@router.post("/dispatch", response_model=DispatchResponse, status_code=status.HTTP_202_ACCEPTED)
def execute_simulated_dispatch(
    payload: DispatchSimulationIn,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Simulated Tactical Emergency Dispatch (NDMA Escalation & SACHET Alert Broadcast).
    
    REQUIREMENT ADDITION #3:
    Logs tactical dispatch parameters to `audit_logs` table without invoking actual
    telecommunications or national disaster warning networks.
    """
    try:
        uid = uuid.UUID(payload.event_id)
        event = db.query(Event).filter(Event.id == uid).first()
    except ValueError:
        event = db.query(Event).filter(Event.event_code == payload.event_id).first()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event '{payload.event_id}' not found for dispatch."
        )

    now = datetime.now(timezone.utc)
    transmission_id = f"SIM-DISPATCH-{uuid.uuid4().hex[:8].upper()}"
    
    target_districts = payload.target_districts or [event.district]
    carrier_relays = [
        "SIM_RELAY_BSNL_CELL_BROADCAST",
        "SIM_RELAY_AIRTEL_TELECOM_GATEWAY",
        "SIM_RELAY_JIO_EMERGENCY_RADIO",
        "SIM_RELAY_SACHET_CAP_SERVER"
    ]

    simulation_payload = {
        "is_simulation": True,
        "simulated_warning_code": "SACHET-RED-ALERT",
        "transmission_id": transmission_id,
        "event_code": event.event_code,
        "dispatch_type": payload.dispatch_type,
        "alert_severity": payload.alert_severity,
        "target_districts": target_districts,
        "target_state": event.state,
        "broadcast_message": payload.broadcast_message,
        "carrier_relays": carrier_relays,
        "estimated_simulated_reach": 450000,
        "dispatched_by_callsign": payload.analyst_callsign,
        "dispatched_by_user": current_user.email,
        "dispatched_at": now.isoformat()
    }

    # Record dispatch strictly to audit_logs
    log = AuditLog(
        event_id=event.id,
        action=f"SIMULATED_{payload.dispatch_type.upper()}",
        actor=current_user.email,
        notes=payload.broadcast_message,
        payload=simulation_payload,
        timestamp=now
    )
    db.add(log)
    
    # Update event summary annotation
    event.conflict_note = f"[SIMULATED {payload.dispatch_type.upper()} TRANSMITTED] {payload.broadcast_message[:100]}..."
    event.last_updated_at = now
    db.commit()
    db.refresh(log)

    return DispatchResponse(
        audit_log_id=str(log.id),
        event_id=str(event.id),
        event_code=event.event_code,
        dispatch_type=payload.dispatch_type,
        is_simulation=True,
        transmission_id=transmission_id,
        carrier_relays_simulated=carrier_relays,
        timestamp=now,
        message=(
            f"Simulated {payload.dispatch_type} successfully logged to Audit Log ({transmission_id}). "
            "No live public emergency broadcasts were transmitted."
        )
    )
