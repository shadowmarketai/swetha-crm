"""
Tenant-isolation tests — verify the two confirmed cross-user data leak
vectors closed in `fix(security): production hardening sweep`:

  1. POST /api/v1/quotations/  with a lead_id owned by a different user
     must NOT silently attach that lead. The router calls
     quotation_service.create_quotation which now filters Lead by user_id.

  2. GET /api/v1/quotations/{id}/pdf  for a quotation owned by another
     user must NOT return that PDF. quotation_service.generate_pdf now
     filters Quotation by user_id.

We register two real users (Alice and Bob), have each create their own
quotation + lead, then verify Alice can't reach Bob's resources and vice
versa. This is the highest-value security regression test in the suite —
the leak vectors here would expose proprietary BOQ pricing across tenants.
"""

from __future__ import annotations

import logging
import uuid

import pytest
import pytest_asyncio

logger = logging.getLogger(__name__)


# ── Two-user fixture ─────────────────────────────────────────────


@pytest_asyncio.fixture
async def alice_and_bob(async_client, async_auth_headers):
    """
    Register two fresh isolated users (Alice, Bob), promote each to 'agent'
    so they can create CRM leads + quotations, then re-login so the new
    role lands in their JWT claims. Returns headers + id for each.
    """
    async def _register_and_promote(prefix: str) -> dict:
        unique = uuid.uuid4().hex[:8]
        password = "IsolationTest1!"
        payload = {
            "email": f"{prefix}-{unique}@isolation.example.com",
            "password": password,
            "full_name": f"{prefix.capitalize()} {unique}",
            "company": f"{prefix.capitalize()} Co",
            "phone": "+91 9876500000",
        }
        resp = await async_client.post("/api/v1/auth/register", json=payload)
        assert resp.status_code in (200, 201), f"register {prefix} failed: {resp.text}"
        user_id = resp.json()["user"]["id"]

        # Promote default 'user' → 'agent' (manager would also work; agent
        # is the lightest role with quotation.create).
        promote = await async_client.put(
            f"/api/v1/users/{user_id}/role",
            json={"role": "agent"},
            headers=async_auth_headers,
        )
        if promote.status_code not in (200, 204):
            pytest.skip(f"role-promotion not available: {promote.status_code}")

        # Re-login so the JWT carries the new role
        relogin = await async_client.post("/api/v1/auth/login", json={
            "email": payload["email"], "password": password,
        })
        assert relogin.status_code == 200, f"re-login failed: {relogin.text}"
        token = relogin.json()["access_token"]
        return {
            "id": user_id,
            "email": payload["email"],
            "headers": {"Authorization": f"Bearer {token}"},
        }

    return {
        "alice": await _register_and_promote("alice"),
        "bob": await _register_and_promote("bob"),
    }


# ── Helpers ──────────────────────────────────────────────────────


async def _create_lead(async_client, headers: dict, name_hint: str) -> int:
    """Create a CRM lead and return its integer id."""
    resp = await async_client.post(
        "/api/v1/crm-leads",
        headers=headers,
        json={
            "first_name": name_hint,
            "last_name": "Test",
            "email": f"{name_hint.lower()}-lead-{uuid.uuid4().hex[:6]}@example.com",
            "phone": "+91 9000000000",
            "company_name": f"{name_hint} Company",
        },
    )
    assert resp.status_code in (200, 201), f"create lead failed: {resp.text}"
    return resp.json()["id"]


async def _create_quotation(async_client, headers: dict, lead_id: int | None, name: str) -> int:
    """Create a minimal quotation tied to the user's own lead."""
    resp = await async_client.post(
        "/api/v1/quotations/",
        headers=headers,
        json={
            "lead_id": lead_id,
            "project_name": name,
            "client_name": "Test Client",
            "client_location": "Test City",
            "building_params": {
                "building_length": 100,
                "building_width": 50,
                "full_height": 25,
                "wall_height": 8,
                "roof_type": "a_type",
                "roof_sheet_type": "bare_galvalume_0.4mm",
                "side_cladding_type": "bare_colour_galvalume_0.4mm",
                "mezzanine_required": False,
            },
        },
    )
    assert resp.status_code in (200, 201), f"create quotation failed: {resp.text}"
    return resp.json()["id"]


# ── Tests ────────────────────────────────────────────────────────


@pytest.mark.asyncio
class TestQuotationLeadIsolation:
    """create_quotation must reject another tenant's lead_id."""

    async def test_alice_cannot_attach_bobs_lead_to_her_quotation(
        self, async_client, alice_and_bob
    ):
        alice = alice_and_bob["alice"]
        bob = alice_and_bob["bob"]

        # Bob creates his lead
        bob_lead_id = await _create_lead(async_client, bob["headers"], "Bob")

        # Alice tries to attach Bob's lead to her own quotation. Before
        # the fix, this would silently succeed (the lookup didn't filter
        # on user_id). After: must be rejected.
        resp = await async_client.post(
            "/api/v1/quotations/",
            headers=alice["headers"],
            json={
                "lead_id": bob_lead_id,
                "project_name": "Alice trying to steal Bob's lead",
                "building_params": {
                    "building_length": 50,
                    "building_width": 30,
                    "full_height": 20,
                    "wall_height": 8,
                    "roof_type": "a_type",
                    "roof_sheet_type": "bare_galvalume_0.4mm",
                    "side_cladding_type": "bare_colour_galvalume_0.4mm",
                    "mezzanine_required": False,
                },
            },
        )
        # 400 (lead not found per user filter) or 404 are acceptable; what
        # we MUST NOT see is 200/201 — that would mean the leak is back.
        assert resp.status_code in (400, 404, 422), (
            f"Cross-tenant lead attachment leaked! Got {resp.status_code}: {resp.text}"
        )


@pytest.mark.asyncio
class TestQuotationPdfIsolation:
    """generate_pdf must filter on user_id."""

    async def test_alice_cannot_generate_pdf_for_bobs_quotation(
        self, async_client, alice_and_bob
    ):
        alice = alice_and_bob["alice"]
        bob = alice_and_bob["bob"]

        # Bob creates a quotation under his own account
        bob_quote_id = await _create_quotation(
            async_client, bob["headers"], None, "Bob's secret pricing"
        )

        # Alice attempts to generate the PDF — must 404 even though the
        # quotation exists (it just isn't hers).
        resp = await async_client.post(
            f"/api/v1/quotations/{bob_quote_id}/pdf",
            headers=alice["headers"],
        )
        assert resp.status_code == 404, (
            f"Cross-tenant PDF leak! Alice got {resp.status_code} for "
            f"Bob's quote: {resp.text[:200]}"
        )

    async def test_alice_cannot_get_bobs_quotation_detail(
        self, async_client, alice_and_bob
    ):
        alice = alice_and_bob["alice"]
        bob = alice_and_bob["bob"]

        bob_quote_id = await _create_quotation(
            async_client, bob["headers"], None, "Bob's quotation"
        )

        resp = await async_client.get(
            f"/api/v1/quotations/{bob_quote_id}",
            headers=alice["headers"],
        )
        assert resp.status_code == 404, (
            f"Cross-tenant detail leak! Alice got {resp.status_code} for "
            f"Bob's quote: {resp.text[:200]}"
        )

    async def test_alice_cannot_delete_bobs_quotation(
        self, async_client, alice_and_bob
    ):
        alice = alice_and_bob["alice"]
        bob = alice_and_bob["bob"]

        bob_quote_id = await _create_quotation(
            async_client, bob["headers"], None, "Bob's quotation"
        )

        resp = await async_client.delete(
            f"/api/v1/quotations/{bob_quote_id}",
            headers=alice["headers"],
        )
        assert resp.status_code in (403, 404), (
            f"Cross-tenant delete leak! Alice got {resp.status_code}"
        )

        # Bob's quotation should still exist after Alice's failed delete
        verify = await async_client.get(
            f"/api/v1/quotations/{bob_quote_id}",
            headers=bob["headers"],
        )
        assert verify.status_code == 200, (
            "Bob's quotation was deleted by Alice's failed delete request"
        )


@pytest.mark.asyncio
class TestQuotationListIsolation:
    """A user's list endpoint should never include another user's records."""

    async def test_quotation_list_only_shows_own_records(
        self, async_client, alice_and_bob
    ):
        alice = alice_and_bob["alice"]
        bob = alice_and_bob["bob"]

        alice_quote_id = await _create_quotation(
            async_client, alice["headers"], None, "Alice's quotation"
        )
        bob_quote_id = await _create_quotation(
            async_client, bob["headers"], None, "Bob's quotation"
        )

        # Alice lists — must contain her quote, must NOT contain Bob's
        resp = await async_client.get(
            "/api/v1/quotations/",
            headers=alice["headers"],
        )
        assert resp.status_code == 200, resp.text
        ids = {item["id"] for item in resp.json().get("items", [])}
        assert alice_quote_id in ids, "Alice can't see her own quotation"
        assert bob_quote_id not in ids, (
            f"List endpoint leaked: Alice sees Bob's quote {bob_quote_id}; "
            f"got ids={sorted(ids)}"
        )
