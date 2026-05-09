"""
VoiceFlow Marketing AI - Inbox Models
======================================
Unified messaging inbox persistence layer.

Channels supported:
    - whatsapp (via BSP: WATI/Gupshup/Twilio, OR Baileys QR unofficial bridge)
    - email    (via IMAP/SMTP, OR Gmail OAuth)
    - sms      (via Twilio/MSG91, stubbed)

Entities:
    ChannelConnection  — a user's connection to an external account/provider
    Conversation       — a thread with a specific remote party on a channel
    Message            — an individual message in a conversation
"""

import enum
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING

from sqlalchemy import (
    String, Integer, Boolean, DateTime, JSON, Text, ForeignKey, Index,
    Enum as SQLEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, SoftDeleteMixin

if TYPE_CHECKING:
    from .user import User


class InboxChannel(str, enum.Enum):
    WHATSAPP = "whatsapp"
    EMAIL = "email"
    SMS = "sms"


class WhatsAppProviderType(str, enum.Enum):
    """Which integration mode the WhatsApp connection uses."""
    WATI = "wati"           # BSP, official
    GUPSHUP = "gupshup"     # BSP, official
    TWILIO = "twilio"       # BSP, official
    BAILEYS = "baileys"     # Unofficial WhatsApp Web via Node bridge


class EmailProviderType(str, enum.Enum):
    IMAP = "imap"
    GMAIL_OAUTH = "gmail_oauth"
    OUTLOOK_OAUTH = "outlook_oauth"


class ConnectionStatus(str, enum.Enum):
    DISCONNECTED = "disconnected"
    PENDING = "pending"        # QR shown, awaiting scan
    CONNECTING = "connecting"
    CONNECTED = "connected"
    ERROR = "error"


class MessageDirection(str, enum.Enum):
    INBOUND = "inbound"      # from remote party to user
    OUTBOUND = "outbound"    # from user to remote party


class MessageStatus(str, enum.Enum):
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"


# ═══════════════════════════════════════════════════════════════════
# ChannelConnection — a user's connection to a messaging provider
# ═══════════════════════════════════════════════════════════════════
class ChannelConnection(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "inbox_connections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    user_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
    )

    channel: Mapped[InboxChannel] = mapped_column(
        SQLEnum(InboxChannel, name="inbox_channel"), nullable=False, index=True,
    )

    # e.g. "wati", "gupshup", "twilio", "baileys", "imap", "gmail_oauth"
    provider: Mapped[str] = mapped_column(String(30), nullable=False)

    # Display label shown in the UI ("My Gmail", "Swetha WhatsApp")
    label: Mapped[str] = mapped_column(String(100), nullable=False)

    status: Mapped[ConnectionStatus] = mapped_column(
        SQLEnum(ConnectionStatus, name="inbox_connection_status"),
        default=ConnectionStatus.DISCONNECTED,
        server_default="disconnected",
        nullable=False,
        index=True,
    )

    # Provider-specific config. Sensitive values should ideally be encrypted,
    # but for this codebase we store as JSON for simplicity.
    # Examples:
    #   WATI:        {"api_key": "...", "base_url": "https://api.wati.io"}
    #   Gupshup:     {"api_key": "...", "app_name": "...", "source_phone": "..."}
    #   Baileys:     {"bridge_url": "http://localhost:4001", "session_id": "..."}
    #   IMAP:        {"host": "imap.gmail.com", "port": 993, "username": "...",
    #                 "password": "...", "smtp_host": "smtp.gmail.com", "smtp_port": 587}
    #   Gmail OAuth: {"refresh_token": "...", "email": "..."}
    config: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Last-known external account identifier (e.g. WhatsApp phone number, email address)
    external_id: Mapped[Optional[str]] = mapped_column(String(200), nullable=True, index=True)

    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    conversations: Mapped[List["Conversation"]] = relationship(
        "Conversation", back_populates="connection", cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("idx_inbox_conn_user_channel", "user_id", "channel"),
    )

    def __repr__(self) -> str:
        return f"<ChannelConnection id={self.id} {self.channel.value}/{self.provider} {self.status.value}>"


# ═══════════════════════════════════════════════════════════════════
# Conversation — a thread with one remote party on one channel
# ═══════════════════════════════════════════════════════════════════
class Conversation(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "inbox_conversations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    user_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
    )

    connection_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("inbox_connections.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    channel: Mapped[InboxChannel] = mapped_column(
        SQLEnum(InboxChannel, name="inbox_channel", create_type=False),
        nullable=False, index=True,
    )

    # The "other party" — phone number for WhatsApp/SMS, email for Email
    remote_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    remote_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    remote_avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Provider-specific thread identifier (e.g. Gmail thread ID, WhatsApp chat ID)
    provider_thread_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)

    subject: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # email subject
    last_message_preview: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_message_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    unread_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)

    # CRM linking
    lead_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("crm_leads.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    contact_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("crm_contacts.id", ondelete="SET NULL"), nullable=True, index=True,
    )

    connection: Mapped["ChannelConnection"] = relationship("ChannelConnection", back_populates="conversations")
    messages: Mapped[List["Message"]] = relationship(
        "Message", back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )

    __table_args__ = (
        Index("idx_inbox_conv_user_channel", "user_id", "channel"),
        Index("idx_inbox_conv_last_msg", "user_id", "last_message_at"),
    )

    def __repr__(self) -> str:
        return f"<Conversation id={self.id} {self.channel.value} {self.remote_id}>"


# ═══════════════════════════════════════════════════════════════════
# Message — individual message in a conversation
# ═══════════════════════════════════════════════════════════════════
class Message(TimestampMixin, Base):
    __tablename__ = "inbox_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    conversation_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("inbox_conversations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    user_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
    )

    direction: Mapped[MessageDirection] = mapped_column(
        SQLEnum(MessageDirection, name="inbox_message_direction"),
        nullable=False, index=True,
    )
    status: Mapped[MessageStatus] = mapped_column(
        SQLEnum(MessageStatus, name="inbox_message_status"),
        default=MessageStatus.PENDING,
        server_default="pending",
        nullable=False,
    )

    body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    html_body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # email HTML
    content_type: Mapped[str] = mapped_column(String(30), default="text", server_default="text")

    # Provider-side identifier (WhatsApp msg id, Gmail message id, etc.)
    provider_message_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)

    # Email-specific
    from_address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    to_addresses: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    cc_addresses: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    attachments: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)  # list of {name, url, mime}
    message_metadata: Mapped[Optional[dict]] = mapped_column("metadata", JSON, nullable=True)

    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="messages")

    __table_args__ = (
        Index("idx_inbox_msg_conv_created", "conversation_id", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<Message id={self.id} {self.direction.value} conv={self.conversation_id}>"
