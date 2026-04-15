"""
Real-time Broadcast Helper
===========================
Broadcasts CRM events to all connected WebSocket clients.
Call after any create/update/delete operation.

Usage:
    from api.broadcast import broadcast_event
    await broadcast_event("lead.created", {"id": 1, "name": "Rajesh Kumar"})
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)


async def broadcast_event(event_type: str, payload: dict, tenant_id: Optional[str] = None) -> None:
    """Broadcast an event to all connected WebSocket clients.

    Args:
        event_type: Event name like "lead.created", "deal.updated", "ticket.deleted"
        payload: The data to send (usually the created/updated entity)
        tenant_id: If set, only broadcast to that tenant's connections
    """
    try:
        from api.realtime import manager
        if tenant_id:
            await manager.to_tenant(tenant_id, event_type, payload)
        else:
            await manager.to_all(event_type, payload)
    except Exception as exc:
        # Never let broadcast failures break the API response
        logger.warning("WS broadcast (%s) failed: %s", event_type, exc)
