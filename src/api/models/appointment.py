"""
VoiceFlow Marketing AI - Appointment / Scheduling Models
=========================================================
World-class appointment system: services (event types), weekly availability,
date overrides, bookings, and public booking pages. Tenant-isolated by
``user_id`` (legacy TEXT column, matching helpdesk pattern).

Designed for real-time updates: every mutation in the router emits a WS event
through ``api.realtime.manager`` so all clients of the same tenant see changes
live without polling.
"""

import enum
from datetime import datetime, time
from typing import Optional, List

from sqlalchemy import (
    String, Integer, Boolean, DateTime, JSON, Text, Time, Date,
    Enum as SQLEnum, Index, ForeignKey,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, SoftDeleteMixin


# ── Enums ─────────────────────────────────────────────────────


class BookingStatus(enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class LocationType(enum.Enum):
    IN_PERSON = "in_person"
    PHONE = "phone"
    GOOGLE_MEET = "google_meet"
    ZOOM = "zoom"
    CUSTOM_LINK = "custom_link"


class BookingPageStatus(enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    DISABLED = "disabled"


# ── Service (event type) ──────────────────────────────────────


class Service(TimestampMixin, SoftDeleteMixin, Base):
    """A bookable service / event type (Calendly-style)."""

    __tablename__ = "appointment_services"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[Optional[str]] = mapped_column(String(120), nullable=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    duration_min: Mapped[int] = mapped_column(Integer, default=30, server_default="30", nullable=False)
    buffer_before_min: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    buffer_after_min: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)

    price_cents: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="INR", server_default="INR", nullable=False)

    color: Mapped[str] = mapped_column(String(9), default="#6366f1", server_default="#6366f1", nullable=False)

    location_type: Mapped[LocationType] = mapped_column(
        SQLEnum(LocationType, name="appt_location_type", create_constraint=True),
        default=LocationType.GOOGLE_MEET,
        server_default="google_meet",
        nullable=False,
    )
    location_value: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Booking constraints
    min_notice_min: Mapped[int] = mapped_column(Integer, default=60, server_default="60", nullable=False)
    max_advance_days: Mapped[int] = mapped_column(Integer, default=60, server_default="60", nullable=False)
    max_per_day: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    intake_form: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)  # [{label, type, required}]

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", nullable=False)

    user_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    bookings: Mapped[List["Booking"]] = relationship(
        "Booking", back_populates="service", lazy="dynamic",
    )

    __table_args__ = (
        Index("idx_appt_service_user_active", "user_id", "is_active"),
    )


# ── Weekly availability rule ──────────────────────────────────


class AvailabilityRule(TimestampMixin, Base):
    """One row per (user, weekday) defining work hours."""

    __tablename__ = "appointment_availability_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    user_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    weekday: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=Mon..6=Sun
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    is_open: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Kolkata", server_default="Asia/Kolkata", nullable=False)

    __table_args__ = (
        Index("idx_appt_avail_user_weekday", "user_id", "weekday"),
    )


# ── Date override (holidays / one-off changes) ────────────────


class AvailabilityOverride(TimestampMixin, Base):
    """Date-specific override: closed day or non-standard hours."""

    __tablename__ = "appointment_availability_overrides"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    user_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    date: Mapped[datetime] = mapped_column(Date, nullable=False, index=True)
    is_closed: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    start_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    end_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    __table_args__ = (
        Index("idx_appt_override_user_date", "user_id", "date"),
    )


# ── Booking ───────────────────────────────────────────────────


class Booking(TimestampMixin, SoftDeleteMixin, Base):
    """A scheduled appointment."""

    __tablename__ = "appointment_bookings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Relations
    service_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("appointment_services.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    user_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)  # tenant/host
    host_user_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)

    # Client
    client_name: Mapped[str] = mapped_column(String(200), nullable=False)
    client_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    client_phone: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    # Schedule
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Kolkata", server_default="Asia/Kolkata", nullable=False)

    status: Mapped[BookingStatus] = mapped_column(
        SQLEnum(BookingStatus, name="appt_booking_status", create_constraint=True),
        default=BookingStatus.PENDING,
        server_default="pending",
        nullable=False,
    )

    # Source: voice_ai, sales_bot, manual, public_page, api
    source: Mapped[str] = mapped_column(String(32), default="manual", server_default="manual", nullable=False)

    # Location
    location_type: Mapped[LocationType] = mapped_column(
        SQLEnum(LocationType, name="appt_booking_location_type", create_constraint=True),
        default=LocationType.GOOGLE_MEET,
        server_default="google_meet",
        nullable=False,
    )
    location_value: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    meeting_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    intake_answers: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    cancellation_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # CRM linkage (optional)
    lead_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    contact_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)

    service: Mapped[Optional["Service"]] = relationship("Service", back_populates="bookings")

    __table_args__ = (
        Index("idx_appt_booking_user_starts", "user_id", "starts_at"),
        Index("idx_appt_booking_user_status", "user_id", "status"),
        Index("idx_appt_booking_starts", "starts_at"),
    )


# ── Public booking page ───────────────────────────────────────


class BookingPage(TimestampMixin, SoftDeleteMixin, Base):
    """Public, embeddable booking page (Calendly-style link)."""

    __tablename__ = "appointment_booking_pages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    user_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    service_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)  # [int]
    custom_questions: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    theme: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    redirect_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    status: Mapped[BookingPageStatus] = mapped_column(
        SQLEnum(BookingPageStatus, name="appt_booking_page_status", create_constraint=True),
        default=BookingPageStatus.DRAFT,
        server_default="draft",
        nullable=False,
    )
    views: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    bookings_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)

    __table_args__ = (
        Index("idx_appt_page_user_slug", "user_id", "slug", unique=True),
    )
