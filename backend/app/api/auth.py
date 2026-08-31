"""Simple HMAC-token authentication.

No new Python packages required — hashlib and hmac are stdlib.
A real production deployment would use JWT (PyJWT + passlib), but this
implementation is functionally equivalent for a demo/hackathon environment.

Token format:  base64(json_payload) + "." + hex_hmac_signature
Payload: {"sub": email, "name": ..., "role": ..., "org": ..., "exp": unix_ts}
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from ..config import (SATQUERY_PASSWORD, SATQUERY_SECRET, SATQUERY_USER,
                      TOKEN_TTL_HOURS)

router = APIRouter(prefix="/auth", tags=["auth"])
bearer = HTTPBearer(auto_error=False)

# ── User database ──────────────────────────────────────────────────────────
# One user for now — add more by extending this dict or wiring to a DB later.
USERS = {
    SATQUERY_USER: {
        "password": SATQUERY_PASSWORD,
        "name":     "QUANTARA Admin",
        "role":     "Analyst",
        "org":      "Team QUANTARA",
    }
}


# ── Token helpers ──────────────────────────────────────────────────────────

def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(s: str) -> bytes:
    pad = 4 - len(s) % 4
    return base64.urlsafe_b64decode(s + "=" * (pad % 4))


def _sign(payload_b64: str) -> str:
    return hmac.new(
        SATQUERY_SECRET.encode(),
        payload_b64.encode(),
        hashlib.sha256,
    ).hexdigest()


def create_token(user: dict, email: str) -> str:
    payload = {
        "sub":  email,
        "name": user["name"],
        "role": user["role"],
        "org":  user["org"],
        "exp":  int(time.time()) + TOKEN_TTL_HOURS * 3600,
    }
    payload_b64 = _b64(json.dumps(payload).encode())
    sig = _sign(payload_b64)
    return f"{payload_b64}.{sig}"


def verify_token(token: str) -> dict:
    """Raises HTTPException(401) if token is invalid or expired."""
    try:
        payload_b64, sig = token.rsplit(".", 1)
    except ValueError:
        raise HTTPException(401, "Malformed token.")

    expected = _sign(payload_b64)
    if not hmac.compare_digest(expected, sig):
        raise HTTPException(401, "Invalid token signature.")

    try:
        payload = json.loads(_unb64(payload_b64))
    except Exception:
        raise HTTPException(401, "Token payload unreadable.")

    if payload.get("exp", 0) < time.time():
        raise HTTPException(401, "Token has expired. Please sign in again.")

    return payload


def optional_auth(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> dict | None:
    """Returns the token payload if a valid Bearer token is present, else None.
    Used on endpoints where auth is desirable but not mandatory (e.g., mock mode)."""
    if credentials is None:
        return None
    try:
        return verify_token(credentials.credentials)
    except HTTPException:
        return None


def require_auth(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> dict:
    """Returns the token payload or raises 401. Use on protected endpoints."""
    if credentials is None:
        raise HTTPException(401, "Authentication required. Please sign in.")
    return verify_token(credentials.credentials)


# ── Schemas ────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    token: str
    user: dict


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest) -> LoginResponse:
    """Validate credentials and return a bearer token."""
    user = USERS.get(req.email.strip().lower())
    # Normalise the lookup key — emails are case-insensitive
    if user is None:
        user = next(
            (v for k, v in USERS.items() if k.lower() == req.email.strip().lower()),
            None,
        )
    if user is None or user["password"] != req.password:
        raise HTTPException(401, "Invalid email or password.")

    email = req.email.strip().lower()
    token = create_token(user, email)
    return LoginResponse(
        token=token,
        user={"email": email, "name": user["name"], "role": user["role"], "org": user["org"]},
    )


@router.get("/me")
def me(payload: Annotated[dict, Depends(require_auth)]) -> dict:
    """Return the authenticated user's profile from the token."""
    return {
        "email": payload["sub"],
        "name":  payload["name"],
        "role":  payload["role"],
        "org":   payload["org"],
    }


@router.post("/logout")
def logout() -> dict:
    """Tokens are stateless — logout is handled client-side by deleting the token.
    This endpoint exists so the frontend has a semantic hook for future server-side
    session invalidation (e.g., a token blocklist)."""
    return {"message": "Signed out. Delete the token on the client."}
