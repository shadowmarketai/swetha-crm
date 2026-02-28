"""
Tests for /api/v1/auth/* authentication endpoints.

Endpoints tested:
- POST /api/v1/auth/register   -> register a new user
- POST /api/v1/auth/login      -> login with email + password
- GET  /api/v1/auth/me         -> get current user profile
- POST /api/v1/auth/refresh    -> refresh access token
- POST /api/v1/auth/logout     -> logout current user

Covers:
- Successful flows
- Validation errors (weak password, missing fields)
- Duplicate email conflict (409)
- Wrong password (401)
- Missing/invalid token (401)
- Token refresh flow
"""

import logging
import uuid

import pytest

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helper to generate unique registration payloads
# ---------------------------------------------------------------------------

def _register_payload(suffix: str = "") -> dict:
    """Generate a unique registration request body."""
    unique = suffix or uuid.uuid4().hex[:8]
    return {
        "email": f"testuser-{unique}@example.com",
        "password": "StrongPass1",
        "full_name": f"Test User {unique}",
        "company": "Test Corp",
        "phone": "+91 9876500001",
    }


# ===========================================================================
# REGISTRATION TESTS
# ===========================================================================


@pytest.mark.asyncio
class TestRegister:
    """POST /api/v1/auth/register"""

    async def test_register_success(self, async_client):
        """Register with valid data should return 201 with tokens and user."""
        payload = _register_payload()
        resp = await async_client.post("/api/v1/auth/register", json=payload)
        assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert "expires_in" in data
        assert "user" in data
        user = data["user"]
        assert user["email"] == payload["email"]
        assert user["full_name"] == payload["full_name"]

    async def test_register_returns_valid_jwt(self, async_client):
        """The access_token from registration should work for /me."""
        payload = _register_payload()
        resp = await async_client.post("/api/v1/auth/register", json=payload)
        if resp.status_code != 201:
            pytest.skip("Registration failed (likely rate limited)")
        token = resp.json()["access_token"]
        me_resp = await async_client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me_resp.status_code == 200
        assert me_resp.json()["email"] == payload["email"]

    async def test_register_weak_password_short(self, async_client):
        """Password shorter than 8 chars should be rejected with 422."""
        payload = _register_payload()
        payload["password"] = "Ab1"  # too short
        resp = await async_client.post("/api/v1/auth/register", json=payload)
        assert resp.status_code == 422

    async def test_register_weak_password_no_uppercase(self, async_client):
        """Password without uppercase should be rejected with 422."""
        payload = _register_payload()
        payload["password"] = "weakpass1"  # no uppercase
        resp = await async_client.post("/api/v1/auth/register", json=payload)
        assert resp.status_code == 422

    async def test_register_weak_password_no_digit(self, async_client):
        """Password without digit should be rejected with 422."""
        payload = _register_payload()
        payload["password"] = "WeakPassNoDigit"  # no digit
        resp = await async_client.post("/api/v1/auth/register", json=payload)
        assert resp.status_code == 422

    async def test_register_missing_email(self, async_client):
        """Missing email field should return 422."""
        resp = await async_client.post("/api/v1/auth/register", json={
            "password": "StrongPass1",
            "full_name": "No Email User",
        })
        assert resp.status_code == 422

    async def test_register_missing_full_name(self, async_client):
        """Missing full_name field should return 422."""
        resp = await async_client.post("/api/v1/auth/register", json={
            "email": f"noname-{uuid.uuid4().hex[:6]}@example.com",
            "password": "StrongPass1",
        })
        assert resp.status_code == 422

    async def test_register_invalid_email_format(self, async_client):
        """Invalid email format should return 422."""
        resp = await async_client.post("/api/v1/auth/register", json={
            "email": "not-an-email",
            "password": "StrongPass1",
            "full_name": "Bad Email User",
        })
        assert resp.status_code == 422

    async def test_register_duplicate_email(self, async_client):
        """Registering with the same email twice should return 409."""
        payload = _register_payload()
        first = await async_client.post("/api/v1/auth/register", json=payload)
        if first.status_code != 201:
            pytest.skip("First registration failed (rate limit?)")
        second = await async_client.post("/api/v1/auth/register", json=payload)
        assert second.status_code == 409, (
            f"Expected 409 for duplicate email, got {second.status_code}: {second.text}"
        )

    async def test_register_empty_body(self, async_client):
        """Empty request body should return 422."""
        resp = await async_client.post("/api/v1/auth/register", json={})
        assert resp.status_code == 422


# ===========================================================================
# LOGIN TESTS
# ===========================================================================


@pytest.mark.asyncio
class TestLogin:
    """POST /api/v1/auth/login"""

    async def test_login_success_admin(self, async_client):
        """Login with seeded admin credentials should return tokens."""
        resp = await async_client.post("/api/v1/auth/login", json={
            "email": "admin@shadowmarket.ai",
            "password": "admin123",
        })
        assert resp.status_code == 200, f"Login failed: {resp.text}"
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert "expires_in" in data
        assert data["expires_in"] > 0
        assert "user" in data

    async def test_login_success_has_user_info(self, async_client):
        """Login response should include user email and role."""
        resp = await async_client.post("/api/v1/auth/login", json={
            "email": "admin@shadowmarket.ai",
            "password": "admin123",
        })
        if resp.status_code != 200:
            pytest.skip("Login failed")
        user = resp.json().get("user", {})
        assert user.get("email") == "admin@shadowmarket.ai"

    async def test_login_wrong_password(self, async_client):
        """Login with wrong password should return 401."""
        resp = await async_client.post("/api/v1/auth/login", json={
            "email": "admin@shadowmarket.ai",
            "password": "wrong-password-123",
        })
        assert resp.status_code == 401

    async def test_login_nonexistent_email(self, async_client):
        """Login with non-existent email should return 401."""
        resp = await async_client.post("/api/v1/auth/login", json={
            "email": "does-not-exist@example.com",
            "password": "SomePass1",
        })
        assert resp.status_code == 401

    async def test_login_missing_email(self, async_client):
        """Login without email should return 422."""
        resp = await async_client.post("/api/v1/auth/login", json={
            "password": "admin123",
        })
        assert resp.status_code == 422

    async def test_login_missing_password(self, async_client):
        """Login without password should return 422."""
        resp = await async_client.post("/api/v1/auth/login", json={
            "email": "admin@shadowmarket.ai",
        })
        assert resp.status_code == 422

    async def test_login_empty_body(self, async_client):
        """Login with empty body should return 422."""
        resp = await async_client.post("/api/v1/auth/login", json={})
        assert resp.status_code == 422


# ===========================================================================
# GET /me TESTS
# ===========================================================================


@pytest.mark.asyncio
class TestGetProfile:
    """GET /api/v1/auth/me"""

    async def test_get_profile_with_valid_token(self, async_client, async_auth_headers):
        """GET /me with valid token should return user profile."""
        resp = await async_client.get("/api/v1/auth/me", headers=async_auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "id" in data
        assert "email" in data
        assert "full_name" in data
        assert "role" in data

    async def test_get_profile_without_token(self, async_client):
        """GET /me without Authorization header should return 401 or 403."""
        resp = await async_client.get("/api/v1/auth/me")
        assert resp.status_code in (401, 403)

    async def test_get_profile_with_invalid_token(self, async_client):
        """GET /me with garbage token should return 401."""
        resp = await async_client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer invalid-garbage-token"},
        )
        assert resp.status_code == 401

    async def test_get_profile_with_empty_bearer(self, async_client):
        """GET /me with 'Bearer ' but no token should return 401 or 403."""
        resp = await async_client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer "},
        )
        assert resp.status_code in (401, 403, 422)

    async def test_get_profile_has_plan_field(self, async_client, async_auth_headers):
        """User profile should include the plan field."""
        resp = await async_client.get("/api/v1/auth/me", headers=async_auth_headers)
        if resp.status_code == 200:
            data = resp.json()
            assert "plan" in data

    async def test_get_profile_has_is_active(self, async_client, async_auth_headers):
        """User profile should include is_active field."""
        resp = await async_client.get("/api/v1/auth/me", headers=async_auth_headers)
        if resp.status_code == 200:
            data = resp.json()
            assert "is_active" in data
            assert data["is_active"] is True


# ===========================================================================
# REFRESH TOKEN TESTS
# ===========================================================================


@pytest.mark.asyncio
class TestRefreshToken:
    """POST /api/v1/auth/refresh"""

    async def test_refresh_token_success(self, async_client, async_auth_tokens):
        """Refresh with a valid refresh_token should return new tokens."""
        refresh_token = async_auth_tokens.get("refresh_token", "")
        if not refresh_token:
            pytest.skip("No refresh token available")
        resp = await async_client.post("/api/v1/auth/refresh", json={
            "refresh_token": refresh_token,
        })
        assert resp.status_code == 200, f"Refresh failed: {resp.text}"
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    async def test_refresh_token_new_access_token_works(self, async_client, async_auth_tokens):
        """The new access token from refresh should authenticate /me."""
        refresh_token = async_auth_tokens.get("refresh_token", "")
        if not refresh_token:
            pytest.skip("No refresh token available")
        resp = await async_client.post("/api/v1/auth/refresh", json={
            "refresh_token": refresh_token,
        })
        if resp.status_code != 200:
            pytest.skip("Refresh failed")
        new_access = resp.json()["access_token"]
        me_resp = await async_client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {new_access}"},
        )
        assert me_resp.status_code == 200

    async def test_refresh_with_invalid_token(self, async_client):
        """Refresh with an invalid token should return 401."""
        resp = await async_client.post("/api/v1/auth/refresh", json={
            "refresh_token": "this-is-not-a-valid-jwt",
        })
        assert resp.status_code == 401

    async def test_refresh_with_access_token_instead(self, async_client, async_auth_tokens):
        """Using an access_token as refresh_token should return 401."""
        access_token = async_auth_tokens.get("access_token", "")
        if not access_token or access_token == "demo-token-123":
            pytest.skip("No real access token available")
        resp = await async_client.post("/api/v1/auth/refresh", json={
            "refresh_token": access_token,
        })
        assert resp.status_code == 401

    async def test_refresh_missing_token(self, async_client):
        """Refresh with empty body should return 422."""
        resp = await async_client.post("/api/v1/auth/refresh", json={})
        assert resp.status_code == 422


# ===========================================================================
# LOGOUT TESTS
# ===========================================================================


@pytest.mark.asyncio
class TestLogout:
    """POST /api/v1/auth/logout"""

    async def test_logout_success(self, async_client, async_auth_headers):
        """Logout with valid token should return success message."""
        resp = await async_client.post("/api/v1/auth/logout", headers=async_auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "message" in data
        assert "logout" in data["message"].lower() or "success" in data["message"].lower()

    async def test_logout_without_token(self, async_client):
        """Logout without authentication should return 401 or 403."""
        resp = await async_client.post("/api/v1/auth/logout")
        assert resp.status_code in (401, 403)
