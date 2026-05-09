"""
Tendent Quotation Engine — Template, Intake, Offer, Portal Token models
========================================================================
Multi-tenant quotation engine with negotiation cap, public intake,
auto-generated renders, and signed client portal.

All new tables are STRICTLY tenant-scoped (tenant_id is NOT nullable and
indexed) because they power public-facing (no-auth) surfaces.
"""

import enum
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean, DateTime, Float, ForeignKey, Index, Integer, JSON, String, Text
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import Base, TimestampMixin, SoftDeleteMixin

# NOTE: The authoritative tenant table is `platform_tenants` (raw-SQL managed,
# TEXT primary key like "tenant-swetha"). We scope via String tenant_id with
# a soft index instead of a strict FK to keep SQLAlchemy independent of the
# raw-SQL SaaS control layer.


# ═════════════════════════════════════════════════════ Enums ══

class TemplateEngine(str, enum.Enum):
    """Calculation engine backing a quotation template."""
    PEB = "peb"          # Pre-Engineered Building — unlocks 3D, drawings, AI render
    GENERIC = "generic"  # Arithmetic over form fields × rate table


class IntakeStatus(str, enum.Enum):
    NEW = "new"                 # Just submitted, renders pending
    PROCESSING = "processing"   # Background jobs running
    READY = "ready"             # Draft quote created, awaiting tenant review
    APPROVED = "approved"       # Tenant approved & sent
    REJECTED = "rejected"       # Tenant rejected
    EXPIRED = "expired"


class OfferStatus(str, enum.Enum):
    """Negotiation offer state machine."""
    CLIENT_PROPOSED = "client_proposed"
    TENANT_APPROVED = "tenant_approved"
    TENANT_COUNTERED = "tenant_countered"
    TENANT_REJECTED = "tenant_rejected"
    AUTO_REJECTED = "auto_rejected"   # Below floor → system rejected
    ACCEPTED_FINAL = "accepted_final"
    EXPIRED = "expired"


class PortalTokenKind(str, enum.Enum):
    VIEW = "view"     # Read-only quotation portal
    VIEW_3D = "view_3d"
    VIEW_RENDER = "view_render"


# ═══════════════════════════════════════ QuotationTemplate ══

class QuotationTemplate(Base, TimestampMixin, SoftDeleteMixin):
    """
    A tenant-defined product/service template that drives the entire
    quotation flow: intake form, rate table, calculation engine, branding,
    auto-generation toggles, and negotiation caps.

    One tenant can have many active templates (e.g., "PEB Warehouse",
    "Cold Storage", "Modular Kitchen"). Each template gets its own
    public intake URL: /intake/{tenant_slug}/{template_slug}
    """

    __tablename__ = "quotation_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True
    )

    # Identity
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    icon: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # lucide icon name
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Engine & auto-generation
    engine: Mapped[str] = mapped_column(
        String(20), default=TemplateEngine.GENERIC.value, nullable=False
    )
    auto_generate_3d: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    auto_generate_drawings: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    auto_generate_render: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Dynamic form schema — list of field definitions
    # [{ key, label, type: text|number|select|checkbox|textarea,
    #    required, default, min, max, unit, options, help, group }]
    fields_schema: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    # Rate line items — used by both engines
    # [{ id, label, unit, material_rate, labour_rate, description,
    #    formula (generic engine only: e.g. "length * width * 1.2") }]
    rate_items: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    # PEB-specific settings (only when engine == peb)
    # Stores steel_rate_main, steel_rate_mezz, excel rate overrides
    peb_config: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Terms, branding & defaults
    terms_conditions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    branding_overrides: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    default_validity_days: Mapped[int] = mapped_column(Integer, default=30)

    # ─── Negotiation caps (Model A1 — flat discount cap) ───
    negotiation_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    max_discount_pct: Mapped[float] = mapped_column(Float, default=0.0)
    negotiation_reject_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    templates_intakes: Mapped[list["ClientIntake"]] = relationship(
        back_populates="template", lazy="dynamic",
        foreign_keys="ClientIntake.template_id",
    )

    __table_args__ = (
        Index("ix_quotation_templates_tenant_slug", "tenant_id", "slug", unique=True),
        Index("ix_quotation_templates_tenant_active", "tenant_id", "is_active"),
    )

    def __repr__(self) -> str:
        return f"<QuotationTemplate(id={self.id}, tenant={self.tenant_id}, slug={self.slug})>"


# ═══════════════════════════════════════════ ClientIntake ══

class ClientIntake(Base, TimestampMixin):
    """
    A public client submission against a template. Creates a DRAFT quotation
    in the background and triggers auto-generation of 3D / drawings / renders.
    Tenant reviews the intake in their Review Inbox and approves.
    """

    __tablename__ = "quotation_intakes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True
    )
    template_id: Mapped[int] = mapped_column(
        ForeignKey("quotation_templates.id"), nullable=False, index=True
    )

    # Client identity (no auth)
    client_name: Mapped[str] = mapped_column(String(200), nullable=False)
    client_email: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    client_phone: Mapped[str] = mapped_column(String(30), nullable=False)
    client_company: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    client_location: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # The raw form payload (keys match template.fields_schema keys)
    form_data: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    # Auto-calculated BOQ snapshot (for preview before tenant review)
    calc_result: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Auto-generated artifact URLs (populated by background jobs)
    render_3d_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    drawings_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    ai_render_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    # State
    status: Mapped[str] = mapped_column(
        String(30), default=IntakeStatus.NEW.value, nullable=False, index=True
    )
    assigned_user_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    quotation_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("quotations.id"), nullable=True, index=True
    )

    # Client metadata (IP, UA for abuse detection on public endpoint)
    source_ip: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Relationships
    template: Mapped["QuotationTemplate"] = relationship(
        back_populates="templates_intakes",
        foreign_keys=[template_id],
    )

    __table_args__ = (
        Index("ix_quotation_intakes_tenant_status", "tenant_id", "status"),
        Index("ix_quotation_intakes_phone", "client_phone"),
    )

    def __repr__(self) -> str:
        return f"<ClientIntake(id={self.id}, tenant={self.tenant_id}, status={self.status})>"


# ═══════════════════════════════════════════ QuotationOffer ══

class QuotationOffer(Base):
    """
    Negotiation offer history for a quotation. Enforces flat max_discount_pct
    floor (Model A1). System auto-rejects below floor; within floor → tenant
    gets 1-click approve/counter/reject decision.
    """

    __tablename__ = "quotation_offers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    quotation_id: Mapped[int] = mapped_column(
        ForeignKey("quotations.id"), nullable=False, index=True
    )
    tenant_id: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True
    )

    # Offer details
    proposed_amount: Mapped[float] = mapped_column(Float, nullable=False)
    original_amount: Mapped[float] = mapped_column(Float, nullable=False)
    discount_pct: Mapped[float] = mapped_column(Float, nullable=False)
    client_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tenant_response: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # State
    status: Mapped[str] = mapped_column(
        String(30), default=OfferStatus.CLIENT_PROPOSED.value, nullable=False, index=True
    )
    resolved_by_user_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        Index("ix_quotation_offers_quotation_status", "quotation_id", "status"),
    )

    def __repr__(self) -> str:
        return (
            f"<QuotationOffer(id={self.id}, q={self.quotation_id}, "
            f"status={self.status}, proposed={self.proposed_amount})>"
        )


# ═══════════════════════════════════ QuotationPortalToken ══

class QuotationPortalToken(Base):
    """
    Signed, expiring public access token for client portal routes.
    HMAC-signed with QUOTATION_SIGNING_SECRET env var. Same token unlocks:
      - /q/{token}          → branded quote page (accept/negotiate/reject)
      - /view/{token}/3d    → public Three.js viewer
      - /view/{token}/render → public AI render gallery
    """

    __tablename__ = "quotation_portal_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    quotation_id: Mapped[int] = mapped_column(
        ForeignKey("quotations.id"), nullable=False, index=True
    )
    tenant_id: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True
    )

    token: Mapped[str] = mapped_column(String(200), nullable=False, unique=True, index=True)
    kind: Mapped[str] = mapped_column(
        String(30), default=PortalTokenKind.VIEW.value, nullable=False
    )

    # Expiry
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Access tracking (how many times client opened, last IP, last UA)
    access_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_accessed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_accessed_ip: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_portal_tokens_quotation", "quotation_id", "kind"),
    )

    def __repr__(self) -> str:
        return f"<QuotationPortalToken(id={self.id}, kind={self.kind}, expires={self.expires_at})>"


# ═════════════════════════════════════ WhatsApp Provider Config ══

class TenantMessagingProvider(str, enum.Enum):
    WATI = "wati"
    TWILIO = "twilio"
    GUPSHUP = "gupshup"
    META = "meta"
    BAILEYS = "baileys"


class TenantWhatsAppConfig(Base, TimestampMixin):
    """
    Per-tenant WhatsApp provider selection + credentials.
    Only one active provider per tenant at a time.
    """

    __tablename__ = "tenant_whatsapp_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, unique=True, index=True
    )

    provider: Mapped[str] = mapped_column(
        String(30), default=TenantMessagingProvider.META.value, nullable=False
    )
    phone_number: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    display_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Provider credentials (encrypted at rest is TODO — v1 stores plain in dev)
    # Schema varies per provider; generic JSON:
    #   wati:    { api_endpoint, access_token, channel_id }
    #   twilio:  { account_sid, auth_token, from_number }
    #   gupshup: { api_key, app_name, source_number }
    #   meta:    { access_token, phone_number_id, business_account_id }
    credentials: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    def __repr__(self) -> str:
        return f"<TenantWhatsAppConfig(tenant={self.tenant_id}, provider={self.provider})>"
