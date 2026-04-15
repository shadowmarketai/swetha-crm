"""
Feature Engine Router — Dynamic feature access for tenants
============================================================
Returns feature config for the authenticated user's tenant.
Used by frontend to dynamically show/hide modules.
"""

import logging

from fastapi import APIRouter, Depends

from api.dependencies import get_current_active_user
from api.database import db, USE_POSTGRES

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/features", tags=["Feature Engine"])

_ph = "%s" if USE_POSTGRES else "?"


@router.get("/")
async def get_my_features(current_user: dict = Depends(get_current_active_user)):
    """Return enabled features for the current user's tenant.

    If no tenant config exists, returns all default-enabled features.
    This ensures existing behavior is preserved.
    """
    tenant_id = current_user.get("tenant_id", "")

    with db() as conn:
        # Get all system features
        features = conn.execute(
            "SELECT * FROM system_features ORDER BY sort_order"
        ).fetchall()

        # Get tenant overrides (if tenant exists)
        overrides = {}
        if tenant_id:
            rows = conn.execute(
                f"SELECT feature_key, enabled FROM tenant_features WHERE tenant_id={_ph}",
                (tenant_id,),
            ).fetchall()
            overrides = {
                (r["feature_key"] if isinstance(r, dict) else r[0]): bool(r["enabled"] if isinstance(r, dict) else r[1])
                for r in rows
            }

        # Get tenant branding
        branding = {}
        if tenant_id:
            tenant_row = conn.execute(
                f"SELECT app_name, logo_url, favicon_url, primary_color, secondary_color, accent_color, font_family FROM platform_tenants WHERE id={_ph}",
                (tenant_id,),
            ).fetchone()
            if tenant_row:
                branding = {k: v for k, v in dict(tenant_row).items() if v is not None}

    # Build feature map: override > default
    modules = {}
    for f in features:
        fd = dict(f)
        key = fd["key"]
        enabled = overrides.get(key, bool(fd["default_enabled"]))
        modules[key] = {
            "enabled": enabled,
            "name": fd["name"],
            "icon": fd["icon"],
            "description": fd["description"],
            "category": fd["category"],
            "is_premium": bool(fd["is_premium"]),
        }

    return {
        "tenant_id": tenant_id,
        "branding": branding,
        "modules": modules,
    }


@router.get("/branding")
async def get_my_branding(current_user: dict = Depends(get_current_active_user)):
    """Return branding config for the current user's tenant."""
    tenant_id = current_user.get("tenant_id", "")
    if not tenant_id:
        return {"app_name": "Swetha Structures CRM", "primary_color": "#f59e0b"}

    with db() as conn:
        row = conn.execute(
            f"SELECT app_name, logo_url, favicon_url, primary_color, secondary_color, accent_color, font_family, custom_css FROM platform_tenants WHERE id={_ph}",
            (tenant_id,),
        ).fetchone()

    if not row:
        return {"app_name": "Swetha Structures CRM", "primary_color": "#f59e0b"}

    return {k: v for k, v in dict(row).items() if v is not None}
