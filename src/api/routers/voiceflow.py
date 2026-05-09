"""
Swetha Structures CRM - VoiceFlow Integration Router
======================================================
Endpoints:
  POST /api/v1/voiceflow/leads/{lead_id}/push          — push a lead to VoiceFlow
  POST /api/v1/voiceflow/webhook                       — receive conversation/recording updates
  GET  /api/v1/voiceflow/leads/{lead_id}/conversations — list conversations for a lead
  GET  /api/v1/voiceflow/conversations/{id}            — single conversation with transcript + recordings

Webhook auth:
  HMAC-SHA256 signature in `X-Voiceflow-Signature` header.
  Secret is `VOICEFLOW_WEBHOOK_SECRET` from config.
"""

import hashlib
import hmac
import logging
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Request, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from api.config import settings
from api.database import get_db
from api.permissions import require_permission
from api.models.crm import Lead
from api.models.voiceflow import (
    VoiceflowConversation,
    VoiceflowConversationStatus,
    VoiceflowRecording,
)
from api.services.voiceflow_client import VoiceflowClient, VoiceflowError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/voiceflow", tags=["VoiceFlow"])


# ── Schemas ──────────────────────────────────────────────────────


class PushLeadResponse(BaseModel):
    voiceflow_session_id: Optional[str] = None
    status: str
    message: str

    model_config = ConfigDict(from_attributes=True)


class RecordingResponse(BaseModel):
    id: int
    recording_url: str
    duration_sec: float
    audio_format: str

    model_config = ConfigDict(from_attributes=True)


class ConversationResponse(BaseModel):
    id: int
    lead_id: int
    voiceflow_session_id: str
    voiceflow_agent_id: Optional[str] = None
    status: str
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration_sec: float = 0.0
    summary: Optional[str] = None
    full_transcript_text: Optional[str] = None
    transcript: Optional[list] = None
    sentiment: float = 0.0
    primary_emotion: Optional[str] = None
    primary_intent: Optional[str] = None
    detected_dialect: Optional[str] = None
    lead_score: Optional[float] = None
    recordings: list[RecordingResponse] = Field(default_factory=list)
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConversationSummaryResponse(BaseModel):
    """Lighter shape for list views — no transcript array."""
    id: int
    lead_id: int
    voiceflow_session_id: str
    status: str
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration_sec: float = 0.0
    summary: Optional[str] = None
    sentiment: float = 0.0
    primary_intent: Optional[str] = None
    recording_count: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Helpers ──────────────────────────────────────────────────────


def _user_id_str(current_user: dict) -> str:
    return str(current_user.get("id", ""))


def _serialize_conversation(c: VoiceflowConversation) -> ConversationResponse:
    return ConversationResponse(
        id=c.id,
        lead_id=c.lead_id,
        voiceflow_session_id=c.voiceflow_session_id,
        voiceflow_agent_id=c.voiceflow_agent_id,
        status=c.status.value if hasattr(c.status, "value") else str(c.status),
        started_at=c.started_at,
        ended_at=c.ended_at,
        duration_sec=c.duration_sec or 0.0,
        summary=c.summary,
        full_transcript_text=c.full_transcript_text,
        transcript=c.transcript,
        sentiment=c.sentiment or 0.0,
        primary_emotion=c.primary_emotion,
        primary_intent=c.primary_intent,
        detected_dialect=c.detected_dialect,
        lead_score=c.lead_score,
        recordings=[
            RecordingResponse(
                id=r.id,
                recording_url=r.recording_url,
                duration_sec=r.duration_sec or 0.0,
                audio_format=r.audio_format,
            )
            for r in c.recordings
        ],
        created_at=c.created_at,
    )


def _verify_webhook_signature(raw_body: bytes, signature_header: Optional[str]) -> None:
    """Reject the request if HMAC signature does not match."""
    secret = getattr(settings, "VOICEFLOW_WEBHOOK_SECRET", "") or ""
    if not secret:
        logger.warning("VOICEFLOW_WEBHOOK_SECRET not configured — rejecting webhook")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Webhook secret not configured",
        )
    if not signature_header:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-Voiceflow-Signature header",
        )
    expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature_header):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook signature",
        )


def _parse_dt(val: Any) -> Optional[datetime]:
    if val is None:
        return None
    if isinstance(val, datetime):
        return val
    try:
        return datetime.fromisoformat(str(val).replace("Z", "+00:00"))
    except ValueError:
        return None


def _parse_status(val: Any) -> VoiceflowConversationStatus:
    if val is None:
        return VoiceflowConversationStatus.QUEUED
    try:
        return VoiceflowConversationStatus(str(val).lower())
    except ValueError:
        return VoiceflowConversationStatus.IN_PROGRESS


# ── POST /leads/{lead_id}/push ───────────────────────────────────


@router.post(
    "/leads/{lead_id}/push",
    response_model=PushLeadResponse,
    summary="Push a lead to VoiceFlow",
)
async def push_lead(
    lead_id: int,
    agent_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("crm", "update")),
) -> PushLeadResponse:
    """Send the lead to the VoiceFlow SaaS so it can initiate a conversation.

    A QUEUED VoiceflowConversation is created locally so the UI can show that
    the lead has been dispatched even before the webhook fires.
    """
    user_id = _user_id_str(current_user)
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.user_id == user_id).first()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    payload = {
        "id": lead.id,
        "phone": lead.phone,
        "email": lead.email,
        "first_name": lead.first_name,
        "last_name": lead.last_name,
        "company_name": lead.company_name,
        "source": lead.source.value if lead.source else None,
        "lead_score": lead.lead_score,
        "status": lead.status.value if lead.status else None,
        "tags": lead.tags or [],
    }

    client = VoiceflowClient()
    try:
        result = await client.push_lead(payload, agent_id=agent_id)
    except VoiceflowError as exc:
        logger.error("Failed to push lead %s to VoiceFlow: %s", lead_id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"VoiceFlow rejected the lead: {exc}",
        )

    session_id = result.get("session_id") or result.get("id")
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="VoiceFlow response did not include session_id",
        )

    # Upsert a QUEUED conversation so the lead detail page reflects the dispatch
    existing = (
        db.query(VoiceflowConversation)
        .filter(VoiceflowConversation.voiceflow_session_id == session_id)
        .first()
    )
    if existing is None:
        conv = VoiceflowConversation(
            lead_id=lead.id,
            voiceflow_session_id=session_id,
            voiceflow_agent_id=agent_id,
            status=VoiceflowConversationStatus.QUEUED,
        )
        db.add(conv)
        db.commit()

    return PushLeadResponse(
        voiceflow_session_id=session_id,
        status="queued",
        message="Lead pushed to VoiceFlow",
    )


# ── POST /webhook ────────────────────────────────────────────────


@router.post(
    "/webhook",
    summary="VoiceFlow webhook receiver",
    status_code=status.HTTP_200_OK,
)
async def voiceflow_webhook(
    request: Request,
    x_voiceflow_signature: Optional[str] = Header(default=None, alias="X-Voiceflow-Signature"),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Receive conversation + recording payloads from VoiceFlow.

    Expected JSON body shape (VoiceFlow side defines the contract):
      {
        "lead_id": "<crm_leads.id>",            # required
        "session_id": "<voiceflow id>",          # required
        "agent_id": "<voiceflow agent>",
        "status": "completed",
        "started_at": "2026-05-09T10:00:00Z",
        "ended_at":   "2026-05-09T10:04:32Z",
        "duration_sec": 272.4,
        "summary": "...",
        "transcript": [ {"speaker": "user", "text": "..."}, ... ],
        "full_transcript_text": "...",
        "sentiment": 0.42,
        "primary_emotion": "happy",
        "primary_intent": "purchase",
        "detected_dialect": "kongu",
        "lead_score": 0.81,
        "recordings": [
          { "url": "https://.../call.mp3", "duration_sec": 272.4, "format": "mp3", "size": 1234567 }
        ]
      }
    """
    raw_body = await request.body()
    _verify_webhook_signature(raw_body, x_voiceflow_signature)

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON body")

    session_id = payload.get("session_id") or payload.get("id")
    if not session_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="session_id is required")

    raw_lead_id = payload.get("lead_id")
    try:
        lead_id_int = int(raw_lead_id) if raw_lead_id is not None else None
    except (TypeError, ValueError):
        lead_id_int = None

    # Find existing conversation by session_id (upsert)
    conv = (
        db.query(VoiceflowConversation)
        .filter(VoiceflowConversation.voiceflow_session_id == session_id)
        .first()
    )
    if conv is None:
        if lead_id_int is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="lead_id required when creating a new conversation",
            )
        if not db.query(Lead).filter(Lead.id == lead_id_int).first():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Lead {lead_id_int} not found",
            )
        conv = VoiceflowConversation(
            lead_id=lead_id_int,
            voiceflow_session_id=session_id,
        )
        db.add(conv)

    # Update fields
    conv.voiceflow_agent_id = payload.get("agent_id") or conv.voiceflow_agent_id
    conv.status = _parse_status(payload.get("status"))
    conv.started_at = _parse_dt(payload.get("started_at")) or conv.started_at
    conv.ended_at = _parse_dt(payload.get("ended_at")) or conv.ended_at
    conv.duration_sec = float(payload.get("duration_sec") or conv.duration_sec or 0.0)
    conv.summary = payload.get("summary") or conv.summary
    conv.full_transcript_text = payload.get("full_transcript_text") or conv.full_transcript_text
    if payload.get("transcript") is not None:
        conv.transcript = payload.get("transcript")
    conv.sentiment = float(payload.get("sentiment") or conv.sentiment or 0.0)
    conv.primary_emotion = payload.get("primary_emotion") or conv.primary_emotion
    conv.primary_intent = payload.get("primary_intent") or conv.primary_intent
    conv.detected_dialect = payload.get("detected_dialect") or conv.detected_dialect
    if payload.get("lead_score") is not None:
        conv.lead_score = float(payload["lead_score"])
    conv.raw_payload = payload

    # Replace recordings
    incoming_recordings = payload.get("recordings") or []
    if incoming_recordings:
        # Drop existing, then re-add (simpler than reconciling)
        for old in list(conv.recordings):
            db.delete(old)
        for r in incoming_recordings:
            url = r.get("url") or r.get("recording_url")
            if not url:
                continue
            db.add(VoiceflowRecording(
                conversation=conv,
                recording_url=url,
                duration_sec=float(r.get("duration_sec") or 0.0),
                audio_format=str(r.get("format") or r.get("audio_format") or "mp3"),
                file_size_bytes=r.get("size") or r.get("file_size_bytes"),
            ))

    db.flush()

    # Sync analysis fields up to the Lead so list filters keep working
    lead = db.query(Lead).filter(Lead.id == conv.lead_id).first()
    if lead:
        if conv.primary_emotion:
            lead.primary_emotion = conv.primary_emotion
        if conv.primary_intent:
            lead.primary_intent = conv.primary_intent
        if conv.detected_dialect:
            lead.detected_dialect = conv.detected_dialect
        if conv.sentiment:
            lead.avg_sentiment = conv.sentiment
        if conv.status == VoiceflowConversationStatus.COMPLETED:
            lead.total_calls = (lead.total_calls or 0) + 1
            if conv.ended_at:
                lead.last_call_at = conv.ended_at
        if conv.lead_score is not None:
            # Scale 0-1 score from VoiceFlow to 0-100 used in CRM
            lead.lead_score = conv.lead_score * 100 if conv.lead_score <= 1 else conv.lead_score

    db.commit()
    db.refresh(conv)

    return {"conversation_id": conv.id, "status": conv.status.value}


# ── GET /leads/{lead_id}/conversations ───────────────────────────


@router.get(
    "/leads/{lead_id}/conversations",
    response_model=list[ConversationSummaryResponse],
    summary="List VoiceFlow conversations for a lead",
)
async def list_conversations_for_lead(
    lead_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("crm", "read")),
) -> list[ConversationSummaryResponse]:
    user_id = _user_id_str(current_user)
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.user_id == user_id).first()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    rows = (
        db.query(VoiceflowConversation)
        .filter(VoiceflowConversation.lead_id == lead_id)
        .order_by(VoiceflowConversation.started_at.desc().nullslast(), VoiceflowConversation.created_at.desc())
        .all()
    )

    return [
        ConversationSummaryResponse(
            id=c.id,
            lead_id=c.lead_id,
            voiceflow_session_id=c.voiceflow_session_id,
            status=c.status.value if hasattr(c.status, "value") else str(c.status),
            started_at=c.started_at,
            ended_at=c.ended_at,
            duration_sec=c.duration_sec or 0.0,
            summary=c.summary,
            sentiment=c.sentiment or 0.0,
            primary_intent=c.primary_intent,
            recording_count=len(c.recordings),
            created_at=c.created_at,
        )
        for c in rows
    ]


# ── GET /conversations/{id} ──────────────────────────────────────


@router.get(
    "/conversations/{conversation_id}",
    response_model=ConversationResponse,
    summary="Get a single VoiceFlow conversation",
)
async def get_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("crm", "read")),
) -> ConversationResponse:
    user_id = _user_id_str(current_user)

    conv = (
        db.query(VoiceflowConversation)
        .join(Lead, VoiceflowConversation.lead_id == Lead.id)
        .filter(VoiceflowConversation.id == conversation_id, Lead.user_id == user_id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    return _serialize_conversation(conv)
