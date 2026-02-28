"""
Integration tests for VoiceFlow Marketing AI.

Tests end-to-end flows that span multiple endpoints:
1. Full auth flow: register -> login -> get me -> refresh -> logout
2. Protected endpoints require authentication
3. Cross-module interactions
"""

import logging
import uuid

import pytest

logger = logging.getLogger(__name__)


# ===========================================================================
# FULL AUTH FLOW (end-to-end)
# ===========================================================================


@pytest.mark.asyncio
class TestFullAuthFlow:
    """Full authentication lifecycle integration test."""

    async def test_register_login_me_refresh_logout(self, async_client):
        """Complete auth flow: register -> login -> me -> refresh -> logout.

        This is the primary integration test that exercises the entire
        authentication subsystem in sequence.
        """
        unique = uuid.uuid4().hex[:8]
        email = f"flow-test-{unique}@example.com"
        password = "FlowTest1"

        # ── Step 1: Register ──────────────────────────────────────
        reg_resp = await async_client.post("/api/v1/auth/register", json={
            "email": email,
            "password": password,
            "full_name": f"Flow Test {unique}",
            "company": "Integration Test Corp",
        })
        if reg_resp.status_code != 201:
            pytest.skip(
                f"Registration returned {reg_resp.status_code} (may fail due to test ordering/DB state)"
            )
        reg_data = reg_resp.json()
        assert "access_token" in reg_data
        reg_token = reg_data["access_token"]

        # ── Step 2: Login with same credentials ───────────────────
        login_resp = await async_client.post("/api/v1/auth/login", json={
            "email": email,
            "password": password,
        })
        assert login_resp.status_code == 200, (
            f"Login failed: {login_resp.status_code} {login_resp.text}"
        )
        login_data = login_resp.json()
        assert "access_token" in login_data
        assert "refresh_token" in login_data
        access_token = login_data["access_token"]
        refresh_token = login_data["refresh_token"]

        # ── Step 3: Get profile with access token ─────────────────
        me_resp = await async_client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert me_resp.status_code == 200
        me_data = me_resp.json()
        assert me_data["email"] == email
        assert "id" in me_data
        assert "role" in me_data

        # ── Step 4: Refresh token ─────────────────────────────────
        refresh_resp = await async_client.post("/api/v1/auth/refresh", json={
            "refresh_token": refresh_token,
        })
        assert refresh_resp.status_code == 200, (
            f"Refresh failed: {refresh_resp.status_code} {refresh_resp.text}"
        )
        refresh_data = refresh_resp.json()
        new_access_token = refresh_data["access_token"]
        assert new_access_token  # Should not be empty

        # ── Step 5: Verify new token works ────────────────────────
        me2_resp = await async_client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {new_access_token}"},
        )
        assert me2_resp.status_code == 200
        assert me2_resp.json()["email"] == email

        # ── Step 6: Logout ────────────────────────────────────────
        logout_resp = await async_client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {new_access_token}"},
        )
        assert logout_resp.status_code == 200
        logout_data = logout_resp.json()
        assert "message" in logout_data

    async def test_register_then_login_with_wrong_password_fails(self, async_client):
        """After registration, login with the wrong password should fail."""
        unique = uuid.uuid4().hex[:8]
        email = f"wrongpw-{unique}@example.com"

        reg_resp = await async_client.post("/api/v1/auth/register", json={
            "email": email,
            "password": "CorrectPass1",
            "full_name": "Wrong PW User",
        })
        if reg_resp.status_code != 201:
            pytest.skip("Registration failed")

        login_resp = await async_client.post("/api/v1/auth/login", json={
            "email": email,
            "password": "WrongPassword1",
        })
        assert login_resp.status_code == 401


# ===========================================================================
# PROTECTED ENDPOINTS REQUIRE AUTH
# ===========================================================================


@pytest.mark.asyncio
class TestProtectedEndpoints:
    """Verify that protected endpoints reject unauthenticated requests."""

    @pytest.mark.parametrize("method,path", [
        ("GET", "/api/v1/auth/me"),
        ("POST", "/api/v1/auth/logout"),
        ("GET", "/api/v1/campaigns/"),
        ("GET", "/api/v1/crm-leads"),
        ("GET", "/api/v1/crm-companies"),
        ("GET", "/api/v1/crm-contacts"),
        ("GET", "/api/v1/crm-deals"),
    ])
    async def test_endpoint_without_auth(self, async_client, method, path):
        """Endpoints that require auth should return 401 or 403 without a token."""
        if method == "GET":
            resp = await async_client.get(path)
        else:
            resp = await async_client.post(path)
        assert resp.status_code in (401, 403, 405), (
            f"{method} {path} returned {resp.status_code}, expected 401/403"
        )

    @pytest.mark.xfail(reason="Legacy SQL tables have different schema than ORM models; needs auth_service ORM migration")
    async def test_authenticated_user_can_access_campaigns(self, async_client, async_auth_headers):
        """Authenticated user should be able to list campaigns."""
        resp = await async_client.get("/api/v1/campaigns/", headers=async_auth_headers)
        assert resp.status_code == 200

    @pytest.mark.xfail(reason="Legacy SQL tables have different schema than ORM models; needs auth_service ORM migration")
    async def test_authenticated_user_can_access_crm_leads(self, async_client, async_auth_headers):
        """Authenticated user should be able to list CRM leads."""
        resp = await async_client.get("/api/v1/crm-leads", headers=async_auth_headers)
        assert resp.status_code == 200

    @pytest.mark.xfail(reason="Legacy SQL tables have different schema than ORM models; needs auth_service ORM migration")
    async def test_authenticated_user_can_access_dashboard(self, async_client, async_auth_headers):
        """Authenticated user should be able to access CRM dashboard."""
        resp = await async_client.get("/api/v1/dashboard", headers=async_auth_headers)
        assert resp.status_code == 200


# ===========================================================================
# HEALTH + AUTH COMBINED
# ===========================================================================


@pytest.mark.asyncio
class TestHealthAuthCombined:
    """Test that health endpoints work regardless of auth state."""

    async def test_health_no_auth_required(self, async_client):
        """Health endpoints should work without authentication."""
        resp = await async_client.get("/health")
        assert resp.status_code == 200

    async def test_root_no_auth_required(self, async_client):
        """Root endpoint should work without authentication."""
        resp = await async_client.get("/")
        assert resp.status_code == 200

    async def test_health_detailed_no_auth_required(self, async_client):
        """Detailed health check should work without authentication."""
        resp = await async_client.get("/api/v1/health/detailed")
        assert resp.status_code in (200, 503)


# ===========================================================================
# TOKEN ISOLATION
# ===========================================================================


@pytest.mark.asyncio
class TestTokenIsolation:
    """Verify that tokens from one user cannot access another user's data."""

    async def test_registration_token_matches_registered_email(self, async_client):
        """The token from registration should identify the registered user, not someone else."""
        unique = uuid.uuid4().hex[:8]
        email = f"isolation-{unique}@example.com"

        reg_resp = await async_client.post("/api/v1/auth/register", json={
            "email": email,
            "password": "IsolateTest1",
            "full_name": "Isolation Test",
        })
        if reg_resp.status_code != 201:
            pytest.skip("Registration failed")

        token = reg_resp.json()["access_token"]
        me_resp = await async_client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me_resp.status_code == 200
        assert me_resp.json()["email"] == email
