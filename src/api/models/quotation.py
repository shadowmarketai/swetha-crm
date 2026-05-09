"""
Swetha Structures CRM - Quotation Models
==========================================
PEB quotation and audit log models.
"""

import enum
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import ForeignKey, Index, String, Text, Float, Integer, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, SoftDeleteMixin


class QuotationStatus(str, enum.Enum):
    DRAFT = "draft"
    SENT = "sent"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    REVISED = "revised"


class Quotation(Base, TimestampMixin, SoftDeleteMixin):
    """PEB Quotation linked to a CRM lead."""

    __tablename__ = "quotations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Multi-tenant scoping (nullable for backward compat with legacy rows)
    # tenant_id is a string FK to platform_tenants.id (e.g. "tenant-swetha")
    tenant_id: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, index=True
    )
    template_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("quotation_templates.id"), nullable=True, index=True
    )
    intake_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("quotation_intakes.id"), nullable=True, index=True
    )

    lead_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("crm_leads.id"), nullable=True, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True
    )

    # Project info
    project_name: Mapped[str] = mapped_column(String(500), nullable=False)
    client_name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    client_location: Mapped[str | None] = mapped_column(String(500), nullable=True)
    client_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    client_email: Mapped[str | None] = mapped_column(String(300), nullable=True)

    # Building parameters (flexible JSON) — legacy name, used by PEB engine
    building_params: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # Generic form payload (for non-PEB templates)
    form_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Calculated BOQ results (cached)
    boq_results: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Financials
    total_amount: Mapped[float] = mapped_column(Float, default=0.0)
    rate_per_sqft: Mapped[float] = mapped_column(Float, default=0.0)

    # ─── Negotiation (Model A1 — flat cap) ───
    negotiation_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    max_discount_pct: Mapped[float] = mapped_column(Float, default=0.0)
    final_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # after accepted negotiation

    # ─── Auto-generated artifact URLs (filled by background job) ───
    render_3d_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    drawings_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    ai_render_urls: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)  # list of URLs

    # Status & revision
    status: Mapped[str] = mapped_column(
        String(20), default=QuotationStatus.DRAFT.value
    )
    revision: Mapped[int] = mapped_column(Integer, default=1)
    parent_quotation_id: Mapped[int | None] = mapped_column(
        ForeignKey("quotations.id"), nullable=True
    )

    # Validity / expiry
    valid_until: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    # PDF
    pdf_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    # Relationships
    logs: Mapped[list["QuotationLog"]] = relationship(
        back_populates="quotation", lazy="dynamic"
    )

    __table_args__ = (
        Index("ix_quotations_status", "status"),
        Index("ix_quotations_lead_user", "lead_id", "user_id"),
    )

    def __repr__(self) -> str:
        return f"<Quotation(id={self.id}, lead_id={self.lead_id}, status={self.status})>"


class QuotationLog(Base):
    """Immutable audit log for quotation actions."""

    __tablename__ = "quotation_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    quotation_id: Mapped[int] = mapped_column(
        ForeignKey("quotations.id"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True
    )
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    quotation: Mapped["Quotation"] = relationship(back_populates="logs")

    __table_args__ = (
        Index("ix_quotation_logs_action", "action"),
    )

    def __repr__(self) -> str:
        return f"<QuotationLog(id={self.id}, action={self.action})>"
