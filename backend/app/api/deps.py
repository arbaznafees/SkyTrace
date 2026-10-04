"""
SkyTrace Common API Dependencies
--------------------------------
Provides DB session access, JWT bearer token extraction, and RBAC role validation.
"""

from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.core.security import decode_access_token
from backend.app.models.user import User

security_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db)
) -> User:
    """Extracts and validates current authenticated user from Bearer JWT."""
    if not auth or not auth.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(auth.credentials)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.email == payload["sub"]).first()
    if not user:
        from backend.app.api.v1.endpoints.auth import DEMO_ACCOUNTS
        demo = DEMO_ACCOUNTS.get(payload["sub"])
        if demo:
            user = User(
                email=payload["sub"],
                full_name=demo["full_name"],
                role=demo["role"],
                station_id=demo["station_id"]
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"},
            )
    return user


def require_triage_access(current_user: User = Depends(get_current_user)) -> User:
    """Allows operational duty personnel (analyst, eoc, admin) to triage individual reports."""
    if current_user.role not in ["admin", "analyst", "eoc"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Triage verification authorization required."
        )
    return current_user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Ensures user has 'admin' privilege for executive dispatch & batch overrides."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Elevated administrative clearance required for this operation."
        )
    return current_user
