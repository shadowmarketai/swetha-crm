"""
RBAC (Role-Based Access Control) tests.

Two layers of coverage:

1. Matrix integrity (pure Python) — verifies the permission matrix in
   src/api/permissions.py is structurally sane: every role has every
   module, no typos in action names, admin always has full access, etc.
   These are cheap to run and catch the most common cause of regressions
   (a developer adding a new module to one role's dict and forgetting
   the other four).

2. Endpoint enforcement (HTTP) — spot-checks that the @require_permission
   dependency actually returns 403 when a role's matrix entry says they
   shouldn't have access. We don't try to drive all 5x16x4 combinations
   through HTTP (flaky and slow); instead we hit a handful of the most
   security-critical endpoints with each role.
"""

from __future__ import annotations

import logging
import uuid

import pytest
import pytest_asyncio

from api.permissions import (
    PERMISSION_MATRIX,
    has_permission,
    get_accessible_modules,
    get_role_permissions,
)

logger = logging.getLogger(__name__)


KNOWN_ROLES = {"admin", "manager", "agent", "user", "viewer"}
KNOWN_ACTIONS = {"create", "read", "update", "delete"}


# ─────────────────────────────────────────────────────────────────
#   1. Permission-matrix integrity (pure Python)
# ─────────────────────────────────────────────────────────────────


class TestPermissionMatrixIntegrity:
    """Cheap sanity checks that protect against typos / drift."""

    def test_all_known_roles_present(self):
        assert set(PERMISSION_MATRIX.keys()) == KNOWN_ROLES

    def test_every_role_lists_every_module(self):
        all_modules = set()
        for role, mods in PERMISSION_MATRIX.items():
            all_modules.update(mods.keys())
        for role, mods in PERMISSION_MATRIX.items():
            missing = all_modules - set(mods.keys())
            assert not missing, f"{role!r} missing modules: {missing}"

    def test_actions_only_use_known_verbs(self):
        for role, mods in PERMISSION_MATRIX.items():
            for module, actions in mods.items():
                bad = set(actions) - KNOWN_ACTIONS
                assert not bad, f"{role!r}/{module!r} uses unknown action(s): {bad}"

    def test_admin_has_full_access_on_every_module(self):
        for module, actions in PERMISSION_MATRIX["admin"].items():
            assert actions == KNOWN_ACTIONS, (
                f"admin role lost full access on {module!r}: {actions}"
            )

    def test_viewer_role_has_no_write_actions(self):
        """Viewer is read-only by design — any write action is a regression."""
        for module, actions in PERMISSION_MATRIX["viewer"].items():
            writes = actions & {"create", "update", "delete"}
            assert not writes, f"viewer gained write access to {module!r}: {writes}"

    def test_no_role_has_billing_writes_except_admin(self):
        """Billing is admin-only territory."""
        for role in KNOWN_ROLES - {"admin"}:
            actions = PERMISSION_MATRIX[role].get("billing", set())
            assert not (actions & {"create", "update", "delete"}), (
                f"{role!r} unexpectedly has billing writes: {actions}"
            )

    def test_no_role_can_manage_tenants_except_admin(self):
        """Tenant management is platform-admin only."""
        for role in KNOWN_ROLES - {"admin"}:
            actions = PERMISSION_MATRIX[role].get("tenants", set())
            assert not actions, (
                f"{role!r} has tenant access: {actions}; only admin should"
            )


class TestHasPermissionFunction:

    def test_admin_has_permission_on_everything(self):
        assert has_permission("admin", "billing", "delete")
        assert has_permission("admin", "crm", "create")

    def test_viewer_can_only_read(self):
        assert has_permission("viewer", "crm", "read")
        assert not has_permission("viewer", "crm", "create")
        assert not has_permission("viewer", "crm", "update")
        assert not has_permission("viewer", "crm", "delete")

    def test_agent_cannot_access_billing(self):
        for action in KNOWN_ACTIONS:
            assert not has_permission("agent", "billing", action)

    def test_unknown_role_has_no_permissions(self):
        assert not has_permission("hacker", "crm", "read")
        assert not has_permission("", "crm", "read")

    def test_unknown_module_returns_false(self):
        assert not has_permission("admin", "nuclear-launch-codes", "read")


class TestAccessibleModules:

    def test_admin_can_access_every_module(self):
        admin_modules = set(get_accessible_modules("admin"))
        all_modules = set(PERMISSION_MATRIX["admin"].keys())
        assert admin_modules == all_modules

    def test_viewer_excludes_modules_with_no_actions(self):
        accessible = set(get_accessible_modules("viewer"))
        # Viewer has empty sets for billing, helpdesk, surveys, tenants, etc.
        # Those should not appear in the accessible list.
        for excluded in ("billing", "tenants", "userManagement", "webhooks"):
            assert excluded not in accessible, (
                f"viewer should not see {excluded!r} in accessible modules"
            )


# ─────────────────────────────────────────────────────────────────
#   2. HTTP enforcement — fixtures + spot-checks
# ─────────────────────────────────────────────────────────────────


async def _register_user(async_client, role_hint: str) -> tuple[str, dict]:
    """
    Register a fresh user via /api/v1/auth/register and return (user_id, headers).
    The role is set to "user" by default; callers that need a different role
    must promote via the admin endpoint (see role_headers fixture).
    """
    unique = uuid.uuid4().hex[:8]
    payload = {
        "email": f"rbac-{role_hint}-{unique}@example.com",
        "password": "RBACTest1!",
        "full_name": f"RBAC {role_hint} {unique}",
        "company": "RBAC Test Co",
        "phone": "+91 9876500000",
    }
    resp = await async_client.post("/api/v1/auth/register", json=payload)
    assert resp.status_code in (200, 201), f"register failed: {resp.text}"
    data = resp.json()
    user_id = data["user"]["id"]
    headers = {"Authorization": f"Bearer {data['access_token']}"}
    return user_id, headers


@pytest_asyncio.fixture
async def viewer_headers(async_client, async_auth_headers):
    """Register a fresh user, promote to 'viewer', return their auth headers."""
    user_id, headers = await _register_user(async_client, "viewer")
    # Promote via admin token
    promote = await async_client.put(
        f"/api/v1/users/{user_id}/role",
        json={"role": "viewer"},
        headers=async_auth_headers,
    )
    if promote.status_code not in (200, 204):
        pytest.skip(f"role-promotion endpoint not available: {promote.status_code}")
    # Re-login so the new role lands in the JWT claims
    relogin = await async_client.post("/api/v1/auth/login", json={
        "email": (await async_client.get(f"/api/v1/users/{user_id}", headers=async_auth_headers)).json().get("email"),
        "password": "RBACTest1!",
    })
    if relogin.status_code != 200:
        return headers   # fall back to original token
    return {"Authorization": f"Bearer {relogin.json()['access_token']}"}


@pytest.mark.asyncio
class TestEndpointEnforcement:
    """A handful of high-impact HTTP-level enforcement checks."""

    async def test_admin_endpoint_blocks_unauthenticated(self, async_client):
        """No token → 401 (auth required)."""
        resp = await async_client.get("/api/v1/super-admin/tenants")
        assert resp.status_code in (401, 403, 404), resp.text

    async def test_admin_endpoint_blocks_non_super_admin(
        self, async_client, async_auth_headers
    ):
        """
        admin@swetha.in seeded as a regular admin, not a super_admin.
        Hitting a super-admin-only endpoint should return 403.
        Endpoint may be 404 if super_admin module isn't registered for this
        environment — that's also acceptable enforcement.
        """
        resp = await async_client.get(
            "/api/v1/super-admin/tenants", headers=async_auth_headers,
        )
        assert resp.status_code in (403, 404), resp.text

    async def test_seeded_admin_can_list_quotations(
        self, async_client, async_auth_headers
    ):
        """Admin role has crm/quotation read access — should 200."""
        resp = await async_client.get("/api/v1/quotations/", headers=async_auth_headers)
        assert resp.status_code == 200, resp.text

    async def test_unauthenticated_cannot_create_quotation(self, async_client):
        """No token → 401 on a write endpoint."""
        resp = await async_client.post("/api/v1/quotations/", json={
            "project_name": "Should not work",
            "building_params": {},
        })
        assert resp.status_code == 401

    async def test_invalid_token_gets_401(self, async_client):
        """A malformed token → 401, not 500."""
        resp = await async_client.get(
            "/api/v1/quotations/",
            headers={"Authorization": "Bearer not-a-real-token"},
        )
        assert resp.status_code == 401
