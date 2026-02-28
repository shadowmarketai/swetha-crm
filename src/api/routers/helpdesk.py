"""
VoiceFlow Marketing AI - Helpdesk Router
==========================================
Support ticket endpoints with priority, status, SLA tracking,
and reply management. All entities are tenant-isolated via user_id.
"""

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from api.database import get_db
from api.permissions import require_permission
from api.models.helpdesk import (
    Ticket,
    TicketCategory,
    TicketPriority,
    TicketReply,
    TicketStatus,
)
from api.schemas.helpdesk import (
    TicketCreate,
    TicketDashboardResponse,
    TicketReplyCreate,
    TicketReplyResponse,
    TicketResponse,
    TicketUpdate,
)
from api.schemas.common import PaginatedResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/helpdesk", tags=["Help Desk"])


# ── Helpers ─────────────────────────────────────────────────────


def _generate_ticket_number() -> str:
    """Generate a unique ticket number like TKT-XXXXXXXX."""
    short_id = uuid.uuid4().hex[:8].upper()
    return f"TKT-{short_id}"


def _ticket_to_dict(ticket: Ticket) -> dict:
    """Convert a Ticket ORM object to a dict suitable for the response schema."""
    return {
        "id": ticket.id,
        "ticket_number": ticket.ticket_number,
        "subject": ticket.subject,
        "description": ticket.description,
        "status": ticket.status.value if ticket.status else None,
        "priority": ticket.priority.value if ticket.priority else None,
        "category": ticket.category.value if ticket.category else None,
        "channel": ticket.channel,
        "source_reference": ticket.source_reference,
        "customer_name": ticket.customer_name,
        "customer_email": ticket.customer_email,
        "customer_phone": ticket.customer_phone,
        "sla_due_at": ticket.sla_due_at,
        "first_response_at": ticket.first_response_at,
        "first_response_sla_met": ticket.first_response_sla_met,
        "resolution_sla_met": ticket.resolution_sla_met,
        "resolved_at": ticket.resolved_at,
        "closed_at": ticket.closed_at,
        "resolution_notes": ticket.resolution_notes,
        "satisfaction_rating": ticket.satisfaction_rating,
        "detected_sentiment": ticket.detected_sentiment,
        "detected_emotion": ticket.detected_emotion,
        "auto_categorized": ticket.auto_categorized,
        "tags": ticket.tags,
        "custom_fields": ticket.custom_fields,
        "internal_notes": ticket.internal_notes,
        "attachments": ticket.attachments,
        "lead_id": ticket.lead_id,
        "contact_id": ticket.contact_id,
        "assigned_to": ticket.assigned_to,
        "user_id": ticket.user_id,
        "created_at": ticket.created_at,
        "updated_at": ticket.updated_at,
    }


def _reply_to_dict(reply: TicketReply) -> dict:
    """Convert a TicketReply ORM object to a dict."""
    return {
        "id": reply.id,
        "body": reply.body,
        "is_internal": reply.is_internal,
        "sender_type": reply.sender_type,
        "sender_name": reply.sender_name,
        "sender_email": reply.sender_email,
        "attachments": reply.attachments,
        "is_ai_generated": reply.is_ai_generated,
        "ai_confidence": reply.ai_confidence,
        "ticket_id": reply.ticket_id,
        "user_id": reply.user_id,
        "created_at": reply.created_at,
    }


def _get_user_id(current_user: dict) -> int:
    """Extract a numeric user_id from the current_user dict.
    Legacy users have string IDs; we hash them to produce a stable int.
    """
    raw = current_user.get("id", "")
    if isinstance(raw, int):
        return raw
    try:
        return int(raw)
    except (ValueError, TypeError):
        # Deterministic int from string ID for legacy users
        return abs(hash(raw)) % (2**31)


# ── GET /tickets ────────────────────────────────────────────────


@router.get(
    "/tickets",
    response_model=PaginatedResponse,
    summary="List tickets (paginated, filterable)",
)
async def list_tickets(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    priority: str | None = Query(None),
    assigned_to: int | None = Query(None),
    category: str | None = Query(None),
    search: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("helpdesk", "read")),
) -> PaginatedResponse:
    """List tickets for the current user with optional filters."""
    uid = _get_user_id(current_user)

    query = db.query(Ticket).filter(
        Ticket.user_id == uid,
        Ticket.is_deleted == False,  # noqa: E712
    )

    # Apply filters
    if status_filter:
        try:
            ts = TicketStatus(status_filter)
            query = query.filter(Ticket.status == ts)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {status_filter}",
            )

    if priority:
        try:
            tp = TicketPriority(priority)
            query = query.filter(Ticket.priority == tp)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid priority: {priority}",
            )

    if category:
        try:
            tc = TicketCategory(category)
            query = query.filter(Ticket.category == tc)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid category: {category}",
            )

    if assigned_to is not None:
        query = query.filter(Ticket.assigned_to == assigned_to)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (Ticket.subject.ilike(search_pattern))
            | (Ticket.ticket_number.ilike(search_pattern))
            | (Ticket.customer_email.ilike(search_pattern))
        )

    total = query.count()
    offset = (page - 1) * page_size
    tickets = query.order_by(Ticket.created_at.desc()).offset(offset).limit(page_size).all()

    items = [TicketResponse(**_ticket_to_dict(t)) for t in tickets]
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size)


# ── POST /tickets ───────────────────────────────────────────────


@router.post(
    "/tickets",
    response_model=TicketResponse,
    status_code=201,
    summary="Create a new ticket",
)
async def create_ticket(
    body: TicketCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("helpdesk", "create")),
) -> TicketResponse:
    """Create a new support ticket."""
    uid = _get_user_id(current_user)

    ticket = Ticket(
        ticket_number=_generate_ticket_number(),
        subject=body.subject,
        description=body.description,
        status=TicketStatus(body.priority) if False else TicketStatus.OPEN,
        priority=TicketPriority(body.priority),
        category=TicketCategory(body.category) if body.category else None,
        channel=body.channel,
        customer_name=body.customer_name,
        customer_email=body.customer_email,
        customer_phone=body.customer_phone,
        assigned_to=body.assigned_to,
        lead_id=body.lead_id,
        contact_id=body.contact_id,
        tags=body.tags,
        custom_fields=body.custom_fields,
        attachments=body.attachments,
        user_id=uid,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    logger.info("Ticket created: %s (user=%s)", ticket.ticket_number, uid)
    return TicketResponse(**_ticket_to_dict(ticket))


# ── GET /tickets/{ticket_id} ───────────────────────────────────


@router.get(
    "/tickets/{ticket_id}",
    response_model=TicketResponse,
    summary="Get ticket with replies",
)
async def get_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("helpdesk", "read")),
) -> TicketResponse:
    """Get a ticket detail including all replies."""
    uid = _get_user_id(current_user)

    ticket = db.query(Ticket).filter(
        Ticket.id == ticket_id,
        Ticket.user_id == uid,
        Ticket.is_deleted == False,  # noqa: E712
    ).first()

    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticket {ticket_id} not found",
        )

    # Fetch replies
    replies = (
        db.query(TicketReply)
        .filter(TicketReply.ticket_id == ticket_id)
        .order_by(TicketReply.created_at.asc())
        .all()
    )

    data = _ticket_to_dict(ticket)
    data["replies"] = [TicketReplyResponse(**_reply_to_dict(r)) for r in replies]
    return TicketResponse(**data)


# ── PUT /tickets/{ticket_id} ───────────────────────────────────


@router.put(
    "/tickets/{ticket_id}",
    response_model=TicketResponse,
    summary="Update ticket",
)
async def update_ticket(
    ticket_id: int,
    body: TicketUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("helpdesk", "update")),
) -> TicketResponse:
    """Update a ticket's status, priority, assignment, etc."""
    uid = _get_user_id(current_user)

    ticket = db.query(Ticket).filter(
        Ticket.id == ticket_id,
        Ticket.user_id == uid,
        Ticket.is_deleted == False,  # noqa: E712
    ).first()

    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticket {ticket_id} not found",
        )

    updates = body.model_dump(exclude_unset=True)

    if "status" in updates and updates["status"] is not None:
        updates["status"] = TicketStatus(updates["status"])
    if "priority" in updates and updates["priority"] is not None:
        updates["priority"] = TicketPriority(updates["priority"])
    if "category" in updates and updates["category"] is not None:
        updates["category"] = TicketCategory(updates["category"])

    for field, value in updates.items():
        setattr(ticket, field, value)

    db.commit()
    db.refresh(ticket)

    logger.info("Ticket updated: %s (user=%s)", ticket.ticket_number, uid)
    return TicketResponse(**_ticket_to_dict(ticket))


# ── POST /tickets/{ticket_id}/reply ─────────────────────────────


@router.post(
    "/tickets/{ticket_id}/reply",
    response_model=TicketReplyResponse,
    status_code=201,
    summary="Add reply to ticket",
)
async def add_reply(
    ticket_id: int,
    body: TicketReplyCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("helpdesk", "update")),
) -> TicketReplyResponse:
    """Add a reply (internal note or public) to an existing ticket."""
    uid = _get_user_id(current_user)

    ticket = db.query(Ticket).filter(
        Ticket.id == ticket_id,
        Ticket.user_id == uid,
        Ticket.is_deleted == False,  # noqa: E712
    ).first()

    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticket {ticket_id} not found",
        )

    # Track first response time
    now = datetime.now(timezone.utc)
    if ticket.first_response_at is None and body.sender_type == "agent":
        ticket.first_response_at = now
        if ticket.sla_due_at:
            ticket.first_response_sla_met = now <= ticket.sla_due_at

    # Move ticket to in_progress if it's still open and an agent replies
    if ticket.status == TicketStatus.OPEN and body.sender_type == "agent":
        ticket.status = TicketStatus.IN_PROGRESS

    reply = TicketReply(
        body=body.body,
        is_internal=body.is_internal,
        sender_type=body.sender_type,
        sender_name=body.sender_name or current_user.get("name"),
        sender_email=body.sender_email or current_user.get("email"),
        attachments=body.attachments,
        ticket_id=ticket_id,
        user_id=uid,
    )
    db.add(reply)
    db.commit()
    db.refresh(reply)

    logger.info("Reply added to ticket %s (user=%s)", ticket.ticket_number, uid)
    return TicketReplyResponse(**_reply_to_dict(reply))


# ── POST /tickets/{ticket_id}/resolve ───────────────────────────


@router.post(
    "/tickets/{ticket_id}/resolve",
    response_model=TicketResponse,
    summary="Resolve ticket",
)
async def resolve_ticket(
    ticket_id: int,
    resolution_notes: str | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("helpdesk", "update")),
) -> TicketResponse:
    """Mark a ticket as resolved."""
    uid = _get_user_id(current_user)

    ticket = db.query(Ticket).filter(
        Ticket.id == ticket_id,
        Ticket.user_id == uid,
        Ticket.is_deleted == False,  # noqa: E712
    ).first()

    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticket {ticket_id} not found",
        )

    if ticket.status in (TicketStatus.RESOLVED, TicketStatus.CLOSED):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ticket is already resolved or closed",
        )

    now = datetime.now(timezone.utc)
    ticket.status = TicketStatus.RESOLVED
    ticket.resolved_at = now
    if resolution_notes:
        ticket.resolution_notes = resolution_notes

    # Check resolution SLA
    if ticket.sla_due_at:
        ticket.resolution_sla_met = now <= ticket.sla_due_at

    db.commit()
    db.refresh(ticket)

    logger.info("Ticket resolved: %s (user=%s)", ticket.ticket_number, uid)
    return TicketResponse(**_ticket_to_dict(ticket))


# ── GET /dashboard ──────────────────────────────────────────────


@router.get(
    "/dashboard",
    response_model=TicketDashboardResponse,
    summary="Ticket dashboard statistics",
)
async def ticket_dashboard(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("helpdesk", "read")),
) -> TicketDashboardResponse:
    """Get ticket statistics for the dashboard."""
    uid = _get_user_id(current_user)

    base = db.query(Ticket).filter(
        Ticket.user_id == uid,
        Ticket.is_deleted == False,  # noqa: E712
    )

    total = base.count()

    # Count by status
    status_counts = (
        db.query(Ticket.status, func.count(Ticket.id))
        .filter(Ticket.user_id == uid, Ticket.is_deleted == False)  # noqa: E712
        .group_by(Ticket.status)
        .all()
    )
    status_map: dict[str, int] = {}
    for s, c in status_counts:
        status_map[s.value] = c

    open_tickets = status_map.get("open", 0)
    in_progress = status_map.get("in_progress", 0)
    waiting = status_map.get("waiting_on_customer", 0) + status_map.get("waiting_on_third_party", 0)
    resolved = status_map.get("resolved", 0)
    closed = status_map.get("closed", 0)
    reopened = status_map.get("reopened", 0)

    # Average resolution time (hours) for resolved tickets
    avg_resolution = None
    resolved_tickets_with_time = (
        base.filter(
            Ticket.resolved_at.isnot(None),
            Ticket.created_at.isnot(None),
        ).all()
    )
    if resolved_tickets_with_time:
        total_hours = 0.0
        count = 0
        for t in resolved_tickets_with_time:
            if t.resolved_at and t.created_at:
                delta = t.resolved_at - t.created_at
                total_hours += delta.total_seconds() / 3600
                count += 1
        if count > 0:
            avg_resolution = round(total_hours / count, 2)

    # Tickets by priority
    priority_counts = (
        db.query(Ticket.priority, func.count(Ticket.id))
        .filter(Ticket.user_id == uid, Ticket.is_deleted == False)  # noqa: E712
        .group_by(Ticket.priority)
        .all()
    )
    priority_map = {p.value: c for p, c in priority_counts}

    # Tickets by category
    category_counts = (
        db.query(Ticket.category, func.count(Ticket.id))
        .filter(
            Ticket.user_id == uid,
            Ticket.is_deleted == False,  # noqa: E712
            Ticket.category.isnot(None),
        )
        .group_by(Ticket.category)
        .all()
    )
    category_map = {cat.value: c for cat, c in category_counts}

    # SLA met percentage
    sla_met_pct = None
    sla_tickets = base.filter(Ticket.resolution_sla_met.isnot(None)).all()
    if sla_tickets:
        met_count = sum(1 for t in sla_tickets if t.resolution_sla_met)
        sla_met_pct = round((met_count / len(sla_tickets)) * 100, 2)

    # Average satisfaction
    avg_sat = None
    sat_tickets = base.filter(Ticket.satisfaction_rating.isnot(None)).all()
    if sat_tickets:
        avg_sat = round(sum(t.satisfaction_rating for t in sat_tickets) / len(sat_tickets), 2)

    return TicketDashboardResponse(
        total_tickets=total,
        open_tickets=open_tickets,
        in_progress_tickets=in_progress,
        waiting_tickets=waiting,
        resolved_tickets=resolved,
        closed_tickets=closed,
        reopened_tickets=reopened,
        avg_resolution_time_hours=avg_resolution,
        tickets_by_priority=priority_map,
        tickets_by_category=category_map,
        sla_met_percentage=sla_met_pct,
        avg_satisfaction_rating=avg_sat,
    )
