"""
VoiceFlow Marketing AI - Unified Inbox Router
==============================================
REST endpoints for the multi-channel inbox (WhatsApp / Email / SMS).

Channels:
    WhatsApp: WATI / Gupshup / Twilio BSP + Baileys bridge (unofficial QR)
    Email:    IMAP/SMTP + Gmail OAuth placeholder
    SMS:      Twilio/MSG91 (adapter stubs)

Realtime events broadcast:
    inbox.message.created
    inbox.conversation.updated
    inbox.connection.updated
"""

import email as stdlib_email
import imaplib
import logging
import smtplib
from datetime import datetime, timezone
from email.header import decode_header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import desc
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from api.database import get_db
from api.permissions import require_permission
from api.models.inbox import (
    ChannelConnection, Conversation, Message,
    InboxChannel, ConnectionStatus, MessageDirection, MessageStatus,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/inbox", tags=["Inbox"])
public_router = APIRouter(prefix="/api/v1/inbox/public", tags=["Inbox (Public)"])


# ═══════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════

def _get_user_id(current_user: dict) -> str:
    raw = current_user.get("id", "")
    return str(raw) if raw is not None else ""


async def _broadcast(uid, event_type: str, payload: dict) -> None:
    """Best-effort realtime broadcast — never blocks on failure."""
    try:
        from api.realtime import manager
        await manager.to_user(str(uid), event_type, payload)
    except Exception as exc:  # pragma: no cover
        logger.debug("inbox broadcast failed (%s): %s", event_type, exc)


def _conn_to_dict(c: ChannelConnection) -> dict:
    # Strip sensitive values from the config before returning.
    safe_config = {}
    if c.config:
        for k, v in c.config.items():
            if k in ("api_key", "password", "refresh_token", "client_secret"):
                safe_config[k] = "••••••••" if v else None
            else:
                safe_config[k] = v
    return {
        "id": c.id,
        "channel": c.channel.value if c.channel else None,
        "provider": c.provider,
        "label": c.label,
        "status": c.status.value if c.status else None,
        "external_id": c.external_id,
        "config": safe_config,
        "last_error": c.last_error,
        "last_synced_at": c.last_synced_at.isoformat() if c.last_synced_at else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


def _conv_to_dict(conv: Conversation) -> dict:
    return {
        "id": conv.id,
        "connection_id": conv.connection_id,
        "channel": conv.channel.value if conv.channel else None,
        "remote_id": conv.remote_id,
        "remote_name": conv.remote_name or conv.remote_id,
        "remote_avatar_url": conv.remote_avatar_url,
        "subject": conv.subject,
        "last_message_preview": conv.last_message_preview,
        "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
        "unread_count": conv.unread_count,
        "lead_id": conv.lead_id,
        "contact_id": conv.contact_id,
        "created_at": conv.created_at.isoformat() if conv.created_at else None,
    }


def _msg_to_dict(m: Message) -> dict:
    return {
        "id": m.id,
        "conversation_id": m.conversation_id,
        "direction": m.direction.value if m.direction else None,
        "status": m.status.value if m.status else None,
        "body": m.body,
        "html_body": m.html_body,
        "content_type": m.content_type,
        "from_address": m.from_address,
        "to_addresses": m.to_addresses,
        "attachments": m.attachments,
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "provider_message_id": m.provider_message_id,
        "error_message": m.error_message,
    }


def _upsert_conversation(
    db: Session,
    uid: str,
    conn: ChannelConnection,
    remote_id: str,
    remote_name: Optional[str] = None,
    subject: Optional[str] = None,
    provider_thread_id: Optional[str] = None,
) -> Conversation:
    """Find or create a conversation for (connection, remote_id)."""
    query = db.query(Conversation).filter(
        Conversation.user_id == uid,
        Conversation.connection_id == conn.id,
        Conversation.remote_id == remote_id,
        Conversation.is_deleted == False,  # noqa: E712
    )
    if provider_thread_id:
        query = query.filter(
            (Conversation.provider_thread_id == provider_thread_id)
            | (Conversation.provider_thread_id.is_(None))
        )
    conv = query.first()
    if conv:
        if remote_name and not conv.remote_name:
            conv.remote_name = remote_name
        if subject and not conv.subject:
            conv.subject = subject
        return conv

    conv = Conversation(
        user_id=uid,
        connection_id=conn.id,
        channel=conn.channel,
        remote_id=remote_id,
        remote_name=remote_name,
        subject=subject,
        provider_thread_id=provider_thread_id,
    )
    db.add(conv)
    db.flush()
    return conv


async def _persist_incoming_message(
    db: Session,
    uid: str,
    conn: ChannelConnection,
    *,
    remote_id: str,
    remote_name: Optional[str],
    body: Optional[str],
    html_body: Optional[str] = None,
    provider_message_id: Optional[str] = None,
    from_address: Optional[str] = None,
    to_addresses: Optional[List[str]] = None,
    subject: Optional[str] = None,
    provider_thread_id: Optional[str] = None,
    direction: MessageDirection = MessageDirection.INBOUND,
) -> Message:
    """Shared path for inserting an incoming message + bumping the conversation."""
    conv = _upsert_conversation(
        db, uid, conn, remote_id=remote_id, remote_name=remote_name,
        subject=subject, provider_thread_id=provider_thread_id,
    )
    msg = Message(
        conversation_id=conv.id,
        user_id=uid,
        direction=direction,
        status=MessageStatus.DELIVERED if direction == MessageDirection.INBOUND else MessageStatus.SENT,
        body=body,
        html_body=html_body,
        content_type="html" if html_body else "text",
        provider_message_id=provider_message_id,
        from_address=from_address,
        to_addresses=to_addresses,
    )
    db.add(msg)

    conv.last_message_preview = (body or "")[:200]
    conv.last_message_at = datetime.now(timezone.utc)
    if direction == MessageDirection.INBOUND:
        conv.unread_count = (conv.unread_count or 0) + 1
    db.flush()
    return msg


# ═══════════════════════════════════════════════════════════════════
# Schemas
# ═══════════════════════════════════════════════════════════════════

class ConnectionCreate(BaseModel):
    channel: InboxChannel
    provider: str = Field(..., max_length=30)
    label: str = Field(..., min_length=1, max_length=100)
    config: Optional[dict] = None
    external_id: Optional[str] = None

    model_config = ConfigDict(use_enum_values=True)


class ConnectionUpdate(BaseModel):
    label: Optional[str] = None
    config: Optional[dict] = None
    status: Optional[ConnectionStatus] = None


class SendMessageBody(BaseModel):
    body: str = Field(..., min_length=1)
    html_body: Optional[str] = None
    subject: Optional[str] = None  # email only


# ═══════════════════════════════════════════════════════════════════
# CONNECTIONS — list / create / update / delete / test
# ═══════════════════════════════════════════════════════════════════

@router.get("/connections", summary="List inbox connections")
async def list_connections(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("inbox", "read")),
):
    uid = _get_user_id(current_user)
    rows = (
        db.query(ChannelConnection)
        .filter(
            ChannelConnection.user_id == uid,
            ChannelConnection.is_deleted == False,  # noqa: E712
        )
        .order_by(ChannelConnection.created_at.desc())
        .all()
    )
    return [_conn_to_dict(r) for r in rows]


@router.post("/connections", status_code=201, summary="Create inbox connection")
async def create_connection(
    body: ConnectionCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("inbox", "create")),
):
    uid = _get_user_id(current_user)
    conn = ChannelConnection(
        user_id=uid,
        channel=InboxChannel(body.channel) if isinstance(body.channel, str) else body.channel,
        provider=body.provider,
        label=body.label,
        config=body.config or {},
        external_id=body.external_id,
        status=ConnectionStatus.PENDING,
    )
    db.add(conn)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        logger.error("Connection create IntegrityError: %s", exc)
        raise HTTPException(status_code=400, detail="Could not create connection")
    db.refresh(conn)

    payload = _conn_to_dict(conn)
    await _broadcast(uid, "inbox.connection.updated", payload)
    return payload


@router.put("/connections/{connection_id}", summary="Update inbox connection")
async def update_connection(
    connection_id: int,
    body: ConnectionUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("inbox", "update")),
):
    uid = _get_user_id(current_user)
    conn = (
        db.query(ChannelConnection)
        .filter(
            ChannelConnection.id == connection_id,
            ChannelConnection.user_id == uid,
            ChannelConnection.is_deleted == False,  # noqa: E712
        )
        .first()
    )
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    if body.label is not None:
        conn.label = body.label
    if body.config is not None:
        # Merge with existing to allow partial updates and preserve secrets
        merged = dict(conn.config or {})
        for k, v in body.config.items():
            if v == "••••••••":
                continue  # preserve masked secret
            merged[k] = v
        conn.config = merged
    if body.status is not None:
        conn.status = body.status

    db.commit()
    db.refresh(conn)
    payload = _conn_to_dict(conn)
    await _broadcast(uid, "inbox.connection.updated", payload)
    return payload


@router.delete("/connections/{connection_id}", status_code=204, summary="Delete inbox connection")
async def delete_connection(
    connection_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("inbox", "delete")),
):
    uid = _get_user_id(current_user)
    conn = (
        db.query(ChannelConnection)
        .filter(
            ChannelConnection.id == connection_id,
            ChannelConnection.user_id == uid,
        )
        .first()
    )
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    conn.is_deleted = True
    conn.deleted_at = datetime.now(timezone.utc)
    db.commit()
    await _broadcast(uid, "inbox.connection.updated", {"id": connection_id, "deleted": True})


@router.post("/connections/{connection_id}/test", summary="Test an inbox connection")
async def test_connection(
    connection_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("inbox", "update")),
):
    uid = _get_user_id(current_user)
    conn = (
        db.query(ChannelConnection)
        .filter(
            ChannelConnection.id == connection_id,
            ChannelConnection.user_id == uid,
            ChannelConnection.is_deleted == False,  # noqa: E712
        )
        .first()
    )
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    try:
        if conn.channel == InboxChannel.EMAIL and conn.provider == "imap":
            cfg = conn.config or {}
            with imaplib.IMAP4_SSL(cfg.get("host", ""), cfg.get("port", 993)) as imap:
                imap.login(cfg.get("username", ""), cfg.get("password", ""))
                imap.select("INBOX")
            conn.status = ConnectionStatus.CONNECTED
            conn.external_id = cfg.get("username")
            conn.last_error = None
        elif conn.channel == InboxChannel.WHATSAPP and conn.provider == "baileys":
            cfg = conn.config or {}
            bridge_url = cfg.get("bridge_url", "http://localhost:4001")
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(f"{bridge_url}/status")
                r.raise_for_status()
                data = r.json()
                conn.status = ConnectionStatus.CONNECTED if data.get("connected") else ConnectionStatus.PENDING
                conn.external_id = data.get("phone")
                conn.last_error = None
        elif conn.channel == InboxChannel.WHATSAPP and conn.provider in ("wati", "gupshup", "twilio"):
            # Minimal sanity check — BSP APIs don't have a cheap healthcheck.
            cfg = conn.config or {}
            if not cfg.get("api_key"):
                raise ValueError("api_key missing")
            conn.status = ConnectionStatus.CONNECTED
            conn.external_id = cfg.get("source_phone") or cfg.get("phone")
            conn.last_error = None
        else:
            conn.status = ConnectionStatus.CONNECTED  # Best-effort for other providers
            conn.last_error = None
        conn.last_synced_at = datetime.now(timezone.utc)
    except Exception as exc:
        conn.status = ConnectionStatus.ERROR
        conn.last_error = str(exc)[:500]
        db.commit()
        await _broadcast(uid, "inbox.connection.updated", _conn_to_dict(conn))
        raise HTTPException(status_code=400, detail=f"Connection test failed: {exc}")

    db.commit()
    db.refresh(conn)
    payload = _conn_to_dict(conn)
    await _broadcast(uid, "inbox.connection.updated", payload)
    return payload


# ═══════════════════════════════════════════════════════════════════
# BAILEYS QR PROXY — forwards QR / status requests to the Node bridge
# ═══════════════════════════════════════════════════════════════════

@router.get("/connections/{connection_id}/baileys/qr", summary="Get Baileys pairing QR")
async def baileys_qr(
    connection_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("inbox", "read")),
):
    uid = _get_user_id(current_user)
    conn = (
        db.query(ChannelConnection)
        .filter(
            ChannelConnection.id == connection_id,
            ChannelConnection.user_id == uid,
            ChannelConnection.provider == "baileys",
        )
        .first()
    )
    if not conn:
        raise HTTPException(status_code=404, detail="Baileys connection not found")
    cfg = conn.config or {}
    bridge_url = cfg.get("bridge_url", "http://localhost:4001")
    session_id = cfg.get("session_id") or f"user-{uid}"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{bridge_url}/session/{session_id}/qr")
            r.raise_for_status()
            data = r.json()
        # {qr, connected, phone}
        if data.get("connected"):
            conn.status = ConnectionStatus.CONNECTED
            conn.external_id = data.get("phone")
            conn.last_synced_at = datetime.now(timezone.utc)
            db.commit()
            await _broadcast(uid, "inbox.connection.updated", _conn_to_dict(conn))
        return data
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail=(
                "Baileys bridge is not running. Start it with "
                "`cd baileys-bridge && npm install && npm start` "
                "(see baileys-bridge/README.md)."
            ),
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Baileys bridge error: {exc}")


# ═══════════════════════════════════════════════════════════════════
# CONVERSATIONS
# ═══════════════════════════════════════════════════════════════════

@router.get("/conversations", summary="List conversations")
async def list_conversations(
    channel: Optional[InboxChannel] = Query(None),
    connection_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("inbox", "read")),
):
    uid = _get_user_id(current_user)
    q = db.query(Conversation).filter(
        Conversation.user_id == uid,
        Conversation.is_deleted == False,  # noqa: E712
    )
    if channel:
        q = q.filter(Conversation.channel == channel)
    if connection_id:
        q = q.filter(Conversation.connection_id == connection_id)
    if search:
        term = f"%{search}%"
        q = q.filter(
            (Conversation.remote_name.ilike(term))
            | (Conversation.remote_id.ilike(term))
            | (Conversation.last_message_preview.ilike(term))
            | (Conversation.subject.ilike(term))
        )
    rows = q.order_by(desc(Conversation.last_message_at)).limit(limit).all()
    return [_conv_to_dict(r) for r in rows]


@router.get("/conversations/{conversation_id}/messages", summary="Get conversation messages")
async def list_messages(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("inbox", "read")),
):
    uid = _get_user_id(current_user)
    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == uid)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    msgs = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .all()
    )
    return {
        "conversation": _conv_to_dict(conv),
        "messages": [_msg_to_dict(m) for m in msgs],
    }


@router.post("/conversations/{conversation_id}/read", summary="Mark conversation read")
async def mark_read(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("inbox", "update")),
):
    uid = _get_user_id(current_user)
    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == uid)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conv.unread_count = 0
    now = datetime.now(timezone.utc)
    db.query(Message).filter(
        Message.conversation_id == conversation_id,
        Message.direction == MessageDirection.INBOUND,
        Message.read_at.is_(None),
    ).update({"read_at": now, "status": MessageStatus.READ}, synchronize_session=False)
    db.commit()
    await _broadcast(uid, "inbox.conversation.updated", _conv_to_dict(conv))
    return _conv_to_dict(conv)


# ═══════════════════════════════════════════════════════════════════
# SENDING MESSAGES
# ═══════════════════════════════════════════════════════════════════

async def _dispatch_whatsapp(conn: ChannelConnection, to: str, text: str) -> dict:
    cfg = conn.config or {}
    if conn.provider == "wati":
        from services.whatsapp_service import WATIClient
        client = WATIClient(cfg.get("api_key", ""), cfg.get("base_url", "https://api.wati.io"))
        res = await client.send_message(to, text)
        return res
    if conn.provider == "gupshup":
        from services.whatsapp_service import GupshupClient
        client = GupshupClient(cfg.get("api_key", ""), cfg.get("app_name", ""), cfg.get("source_phone", ""))
        return await client.send_message(to, text)
    if conn.provider == "twilio":
        # Twilio adapter: REST POST
        account_sid = cfg.get("account_sid")
        auth_token = cfg.get("auth_token")
        from_phone = cfg.get("source_phone")
        if not (account_sid and auth_token and from_phone):
            return {"success": False, "error": "Twilio credentials incomplete"}
        url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                url,
                auth=(account_sid, auth_token),
                data={"From": f"whatsapp:{from_phone}", "To": f"whatsapp:{to}", "Body": text},
            )
            return {"success": r.is_success, "data": r.json() if r.content else {}, "status_code": r.status_code}
    if conn.provider == "baileys":
        bridge_url = cfg.get("bridge_url", "http://localhost:4001")
        session_id = cfg.get("session_id") or f"user-{conn.user_id}"
        async with httpx.AsyncClient(timeout=15) as client:
            try:
                r = await client.post(
                    f"{bridge_url}/session/{session_id}/send",
                    json={"to": to, "text": text},
                )
                return {"success": r.is_success, "data": r.json() if r.content else {}}
            except httpx.ConnectError:
                return {"success": False, "error": "Baileys bridge is not running"}
    return {"success": False, "error": f"Unknown WhatsApp provider: {conn.provider}"}


def _dispatch_email(conn: ChannelConnection, to: str, subject: str, body: str, html_body: Optional[str]) -> dict:
    cfg = conn.config or {}
    if conn.provider != "imap":
        return {"success": False, "error": "Only IMAP/SMTP email sending is supported right now"}
    try:
        smtp_host = cfg.get("smtp_host") or cfg.get("host")
        smtp_port = int(cfg.get("smtp_port", 587))
        username = cfg.get("username")
        password = cfg.get("password")
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject or "(no subject)"
        msg["From"] = username
        msg["To"] = to
        msg.attach(MIMEText(body or "", "plain"))
        if html_body:
            msg.attach(MIMEText(html_body, "html"))
        with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
            server.starttls()
            server.login(username, password)
            server.sendmail(username, [to], msg.as_string())
        return {"success": True}
    except Exception as exc:
        return {"success": False, "error": str(exc)[:500]}


@router.post("/conversations/{conversation_id}/messages", status_code=201, summary="Send a message")
async def send_message(
    conversation_id: int,
    body: SendMessageBody,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("inbox", "create")),
):
    uid = _get_user_id(current_user)
    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == uid)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conn = db.query(ChannelConnection).filter(ChannelConnection.id == conv.connection_id).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Channel connection not found")

    msg = Message(
        conversation_id=conv.id,
        user_id=uid,
        direction=MessageDirection.OUTBOUND,
        status=MessageStatus.PENDING,
        body=body.body,
        html_body=body.html_body,
        content_type="html" if body.html_body else "text",
        to_addresses=[conv.remote_id],
    )
    db.add(msg)
    conv.last_message_preview = body.body[:200]
    conv.last_message_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(msg)

    # Dispatch to provider
    if conv.channel == InboxChannel.WHATSAPP:
        result = await _dispatch_whatsapp(conn, conv.remote_id, body.body)
    elif conv.channel == InboxChannel.EMAIL:
        result = _dispatch_email(
            conn, conv.remote_id, body.subject or conv.subject or "(no subject)",
            body.body, body.html_body,
        )
    else:
        result = {"success": False, "error": f"Sending not implemented for {conv.channel.value}"}

    if result.get("success"):
        msg.status = MessageStatus.SENT
        if isinstance(result.get("data"), dict):
            msg.provider_message_id = str(result["data"].get("id") or result["data"].get("messageId") or "")
    else:
        msg.status = MessageStatus.FAILED
        msg.error_message = result.get("error", "Unknown error")

    db.commit()
    db.refresh(msg)

    payload = _msg_to_dict(msg)
    await _broadcast(uid, "inbox.message.created", {"conversation_id": conv.id, "message": payload})
    await _broadcast(uid, "inbox.conversation.updated", _conv_to_dict(conv))

    if not result.get("success"):
        raise HTTPException(status_code=502, detail=f"Send failed: {msg.error_message}")
    return payload


# ═══════════════════════════════════════════════════════════════════
# EMAIL — manual IMAP poll
# ═══════════════════════════════════════════════════════════════════

def _decode(part) -> str:
    if part is None:
        return ""
    parts = decode_header(part)
    out = []
    for text, charset in parts:
        if isinstance(text, bytes):
            try:
                out.append(text.decode(charset or "utf-8", errors="replace"))
            except LookupError:
                out.append(text.decode("utf-8", errors="replace"))
        else:
            out.append(text)
    return "".join(out)


def _extract_body(msg: stdlib_email.message.Message) -> tuple[str, Optional[str]]:
    """Return (plain_text, html_text_or_None)."""
    plain: Optional[str] = None
    html: Optional[str] = None
    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            dispo = str(part.get("Content-Disposition") or "")
            if "attachment" in dispo:
                continue
            if ctype == "text/plain" and plain is None:
                try:
                    plain = part.get_payload(decode=True).decode(part.get_content_charset() or "utf-8", errors="replace")
                except Exception:
                    pass
            elif ctype == "text/html" and html is None:
                try:
                    html = part.get_payload(decode=True).decode(part.get_content_charset() or "utf-8", errors="replace")
                except Exception:
                    pass
    else:
        try:
            plain = msg.get_payload(decode=True).decode(msg.get_content_charset() or "utf-8", errors="replace")
        except Exception:
            plain = msg.get_payload() or ""
    return (plain or "", html)


@router.post("/connections/{connection_id}/email/poll", summary="Fetch new emails via IMAP")
async def poll_email(
    connection_id: int,
    limit: int = Query(30, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("inbox", "update")),
):
    """Pull the most recent messages from the IMAP INBOX and persist them.

    This is a pull-on-demand endpoint (no background daemon). The frontend
    calls this when the user clicks "Refresh" on the Email tab.
    """
    uid = _get_user_id(current_user)
    conn = (
        db.query(ChannelConnection)
        .filter(
            ChannelConnection.id == connection_id,
            ChannelConnection.user_id == uid,
            ChannelConnection.channel == InboxChannel.EMAIL,
            ChannelConnection.is_deleted == False,  # noqa: E712
        )
        .first()
    )
    if not conn:
        raise HTTPException(status_code=404, detail="Email connection not found")
    if conn.provider != "imap":
        raise HTTPException(status_code=400, detail="Polling is only supported for IMAP connections")

    cfg = conn.config or {}
    host = cfg.get("host", "")
    port = int(cfg.get("port", 993))
    username = cfg.get("username", "")
    password = cfg.get("password", "")

    new_count = 0
    try:
        imap = imaplib.IMAP4_SSL(host, port)
        imap.login(username, password)
        imap.select("INBOX")
        _, data = imap.search(None, "ALL")
        ids = data[0].split()
        ids = ids[-limit:]  # most recent N
        for raw_id in ids:
            _, msg_data = imap.fetch(raw_id, "(RFC822)")
            if not msg_data or not msg_data[0]:
                continue
            raw = msg_data[0][1]
            email_msg = stdlib_email.message_from_bytes(raw)

            message_id = email_msg.get("Message-ID", "").strip("<>")
            if not message_id:
                continue
            # Dedupe
            existing = (
                db.query(Message)
                .filter(Message.provider_message_id == message_id, Message.user_id == uid)
                .first()
            )
            if existing:
                continue

            subject = _decode(email_msg.get("Subject"))
            from_header = _decode(email_msg.get("From"))
            to_header = _decode(email_msg.get("To"))
            plain, html = _extract_body(email_msg)

            # Parse "Name <email@x>" → (name, email)
            from_addr, from_name = from_header, None
            if "<" in from_header and ">" in from_header:
                from_name = from_header.split("<")[0].strip().strip('"')
                from_addr = from_header.split("<")[1].split(">")[0].strip()

            await _persist_incoming_message(
                db, uid, conn,
                remote_id=from_addr,
                remote_name=from_name or from_addr,
                body=plain[:5000],
                html_body=html[:50000] if html else None,
                provider_message_id=message_id,
                from_address=from_addr,
                to_addresses=[to_header] if to_header else None,
                subject=subject,
                provider_thread_id=email_msg.get("Message-ID"),
            )
            new_count += 1
        imap.close()
        imap.logout()

        conn.status = ConnectionStatus.CONNECTED
        conn.last_synced_at = datetime.now(timezone.utc)
        conn.last_error = None
        db.commit()
    except Exception as exc:
        db.rollback()
        conn.status = ConnectionStatus.ERROR
        conn.last_error = str(exc)[:500]
        db.commit()
        raise HTTPException(status_code=502, detail=f"IMAP poll failed: {exc}")

    # Broadcast a summary event so the UI refreshes its conversation list
    await _broadcast(uid, "inbox.connection.updated", _conn_to_dict(conn))
    await _broadcast(uid, "inbox.poll.complete", {"connection_id": conn.id, "new_messages": new_count})
    return {"new_messages": new_count}


# ═══════════════════════════════════════════════════════════════════
# WEBHOOKS — public endpoints that BSP providers / Baileys bridge call
# ═══════════════════════════════════════════════════════════════════

@public_router.post("/whatsapp/{connection_id}", summary="WhatsApp BSP webhook receiver")
async def whatsapp_webhook(
    connection_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    """Receives inbound WhatsApp messages from WATI / Gupshup / Twilio / Baileys.

    The payload shape varies per provider so we normalize defensively.
    """
    body = await request.json()
    conn = (
        db.query(ChannelConnection)
        .filter(ChannelConnection.id == connection_id, ChannelConnection.channel == InboxChannel.WHATSAPP)
        .first()
    )
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    # Normalize across providers
    remote_id = None
    remote_name = None
    text = None
    provider_msg_id = None

    if conn.provider == "wati":
        remote_id = body.get("waId") or body.get("senderPhone")
        remote_name = body.get("senderName")
        text = body.get("text") or body.get("body")
        provider_msg_id = body.get("id") or body.get("messageId")
    elif conn.provider == "gupshup":
        payload = body.get("payload", {}) or {}
        sender = payload.get("sender", {}) or {}
        remote_id = sender.get("phone")
        remote_name = sender.get("name")
        text = (payload.get("payload") or {}).get("text")
        provider_msg_id = payload.get("id")
    elif conn.provider == "twilio":
        remote_id = (body.get("From") or "").replace("whatsapp:", "")
        text = body.get("Body")
        provider_msg_id = body.get("MessageSid")
    elif conn.provider == "baileys":
        remote_id = body.get("from")
        remote_name = body.get("name")
        text = body.get("text")
        provider_msg_id = body.get("id")

    if not remote_id or text is None:
        return {"ok": False, "reason": "payload missing remote_id or text", "body": body}

    await _persist_incoming_message(
        db, conn.user_id, conn,
        remote_id=remote_id,
        remote_name=remote_name,
        body=text,
        provider_message_id=provider_msg_id,
    )
    db.commit()

    # Broadcast to the owning user
    conv = (
        db.query(Conversation)
        .filter(
            Conversation.user_id == conn.user_id,
            Conversation.connection_id == conn.id,
            Conversation.remote_id == remote_id,
        )
        .order_by(desc(Conversation.last_message_at))
        .first()
    )
    if conv:
        latest = db.query(Message).filter(Message.conversation_id == conv.id).order_by(desc(Message.created_at)).first()
        await _broadcast(conn.user_id, "inbox.message.created", {
            "conversation_id": conv.id,
            "message": _msg_to_dict(latest) if latest else None,
        })
        await _broadcast(conn.user_id, "inbox.conversation.updated", _conv_to_dict(conv))

    return {"ok": True}
