"""
VoiceFlow Marketing AI - Auth Service
=======================================
Business logic for authentication: registration, login, token management.

Rules enforced:
- KB-004: Uses PyJWT exclusively (NOT python-jose)
- KB-005: Password validation (8+ chars, 1 uppercase, 1 digit)
- Uses bcrypt via passlib for password hashing (OWASP compliant)
- KB-017: Always call db.refresh() / re-fetch after db.commit()
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from passlib.context import CryptContext

from api.config import settings
from api.database import db
from api.exceptions import ConflictError, NotFoundError, UnauthorizedError

logger = logging.getLogger(__name__)

# Use bcrypt for password hashing (OWASP recommendation)
# passlib 1.7.4 + bcrypt 4.0.1 are compatible; pin bcrypt<4.1 in requirements
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── Auth state store (multi-worker safe) ──────────────────────────
#
# Token revocations and brute-force counters need to outlive process restarts
# AND be visible to every uvicorn worker. The store is backed by Redis when
# REDIS_URL is reachable; otherwise it falls back to in-memory structures so
# dev and tests still work without infrastructure.
#
# This module-level object is the single state surface — the rest of the file
# (revoke_token, is_token_revoked, _check_lockout, etc.) delegates to it.

_MAX_FAILED_ATTEMPTS = 5      # OWASP recommends 5; dropped from 10
_LOCKOUT_SECONDS = 900        # 15 minutes; bumped from 5
_REVOKE_TTL_SECONDS = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60


class _InMemoryAuthState:
    """Fallback when Redis isn't reachable. NOT multi-worker safe."""

    def __init__(self) -> None:
        self._revoked: set[str] = set()
        self._failed: dict[str, dict] = {}

    def revoke_jti(self, jti: str) -> None:
        self._revoked.add(jti)

    def is_jti_revoked(self, jti: str) -> bool:
        return jti in self._revoked

    def get_lockout_remaining(self, email: str) -> int:
        rec = self._failed.get(email)
        if not rec:
            return 0
        until = rec.get("locked_until")
        if not until:
            return 0
        remaining = int((until - datetime.now(timezone.utc)).total_seconds())
        if remaining <= 0:
            self._failed.pop(email, None)
            return 0
        return remaining

    def record_failed(self, email: str) -> int:
        rec = self._failed.setdefault(email, {"count": 0, "locked_until": None})
        rec["count"] += 1
        if rec["count"] >= _MAX_FAILED_ATTEMPTS:
            rec["locked_until"] = datetime.now(timezone.utc) + timedelta(seconds=_LOCKOUT_SECONDS)
        return rec["count"]

    def clear_failed(self, email: str) -> None:
        self._failed.pop(email, None)


class _RedisAuthState:
    """Production-grade auth state. Each worker instantiates its own client."""

    def __init__(self, redis_client) -> None:
        self._r = redis_client

    @staticmethod
    def _revoke_key(jti: str) -> str:
        return f"auth:revoked:{jti}"

    @staticmethod
    def _failed_key(email: str) -> str:
        return f"auth:failed:{email.lower()}"

    @staticmethod
    def _lockout_key(email: str) -> str:
        return f"auth:lockout:{email.lower()}"

    def revoke_jti(self, jti: str) -> None:
        # SETEX with the access token TTL — the entry naturally expires when
        # the token would have expired anyway, so the keyspace doesn't grow.
        self._r.setex(self._revoke_key(jti), _REVOKE_TTL_SECONDS, "1")

    def is_jti_revoked(self, jti: str) -> bool:
        return bool(self._r.exists(self._revoke_key(jti)))

    def get_lockout_remaining(self, email: str) -> int:
        ttl = self._r.ttl(self._lockout_key(email))
        # ttl returns -2 for missing key, -1 for key without TTL
        return ttl if ttl and ttl > 0 else 0

    def record_failed(self, email: str) -> int:
        key = self._failed_key(email)
        # INCR returns the new count atomically across workers
        count = self._r.incr(key)
        if count == 1:
            # First failure in this window — set TTL so the counter resets
            self._r.expire(key, _LOCKOUT_SECONDS)
        if count >= _MAX_FAILED_ATTEMPTS:
            # Set the lockout flag with TTL = lockout duration
            self._r.setex(self._lockout_key(email), _LOCKOUT_SECONDS, "1")
        return int(count)

    def clear_failed(self, email: str) -> None:
        self._r.delete(self._failed_key(email), self._lockout_key(email))


def _build_auth_state():
    """
    Try Redis first; fall back to in-memory if unavailable. Connection is
    tested with a PING — silent failure here would mean state is local to
    one worker (security degradation), so we want a clear log line.
    """
    redis_url = (getattr(settings, "REDIS_URL", "") or "").strip()
    if redis_url:
        try:
            import redis  # type: ignore
            client = redis.from_url(redis_url, socket_connect_timeout=2, decode_responses=True)
            client.ping()
            logger.info("Auth state backend: Redis (%s)", redis_url)
            return _RedisAuthState(client)
        except Exception as exc:
            logger.warning(
                "Auth state backend: in-memory fallback (Redis unreachable: %s). "
                "This is NOT multi-worker safe; do not run --workers > 1 in production.",
                exc,
            )
    else:
        logger.info("Auth state backend: in-memory (REDIS_URL not configured)")
    return _InMemoryAuthState()


_state = _build_auth_state()


def revoke_token(jti: str) -> None:
    """Mark a token's jti as revoked. Persists across worker restart via Redis."""
    _state.revoke_jti(jti)


def is_token_revoked(jti: str) -> bool:
    return _state.is_jti_revoked(jti)


def _check_lockout(email: str) -> None:
    """Raise UnauthorizedError if the account is locked out."""
    remaining = _state.get_lockout_remaining(email)
    if remaining > 0:
        raise UnauthorizedError(
            detail=f"Account temporarily locked. Try again in {remaining} seconds."
        )


def _record_failed_login(email: str) -> None:
    """Record a failed login. Locks the account at _MAX_FAILED_ATTEMPTS."""
    count = _state.record_failed(email)
    if count >= _MAX_FAILED_ATTEMPTS:
        logger.warning("Account locked for %s after %d failed attempts", email, count)


def _clear_failed_logins(email: str) -> None:
    """Clear failed-login state on successful login."""
    _state.clear_failed(email)


class AuthService:
    """Handles all authentication operations."""

    # ── Password Hashing ─────────────────────────────────────────

    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a plaintext password using bcrypt."""
        return pwd_context.hash(password)

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify a plaintext password against a hash."""
        return pwd_context.verify(plain_password, hashed_password)

    # ── Token Creation (KB-004: PyJWT only) ──────────────────────

    @staticmethod
    def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """Create a JWT access token using PyJWT (KB-004).

        Args:
            data: Payload data (must include 'sub' for user email).
            expires_delta: Custom expiration. Defaults to settings.ACCESS_TOKEN_EXPIRE_MINUTES.

        Returns:
            Encoded JWT string.
        """
        to_encode = data.copy()
        expire = datetime.now(timezone.utc) + (
            expires_delta
            or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        to_encode.update({
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "type": "access",
            "jti": str(uuid.uuid4()),
        })
        encoded = jwt.encode(
            to_encode,
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM,
        )
        return encoded

    @staticmethod
    def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """Create a JWT refresh token using PyJWT (KB-004).

        Args:
            data: Payload data (must include 'sub' for user email).
            expires_delta: Custom expiration. Defaults to settings.REFRESH_TOKEN_EXPIRE_DAYS.

        Returns:
            Encoded JWT string.
        """
        to_encode = data.copy()
        expire = datetime.now(timezone.utc) + (
            expires_delta
            or timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        )
        to_encode.update({
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "type": "refresh",
            "jti": str(uuid.uuid4()),
        })
        encoded = jwt.encode(
            to_encode,
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM,
        )
        return encoded

    @staticmethod
    def decode_token(token: str) -> dict:
        """Decode and validate a JWT token.

        Raises:
            UnauthorizedError: If token is invalid or expired.
        """
        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM],
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise UnauthorizedError(detail="Token has expired")
        except jwt.PyJWTError as exc:
            logger.warning("JWT decode error: %s", exc)
            raise UnauthorizedError(detail="Invalid or malformed token")

    # ── Registration ─────────────────────────────────────────────

    @classmethod
    def register(
        cls,
        email: str,
        password: str,
        full_name: str,
        company: Optional[str] = None,
        phone: Optional[str] = None,
    ) -> dict:
        """Register a new user account.

        Args:
            email: User email (must be unique).
            password: Plaintext password (already validated by schema).
            full_name: User's display name.
            company: Optional company name.
            phone: Optional phone number.

        Returns:
            dict with access_token, refresh_token, and user info.

        Raises:
            ConflictError: If email is already registered.
        """
        with db() as conn:
            # Check for existing user
            existing = conn.execute(
                "SELECT id FROM users WHERE email=?", (email,)
            ).fetchone()
            if existing:
                raise ConflictError(detail="Email already registered")

            user_id = f"user-{uuid.uuid4().hex[:8]}"
            hashed = cls.hash_password(password)
            created_at = datetime.now(timezone.utc).isoformat()

            conn.execute(
                """
                INSERT INTO users (id, email, name, hashed_password, role, plan, company, phone, created_at, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    email,
                    full_name,
                    hashed,
                    "user",
                    "starter",
                    company or "",
                    phone or "",
                    created_at,
                    1,
                ),
            )

            # KB-017: re-fetch after commit
            row = conn.execute(
                "SELECT * FROM users WHERE id=?", (user_id,)
            ).fetchone()

        user_dict = dict(row)
        safe_user = _safe_user(user_dict)

        token_data = {"sub": email, "role": "user", "user_id": user_id}
        access_token = cls.create_access_token(token_data)
        refresh_token = cls.create_refresh_token(token_data)

        logger.info("User registered: %s (%s)", email, user_id)

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "user": safe_user,
        }

    # ── Login ────────────────────────────────────────────────────

    @classmethod
    def login(cls, email: str, password: str) -> dict:
        """Authenticate a user with email and password.

        Returns:
            dict with access_token, refresh_token, and user info.

        Raises:
            UnauthorizedError: If email/password is invalid or account is locked.
        """
        # Check account lockout before attempting auth
        _check_lockout(email)

        with db() as conn:
            row = conn.execute(
                "SELECT * FROM users WHERE email=?", (email,)
            ).fetchone()

        if not row:
            _record_failed_login(email)
            raise UnauthorizedError(detail="Invalid email or password")

        user_dict = dict(row)

        if not cls.verify_password(password, user_dict.get("hashed_password", "")):
            _record_failed_login(email)
            raise UnauthorizedError(detail="Invalid email or password")

        # Check if user is active
        if not user_dict.get("is_active", 1):
            raise UnauthorizedError(detail="Account is deactivated")

        # Clear failed login counter on success
        _clear_failed_logins(email)

        safe_user = _safe_user(user_dict)
        token_data = {
            "sub": user_dict["email"],
            "role": user_dict.get("role", "user"),
            "user_id": user_dict["id"],
            "is_super_admin": bool(user_dict.get("is_super_admin", 0)),
            "tenant_id": user_dict.get("tenant_id", ""),
        }
        access_token = cls.create_access_token(token_data)
        refresh_token = cls.create_refresh_token(token_data)

        logger.info("User logged in: %s (super_admin=%s)", email, safe_user.get("is_super_admin"))

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "user": safe_user,
        }

    # ── Refresh Token ────────────────────────────────────────────

    @classmethod
    def refresh_token(cls, refresh_token_str: str) -> dict:
        """Issue a new access token from a valid refresh token.

        Args:
            refresh_token_str: The refresh JWT to validate.

        Returns:
            dict with new access_token and refresh_token.

        Raises:
            UnauthorizedError: If refresh token is invalid.
        """
        payload = cls.decode_token(refresh_token_str)

        if payload.get("type") != "refresh":
            raise UnauthorizedError(detail="Invalid token type — expected refresh token")

        email = payload.get("sub")
        if not email:
            raise UnauthorizedError(detail="Invalid token: missing subject")

        with db() as conn:
            row = conn.execute(
                "SELECT * FROM users WHERE email=?", (email,)
            ).fetchone()

        if not row:
            raise UnauthorizedError(detail="User not found")

        user_dict = dict(row)
        if not user_dict.get("is_active", 1):
            raise UnauthorizedError(detail="Account is deactivated")

        safe_user = _safe_user(user_dict)
        token_data = {
            "sub": user_dict["email"],
            "role": user_dict.get("role", "user"),
            "user_id": user_dict["id"],
        }
        new_access = cls.create_access_token(token_data)
        new_refresh = cls.create_refresh_token(token_data)

        logger.info("Token refreshed for: %s", email)

        return {
            "access_token": new_access,
            "refresh_token": new_refresh,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "user": safe_user,
        }

    # ── Logout ───────────────────────────────────────────────────

    @staticmethod
    def logout(user_id: str, token_jti: Optional[str] = None) -> dict:
        """Logout a user — revokes the current token so it cannot be reused.

        Args:
            user_id: The ID of the user logging out.
            token_jti: The jti claim from the current JWT (if available).

        Returns:
            dict with logout confirmation message.
        """
        if token_jti:
            revoke_token(token_jti)
        logger.info("User logged out: %s (jti revoked: %s)", user_id, bool(token_jti))
        return {"message": "Logged out successfully"}

    # ── User Profile ─────────────────────────────────────────────

    @classmethod
    def get_user_by_email(cls, email: str) -> Optional[dict]:
        """Fetch a user by email."""
        with db() as conn:
            row = conn.execute(
                "SELECT * FROM users WHERE email=?", (email,)
            ).fetchone()
        if not row:
            return None
        return dict(row)

    @classmethod
    def get_user_by_id(cls, user_id: str) -> Optional[dict]:
        """Fetch a user by ID."""
        with db() as conn:
            row = conn.execute(
                "SELECT * FROM users WHERE id=?", (user_id,)
            ).fetchone()
        if not row:
            return None
        return dict(row)

    @classmethod
    def update_user(cls, user_id: str, updates: dict) -> dict:
        """Update a user's profile fields.

        Args:
            user_id: The user ID to update.
            updates: Dict of field->value pairs to update.

        Returns:
            Updated safe user dict.

        Raises:
            NotFoundError: If user does not exist.
        """
        if not updates:
            raise NotFoundError(detail="No updates provided")

        # Map schema fields to DB columns — strict allowlist, no fallback
        field_mapping = {
            "full_name": "name",
            "company": "company",
            "phone": "phone",
        }

        db_updates = {}
        for key, value in updates.items():
            if value is not None and key in field_mapping:
                db_updates[field_mapping[key]] = value

        if not db_updates:
            raise NotFoundError(detail="No valid updates provided")

        with db() as conn:
            existing = conn.execute(
                "SELECT id FROM users WHERE id=?", (user_id,)
            ).fetchone()
            if not existing:
                raise NotFoundError(detail="User not found")

            set_clause = ", ".join(f"{k}=?" for k in db_updates)
            values = list(db_updates.values()) + [user_id]
            conn.execute(
                f"UPDATE users SET {set_clause} WHERE id=?",
                values,
            )

            # KB-017: re-fetch after commit
            row = conn.execute(
                "SELECT * FROM users WHERE id=?", (user_id,)
            ).fetchone()

        user_dict = dict(row)
        logger.info("User updated: %s", user_id)
        return _safe_user(user_dict)


# ── Private Helpers ──────────────────────────────────────────────


def _safe_user(user_dict: dict) -> dict:
    """Remove sensitive fields (hashed_password) from user dict."""
    return {
        "id": user_dict.get("id", ""),
        "email": user_dict.get("email", ""),
        "full_name": user_dict.get("name", ""),
        "role": user_dict.get("role", "user"),
        "company": user_dict.get("company", ""),
        "phone": user_dict.get("phone", ""),
        "plan": user_dict.get("plan", "starter"),
        "is_active": bool(user_dict.get("is_active", 1)),
        "is_super_admin": bool(user_dict.get("is_super_admin", 0)),
        "tenant_id": user_dict.get("tenant_id", ""),
        "created_at": user_dict.get("created_at", ""),
    }
