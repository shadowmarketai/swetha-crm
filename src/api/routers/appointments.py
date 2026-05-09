"""
VoiceFlow Marketing AI - Appointments Router
==============================================
Full CRUD for the simplified Appointments module:
  • Bookings (list, create, update/reschedule, cancel, confirm, no-show)
  • Services (event types)
  • Weekly availability + date overrides
  • Public booking pages
  • KPI summary for the dashboard hub

Every mutation broadcasts a WebSocket event via ``api.realtime.manager`` so
the frontend updates in real time without polling. Event types:

    appointment.created
    appointment.updated
    appointment.cancelled
    appointment.confirmed
    appointment.completed
    appointment.no_show

Tenant isolation follows the helpdesk pattern: ``user_id`` is a TEXT key
matching the legacy users table.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from api.database import get_db
from api.permissions import require_permission
from api.models.appointment import (
    Service,
    AvailabilityRule,
    AvailabilityOverride,
    Booking,
    BookingPage,
    BookingStatus,
    LocationType,
    BookingPageStatus,
)
from api.schemas.appointment import (
    ServiceCreate,
    ServiceUpdate,
    ServiceResponse,
    AvailabilityRuleSchema,
    AvailabilityRuleResponse,
    AvailabilityOverrideCreate,
    AvailabilityOverrideResponse,
    BookingCreate,
    BookingUpdate,
    BookingResponse,
    BookingPageCreate,
    BookingPageUpdate,
    BookingPageResponse,
    AppointmentKpis,
)
from api.schemas.common import PaginatedResponse, MessageResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/appointments", tags=["Appointments"])


# ── Helpers ────────────────────────────────────────────────────


def _uid(current_user: dict) -> str:
    return str(current_user.get("id", ""))


async def _broadcast(uid: str, event_type: str, payload: dict) -> None:
    """Push a real-time WS event to every connection of this tenant."""
    try:
        from api.realtime import manager
        await manager.to_user(uid, event_type, payload)
    except Exception as exc:  # never fail the API on WS errors
        logger.warning("WS broadcast %s failed: %s", event_type, exc)


def _service_to_dict(s: Service) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "slug": s.slug,
        "description": s.description,
        "duration_min": s.duration_min,
        "buffer_before_min": s.buffer_before_min,
        "buffer_after_min": s.buffer_after_min,
        "price_cents": s.price_cents,
        "currency": s.currency,
        "color": s.color,
        "location_type": s.location_type.value if s.location_type else "google_meet",
        "location_value": s.location_value,
        "min_notice_min": s.min_notice_min,
        "max_advance_days": s.max_advance_days,
        "max_per_day": s.max_per_day,
        "intake_form": s.intake_form,
        "is_active": s.is_active,
        "created_at": s.created_at,
        "updated_at": s.updated_at,
    }


def _booking_to_dict(b: Booking) -> dict:
    svc = b.service
    return {
        "id": b.id,
        "service_id": b.service_id,
        "service_name": svc.name if svc else None,
        "service_color": svc.color if svc else None,
        "client_name": b.client_name,
        "client_email": b.client_email,
        "client_phone": b.client_phone,
        "starts_at": b.starts_at,
        "ends_at": b.ends_at,
        "timezone": b.timezone,
        "status": b.status.value if b.status else "pending",
        "source": b.source,
        "location_type": b.location_type.value if b.location_type else "google_meet",
        "location_value": b.location_value,
        "meeting_url": b.meeting_url,
        "notes": b.notes,
        "intake_answers": b.intake_answers,
        "cancellation_reason": b.cancellation_reason,
        "created_at": b.created_at,
        "updated_at": b.updated_at,
    }


def _page_to_dict(p: BookingPage) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "slug": p.slug,
        "description": p.description,
        "service_ids": p.service_ids,
        "custom_questions": p.custom_questions,
        "theme": p.theme,
        "redirect_url": p.redirect_url,
        "status": p.status.value if p.status else "draft",
        "views": p.views,
        "bookings_count": p.bookings_count,
        "created_at": p.created_at,
    }


def _parse_status(value: str | None) -> BookingStatus | None:
    if not value:
        return None
    try:
        return BookingStatus(value)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status: {value}")


def _parse_location(value: str | None) -> LocationType:
    if not value:
        return LocationType.GOOGLE_MEET
    try:
        return LocationType(value)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid location_type: {value}")


# ════════════════════════════════════════════════════════════════
# KPIs
# ════════════════════════════════════════════════════════════════


@router.get("/kpis", response_model=AppointmentKpis, summary="Dashboard KPIs")
async def get_kpis(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("appointments", "read")),
) -> AppointmentKpis:
    uid = _uid(current_user)
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    week_end = today_start + timedelta(days=7)
    month_end = today_start + timedelta(days=30)

    base = db.query(Booking).filter(
        Booking.user_id == uid,
        Booking.is_deleted == False,  # noqa: E712
    )

    today_count = base.filter(Booking.starts_at >= today_start, Booking.starts_at < today_end).count()
    week_count = base.filter(Booking.starts_at >= today_start, Booking.starts_at < week_end).count()
    month_count = base.filter(Booking.starts_at >= today_start, Booking.starts_at < month_end).count()
    booked_by_ai = base.filter(Booking.source.in_(["voice_ai", "sales_bot"])).count()
    pending_count = base.filter(Booking.status == BookingStatus.PENDING).count()

    completed = base.filter(Booking.status == BookingStatus.COMPLETED).count()
    no_show = base.filter(Booking.status == BookingStatus.NO_SHOW).count()
    total_done = completed + no_show
    show_rate = (completed / total_done * 100.0) if total_done else 0.0

    return AppointmentKpis(
        today_count=today_count,
        week_count=week_count,
        month_count=month_count,
        booked_by_ai=booked_by_ai,
        show_rate_pct=round(show_rate, 1),
        pending_count=pending_count,
    )


# ════════════════════════════════════════════════════════════════
# Bookings
# ════════════════════════════════════════════════════════════════


@router.get("/bookings", response_model=PaginatedResponse, summary="List bookings")
async def list_bookings(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    status_filter: str | None = Query(None, alias="status"),
    service_id: int | None = Query(None),
    from_date: datetime | None = Query(None, alias="from"),
    to_date: datetime | None = Query(None, alias="to"),
    search: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("appointments", "read")),
) -> PaginatedResponse:
    uid = _uid(current_user)
    q = db.query(Booking).filter(
        Booking.user_id == uid,
        Booking.is_deleted == False,  # noqa: E712
    )
    st = _parse_status(status_filter)
    if st:
        q = q.filter(Booking.status == st)
    if service_id is not None:
        q = q.filter(Booking.service_id == service_id)
    if from_date:
        q = q.filter(Booking.starts_at >= from_date)
    if to_date:
        q = q.filter(Booking.starts_at <= to_date)
    if search:
        like = f"%{search}%"
        q = q.filter(
            (Booking.client_name.ilike(like))
            | (Booking.client_email.ilike(like))
            | (Booking.client_phone.ilike(like))
        )

    total = q.count()
    rows = (
        q.order_by(Booking.starts_at.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    items = [BookingResponse(**_booking_to_dict(b)) for b in rows]
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size)


@router.post("/bookings", response_model=BookingResponse, status_code=201, summary="Create a booking")
async def create_booking(
    body: BookingCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("appointments", "create")),
) -> BookingResponse:
    uid = _uid(current_user)

    if body.ends_at <= body.starts_at:
        raise HTTPException(status_code=400, detail="ends_at must be after starts_at")

    booking = Booking(
        service_id=body.service_id,
        user_id=uid,
        host_user_id=uid,
        client_name=body.client_name,
        client_email=body.client_email,
        client_phone=body.client_phone,
        starts_at=body.starts_at,
        ends_at=body.ends_at,
        timezone=body.timezone,
        status=BookingStatus.PENDING,
        source=body.source or "manual",
        location_type=_parse_location(body.location_type),
        location_value=body.location_value,
        meeting_url=body.meeting_url,
        notes=body.notes,
        intake_answers=body.intake_answers,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    payload = _booking_to_dict(booking)
    await _broadcast(uid, "appointment.created", payload)
    return BookingResponse(**payload)


@router.get("/bookings/{booking_id}", response_model=BookingResponse, summary="Get booking")
async def get_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("appointments", "read")),
) -> BookingResponse:
    uid = _uid(current_user)
    b = db.query(Booking).filter(
        Booking.id == booking_id,
        Booking.user_id == uid,
        Booking.is_deleted == False,  # noqa: E712
    ).first()
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    return BookingResponse(**_booking_to_dict(b))


@router.patch("/bookings/{booking_id}", response_model=BookingResponse, summary="Update / reschedule booking")
async def update_booking(
    booking_id: int,
    body: BookingUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("appointments", "update")),
) -> BookingResponse:
    uid = _uid(current_user)
    b = db.query(Booking).filter(
        Booking.id == booking_id,
        Booking.user_id == uid,
        Booking.is_deleted == False,  # noqa: E712
    ).first()
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")

    updates = body.model_dump(exclude_unset=True)
    if "status" in updates and updates["status"] is not None:
        updates["status"] = BookingStatus(updates["status"])
    if "location_type" in updates and updates["location_type"] is not None:
        updates["location_type"] = LocationType(updates["location_type"])

    for k, v in updates.items():
        setattr(b, k, v)

    db.commit()
    db.refresh(b)

    payload = _booking_to_dict(b)
    event_type = "appointment.updated"
    if "status" in updates:
        event_type = {
            BookingStatus.CONFIRMED: "appointment.confirmed",
            BookingStatus.CANCELLED: "appointment.cancelled",
            BookingStatus.COMPLETED: "appointment.completed",
            BookingStatus.NO_SHOW: "appointment.no_show",
        }.get(updates["status"], "appointment.updated")
    await _broadcast(uid, event_type, payload)
    return BookingResponse(**payload)


@router.delete("/bookings/{booking_id}", response_model=MessageResponse, summary="Cancel booking")
async def cancel_booking(
    booking_id: int,
    reason: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("appointments", "delete")),
) -> MessageResponse:
    uid = _uid(current_user)
    b = db.query(Booking).filter(
        Booking.id == booking_id,
        Booking.user_id == uid,
        Booking.is_deleted == False,  # noqa: E712
    ).first()
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    b.status = BookingStatus.CANCELLED
    b.cancellation_reason = reason
    db.commit()

    await _broadcast(uid, "appointment.cancelled", _booking_to_dict(b))
    return MessageResponse(message="Booking cancelled")


# ════════════════════════════════════════════════════════════════
# Services
# ════════════════════════════════════════════════════════════════


@router.get("/services", response_model=list[ServiceResponse], summary="List services")
async def list_services(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("appointments", "read")),
) -> list[ServiceResponse]:
    uid = _uid(current_user)
    rows = (
        db.query(Service)
        .filter(Service.user_id == uid, Service.is_deleted == False)  # noqa: E712
        .order_by(Service.created_at.desc())
        .all()
    )
    return [ServiceResponse(**_service_to_dict(s)) for s in rows]


@router.post("/services", response_model=ServiceResponse, status_code=201, summary="Create service")
async def create_service(
    body: ServiceCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("appointments", "create")),
) -> ServiceResponse:
    uid = _uid(current_user)
    s = Service(
        user_id=uid,
        name=body.name,
        description=body.description,
        duration_min=body.duration_min,
        buffer_before_min=body.buffer_before_min,
        buffer_after_min=body.buffer_after_min,
        price_cents=body.price_cents,
        currency=body.currency,
        color=body.color,
        location_type=_parse_location(body.location_type),
        location_value=body.location_value,
        min_notice_min=body.min_notice_min,
        max_advance_days=body.max_advance_days,
        max_per_day=body.max_per_day,
        intake_form=body.intake_form,
        is_active=body.is_active,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    payload = _service_to_dict(s)
    await _broadcast(uid, "appointment.service.created", payload)
    return ServiceResponse(**payload)


@router.patch("/services/{service_id}", response_model=ServiceResponse, summary="Update service")
async def update_service(
    service_id: int,
    body: ServiceUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("appointments", "update")),
) -> ServiceResponse:
    uid = _uid(current_user)
    s = db.query(Service).filter(
        Service.id == service_id,
        Service.user_id == uid,
        Service.is_deleted == False,  # noqa: E712
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Service not found")

    updates = body.model_dump(exclude_unset=True)
    if "location_type" in updates and updates["location_type"] is not None:
        updates["location_type"] = LocationType(updates["location_type"])
    for k, v in updates.items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    payload = _service_to_dict(s)
    await _broadcast(uid, "appointment.service.updated", payload)
    return ServiceResponse(**payload)


@router.delete("/services/{service_id}", response_model=MessageResponse, summary="Delete service")
async def delete_service(
    service_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("appointments", "delete")),
) -> MessageResponse:
    uid = _uid(current_user)
    s = db.query(Service).filter(
        Service.id == service_id,
        Service.user_id == uid,
        Service.is_deleted == False,  # noqa: E712
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Service not found")
    s.is_deleted = True
    s.deleted_at = datetime.now(timezone.utc)
    db.commit()
    await _broadcast(uid, "appointment.service.deleted", {"id": service_id})
    return MessageResponse(message="Service deleted")


# ════════════════════════════════════════════════════════════════
# Availability
# ════════════════════════════════════════════════════════════════


@router.get("/availability", response_model=list[AvailabilityRuleResponse], summary="Get weekly availability")
async def get_availability(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("appointments", "read")),
) -> list[AvailabilityRuleResponse]:
    uid = _uid(current_user)
    rows = (
        db.query(AvailabilityRule)
        .filter(AvailabilityRule.user_id == uid)
        .order_by(AvailabilityRule.weekday.asc(), AvailabilityRule.start_time.asc())
        .all()
    )
    return [AvailabilityRuleResponse.model_validate(r) for r in rows]


@router.put("/availability", response_model=list[AvailabilityRuleResponse], summary="Replace weekly availability")
async def set_availability(
    rules: list[AvailabilityRuleSchema],
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("appointments", "update")),
) -> list[AvailabilityRuleResponse]:
    uid = _uid(current_user)
    db.query(AvailabilityRule).filter(AvailabilityRule.user_id == uid).delete()
    new_rows: list[AvailabilityRule] = []
    for r in rules:
        new_rows.append(
            AvailabilityRule(
                user_id=uid,
                weekday=r.weekday,
                start_time=r.start_time,
                end_time=r.end_time,
                is_open=r.is_open,
                timezone=r.timezone,
            )
        )
    db.add_all(new_rows)
    db.commit()
    for row in new_rows:
        db.refresh(row)

    await _broadcast(uid, "appointment.availability.updated", {"count": len(new_rows)})
    return [AvailabilityRuleResponse.model_validate(r) for r in new_rows]


@router.get("/availability/overrides", response_model=list[AvailabilityOverrideResponse])
async def list_overrides(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("appointments", "read")),
) -> list[AvailabilityOverrideResponse]:
    uid = _uid(current_user)
    rows = (
        db.query(AvailabilityOverride)
        .filter(AvailabilityOverride.user_id == uid)
        .order_by(AvailabilityOverride.date.asc())
        .all()
    )
    return [AvailabilityOverrideResponse.model_validate(r) for r in rows]


@router.post("/availability/overrides", response_model=AvailabilityOverrideResponse, status_code=201)
async def create_override(
    body: AvailabilityOverrideCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("appointments", "create")),
) -> AvailabilityOverrideResponse:
    uid = _uid(current_user)
    o = AvailabilityOverride(
        user_id=uid,
        date=body.date,
        is_closed=body.is_closed,
        start_time=body.start_time,
        end_time=body.end_time,
        reason=body.reason,
    )
    db.add(o)
    db.commit()
    db.refresh(o)
    await _broadcast(uid, "appointment.override.created", {"id": o.id, "date": str(o.date)})
    return AvailabilityOverrideResponse.model_validate(o)


@router.delete("/availability/overrides/{override_id}", response_model=MessageResponse)
async def delete_override(
    override_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("appointments", "delete")),
) -> MessageResponse:
    uid = _uid(current_user)
    o = db.query(AvailabilityOverride).filter(
        AvailabilityOverride.id == override_id,
        AvailabilityOverride.user_id == uid,
    ).first()
    if not o:
        raise HTTPException(status_code=404, detail="Override not found")
    db.delete(o)
    db.commit()
    await _broadcast(uid, "appointment.override.deleted", {"id": override_id})
    return MessageResponse(message="Override deleted")


# ════════════════════════════════════════════════════════════════
# Booking pages
# ════════════════════════════════════════════════════════════════


@router.get("/pages", response_model=list[BookingPageResponse], summary="List booking pages")
async def list_pages(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("appointments", "read")),
) -> list[BookingPageResponse]:
    uid = _uid(current_user)
    rows = (
        db.query(BookingPage)
        .filter(BookingPage.user_id == uid, BookingPage.is_deleted == False)  # noqa: E712
        .order_by(BookingPage.created_at.desc())
        .all()
    )
    return [BookingPageResponse(**_page_to_dict(p)) for p in rows]


@router.post("/pages", response_model=BookingPageResponse, status_code=201)
async def create_page(
    body: BookingPageCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("appointments", "create")),
) -> BookingPageResponse:
    uid = _uid(current_user)
    p = BookingPage(
        user_id=uid,
        name=body.name,
        slug=body.slug,
        description=body.description,
        service_ids=body.service_ids,
        custom_questions=body.custom_questions,
        theme=body.theme,
        redirect_url=body.redirect_url,
        status=BookingPageStatus(body.status) if body.status else BookingPageStatus.DRAFT,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    payload = _page_to_dict(p)
    await _broadcast(uid, "appointment.page.created", payload)
    return BookingPageResponse(**payload)


@router.patch("/pages/{page_id}", response_model=BookingPageResponse)
async def update_page(
    page_id: int,
    body: BookingPageUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("appointments", "update")),
) -> BookingPageResponse:
    uid = _uid(current_user)
    p = db.query(BookingPage).filter(
        BookingPage.id == page_id,
        BookingPage.user_id == uid,
        BookingPage.is_deleted == False,  # noqa: E712
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Booking page not found")
    updates = body.model_dump(exclude_unset=True)
    if "status" in updates and updates["status"] is not None:
        updates["status"] = BookingPageStatus(updates["status"])
    for k, v in updates.items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    payload = _page_to_dict(p)
    await _broadcast(uid, "appointment.page.updated", payload)
    return BookingPageResponse(**payload)


@router.delete("/pages/{page_id}", response_model=MessageResponse)
async def delete_page(
    page_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("appointments", "delete")),
) -> MessageResponse:
    uid = _uid(current_user)
    p = db.query(BookingPage).filter(
        BookingPage.id == page_id,
        BookingPage.user_id == uid,
        BookingPage.is_deleted == False,  # noqa: E712
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Booking page not found")
    p.is_deleted = True
    p.deleted_at = datetime.now(timezone.utc)
    db.commit()
    await _broadcast(uid, "appointment.page.deleted", {"id": page_id})
    return MessageResponse(message="Booking page deleted")
