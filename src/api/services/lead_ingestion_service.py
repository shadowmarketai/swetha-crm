"""
VoiceFlow Marketing AI - Lead Ingestion Service
=================================================
Normalizes leads from IndiaMart, JustDial, and Facebook Lead Ads
into the unified Lead model. Handles deduplication, auto-assign,
and activity logging.
"""

import logging
import re
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, and_, or_
from sqlalchemy.orm import Session

from api.models.crm import Lead, LeadSource, LeadStatus, Activity, ActivityType
from api.models.lead_source_config import LeadSourceConfig

logger = logging.getLogger(__name__)


# ── Phone Normalization ──────────────────────────────────────────


def normalize_phone(raw: str) -> str:
    """Normalize Indian phone numbers to 10-digit format.

    Handles: +91XXXXXXXXXX, 91XXXXXXXXXX, 0XXXXXXXXXX, XXXXXXXXXX
    """
    if not raw:
        return ""
    cleaned = re.sub(r"[^\d+]", "", raw.strip())
    # Remove leading +91 or 91 prefix
    if cleaned.startswith("+91") and len(cleaned) == 13:
        cleaned = cleaned[3:]
    elif cleaned.startswith("91") and len(cleaned) == 12:
        cleaned = cleaned[2:]
    elif cleaned.startswith("0") and len(cleaned) == 11:
        cleaned = cleaned[1:]
    return cleaned


# ── Name Splitting ───────────────────────────────────────────────


def split_name(full_name: str) -> tuple[str, str]:
    """Split a full name into (first_name, last_name).

    "Rajesh Kumar" → ("Rajesh", "Kumar")
    "Rajesh" → ("Rajesh", "")
    """
    if not full_name:
        return ("", "")
    parts = full_name.strip().split(None, 1)
    first = parts[0]
    last = parts[1] if len(parts) > 1 else ""
    return (first, last)


# ── Deduplication ────────────────────────────────────────────────


def find_duplicate_lead(
    db: Session,
    user_id: int,
    phone: Optional[str],
    email: Optional[str],
    external_id: Optional[str],
    external_type: Optional[str],
) -> Optional[Lead]:
    """3-tier dedup: external_id → phone → email."""
    # Tier 1: Match by external source ID
    if external_id and external_type:
        stmt = select(Lead).where(
            and_(
                Lead.user_id == user_id,
                Lead.external_source_id == external_id,
                Lead.external_source_type == external_type,
            )
        )
        existing = db.execute(stmt).scalar_one_or_none()
        if existing:
            return existing

    # Tier 2: Match by phone
    if phone:
        normalized = normalize_phone(phone)
        if normalized and len(normalized) >= 10:
            stmt = select(Lead).where(
                and_(Lead.user_id == user_id, Lead.phone == normalized)
            )
            existing = db.execute(stmt).scalar_one_or_none()
            if existing:
                return existing

    # Tier 3: Match by email
    if email:
        stmt = select(Lead).where(
            and_(Lead.user_id == user_id, Lead.email == email.lower())
        )
        existing = db.execute(stmt).scalar_one_or_none()
        if existing:
            return existing

    return None


# ── Source-Specific Normalizers ──────────────────────────────────


def normalize_indiamart_lead(raw: dict) -> dict:
    """Normalize IndiaMart CRM API response to standard format.

    IndiaMart fields: SENDER_NAME, SENDER_MOBILE, SENDER_EMAIL,
    SENDER_COMPANY, UNIQUE_QUERY_ID, QUERY_PRODUCT_NAME, SENDER_CITY,
    SENDER_STATE, QUERY_MESSAGE, DATE_TIME_STAMP
    """
    first, last = split_name(raw.get("SENDER_NAME", ""))
    return {
        "first_name": first,
        "last_name": last,
        "phone": normalize_phone(raw.get("SENDER_MOBILE", "")),
        "email": (raw.get("SENDER_EMAIL") or "").strip().lower() or None,
        "company_name": raw.get("SENDER_COMPANY"),
        "city": raw.get("SENDER_CITY"),
        "state": raw.get("SENDER_STATE"),
        "notes": raw.get("QUERY_MESSAGE"),
        "external_source_id": str(raw.get("UNIQUE_QUERY_ID", "")),
        "external_source_type": "indiamart",
        "source": LeadSource.INDIAMART,
        "raw_payload": raw,
        "custom_fields": {
            "product_interest": raw.get("QUERY_PRODUCT_NAME"),
            "query_time": raw.get("DATE_TIME_STAMP"),
        },
    }


def normalize_justdial_lead(raw: dict) -> dict:
    """Normalize JustDial webhook payload to standard format.

    JustDial fields: leadid, name, mobile, email, category, area, city, date
    """
    first, last = split_name(raw.get("name", ""))
    return {
        "first_name": first,
        "last_name": last,
        "phone": normalize_phone(raw.get("mobile", "")),
        "email": (raw.get("email") or "").strip().lower() or None,
        "company_name": None,
        "city": raw.get("city"),
        "state": None,
        "notes": f"Category: {raw.get('category', 'N/A')}, Area: {raw.get('area', 'N/A')}",
        "external_source_id": str(raw.get("leadid", "")),
        "external_source_type": "justdial",
        "source": LeadSource.JUSTDIAL,
        "raw_payload": raw,
        "custom_fields": {
            "category": raw.get("category"),
            "area": raw.get("area"),
        },
    }


def normalize_facebook_lead(raw: dict) -> dict:
    """Normalize Facebook Lead Ads field_data into standard format.

    Facebook sends: field_data = [{"name": "full_name", "values": ["Raj"]}, ...]
    """
    # Flatten field_data array into dict
    fields = {}
    for item in raw.get("field_data", []):
        name = item.get("name", "")
        values = item.get("values", [])
        fields[name] = values[0] if values else ""

    first, last = split_name(fields.get("full_name", ""))
    return {
        "first_name": first,
        "last_name": last,
        "phone": normalize_phone(fields.get("phone_number", "")),
        "email": (fields.get("email") or "").strip().lower() or None,
        "company_name": fields.get("company_name"),
        "city": fields.get("city"),
        "state": fields.get("state"),
        "notes": None,
        "external_source_id": str(raw.get("id", "")),
        "external_source_type": "facebook_leads",
        "source": LeadSource.FACEBOOK_LEADS,
        "raw_payload": raw,
        "custom_fields": {k: v for k, v in fields.items()
                         if k not in ("full_name", "phone_number", "email", "company_name", "city", "state")},
    }


# ── Lead Ingestion ───────────────────────────────────────────────


def ingest_lead(
    db: Session,
    user_id: int,
    normalized: dict,
    config: Optional[LeadSourceConfig] = None,
) -> tuple[Optional[Lead], bool]:
    """Create a Lead from normalized data. Returns (lead, is_new).

    - Checks for duplicates before creating
    - Applies auto-assign and default tags from config
    - Logs an activity entry
    - Updates config sync stats
    """
    # Dedup check
    existing = find_duplicate_lead(
        db,
        user_id,
        normalized.get("phone"),
        normalized.get("email"),
        normalized.get("external_source_id"),
        normalized.get("external_source_type"),
    )
    if existing:
        if config:
            config.total_duplicates = (config.total_duplicates or 0) + 1
        return (existing, False)

    # Create lead
    lead = Lead(
        user_id=user_id,
        first_name=normalized.get("first_name", ""),
        last_name=normalized.get("last_name"),
        phone=normalized.get("phone"),
        email=normalized.get("email"),
        company_name=normalized.get("company_name"),
        city=normalized.get("city"),
        state=normalized.get("state"),
        notes=normalized.get("notes"),
        source=normalized.get("source"),
        external_source_id=normalized.get("external_source_id"),
        external_source_type=normalized.get("external_source_type"),
        raw_payload=normalized.get("raw_payload"),
        custom_fields=normalized.get("custom_fields"),
        status=LeadStatus.NEW,
        lead_score=0.0,
        ingested_at=datetime.now(timezone.utc),
    )

    # Apply config defaults
    if config:
        if config.default_tags:
            lead.tags = list(config.default_tags)
        if config.auto_assign and config.assign_to_user_id:
            lead.assigned_to = config.assign_to_user_id

    db.add(lead)
    db.flush()  # Get lead.id

    # Log activity
    activity = Activity(
        user_id=user_id,
        lead_id=lead.id,
        activity_type=ActivityType.NOTE,
        subject=f"Lead ingested from {normalized.get('external_source_type', 'unknown')}",
        description=f"External ID: {normalized.get('external_source_id', 'N/A')}",
    )
    db.add(activity)

    # Update config stats
    if config:
        config.total_ingested = (config.total_ingested or 0) + 1
        config.last_sync_at = datetime.now(timezone.utc)

    return (lead, True)
