"""
VoiceFlow Marketing AI - Auth Router
======================================
Authentication endpoints with rate limiting.

KB-004: PyJWT only (NOT python-jose)
KB-005: Password validation (8+ chars, 1 uppercase, 1 digit)
KB-006: Rate limit auth endpoints (login 5/min, register 3/min)
KB-007: Include logout endpoint
"""

import logging
import os

from fastapi import APIRouter, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from api.dependencies import get_current_active_user, get_current_user
from api.schemas.auth import (
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
    UserUpdate,
)
from api.schemas.common import MessageResponse
from api.permissions import get_accessible_modules, get_role_permissions
from api.services.auth_service import AuthService

logger = logging.getLogger(__name__)

# Rate limiter instance (KB-006) — disabled in test environment
_is_testing = os.getenv("APP_ENV") == "testing"
_rate_register = "100/minute" if _is_testing else "3/minute"
_rate_login = "100/minute" if _is_testing else "5/minute"
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


# ── POST /register ───────────────────────────────────────────────


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=201,
    summary="Register a new user account",
)
@limiter.limit(_rate_register)
async def register(request: Request, body: RegisterRequest) -> TokenResponse:
    """Register a new user.

    Rate limited to 3 requests per minute (KB-006).
    Password must meet complexity requirements (KB-005).
    """
    result = AuthService.register(
        email=body.email,
        password=body.password,
        full_name=body.full_name,
        company=body.company,
        phone=body.phone,
    )
    return TokenResponse(**result)


# ── POST /login ──────────────────────────────────────────────────


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login with email and password",
)
@limiter.limit(_rate_login)
async def login(request: Request, body: LoginRequest) -> TokenResponse:
    """Authenticate with email and password, returns JWT tokens.

    Rate limited to 5 requests per minute (KB-006).
    """
    result = AuthService.login(email=body.email, password=body.password)
    return TokenResponse(**result)


# ── POST /refresh ────────────────────────────────────────────────


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh access token",
)
async def refresh_token(body: RefreshTokenRequest) -> TokenResponse:
    """Exchange a valid refresh token for a new access + refresh token pair.

    Refresh tokens expire after 7 days (configurable via REFRESH_TOKEN_EXPIRE_DAYS).
    """
    result = AuthService.refresh_token(refresh_token_str=body.refresh_token)
    return TokenResponse(**result)


# ── POST /logout (KB-007) ───────────────────────────────────────


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Logout current user",
)
async def logout(
    current_user: dict = Depends(get_current_user),
) -> MessageResponse:
    """Logout the current user (KB-007).

    Client should discard tokens. In production, the token would be
    added to a Redis blacklist.
    """
    result = AuthService.logout(user_id=current_user.get("id", ""))
    return MessageResponse(**result)


# ── GET /me ──────────────────────────────────────────────────────


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user profile",
)
async def get_profile(
    current_user: dict = Depends(get_current_active_user),
) -> UserResponse:
    """Get the authenticated user's profile."""
    return UserResponse(
        id=current_user.get("id", ""),
        email=current_user.get("email", ""),
        full_name=current_user.get("name", ""),
        role=current_user.get("role", "user"),
        company=current_user.get("company"),
        phone=current_user.get("phone"),
        plan=current_user.get("plan", "starter"),
        is_active=bool(current_user.get("is_active", 1)),
        created_at=current_user.get("created_at", ""),
    )


# ── PUT /me ──────────────────────────────────────────────────────


@router.put(
    "/me",
    response_model=UserResponse,
    summary="Update current user profile",
)
async def update_profile(
    body: UserUpdate,
    current_user: dict = Depends(get_current_active_user),
) -> UserResponse:
    """Update the authenticated user's profile fields."""
    updates = body.model_dump(exclude_none=True)
    updated_user = AuthService.update_user(
        user_id=current_user.get("id", ""),
        updates=updates,
    )
    return UserResponse(**updated_user)


# ── GET /permissions ──────────────────────────────────────────────


@router.get(
    "/permissions",
    summary="Get current user's permissions",
)
async def get_permissions(
    current_user: dict = Depends(get_current_active_user),
) -> dict:
    """Return the authenticated user's role permissions and accessible modules."""
    role = current_user.get("role", "user")
    return {
        "role": role,
        "permissions": get_role_permissions(role),
        "accessible_modules": get_accessible_modules(role),
    }
