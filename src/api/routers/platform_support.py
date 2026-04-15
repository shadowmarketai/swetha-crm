"""
Platform Support Router — Tenant side
=======================================
Endpoints for tenant admins to raise support tickets to the platform team
(super admin) and view/reply to their own tickets.

These tickets are distinct from helpdesk tickets, which are tenants' own
customer support. Platform tickets are tenant→platform conversations
about billing, bugs, feature requests, and access issues.
"""

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException

from api.dependencies import get_current_active_user
from api.database import db, USE_POSTGRES

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/platform-support", tags=["Platform Support"])

_ph = "%s" if USE_POSTGRES else "?"


def _require_tenant_user(current_user: dict = Depends(get_current_active_user)) -> dict:
    """Require an authenticated user that belongs to a tenant.

    Super admins are NOT allowed to use these tenant-side endpoints — they
    should use /api/v1/admin/tickets instead.
    """
    if current_user.get("is_super_admin"):
        raise HTTPException(
            status_code=403,
            detail="Super admins should use /api/v1/admin/tickets, not the tenant support endpoints",
        )
    if not current_user.get("tenant_id"):
        raise HTTPException(
            status_code=403,
            detail="User is not assigned to any tenant",
        )
    return current_user


def _enrich_ticket(conn, ticket: dict) -> dict:
    """Add raised_by_name/email, assigned_to_name, reply_count to a ticket dict."""
    if ticket.get("raised_by"):
        u = conn.execute(
            f"SELECT name, email FROM users WHERE id={_ph}", (ticket["raised_by"],)
        ).fetchone()
        if u:
            ud = dict(u)
            ticket["raised_by_name"] = ud.get("name")
            ticket["raised_by_email"] = ud.get("email")
    if ticket.get("assigned_to"):
        u = conn.execute(
            f"SELECT name FROM users WHERE id={_ph}", (ticket["assigned_to"],)
        ).fetchone()
        if u:
            ticket["assigned_to_name"] = dict(u).get("name")
    rc = conn.execute(
        f"SELECT COUNT(*) FROM platform_ticket_replies WHERE ticket_id={_ph}", (ticket["id"],)
    ).fetchone()[0]
    ticket["reply_count"] = rc
    return ticket


# ── Raise a ticket ─────────────────────────────────────────────────


@router.post("/tickets")
async def create_platform_ticket(body: dict, user: dict = Depends(_require_tenant_user)):
    """Tenant admin raises a new support ticket to the platform team."""
    subject = (body.get("subject") or "").strip()
    msg_body = (body.get("body") or "").strip()
    if len(subject) < 3:
        raise HTTPException(400, "Subject must be at least 3 characters")
    if len(msg_body) < 5:
        raise HTTPException(400, "Body must be at least 5 characters")

    category = body.get("category", "other")
    if category not in ("billing", "bug", "feature_request", "access", "other"):
        category = "other"
    priority = body.get("priority", "medium")
    if priority not in ("low", "medium", "high", "urgent"):
        priority = "medium"

    ticket_id = f"pt-{uuid.uuid4().hex[:10]}"
    with db() as conn:
        conn.execute(f"""
            INSERT INTO platform_tickets
            (id, tenant_id, raised_by, subject, body, category, priority, status)
            VALUES ({_ph},{_ph},{_ph},{_ph},{_ph},{_ph},{_ph},{_ph})
        """, (
            ticket_id, user["tenant_id"], user["id"],
            subject, msg_body, category, priority, "open",
        ))
        row = conn.execute(
            f"SELECT * FROM platform_tickets WHERE id={_ph}", (ticket_id,)
        ).fetchone()
        ticket = _enrich_ticket(conn, dict(row))

    logger.info(
        "Platform ticket %s raised by %s (tenant %s): %s",
        ticket_id, user["email"], user["tenant_id"], subject,
    )

    # Real-time: notify all super admins of the new ticket
    try:
        from api.realtime import manager
        await manager.to_super_admins("ticket.created", ticket)
    except Exception as exc:
        logger.warning("WS broadcast (ticket.created) failed: %s", exc)

    return ticket


# ── List my tenant's tickets ───────────────────────────────────────


@router.get("/tickets")
async def list_my_tickets(
    status: str = None,
    user: dict = Depends(_require_tenant_user),
):
    """List all platform tickets raised by the current user's tenant."""
    query = f"SELECT * FROM platform_tickets WHERE tenant_id={_ph}"
    params = [user["tenant_id"]]
    if status:
        query += f" AND status={_ph}"
        params.append(status)
    query += " ORDER BY created_at DESC"
    with db() as conn:
        rows = conn.execute(query, params).fetchall()
        tickets = [_enrich_ticket(conn, dict(r)) for r in rows]
    return {"tickets": tickets, "total": len(tickets)}


# ── View a specific ticket (with replies) ──────────────────────────


@router.get("/tickets/{ticket_id}")
async def get_my_ticket(ticket_id: str, user: dict = Depends(_require_tenant_user)):
    """Get a ticket detail. Tenant can only view their own tenant's tickets."""
    with db() as conn:
        row = conn.execute(
            f"SELECT * FROM platform_tickets WHERE id={_ph}", (ticket_id,)
        ).fetchone()
        if not row:
            raise HTTPException(404, "Ticket not found")
        ticket = dict(row)
        if ticket.get("tenant_id") != user.get("tenant_id"):
            raise HTTPException(403, "You can only view tickets from your own tenant")
        ticket = _enrich_ticket(conn, ticket)

        reply_rows = conn.execute(
            f"SELECT * FROM platform_ticket_replies WHERE ticket_id={_ph} ORDER BY created_at ASC",
            (ticket_id,),
        ).fetchall()
        replies = []
        for r in reply_rows:
            rd = dict(r)
            if rd.get("author_id"):
                u = conn.execute(
                    f"SELECT name, email FROM users WHERE id={_ph}", (rd["author_id"],)
                ).fetchone()
                if u:
                    ud = dict(u)
                    rd["author_name"] = ud.get("name")
                    rd["author_email"] = ud.get("email")
            rd["is_super_admin"] = bool(rd.get("is_super_admin"))
            replies.append(rd)
        ticket["replies"] = replies
    return ticket


# ── Tenant reply ───────────────────────────────────────────────────


@router.post("/tickets/{ticket_id}/reply")
async def reply_to_my_ticket(
    ticket_id: str, body: dict, user: dict = Depends(_require_tenant_user)
):
    """Tenant adds a reply to their own ticket."""
    reply_body = (body.get("body") or "").strip()
    if not reply_body:
        raise HTTPException(400, "Reply body cannot be empty")

    reply_id = f"ptr-{uuid.uuid4().hex[:10]}"
    with db() as conn:
        existing = conn.execute(
            f"SELECT tenant_id, status FROM platform_tickets WHERE id={_ph}", (ticket_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(404, "Ticket not found")
        ed = dict(existing)
        if ed.get("tenant_id") != user.get("tenant_id"):
            raise HTTPException(403, "You can only reply to tickets from your own tenant")

        conn.execute(f"""
            INSERT INTO platform_ticket_replies
            (id, ticket_id, author_id, is_super_admin, body)
            VALUES ({_ph},{_ph},{_ph},{_ph},{_ph})
        """, (reply_id, ticket_id, user["id"], 0, reply_body))

        # If super admin had set status to waiting_tenant, move back to in_progress
        if ed.get("status") == "waiting_tenant":
            conn.execute(
                f"UPDATE platform_tickets SET status='in_progress' WHERE id={_ph}", (ticket_id,)
            )

    payload = {
        "id": reply_id, "ticket_id": ticket_id, "body": reply_body,
        "is_super_admin": False, "author_id": user["id"], "author_name": user.get("name"),
    }
    # Real-time: notify the super admins watching this ticket
    try:
        from api.realtime import manager
        await manager.to_super_admins("ticket.reply.created", payload)
    except Exception as exc:
        logger.warning("WS broadcast (ticket.reply.created) failed: %s", exc)

    return payload
