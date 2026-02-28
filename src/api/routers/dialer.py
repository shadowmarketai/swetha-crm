"""
VoiceFlow Marketing AI - Dialer Router
========================================
CRUD for campaigns, contacts, calls. Integrates with telephony
providers and voice analysis pipeline.

API prefix: /api/v1/dialer
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from api.database import get_db
from api.permissions import require_permission
from api.models.dialer import (
    DialerCampaign, DialerContact, DialerCall, DNCEntry,
    DialerMode, DialerCampaignStatus, CallDisposition,
)
from api.schemas.dialer import (
    DialerCampaignCreate, DialerCampaignUpdate, DialerCampaignResponse,
    DialerContactCreate, DialerContactBulkCreate,
    DialerCallComplete, DialerCallResponse,
    CampaignStatsResponse, DNCCreate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/dialer", tags=["Dialer"])


# ── Helpers ──────────────────────────────────────────────────

def _get_user_id(current_user: dict) -> int:
    raw = current_user.get("id", "")
    if isinstance(raw, int):
        return raw
    try:
        return int(raw)
    except (ValueError, TypeError):
        return 1


def _get_orm_db(conn) -> Session:
    if isinstance(conn, Session):
        return conn
    from api.database import get_session_factory
    return get_session_factory()()


def _enum_val(v) -> Optional[str]:
    if v is None:
        return None
    return v.value if hasattr(v, "value") else str(v)


def _dt_str(dt) -> Optional[str]:
    if dt is None:
        return None
    return dt.isoformat()


def _campaign_dict(c: DialerCampaign) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "description": c.description,
        "mode": _enum_val(c.mode),
        "caller_id": c.caller_id,
        "status": _enum_val(c.status),
        "start_time": c.start_time,
        "end_time": c.end_time,
        "total_contacts": c.total_contacts,
        "contacted": c.contacted,
        "connected": c.connected,
        "converted": c.converted,
        "created_at": _dt_str(c.created_at),
    }


# =====================================================================
# CAMPAIGNS
# =====================================================================


@router.get("/campaigns", summary="List dialer campaigns")
async def list_campaigns(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: dict = Depends(require_permission("voiceAI", "read")),
    db: Session = Depends(get_db),
):
    session = _get_orm_db(db)
    uid = _get_user_id(current_user)
    q = session.query(DialerCampaign).filter(DialerCampaign.user_id == uid)
    if status_filter:
        try:
            q = q.filter(DialerCampaign.status == DialerCampaignStatus(status_filter))
        except ValueError:
            pass
    total = q.count()
    items = q.order_by(DialerCampaign.created_at.desc()).offset(skip).limit(limit).all()
    return {"items": [_campaign_dict(c) for c in items], "total": total}


@router.post("/campaigns", status_code=201, summary="Create campaign")
async def create_campaign(
    body: DialerCampaignCreate,
    current_user: dict = Depends(require_permission("voiceAI", "create")),
    db: Session = Depends(get_db),
):
    session = _get_orm_db(db)
    uid = _get_user_id(current_user)
    campaign = DialerCampaign(
        user_id=uid,
        name=body.name,
        description=body.description,
        mode=DialerMode(body.mode),
        caller_id=body.caller_id,
        start_time=body.start_time,
        end_time=body.end_time,
        days_of_week=body.days_of_week,
        max_attempts_per_contact=body.max_attempts_per_contact,
        retry_interval_minutes=body.retry_interval_minutes,
        max_concurrent_calls=body.max_concurrent_calls,
        script_template=body.script_template,
    )
    session.add(campaign)
    session.commit()
    session.refresh(campaign)
    return _campaign_dict(campaign)


@router.get("/campaigns/{campaign_id}", summary="Get campaign")
async def get_campaign(
    campaign_id: int,
    current_user: dict = Depends(require_permission("voiceAI", "read")),
    db: Session = Depends(get_db),
):
    session = _get_orm_db(db)
    uid = _get_user_id(current_user)
    c = session.query(DialerCampaign).filter(
        DialerCampaign.id == campaign_id, DialerCampaign.user_id == uid,
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return _campaign_dict(c)


@router.put("/campaigns/{campaign_id}", summary="Update campaign")
async def update_campaign(
    campaign_id: int,
    body: DialerCampaignUpdate,
    current_user: dict = Depends(require_permission("voiceAI", "update")),
    db: Session = Depends(get_db),
):
    session = _get_orm_db(db)
    uid = _get_user_id(current_user)
    c = session.query(DialerCampaign).filter(
        DialerCampaign.id == campaign_id, DialerCampaign.user_id == uid,
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    updates = body.model_dump(exclude_unset=True)
    if "mode" in updates and updates["mode"]:
        updates["mode"] = DialerMode(updates["mode"])
    if "status" in updates and updates["status"]:
        updates["status"] = DialerCampaignStatus(updates["status"])
    for key, val in updates.items():
        setattr(c, key, val)
    session.commit()
    session.refresh(c)
    return _campaign_dict(c)


@router.delete("/campaigns/{campaign_id}", status_code=204, summary="Delete campaign")
async def delete_campaign(
    campaign_id: int,
    current_user: dict = Depends(require_permission("voiceAI", "delete")),
    db: Session = Depends(get_db),
):
    session = _get_orm_db(db)
    uid = _get_user_id(current_user)
    c = session.query(DialerCampaign).filter(
        DialerCampaign.id == campaign_id, DialerCampaign.user_id == uid,
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    session.delete(c)
    session.commit()


# =====================================================================
# CONTACTS
# =====================================================================


@router.post("/campaigns/{campaign_id}/contacts", status_code=201, summary="Add contacts to campaign")
async def add_contacts(
    campaign_id: int,
    body: DialerContactBulkCreate,
    current_user: dict = Depends(require_permission("voiceAI", "create")),
    db: Session = Depends(get_db),
):
    session = _get_orm_db(db)
    uid = _get_user_id(current_user)
    c = session.query(DialerCampaign).filter(
        DialerCampaign.id == campaign_id, DialerCampaign.user_id == uid,
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")

    added = 0
    for item in body.contacts:
        contact = DialerContact(
            campaign_id=campaign_id,
            phone=item.phone,
            name=item.name,
            email=item.email,
            priority=item.priority,
            custom_fields=item.custom_fields,
            lead_id=item.lead_id,
        )
        session.add(contact)
        added += 1

    c.total_contacts += added
    session.commit()
    return {"added": added, "total_contacts": c.total_contacts}


@router.get("/campaigns/{campaign_id}/contacts", summary="List campaign contacts")
async def list_contacts(
    campaign_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    completed: Optional[bool] = None,
    current_user: dict = Depends(require_permission("voiceAI", "read")),
    db: Session = Depends(get_db),
):
    session = _get_orm_db(db)
    uid = _get_user_id(current_user)
    # Verify campaign ownership
    c = session.query(DialerCampaign).filter(
        DialerCampaign.id == campaign_id, DialerCampaign.user_id == uid,
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")

    q = session.query(DialerContact).filter(DialerContact.campaign_id == campaign_id)
    if completed is not None:
        q = q.filter(DialerContact.is_completed == completed)
    total = q.count()
    items = q.order_by(DialerContact.priority.desc()).offset(skip).limit(limit).all()
    return {
        "items": [
            {
                "id": ct.id, "phone": ct.phone, "name": ct.name, "email": ct.email,
                "priority": ct.priority, "attempt_count": ct.attempt_count,
                "last_disposition": _enum_val(ct.last_disposition),
                "is_completed": ct.is_completed, "is_dnc": ct.is_dnc,
            }
            for ct in items
        ],
        "total": total,
    }


# =====================================================================
# CALLS
# =====================================================================


@router.post("/campaigns/{campaign_id}/calls/{contact_id}/initiate", summary="Initiate a call")
async def initiate_call(
    campaign_id: int,
    contact_id: int,
    request: Request,
    current_user: dict = Depends(require_permission("voiceAI", "create")),
    db: Session = Depends(get_db),
):
    """Initiate an outbound call for a campaign contact via telephony provider."""
    session = _get_orm_db(db)
    uid = _get_user_id(current_user)

    campaign = session.query(DialerCampaign).filter(
        DialerCampaign.id == campaign_id, DialerCampaign.user_id == uid,
    ).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    contact = session.query(DialerContact).filter(
        DialerContact.id == contact_id, DialerContact.campaign_id == campaign_id,
    ).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    if contact.is_dnc:
        raise HTTPException(status_code=400, detail="Contact is on DNC list")
    if contact.is_completed:
        raise HTTPException(status_code=400, detail="Contact already completed")

    # Create call record
    call = DialerCall(
        campaign_id=campaign_id,
        contact_id=contact_id,
        agent_id=uid,
        phone=contact.phone,
        caller_id=campaign.caller_id,
    )
    session.add(call)

    # Update contact attempt
    contact.attempt_count += 1

    session.commit()
    session.refresh(call)

    # Try to make the actual call via telephony
    try:
        from integrations.telephony.telephony_providers import telephony_manager
        result = await telephony_manager.make_call(
            from_number=campaign.caller_id or "",
            to_number=contact.phone,
            record=True,
        )
        if result.get("call_id"):
            call.provider_call_id = result["call_id"]
            call.provider = result.get("provider", "telecmi")
            session.commit()
    except Exception as exc:
        logger.warning("Telephony call initiation failed: %s", exc)

    return {
        "call_id": call.id,
        "phone": call.phone,
        "provider_call_id": call.provider_call_id,
        "status": "initiated",
    }


@router.post("/calls/{call_id}/complete", summary="Complete a call with disposition")
async def complete_call(
    call_id: int,
    body: DialerCallComplete,
    request: Request,
    current_user: dict = Depends(require_permission("voiceAI", "update")),
    db: Session = Depends(get_db),
):
    """Mark a call as complete with disposition. Triggers voice analysis if recording exists."""
    session = _get_orm_db(db)
    uid = _get_user_id(current_user)

    call = session.query(DialerCall).filter(DialerCall.id == call_id).first()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    # Verify ownership
    campaign = session.query(DialerCampaign).filter(
        DialerCampaign.id == call.campaign_id, DialerCampaign.user_id == uid,
    ).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    try:
        call.disposition = CallDisposition(body.disposition)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid disposition: {body.disposition}")

    call.notes = body.notes
    call.duration_seconds = body.duration_seconds
    call.recording_url = body.recording_url

    # Update contact
    contact = session.query(DialerContact).filter(DialerContact.id == call.contact_id).first()
    if contact:
        contact.last_disposition = call.disposition
        if call.disposition in (
            CallDisposition.CONNECTED, CallDisposition.SALE,
            CallDisposition.NOT_INTERESTED, CallDisposition.DNC,
            CallDisposition.WRONG_NUMBER,
        ):
            contact.is_completed = True
        if call.disposition == CallDisposition.DNC:
            contact.is_dnc = True

    # Update campaign stats
    campaign.contacted += 1
    if call.disposition == CallDisposition.CONNECTED:
        campaign.connected += 1
    if call.disposition == CallDisposition.SALE:
        campaign.converted += 1

    session.commit()

    # Trigger voice analysis on recording if available
    analysis_result = None
    if call.recording_url and call.duration_seconds > 2:
        try:
            from api.services.call_processing_service import process_call_recording
            voice_engine = getattr(request.app.state, "voice_engine", None)
            result = await process_call_recording(
                db=session,
                voice_engine=voice_engine,
                recording_url=call.recording_url,
                phone_number=call.phone,
                call_direction="outbound",
                provider=call.provider,
                provider_call_id=call.provider_call_id,
                user_id=uid,
                duration_seconds=call.duration_seconds,
            )
            if result:
                call.transcription = result.get("transcription")
                call.emotion = result.get("emotion")
                call.intent = result.get("intent")
                call.lead_score = result.get("lead_score")
                call.voice_analysis_id = result.get("analysis_id")
                session.commit()
                analysis_result = result
        except Exception as exc:
            logger.warning("Voice analysis for dialer call %s failed: %s", call_id, exc)

    return {
        "call_id": call.id,
        "disposition": _enum_val(call.disposition),
        "voice_analysis": analysis_result,
    }


@router.get("/campaigns/{campaign_id}/calls", summary="List calls for campaign")
async def list_calls(
    campaign_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    disposition: Optional[str] = None,
    current_user: dict = Depends(require_permission("voiceAI", "read")),
    db: Session = Depends(get_db),
):
    session = _get_orm_db(db)
    uid = _get_user_id(current_user)
    campaign = session.query(DialerCampaign).filter(
        DialerCampaign.id == campaign_id, DialerCampaign.user_id == uid,
    ).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    q = session.query(DialerCall).filter(DialerCall.campaign_id == campaign_id)
    if disposition:
        try:
            q = q.filter(DialerCall.disposition == CallDisposition(disposition))
        except ValueError:
            pass
    total = q.count()
    items = q.order_by(DialerCall.created_at.desc()).offset(skip).limit(limit).all()
    return {
        "items": [
            {
                "id": cl.id, "contact_id": cl.contact_id, "phone": cl.phone,
                "disposition": _enum_val(cl.disposition), "duration_seconds": cl.duration_seconds,
                "recording_url": cl.recording_url, "transcription": cl.transcription,
                "emotion": cl.emotion, "intent": cl.intent, "lead_score": cl.lead_score,
                "notes": cl.notes, "created_at": _dt_str(cl.created_at),
            }
            for cl in items
        ],
        "total": total,
    }


# =====================================================================
# CAMPAIGN STATS
# =====================================================================


@router.get("/campaigns/{campaign_id}/stats", summary="Campaign statistics")
async def campaign_stats(
    campaign_id: int,
    current_user: dict = Depends(require_permission("voiceAI", "read")),
    db: Session = Depends(get_db),
):
    session = _get_orm_db(db)
    uid = _get_user_id(current_user)
    c = session.query(DialerCampaign).filter(
        DialerCampaign.id == campaign_id, DialerCampaign.user_id == uid,
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")

    agg = session.query(
        func.coalesce(func.avg(DialerCall.lead_score), 0.0),
        func.coalesce(func.avg(DialerCall.duration_seconds), 0.0),
    ).filter(DialerCall.campaign_id == campaign_id).first()

    total = c.total_contacts or 1
    return {
        "campaign_id": c.id,
        "total_contacts": c.total_contacts,
        "contacted": c.contacted,
        "connected": c.connected,
        "converted": c.converted,
        "completion_rate": round(c.contacted / total * 100, 1),
        "connection_rate": round(c.connected / max(c.contacted, 1) * 100, 1),
        "conversion_rate": round(c.converted / max(c.connected, 1) * 100, 1),
        "avg_lead_score": round(float(agg[0]), 2) if agg else None,
        "avg_duration": round(float(agg[1]), 1) if agg else None,
    }


# =====================================================================
# DNC LIST
# =====================================================================


@router.post("/dnc", status_code=201, summary="Add to DNC list")
async def add_dnc(
    body: DNCCreate,
    current_user: dict = Depends(require_permission("voiceAI", "create")),
    db: Session = Depends(get_db),
):
    session = _get_orm_db(db)
    uid = _get_user_id(current_user)
    existing = session.query(DNCEntry).filter(
        DNCEntry.user_id == uid, DNCEntry.phone == body.phone,
    ).first()
    if existing:
        return {"message": "Already on DNC list", "id": existing.id}
    entry = DNCEntry(user_id=uid, phone=body.phone, reason=body.reason)
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return {"id": entry.id, "phone": entry.phone}


@router.get("/dnc", summary="List DNC entries")
async def list_dnc(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(require_permission("voiceAI", "read")),
    db: Session = Depends(get_db),
):
    session = _get_orm_db(db)
    uid = _get_user_id(current_user)
    q = session.query(DNCEntry).filter(DNCEntry.user_id == uid)
    total = q.count()
    items = q.offset(skip).limit(limit).all()
    return {
        "items": [{"id": e.id, "phone": e.phone, "reason": e.reason} for e in items],
        "total": total,
    }


@router.delete("/dnc/{phone}", status_code=204, summary="Remove from DNC")
async def remove_dnc(
    phone: str,
    current_user: dict = Depends(require_permission("voiceAI", "delete")),
    db: Session = Depends(get_db),
):
    session = _get_orm_db(db)
    uid = _get_user_id(current_user)
    entry = session.query(DNCEntry).filter(DNCEntry.user_id == uid, DNCEntry.phone == phone).first()
    if not entry:
        raise HTTPException(status_code=404, detail="DNC entry not found")
    session.delete(entry)
    session.commit()
