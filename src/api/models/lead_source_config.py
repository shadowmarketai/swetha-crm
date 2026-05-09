"""
VoiceFlow Marketing AI - Lead Source Config Model
===================================================
Configuration for external lead sources (IndiaMart, JustDial, Facebook Lead Ads).
Stores API credentials, polling settings, and sync statistics per user.
"""

import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Integer, Boolean, DateTime, JSON, ForeignKey, Index, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin


class LeadSourceProvider(enum.Enum):
    """Supported lead source providers."""
    INDIAMART = "indiamart"
    JUSTDIAL = "justdial"
    FACEBOOK_LEADS = "facebook_leads"


class LeadSourceConfig(TimestampMixin, Base):
    """
    Configuration for an external lead source integration.
    Each user can have one config per provider.
    Stores API credentials, auto-assign rules, and sync statistics.
    """
    __tablename__ = "lead_source_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Provider
    provider: Mapped[LeadSourceProvider] = mapped_column(
        SQLEnum(LeadSourceProvider, name="lead_source_provider", create_constraint=True),
        nullable=False,
    )

    # Credentials (stored encrypted at rest in production)
    api_key: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    api_secret: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    app_secret: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    page_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Polling settings
    polling_interval_minutes: Mapped[int] = mapped_column(Integer, default=5, server_default="5")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    # Auto-assign incoming leads
    auto_assign: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    assign_to_user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )

    # Default tags for ingested leads
    default_tags: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # Sync statistics
    total_ingested: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    total_duplicates: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    total_errors: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_sync_cursor: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Owner (tenant isolation)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
    )

    __table_args__ = (
        Index("idx_lead_source_config_user_provider", "user_id", "provider", unique=True),
    )

    def __repr__(self) -> str:
        return f"<LeadSourceConfig(id={self.id}, provider={self.provider.value}, user_id={self.user_id})>"
