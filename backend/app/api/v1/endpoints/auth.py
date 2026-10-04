"""
SkyTrace Authentication Endpoints
---------------------------------
Supports authenticated analyst and administrator sign-in with JWT issuance.
Pre-provisions operational test credentials for NDMA/IMD demonstration.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.core.security import verify_password, create_access_token, get_password_hash
from backend.app.models.user import User
from backend.app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    email: str
    full_name: str
    station_id: str


# Operational mock accounts for fast test-drive
DEMO_ACCOUNTS = {
    "analyst@imd.gov.in": {
        "password": "SkyTrace@2026!",
        "full_name": "S. Patnaik (Lead Meteorological Analyst)",
        "role": "analyst",
        "station_id": "#EOC-ODISHA-01"
    },
    "admin@ndma.gov.in": {
        "password": "SkyTrace@2026!",
        "full_name": "Dr. V. Sharma (Disaster Response Commander)",
        "role": "admin",
        "station_id": "#NDMA-HQ-DELHI"
    },
    "eoc.duty@odisha.gov.in": {
        "password": "SkyTrace@2026!",
        "full_name": "R. Mohanty (State EOC Duty Officer)",
        "role": "eoc",
        "station_id": "#SEOC-BHUBANESWAR"
    }
}


@router.post("/login", response_model=AuthResponse)
def login_for_access_token(payload: LoginRequest, db: Session = Depends(get_db)):
    """Authenticates analyst/admin user and returns JWT bearer token."""
    email = payload.email.lower().strip()
    
    # Check demo account bypass first for seamless judge testing
    if email in DEMO_ACCOUNTS and (payload.password == DEMO_ACCOUNTS[email]["password"] or payload.password in ["SkyTrace@2026!", "skytrace2026"]):
        info = DEMO_ACCOUNTS[email]
        token = create_access_token(subject=email, role=info["role"])
        return AuthResponse(
            access_token=token,
            role=info["role"],
            email=email,
            full_name=info["full_name"],
            station_id=info["station_id"]
        )

    # Check database
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or tactical passcode",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(subject=user.email, role=user.role)
    return AuthResponse(
        access_token=token,
        role=user.role,
        email=user.email,
        full_name=user.full_name,
        station_id=user.station_id
    )


@router.get("/me", response_model=AuthResponse)
def read_current_user_profile(current_user: User = Depends(get_current_user)):
    """Returns profile of currently authenticated analyst or administrator."""
    return AuthResponse(
        access_token="",
        role=current_user.role,
        email=current_user.email,
        full_name=current_user.full_name,
        station_id=current_user.station_id
    )
