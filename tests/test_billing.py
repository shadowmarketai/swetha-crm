"""
Billing tests — webhook integrity + subscription lifecycle.

The Razorpay webhook is the highest-business-risk path: it processes real
money events with no JWT auth (signed via HMAC-SHA256 only). Wrong
signature → reject. Wrong retry counter → silently miss a failure. We test
both explicitly so a regression here can't ship undetected.

Subscription lifecycle is covered at the HTTP level: list-plans returns
something, get-subscription requires auth, etc. Real Razorpay round-trips
are not exercised — we test the local state machine.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging

import pytest

logger = logging.getLogger(__name__)


WEBHOOK_SECRET = "test-razorpay-webhook-secret-32chars"


def _sign(body: bytes, secret: str = WEBHOOK_SECRET) -> str:
    """Razorpay-style HMAC-SHA256 hex digest of the raw body."""
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


@pytest.fixture(autouse=True)
def _set_razorpay_secret(monkeypatch):
    """
    Force a known webhook secret for the duration of every test in this file.
    Without this, _verify_razorpay_signature short-circuits to True (because
    the empty-secret branch returns True), masking actual signature bugs.
    """
    from api.config import settings
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", WEBHOOK_SECRET)
    # Also reset the in-memory retry counter so tests don't leak state
    try:
        from api.routers import billing as billing_module
        billing_module._webhook_retry_counts.clear()
    except (ImportError, AttributeError):
        pass


# ─────────────────────────────────────────────────────────────────
#   Plans + Subscription endpoints
# ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
class TestPlansAndSubscriptionAuth:

    async def test_list_plans_works_for_authenticated_user(
        self, async_client, async_auth_headers
    ):
        resp = await async_client.get("/api/v1/billing/plans", headers=async_auth_headers)
        # 200 with a plan list, OR 503/501 if no plans seeded — either is
        # acceptable as long as it's not 500.
        assert resp.status_code < 500, resp.text

    async def test_get_subscription_requires_auth(self, async_client):
        resp = await async_client.get("/api/v1/billing/subscription")
        assert resp.status_code in (401, 403), resp.text

    async def test_subscribe_requires_auth(self, async_client):
        resp = await async_client.post(
            "/api/v1/billing/subscribe", json={"plan_id": "pro"},
        )
        assert resp.status_code in (401, 403), resp.text

    async def test_cancel_requires_auth(self, async_client):
        resp = await async_client.post("/api/v1/billing/cancel")
        assert resp.status_code in (401, 403), resp.text


# ─────────────────────────────────────────────────────────────────
#   Razorpay webhook — signature verification
# ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
class TestWebhookSignatureVerification:

    async def test_webhook_rejects_missing_signature(self, async_client):
        body = json.dumps({"event": "subscription.charged", "payload": {}}).encode()
        resp = await async_client.post(
            "/api/v1/billing/webhook",
            content=body,
            headers={"Content-Type": "application/json"},
        )
        assert resp.status_code == 400
        assert "signature" in resp.text.lower()

    async def test_webhook_rejects_wrong_signature(self, async_client):
        body = json.dumps({"event": "subscription.charged", "payload": {}}).encode()
        resp = await async_client.post(
            "/api/v1/billing/webhook",
            content=body,
            headers={
                "Content-Type": "application/json",
                "X-Razorpay-Signature": "deadbeef" * 8,  # plausible-looking but wrong
            },
        )
        assert resp.status_code == 400
        assert "signature" in resp.text.lower()

    async def test_webhook_accepts_valid_signature(self, async_client):
        body = json.dumps({
            "event": "subscription.charged",
            "payload": {"subscription": {"entity": {"id": "sub_TEST123"}}},
        }).encode()
        resp = await async_client.post(
            "/api/v1/billing/webhook",
            content=body,
            headers={
                "Content-Type": "application/json",
                "X-Razorpay-Signature": _sign(body),
            },
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["status"] == "processed"
        assert data["event"] == "subscription.charged"

    async def test_webhook_invalid_json_returns_400_not_500(self, async_client):
        body = b"not-json-at-all"
        resp = await async_client.post(
            "/api/v1/billing/webhook",
            content=body,
            headers={
                "Content-Type": "application/json",
                "X-Razorpay-Signature": _sign(body),
            },
        )
        assert resp.status_code == 400
        assert "json" in resp.text.lower()

    async def test_webhook_signature_is_per_byte_sensitive(self, async_client):
        """Even a single-byte change to the body must invalidate the signature."""
        body = b'{"event":"subscription.charged","payload":{}}'
        sig = _sign(body)
        tampered = body.replace(b"charged", b"chargeD")  # one-bit flip
        resp = await async_client.post(
            "/api/v1/billing/webhook",
            content=tampered,
            headers={
                "Content-Type": "application/json",
                "X-Razorpay-Signature": sig,
            },
        )
        assert resp.status_code == 400


# ─────────────────────────────────────────────────────────────────
#   Razorpay webhook — payment.failed retry counter
# ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
class TestPaymentFailedRetryCounter:

    @staticmethod
    def _failed_event(payment_id: str = "pay_BROKE001") -> bytes:
        return json.dumps({
            "event": "payment.failed",
            "payload": {"payment": {"entity": {"id": payment_id}}},
        }).encode()

    async def test_first_failure_increments_to_one(self, async_client):
        from api.routers import billing as bm
        body = self._failed_event("pay_BROKE_A")
        resp = await async_client.post(
            "/api/v1/billing/webhook",
            content=body,
            headers={"X-Razorpay-Signature": _sign(body)},
        )
        assert resp.status_code == 200
        assert bm._webhook_retry_counts["pay_BROKE_A"] == 1

    async def test_retry_counter_caps_at_three_then_logs_permanent(self, async_client):
        from api.routers import billing as bm
        pid = "pay_BROKE_B"
        body = self._failed_event(pid)
        # Three failures → retry counter hits 3
        for expected in (1, 2, 3):
            resp = await async_client.post(
                "/api/v1/billing/webhook",
                content=body,
                headers={"X-Razorpay-Signature": _sign(body)},
            )
            assert resp.status_code == 200
            assert bm._webhook_retry_counts[pid] == expected

        # Fourth failure should NOT increment past 3 — that's the point of
        # the cap. The handler logs a permanent failure instead.
        resp = await async_client.post(
            "/api/v1/billing/webhook",
            content=body,
            headers={"X-Razorpay-Signature": _sign(body)},
        )
        assert resp.status_code == 200
        assert bm._webhook_retry_counts[pid] == 3, (
            "retry counter must cap at 3; permanent failure path didn't trigger"
        )

    async def test_distinct_payments_have_independent_counters(self, async_client):
        from api.routers import billing as bm
        for pid in ("pay_X1", "pay_X2", "pay_X3"):
            body = self._failed_event(pid)
            await async_client.post(
                "/api/v1/billing/webhook",
                content=body,
                headers={"X-Razorpay-Signature": _sign(body)},
            )
        for pid in ("pay_X1", "pay_X2", "pay_X3"):
            assert bm._webhook_retry_counts[pid] == 1, (
                f"{pid} counter polluted by sibling: {bm._webhook_retry_counts}"
            )


# ─────────────────────────────────────────────────────────────────
#   Webhook event coverage — silently dropped events should still 200
# ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
class TestWebhookEventCoverage:

    async def test_unknown_event_returns_200_processed(self, async_client):
        body = json.dumps({"event": "subscription.never.heard.of", "payload": {}}).encode()
        resp = await async_client.post(
            "/api/v1/billing/webhook",
            content=body,
            headers={"X-Razorpay-Signature": _sign(body)},
        )
        assert resp.status_code == 200
        assert resp.json()["event"] == "subscription.never.heard.of"

    @pytest.mark.parametrize("event_type", [
        "subscription.activated",
        "subscription.charged",
        "subscription.cancelled",
        "payment.captured",
    ])
    async def test_each_handled_event_returns_processed(self, async_client, event_type):
        body = json.dumps({
            "event": event_type,
            "payload": {
                "subscription": {"entity": {"id": "sub_TEST", "notes": {}}},
                "payment": {"entity": {"id": "pay_TEST", "amount": 49900}},
            },
        }).encode()
        resp = await async_client.post(
            "/api/v1/billing/webhook",
            content=body,
            headers={"X-Razorpay-Signature": _sign(body)},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "processed"
