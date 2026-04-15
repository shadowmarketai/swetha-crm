"""
Signed portal tokens for public client access.

Token format (URL-safe, compact):
    {b64url(payload)}.{b64url(hmac)}

Payload is a JSON object:
    { "q": <quotation_id>, "t": "<tenant_id>", "k": "<kind>", "e": <unix_exp> }

Signed with HMAC-SHA256 using QUOTATION_SIGNING_SECRET (falls back to
SECRET_KEY / JWT_SECRET_KEY). Tokens are also written to the
quotation_portal_tokens table for revocation and access tracking, but
the signature alone is enough to verify authenticity offline.
"""

import base64
import hmac
import hashlib
import json
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from sqlalchemy.orm import Session

from api.models.quotation_template import (
    QuotationPortalToken,
    PortalTokenKind,
)

# Secret resolution order
_SECRET = (
    os.getenv("QUOTATION_SIGNING_SECRET")
    or os.getenv("SECRET_KEY")
    or os.getenv("JWT_SECRET_KEY")
    or "tendent-quotation-dev-secret-change-me"
).encode("utf-8")


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def _sign(payload: bytes) -> bytes:
    return hmac.new(_SECRET, payload, hashlib.sha256).digest()


def create_token_string(
    quotation_id: int,
    tenant_id: str,
    kind: str = PortalTokenKind.VIEW.value,
    expires_in_days: int = 30,
) -> Tuple[str, datetime]:
    """
    Generate a signed portal token string and its expiry datetime.
    Does NOT persist to DB — caller does that via create_token().
    """
    expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)
    payload = {
        "q": int(quotation_id),
        "t": str(tenant_id),
        "k": str(kind),
        "e": int(expires_at.timestamp()),
        # Jitter to guarantee unique tokens even for identical payloads
        "j": secrets.token_hex(4),
    }
    payload_bytes = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    sig = _sign(payload_bytes)
    token = f"{_b64url_encode(payload_bytes)}.{_b64url_encode(sig)}"
    return token, expires_at


def verify_token_string(token: str) -> Optional[dict]:
    """
    Verify signature + expiry WITHOUT touching the DB.
    Returns the decoded payload dict or None if invalid/expired.
    """
    if not token or "." not in token:
        return None
    try:
        payload_b64, sig_b64 = token.split(".", 1)
        payload_bytes = _b64url_decode(payload_b64)
        sig = _b64url_decode(sig_b64)
    except Exception:
        return None

    expected = _sign(payload_bytes)
    if not hmac.compare_digest(sig, expected):
        return None

    try:
        payload = json.loads(payload_bytes.decode())
    except Exception:
        return None

    exp = payload.get("e", 0)
    if exp and exp < datetime.now(timezone.utc).timestamp():
        return None  # expired

    return payload


def create_token(
    db: Session,
    quotation_id: int,
    tenant_id: str,
    kind: str = PortalTokenKind.VIEW.value,
    expires_in_days: int = 30,
) -> QuotationPortalToken:
    """Generate a signed token AND persist it for revocation + tracking."""
    token_str, expires_at = create_token_string(
        quotation_id, tenant_id, kind, expires_in_days
    )
    row = QuotationPortalToken(
        quotation_id=quotation_id,
        tenant_id=tenant_id,
        token=token_str,
        kind=kind,
        expires_at=expires_at,
        access_count=0,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_token(db: Session, token_str: str) -> Optional[QuotationPortalToken]:
    """
    Look up a token row by its string value. Returns None if not found,
    revoked, or expired. Also verifies the signature — a token with valid
    DB entry but mismatched signature is rejected.
    """
    # First verify signature offline (fast path, also enforces expiry)
    payload = verify_token_string(token_str)
    if payload is None:
        return None

    row = (
        db.query(QuotationPortalToken)
        .filter(QuotationPortalToken.token == token_str)
        .first()
    )
    if row is None:
        return None
    if row.revoked:
        return None
    if row.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        return None
    return row


def record_access(
    db: Session,
    token_row: QuotationPortalToken,
    ip: Optional[str] = None,
) -> None:
    """Increment access counter + log last access."""
    token_row.access_count = (token_row.access_count or 0) + 1
    token_row.last_accessed_at = datetime.now(timezone.utc)
    if ip:
        token_row.last_accessed_ip = ip
    db.commit()


def revoke_tokens_for_quotation(db: Session, quotation_id: int) -> int:
    """Revoke all active tokens for a quotation (e.g. after major revision)."""
    rows = (
        db.query(QuotationPortalToken)
        .filter(
            QuotationPortalToken.quotation_id == quotation_id,
            QuotationPortalToken.revoked == False,  # noqa: E712
        )
        .all()
    )
    for row in rows:
        row.revoked = True
    db.commit()
    return len(rows)
