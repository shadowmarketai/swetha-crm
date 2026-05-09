"""
Swetha Structures CRM - VoiceFlow Integration Models
=======================================================
Stores conversations and recordings synced from the external VoiceFlow SaaS.

Flow:
  CRM lead -> POST to VoiceFlow API (push_lead) -> VoiceFlow runs the call
            -> VoiceFlow webhooks back to /api/v1/voiceflow/webhook
            -> upserts a VoiceflowConversation + zero or more VoiceflowRecording rows

Recordings store URLs only — the audio media itself stays in VoiceFlow's storage
and is streamed by the player from there.
"""

import enum
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING

from sqlalchemy import (
    String, Integer, Float, JSON, Text, ForeignKey, Index, DateTime,
    Enum as SQLEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin

if TYPE_CHECKING:
    from .crm import Lead


class VoiceflowConversationStatus(enum.Enum):
    """Lifecycle of a conversation pushed to VoiceFlow."""
    QUEUED = "queued"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    NO_ANSWER = "no_answer"
    BUSY = "busy"


class VoiceflowConversation(TimestampMixin, Base):
    """
    A conversation conducted by VoiceFlow on behalf of a CRM lead.

    Populated via webhook from the VoiceFlow SaaS once the call/chat ends.
    """
    __tablename__ = "voiceflow_conversations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Foreign key to CRM Lead
    lead_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("crm_leads.id", ondelete="CASCADE"), nullable=False, index=True,
    )

    # External identifiers (VoiceFlow side)
    voiceflow_session_id: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True,
    )
    voiceflow_agent_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Status & timing
    status: Mapped[VoiceflowConversationStatus] = mapped_column(
        SQLEnum(VoiceflowConversationStatus, name="voiceflow_conversation_status", create_constraint=True),
        default=VoiceflowConversationStatus.QUEUED,
        server_default="queued",
        nullable=False,
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_sec: Mapped[float] = mapped_column(Float, default=0.0, server_default="0")

    # Conversation content
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    transcript: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    full_transcript_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Analysis (populated by VoiceFlow's NLU)
    sentiment: Mapped[float] = mapped_column(Float, default=0.0, server_default="0")
    primary_emotion: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    primary_intent: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    detected_dialect: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    lead_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Raw webhook payload — keep for replay/debugging
    raw_payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Relationships
    lead: Mapped["Lead"] = relationship("Lead", back_populates="voiceflow_conversations")
    recordings: Mapped[List["VoiceflowRecording"]] = relationship(
        "VoiceflowRecording", back_populates="conversation",
        cascade="all, delete-orphan", lazy="selectin",
    )

    __table_args__ = (
        Index("idx_vfc_lead_started", "lead_id", "started_at"),
        Index("idx_vfc_status", "status"),
    )

    def __repr__(self) -> str:
        return f"<VoiceflowConversation(id={self.id}, lead_id={self.lead_id}, status={self.status.value})>"


class VoiceflowRecording(TimestampMixin, Base):
    """
    Audio/video recording produced by a VoiceFlow conversation.
    URL points back to VoiceFlow's storage — we don't host the media.
    """
    __tablename__ = "voiceflow_recordings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    conversation_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("voiceflow_conversations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    recording_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    duration_sec: Mapped[float] = mapped_column(Float, default=0.0, server_default="0")
    audio_format: Mapped[str] = mapped_column(String(20), default="mp3", server_default="mp3")
    file_size_bytes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Relationships
    conversation: Mapped["VoiceflowConversation"] = relationship(
        "VoiceflowConversation", back_populates="recordings",
    )

    def __repr__(self) -> str:
        return f"<VoiceflowRecording(id={self.id}, conversation_id={self.conversation_id})>"
