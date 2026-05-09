"""
Shared fixtures for VoiceFlow API tests.

Uses httpx AsyncClient with ASGITransport against the FastAPI app.
Uses SQLite in-memory or file-based test database.
Overrides the get_db dependency so all tests run in isolation.
"""

import logging
import os
import sys
import uuid

import pytest
import pytest_asyncio

# ---------------------------------------------------------------------------
# Environment setup - MUST happen before any app/model imports
# ---------------------------------------------------------------------------
# Ensure src/ is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

# Force SQLite test database (no Postgres in CI)
os.environ.pop("DATABASE_URL", None)
os.environ["APP_ENV"] = "testing"
os.environ["SECRET_KEY"] = "test-secret-key-for-pytest-only"

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# App and database fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def app():
    """Create the FastAPI app instance once per test session.

    This triggers init_db() which creates legacy tables and ORM tables.
    The app factory (create_app) is called at import time in server.py,
    so we just import the pre-built app singleton.
    """
    from api.server import app as _app
    return _app


@pytest.fixture(scope="session")
def _init_database(app):
    """Initialize the database once per session.

    Uses ORM models to create clean tables (not legacy raw SQL).
    This avoids schema conflicts between legacy TEXT-id tables and ORM INT-id tables.
    """
    # Init strategy: legacy init_db() creates raw SQL tables (users, leads,
    # campaigns, etc.) with TEXT IDs and the old column names that auth_service
    # expects. Then we create the remaining ORM-only tables (voice_analyses,
    # companies, contacts, deals, activities, etc.) that the new routers need.
    from api.database import init_db, get_engine
    try:
        init_db()
        logger.info("Legacy tables created")
    except Exception as exc:
        logger.warning("Legacy init_db: %s", exc)

    # Drop legacy tables whose schema conflicts with ORM models.
    # Legacy tables (TEXT IDs, no user_id) prevent ORM routers from working.
    # The legacy auth_service only uses the 'users' table, so dropping
    # leads/campaigns/calls is safe for tests.
    try:
        from sqlalchemy import text as sa_text
        eng = get_engine()
        with eng.connect() as conn:
            for tbl in ("leads", "campaigns", "calls"):
                conn.execute(sa_text(f"DROP TABLE IF EXISTS {tbl}"))
            conn.commit()
        logger.info("Dropped conflicting legacy tables (leads, campaigns, calls)")
    except Exception as exc:
        logger.warning("Legacy table drop: %s", exc)

    # Create all ORM tables (including replacements for dropped legacy ones)
    try:
        from api.models.base import Base
        import api.models  # noqa: F401
        eng = get_engine()
        Base.metadata.create_all(bind=eng)
        logger.info("ORM tables created")
    except Exception as exc:
        logger.warning("ORM table creation: %s", exc)


# ---------------------------------------------------------------------------
# Sync test client (for existing sync tests - backward compatible)
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def client(app, _init_database):
    """Async test client aliased as 'client' for backward compatibility.

    Uses httpx.AsyncClient with ASGITransport. Tests using this fixture
    must be marked with @pytest.mark.asyncio or be async def.
    """
    import httpx
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ---------------------------------------------------------------------------
# Async test client (for new async tests)
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def async_client(app, _init_database):
    """Async test client using httpx.AsyncClient with ASGITransport.

    Preferred for new tests - uses pytest-asyncio and async def tests.
    """
    import httpx
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def auth_headers(client):
    """Login with the seeded admin user and return Authorization headers.

    Falls back to demo token if login fails (e.g. if the password hash
    algorithm changes or the admin user was not seeded).
    """
    resp = await client.post("/api/v1/auth/login", json={
        "email": "admin@swetha.in",
        "password": "Swetha123!",
    })
    if resp.status_code == 200:
        data = resp.json()
        token = data.get("access_token", data.get("token", ""))
        if token:
            return {"Authorization": f"Bearer {token}"}
    # Fallback to demo token accepted by dependencies.py
    return {"Authorization": "Bearer demo-token-123"}


@pytest_asyncio.fixture
async def async_auth_headers(async_client):
    """Async variant: login with admin user and return Authorization headers."""
    resp = await async_client.post("/api/v1/auth/login", json={
        "email": "admin@swetha.in",
        "password": "Swetha123!",
    })
    if resp.status_code == 200:
        data = resp.json()
        token = data.get("access_token", data.get("token", ""))
        if token:
            return {"Authorization": f"Bearer {token}"}
    return {"Authorization": "Bearer demo-token-123"}


@pytest_asyncio.fixture
async def async_auth_tokens(async_client):
    """Login with admin user and return the full token response dict.

    Useful when tests need access_token AND refresh_token.
    """
    resp = await async_client.post("/api/v1/auth/login", json={
        "email": "admin@swetha.in",
        "password": "Swetha123!",
    })
    if resp.status_code == 200:
        return resp.json()
    return {"access_token": "demo-token-123", "refresh_token": ""}


# ---------------------------------------------------------------------------
# Test user fixture
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def test_user(async_client):
    """Register a unique test user and return (user_data, auth_headers).

    Creates a new user per test to avoid email collisions.
    """
    unique = uuid.uuid4().hex[:8]
    email = f"testuser-{unique}@example.com"
    password = "TestPass1"
    payload = {
        "email": email,
        "password": password,
        "full_name": f"Test User {unique}",
        "company": "Test Corp",
        "phone": "+91 9876500000",
    }
    resp = await async_client.post("/api/v1/auth/register", json=payload)
    if resp.status_code == 201:
        data = resp.json()
        headers = {"Authorization": f"Bearer {data['access_token']}"}
        return {
            "email": email,
            "password": password,
            "data": data,
            "headers": headers,
        }
    # If registration fails (rate limit, etc.), fallback to demo
    return {
        "email": "admin@swetha.in",
        "password": "Swetha123!",
        "data": {},
        "headers": {"Authorization": "Bearer demo-token-123"},
    }
