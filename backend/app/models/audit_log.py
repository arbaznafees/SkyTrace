import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from backend.app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    
    # Action types: APPROVE, REJECT, REQUEST_RE_POLL, SIMULATED_NDMA_ESCALATION, SIMULATED_SACHET_BROADCAST, OVERRIDE
    action = Column(String(100), nullable=False, index=True)
    actor = Column(String(150), nullable=False)  # User email or system identifier
    
    # Requirement Addition #3: Full simulation payload recorded for auditability
    payload = Column(JSON, default=dict)
    notes = Column(Text, nullable=True)
    
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
