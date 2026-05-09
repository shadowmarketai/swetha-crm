"""
Tenant WhatsApp service
=======================

Per-tenant WhatsApp helpers — looks up the tenant's active provider config
and dispatches messages (text + PDF document) via the appropriate adapter
constructed by ``MessagingFactory.get_whatsapp_adapter``.
"""

from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy.orm import Session

from api.models.quotation_template import (
    TenantWhatsAppConfig,
)
from integrations.messaging.messaging_integration import MessagingFactory

logger = logging.getLogger(__name__)


def get_active_config(db: Session, tenant_id: str) -> Optional[TenantWhatsAppConfig]:
    """Return the active WhatsApp config row for ``tenant_id``, or ``None``."""
    try:
        return (
            db.query(TenantWhatsAppConfig)
            .filter(
                TenantWhatsAppConfig.tenant_id == tenant_id,
                TenantWhatsAppConfig.is_active.is_(True),
            )
            .first()
        )
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("Failed to load TenantWhatsAppConfig for tenant=%s: %s", tenant_id, exc)
        return None


async def send_quotation_to_client(
    db: Session,
    tenant_id: str,
    client_phone: str,
    pdf_url: str,
    portal_url: str,
    client_name: str,
    project_name: str,
    total_amount: float,
) -> dict:
    """
    Send a quotation to a client over WhatsApp using the tenant's configured provider.

    Sends a text message first (greeting + links), then the PDF as a document.
    Accumulates results into a single dict.

    Returns:
        {
            "success": bool,
            "provider": str,
            "message_id": str | None,
            "error": str | None,
            "text_result": {...} | None,
            "document_result": {...} | None,
        }
    """
    config = get_active_config(db, tenant_id)
    if config is None:
        return {
            "success": False,
            "provider": None,
            "message_id": None,
            "error": "WhatsApp not configured for this tenant",
        }

    provider = config.provider
    credentials = config.credentials or {}

    try:
        adapter = MessagingFactory.get_whatsapp_adapter(provider, credentials)
    except NotImplementedError as exc:
        return {
            "success": False,
            "provider": provider,
            "message_id": None,
            "error": str(exc),
        }
    except Exception as exc:
        logger.exception("Failed to construct WhatsApp adapter for provider=%s", provider)
        return {
            "success": False,
            "provider": provider,
            "message_id": None,
            "error": f"Failed to initialise provider '{provider}': {exc}",
        }

    body = (
        f"Hi {client_name},\n\n"
        f"Your quotation for \"{project_name}\" is ready.\n\n"
        f"Total: \u20b9{total_amount:,.0f}\n\n"
        f"\U0001F4C4 View PDF: {pdf_url}\n"
        f"\U0001F3D7\ufe0f Interactive 3D: {portal_url}\n\n"
        "Reply here if you have any questions!"
    )

    text_result = await adapter.send_text_message(to=client_phone, text=body)

    filename = f"{project_name.replace(' ', '_')}_quotation.pdf"
    document_result = await adapter.send_document_message(
        to=client_phone,
        document_url=pdf_url,
        filename=filename,
        caption=f"Quotation for {project_name}",
    )

    overall_success = bool(getattr(text_result, "success", False)) and bool(
        getattr(document_result, "success", False)
    )

    primary_message_id = (
        getattr(document_result, "message_id", None)
        or getattr(text_result, "message_id", None)
    )

    error_parts = []
    if not getattr(text_result, "success", False):
        err = getattr(text_result, "error", None)
        if err:
            error_parts.append(f"text: {err}")
    if not getattr(document_result, "success", False):
        err = getattr(document_result, "error", None)
        if err:
            error_parts.append(f"document: {err}")

    return {
        "success": overall_success,
        "provider": provider,
        "message_id": primary_message_id,
        "error": "; ".join(error_parts) if error_parts else None,
        "text_result": {
            "success": getattr(text_result, "success", False),
            "message_id": getattr(text_result, "message_id", None),
            "error": getattr(text_result, "error", None),
        },
        "document_result": {
            "success": getattr(document_result, "success", False),
            "message_id": getattr(document_result, "message_id", None),
            "error": getattr(document_result, "error", None),
        },
    }
