"""
VoiceFlow Marketing AI - Lead Sources Router
==============================================
Endpoints for IndiaMart, JustDial, and Facebook Lead Ads integrations.
Handles webhook ingestion, API polling, and source config management.
"""

import hashlib
import hmac
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Header, Query, Request, status
from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session

from api.config import settings
from api.database import get_db
from api.models.crm import Lead, LeadSource
from api.models.lead_source_config import LeadSourceConfig, LeadSourceProvider
from api.permissions import require_permission
from api.schemas.lead_sources import (
    LeadSourceConfigCreate,
    LeadSourceConfigUpdate,
    LeadSourceConfigResponse,
    LeadIngestionResult,
    LeadSourceStats,
)
from api.services.lead_ingestion_service import (
    ingest_lead,
    normalize_indiamart_lead,
    normalize_justdial_lead,
    normalize_facebook_lead,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/lead-sources", tags=["Lead Sources"])


# ── IndiaMart Polling ────────────────────────────────────────────


@router.post("/indiamart/poll", response_model=LeadIngestionResult)
async def poll_indiamart(
    user: dict = Depends(require_permission("crm", "create")),
    db: Session = Depends(get_db),
):
    """Trigger an IndiaMart CRM API poll to fetch new leads."""
    user_id = user["id"]

    config = db.execute(
        select(LeadSourceConfig).where(
            and_(
                LeadSourceConfig.user_id == user_id,
                LeadSourceConfig.provider == LeadSourceProvider.INDIAMART,
                LeadSourceConfig.is_active == True,
            )
        )
    ).scalar_one_or_none()

    if not config or not config.api_key:
        raise HTTPException(status_code=400, detail="IndiaMart not configured or inactive")

    # Build API URL with CRM key
    url = settings.INDIAMART_CRM_API_URL
    params = {"glusr_crm_key": config.api_key}
    if config.last_sync_cursor:
        params["start_time"] = config.last_sync_cursor

    result = LeadIngestionResult()

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.error("IndiaMart API error: %s", exc)
        config.total_errors = (config.total_errors or 0) + 1
        db.commit()
        raise HTTPException(status_code=502, detail=f"IndiaMart API error: {exc}")

    # IndiaMart returns a list of leads or {"STATUS": "SUCCESS", ...}
    leads_data = data if isinstance(data, list) else data.get("JEESSION", [])
    if not isinstance(leads_data, list):
        leads_data = []

    for raw in leads_data:
        try:
            normalized = normalize_indiamart_lead(raw)
            lead, is_new = ingest_lead(db, user_id, normalized, config)
            if is_new:
                result.ingested += 1
            else:
                result.duplicates += 1
        except Exception as exc:
            result.errors += 1
            result.error_details.append(str(exc))
            logger.warning("IndiaMart lead ingestion error: %s", exc)

    # Update cursor to now for next poll
    config.last_sync_cursor = datetime.now(timezone.utc).strftime("%d-%b-%Y %H:%M:%S")
    db.commit()

    logger.info(
        "IndiaMart poll complete: ingested=%d duplicates=%d errors=%d",
        result.ingested, result.duplicates, result.errors,
    )
    return result


# ── JustDial Webhook ─────────────────────────────────────────────


@router.post("/justdial/webhook", response_model=LeadIngestionResult)
async def justdial_webhook(
    request: Request,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    db: Session = Depends(get_db),
):
    """Receive lead pushes from JustDial."""
    body = await request.json()

    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing X-API-Key header")

    # Find config matching this API key
    config = db.execute(
        select(LeadSourceConfig).where(
            and_(
                LeadSourceConfig.provider == LeadSourceProvider.JUSTDIAL,
                LeadSourceConfig.api_key == x_api_key,
                LeadSourceConfig.is_active == True,
            )
        )
    ).scalar_one_or_none()

    if not config:
        raise HTTPException(status_code=401, detail="Invalid API key")

    result = LeadIngestionResult()
    leads_list = body if isinstance(body, list) else [body]

    for raw in leads_list:
        try:
            normalized = normalize_justdial_lead(raw)
            lead, is_new = ingest_lead(db, config.user_id, normalized, config)
            if is_new:
                result.ingested += 1
            else:
                result.duplicates += 1
        except Exception as exc:
            result.errors += 1
            result.error_details.append(str(exc))
            logger.warning("JustDial lead ingestion error: %s", exc)

    db.commit()
    return result


# ── Facebook Webhook (Verification + Lead Ingestion) ─────────────


@router.get("/facebook/webhook")
async def facebook_webhook_verify(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    """Facebook webhook verification (hub.challenge handshake)."""
    if hub_mode == "subscribe" and hub_verify_token == settings.META_WEBHOOK_VERIFY_TOKEN:
        return int(hub_challenge)
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/facebook/webhook")
async def facebook_webhook_receive(
    request: Request,
    x_hub_signature: Optional[str] = Header(None, alias="X-Hub-Signature-256"),
    db: Session = Depends(get_db),
):
    """Receive Facebook Lead Ads form submissions."""
    raw_body = await request.body()

    # Verify HMAC signature
    if settings.META_APP_SECRET and x_hub_signature:
        expected = "sha256=" + hmac.HMAC(
            settings.META_APP_SECRET.encode(),
            raw_body,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, x_hub_signature):
            raise HTTPException(status_code=403, detail="Invalid signature")

    body = await request.json()
    result = LeadIngestionResult()

    entries = body.get("entry", [])
    for entry in entries:
        page_id = str(entry.get("id", ""))
        changes = entry.get("changes", [])

        for change in changes:
            if change.get("field") != "leadgen":
                continue

            leadgen_id = change.get("value", {}).get("leadgen_id")
            if not leadgen_id:
                continue

            # Find config for this page
            config = db.execute(
                select(LeadSourceConfig).where(
                    and_(
                        LeadSourceConfig.provider == LeadSourceProvider.FACEBOOK_LEADS,
                        LeadSourceConfig.page_id == page_id,
                        LeadSourceConfig.is_active == True,
                    )
                )
            ).scalar_one_or_none()

            if not config:
                logger.warning("No Facebook config for page_id=%s", page_id)
                continue

            # Fetch full lead data from Graph API
            try:
                lead_data = await _fetch_facebook_lead(leadgen_id, config.api_key)
            except Exception as exc:
                result.errors += 1
                result.error_details.append(f"Graph API error: {exc}")
                config.total_errors = (config.total_errors or 0) + 1
                continue

            try:
                normalized = normalize_facebook_lead(lead_data)
                lead, is_new = ingest_lead(db, config.user_id, normalized, config)
                if is_new:
                    result.ingested += 1
                else:
                    result.duplicates += 1
            except Exception as exc:
                result.errors += 1
                result.error_details.append(str(exc))

    db.commit()
    return result


async def _fetch_facebook_lead(leadgen_id: str, page_access_token: str) -> dict:
    """Fetch lead details from Facebook Graph API."""
    url = f"https://graph.facebook.com/v18.0/{leadgen_id}"
    params = {"access_token": page_access_token}
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        return resp.json()


# ── Config CRUD ──────────────────────────────────────────────────


@router.get("/configs", response_model=list[LeadSourceConfigResponse])
async def list_configs(
    user: dict = Depends(require_permission("integrations", "read")),
    db: Session = Depends(get_db),
):
    """List the current user's lead source configurations."""
    configs = db.execute(
        select(LeadSourceConfig).where(LeadSourceConfig.user_id == user["id"])
    ).scalars().all()

    return [_config_to_response(c) for c in configs]


@router.post("/configs", response_model=LeadSourceConfigResponse, status_code=201)
async def create_config(
    payload: LeadSourceConfigCreate,
    user: dict = Depends(require_permission("integrations", "create")),
    db: Session = Depends(get_db),
):
    """Create or update a lead source configuration."""
    user_id = user["id"]

    # Check for existing config for this provider
    existing = db.execute(
        select(LeadSourceConfig).where(
            and_(
                LeadSourceConfig.user_id == user_id,
                LeadSourceConfig.provider == LeadSourceProvider(payload.provider.value),
            )
        )
    ).scalar_one_or_none()

    if existing:
        # Update existing
        for field, value in payload.model_dump(exclude_unset=True).items():
            if field == "provider":
                continue
            if hasattr(existing, field):
                setattr(existing, field, value)
        db.commit()
        db.refresh(existing)
        return _config_to_response(existing)

    config = LeadSourceConfig(
        user_id=user_id,
        provider=LeadSourceProvider(payload.provider.value),
        api_key=payload.api_key,
        api_secret=payload.api_secret,
        app_secret=payload.app_secret,
        page_id=payload.page_id,
        polling_interval_minutes=payload.polling_interval_minutes,
        is_active=payload.is_active,
        auto_assign=payload.auto_assign,
        assign_to_user_id=payload.assign_to_user_id,
        default_tags=payload.default_tags,
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return _config_to_response(config)


@router.put("/configs/{config_id}", response_model=LeadSourceConfigResponse)
async def update_config(
    config_id: int,
    payload: LeadSourceConfigUpdate,
    user: dict = Depends(require_permission("integrations", "update")),
    db: Session = Depends(get_db),
):
    """Update a lead source configuration."""
    config = db.execute(
        select(LeadSourceConfig).where(
            and_(
                LeadSourceConfig.id == config_id,
                LeadSourceConfig.user_id == user["id"],
            )
        )
    ).scalar_one_or_none()

    if not config:
        raise HTTPException(status_code=404, detail="Config not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        if hasattr(config, field) and value is not None:
            setattr(config, field, value)

    db.commit()
    db.refresh(config)
    return _config_to_response(config)


@router.delete("/configs/{config_id}", status_code=204)
async def delete_config(
    config_id: int,
    user: dict = Depends(require_permission("integrations", "delete")),
    db: Session = Depends(get_db),
):
    """Delete a lead source configuration."""
    config = db.execute(
        select(LeadSourceConfig).where(
            and_(
                LeadSourceConfig.id == config_id,
                LeadSourceConfig.user_id == user["id"],
            )
        )
    ).scalar_one_or_none()

    if not config:
        raise HTTPException(status_code=404, detail="Config not found")

    db.delete(config)
    db.commit()


# ── Stats ────────────────────────────────────────────────────────


@router.get("/stats", response_model=list[LeadSourceStats])
async def get_stats(
    user: dict = Depends(require_permission("crm", "read")),
    db: Session = Depends(get_db),
):
    """Get per-source lead counts for the current user."""
    user_id = user["id"]
    sources = [
        ("indiamart", LeadSource.INDIAMART),
        ("justdial", LeadSource.JUSTDIAL),
        ("facebook_leads", LeadSource.FACEBOOK_LEADS),
    ]

    now = datetime.now(timezone.utc)
    results = []

    for label, source_enum in sources:
        base = select(func.count(Lead.id)).where(
            and_(Lead.user_id == user_id, Lead.source == source_enum)
        )
        total = db.execute(base).scalar() or 0

        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_count = db.execute(
            base.where(Lead.created_at >= today_start)
        ).scalar() or 0

        from datetime import timedelta
        week_start = today_start - timedelta(days=today_start.weekday())
        week_count = db.execute(
            base.where(Lead.created_at >= week_start)
        ).scalar() or 0

        month_start = today_start.replace(day=1)
        month_count = db.execute(
            base.where(Lead.created_at >= month_start)
        ).scalar() or 0

        results.append(LeadSourceStats(
            source=label,
            total=total,
            today=today_count,
            this_week=week_count,
            this_month=month_count,
        ))

    return results


# ── Helpers ──────────────────────────────────────────────────────


def _mask_key(key: Optional[str]) -> Optional[str]:
    """Mask an API key for display: show first 4 and last 4 chars."""
    if not key or len(key) < 10:
        return "****" if key else None
    return f"{key[:4]}...{key[-4:]}"


def _config_to_response(config: LeadSourceConfig) -> LeadSourceConfigResponse:
    return LeadSourceConfigResponse(
        id=config.id,
        provider=config.provider.value,
        api_key_masked=_mask_key(config.api_key),
        page_id=config.page_id,
        polling_interval_minutes=config.polling_interval_minutes,
        is_active=config.is_active,
        auto_assign=config.auto_assign,
        assign_to_user_id=config.assign_to_user_id,
        default_tags=config.default_tags,
        total_ingested=config.total_ingested or 0,
        total_duplicates=config.total_duplicates or 0,
        total_errors=config.total_errors or 0,
        last_sync_at=str(config.last_sync_at) if config.last_sync_at else None,
        created_at=str(config.created_at) if config.created_at else None,
        updated_at=str(config.updated_at) if config.updated_at else None,
    )
