"""
Tests for health check and root endpoints.

Endpoints tested:
- GET /                           -> app info
- GET /health                     -> liveness probe
- GET /health/detailed            -> detailed readiness check (legacy path)
- GET /api/v1/health/detailed     -> detailed readiness check (versioned path)
- GET /api/v1/launch-checklist    -> production readiness checklist
"""

import logging

import pytest

logger = logging.getLogger(__name__)


# ── Core health tests ────────────────────────────────────────────────


@pytest.mark.asyncio
class TestHealthSync:
    """Health checks using httpx AsyncClient."""

    async def test_root_returns_app_info(self, client):
        """GET /api/info should return app name, version, status, and features (non-prod)."""
        resp = await client.get("/api/info")
        assert resp.status_code == 200
        data = resp.json()
        assert "name" in data
        assert "version" in data
        assert data["status"] == "running"
        assert "features" in data
        assert isinstance(data["features"], list)

    async def test_health_liveness(self, client):
        """GET /health should return 200 with status=healthy."""
        resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data

    async def test_health_detailed_legacy_path(self, client):
        """GET /health/detailed (legacy) should return component statuses."""
        resp = await client.get("/health/detailed")
        assert resp.status_code in (200, 503)
        data = resp.json()
        assert "status" in data
        assert data["status"] in ("healthy", "degraded", "unhealthy")
        assert "checks" in data
        checks = data["checks"]
        assert "database" in checks
        assert "uptime" in checks

    async def test_health_detailed_versioned_path(self, client):
        """GET /api/v1/health/detailed should return component statuses."""
        resp = await client.get("/api/v1/health/detailed")
        assert resp.status_code in (200, 503)
        data = resp.json()
        assert "status" in data
        assert "checks" in data
        assert "timestamp" in data

    async def test_health_detailed_has_system_info(self, client):
        """Detailed health check should include system info."""
        resp = await client.get("/api/v1/health/detailed")
        data = resp.json()
        checks = data.get("checks", {})
        system = checks.get("system", {})
        assert "python" in system
        assert "platform" in system

    async def test_health_detailed_has_database_check(self, client):
        """Detailed health check should include database connectivity status."""
        resp = await client.get("/api/v1/health/detailed")
        data = resp.json()
        db_check = data.get("checks", {}).get("database", {})
        assert "status" in db_check
        assert db_check["status"] in ("ok", "error")

    async def test_launch_checklist(self, client):
        """GET /api/v1/launch-checklist should return a scored checklist."""
        resp = await client.get("/api/v1/launch-checklist")
        assert resp.status_code == 200
        data = resp.json()
        assert "score" in data
        assert "passed" in data
        assert "total" in data
        assert "ready" in data
        assert "items" in data
        assert isinstance(data["items"], list)
        assert data["total"] > 0
        for item in data["items"]:
            assert "id" in item
            assert "label" in item
            assert "passed" in item
            assert "category" in item


# ── Async tests (new style using httpx.AsyncClient) ──────────────────


@pytest.mark.asyncio
class TestHealthAsync:
    """Async health checks using httpx AsyncClient."""

    async def test_root_returns_200(self, async_client):
        """GET / should return 200."""
        resp = await async_client.get("/")
        assert resp.status_code == 200

    async def test_root_has_features_list(self, async_client):
        """GET /api/info should list supported features (Swetha CRM + Quotation surface)."""
        resp = await async_client.get("/api/info")
        data = resp.json()
        features = data.get("features", [])
        assert len(features) > 0
        features_lower = [f.lower() for f in features]
        assert any("crm" in f or "quotation" in f for f in features_lower)

    async def test_health_returns_timestamp(self, async_client):
        """GET /health timestamp should be a valid ISO-8601 string."""
        resp = await async_client.get("/health")
        data = resp.json()
        ts = data.get("timestamp", "")
        assert "T" in ts  # Basic ISO-8601 check

    async def test_health_detailed_uptime(self, async_client):
        """Detailed health check should report uptime."""
        resp = await async_client.get("/api/v1/health/detailed")
        data = resp.json()
        uptime = data.get("checks", {}).get("uptime", {})
        assert "uptime_seconds" in uptime
        assert uptime["uptime_seconds"] >= 0
        assert "uptime_human" in uptime

    async def test_health_detailed_redis_check(self, async_client):
        """Detailed health check should include Redis status (skipped without REDIS_URL)."""
        resp = await async_client.get("/api/v1/health/detailed")
        data = resp.json()
        redis_check = data.get("checks", {}).get("redis", {})
        assert "status" in redis_check
        # Without REDIS_URL env var, status should be "skipped"
        assert redis_check["status"] in ("ok", "skipped", "error")

    async def test_health_detailed_disk_check(self, async_client):
        """Detailed health check should include disk space status."""
        resp = await async_client.get("/api/v1/health/detailed")
        data = resp.json()
        disk_check = data.get("checks", {}).get("disk", {})
        assert "status" in disk_check
        assert disk_check["status"] in ("ok", "warning", "critical", "error")
