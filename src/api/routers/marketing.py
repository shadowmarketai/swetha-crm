"""
VoiceFlow Marketing AI - Marketing Router
==========================================
Marketing automation triggers and audience management.

Trigger marketing campaigns based on voice insights (async).
Build audience segments from voice analysis data.
"""

import logging
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func, and_, case, distinct
from sqlalchemy.orm import Session

from api.database import get_db
from api.permissions import require_permission
from api.models.campaign import (
    Campaign,
    CampaignStatus as ModelCampaignStatus,
)
from api.models.voice import VoiceAnalysis, EmotionType, IntentType, DialectType
from api.models.crm import Lead, LeadStatus

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/marketing", tags=["Marketing"])


# ── Request / Response Schemas ───────────────────────────────────


class MarketingTriggerRequest(BaseModel):
    """Request to trigger a marketing campaign from voice insights."""

    campaign_id: int = Field(..., description="Campaign to trigger")
    trigger_type: str = Field(
        ...,
        description="Trigger type: emotion_based, intent_based, dialect_based, score_based",
    )
    criteria: dict[str, Any] = Field(
        default_factory=dict,
        description="Filter criteria, e.g. {'emotions': ['angry'], 'min_score': 70}",
    )
    message_override: Optional[str] = Field(
        default=None,
        max_length=5000,
        description="Override campaign message template",
    )

    @field_validator("trigger_type")
    @classmethod
    def validate_trigger_type(cls, v: str) -> str:
        allowed = {"emotion_based", "intent_based", "dialect_based", "score_based"}
        if v not in allowed:
            raise ValueError(f"trigger_type must be one of {allowed}")
        return v

    model_config = ConfigDict(from_attributes=True)


class MarketingTriggerResponse(BaseModel):
    """Response after enqueueing a marketing trigger."""

    message: str
    campaign_id: int
    trigger_type: str
    matched_leads: int
    status: str = "queued"

    model_config = ConfigDict(from_attributes=True)


class AudiencePreviewRequest(BaseModel):
    """Preview audience size for given criteria."""

    audience_type: str = Field(
        ...,
        description="emotion_based, intent_based, dialect_based, score_based",
    )
    criteria: dict[str, Any] = Field(
        default_factory=dict,
        description="Filter criteria",
    )

    @field_validator("audience_type")
    @classmethod
    def validate_audience_type(cls, v: str) -> str:
        allowed = {"emotion_based", "intent_based", "dialect_based", "score_based"}
        if v not in allowed:
            raise ValueError(f"audience_type must be one of {allowed}")
        return v

    model_config = ConfigDict(from_attributes=True)


class AudienceSegment(BaseModel):
    """An audience segment descriptor."""

    segment_id: str
    name: str
    description: str
    size: int
    criteria: dict[str, Any]

    model_config = ConfigDict(from_attributes=True)


class MetricsResponse(BaseModel):
    """Cross-campaign performance metrics."""

    total_campaigns: int = 0
    active_campaigns: int = 0
    total_budget: float = 0.0
    total_spent: float = 0.0
    total_impressions: int = 0
    total_clicks: int = 0
    total_conversions: int = 0
    overall_ctr: float = 0.0
    overall_conversion_rate: float = 0.0
    overall_roi: float = 0.0
    by_platform: list[dict[str, Any]] = []

    model_config = ConfigDict(from_attributes=True)


# ── Helpers ───────────────────────────────────────────────────────


def _get_user_id(current_user: dict) -> int:
    raw = current_user.get("id", 1)
    if isinstance(raw, int):
        return raw
    try:
        return int(raw)
    except (ValueError, TypeError):
        return 1


def _build_audience_query(
    db: Session,
    user_id: int,
    audience_type: str,
    criteria: dict[str, Any],
):
    """Build a query for leads matching the audience criteria.

    Uses VoiceAnalysis data joined to leads for filtering.
    Returns a query of Lead objects.
    """
    query = (
        db.query(Lead)
        .join(VoiceAnalysis, VoiceAnalysis.lead_id == Lead.id, isouter=True)
        .filter(Lead.user_id == user_id)
    )

    if audience_type == "emotion_based":
        emotions = criteria.get("emotions", [])
        if emotions:
            emotion_enums = []
            for e in emotions:
                try:
                    emotion_enums.append(EmotionType(e))
                except ValueError:
                    continue
            if emotion_enums:
                query = query.filter(VoiceAnalysis.emotion.in_(emotion_enums))

    elif audience_type == "intent_based":
        intents = criteria.get("intents", [])
        if intents:
            intent_enums = []
            for i in intents:
                try:
                    intent_enums.append(IntentType(i))
                except ValueError:
                    continue
            if intent_enums:
                query = query.filter(VoiceAnalysis.intent.in_(intent_enums))

    elif audience_type == "dialect_based":
        dialects = criteria.get("dialects", [])
        if dialects:
            dialect_enums = []
            for d in dialects:
                try:
                    dialect_enums.append(DialectType(d))
                except ValueError:
                    continue
            if dialect_enums:
                query = query.filter(VoiceAnalysis.dialect.in_(dialect_enums))

    elif audience_type == "score_based":
        min_score = criteria.get("min_score", 0)
        max_score = criteria.get("max_score", 100)
        query = query.filter(
            VoiceAnalysis.lead_score >= min_score,
            VoiceAnalysis.lead_score <= max_score,
        )

    # Additional general filters
    if "lead_status" in criteria:
        statuses = criteria["lead_status"]
        if isinstance(statuses, list):
            status_enums = []
            for s in statuses:
                try:
                    status_enums.append(LeadStatus(s))
                except ValueError:
                    continue
            if status_enums:
                query = query.filter(Lead.status.in_(status_enums))

    return query.distinct()


def _execute_trigger_background(
    campaign_id: int,
    trigger_type: str,
    criteria: dict,
    matched_lead_ids: list[int],
    message_override: Optional[str],
    user_id: int,
) -> None:
    """Background task that 'sends' the marketing trigger.

    In production this would dispatch to Meta Ads API, Google Ads API,
    WhatsApp Business API, or an email/SMS provider.  For now it logs
    the action and records an analytics event.
    """
    logger.info(
        "Marketing trigger executing: campaign=%s type=%s leads=%d user=%s",
        campaign_id,
        trigger_type,
        len(matched_lead_ids),
        user_id,
    )
    # Future: dispatch to integration layer
    # from integrations.marketing.meta_ads import MetaAdsClient
    # from integrations.marketing.google_ads import GoogleAdsClient
    # etc.


# ── POST /trigger — Trigger marketing campaign ──────────────────


@router.post(
    "/trigger",
    response_model=MarketingTriggerResponse,
    summary="Trigger marketing campaign",
)
async def trigger_campaign(
    body: MarketingTriggerRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("marketing", "create")),
) -> MarketingTriggerResponse:
    """Trigger a marketing campaign based on voice insights.

    The audience is computed from voice analysis data, and the actual
    dispatch happens asynchronously in the background.
    """
    user_id = _get_user_id(current_user)

    # Verify campaign exists and belongs to user
    campaign = (
        db.query(Campaign)
        .filter(
            Campaign.id == body.campaign_id,
            Campaign.user_id == user_id,
            Campaign.is_deleted == False,  # noqa: E712
        )
        .first()
    )
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaign {body.campaign_id} not found",
        )

    # Build audience
    audience_query = _build_audience_query(db, user_id, body.trigger_type, body.criteria)
    matched_leads = audience_query.all()
    matched_lead_ids = [lead.id for lead in matched_leads]

    if not matched_lead_ids:
        return MarketingTriggerResponse(
            message="No leads matched the criteria",
            campaign_id=body.campaign_id,
            trigger_type=body.trigger_type,
            matched_leads=0,
            status="no_match",
        )

    # Update campaign audience size
    campaign.audience_size = len(matched_lead_ids)
    campaign.audience_criteria = body.criteria
    campaign.audience_type = body.trigger_type
    db.commit()
    db.refresh(campaign)

    # Enqueue background processing
    background_tasks.add_task(
        _execute_trigger_background,
        campaign_id=body.campaign_id,
        trigger_type=body.trigger_type,
        criteria=body.criteria,
        matched_lead_ids=matched_lead_ids,
        message_override=body.message_override,
        user_id=user_id,
    )

    logger.info(
        "Marketing trigger queued: campaign=%s type=%s leads=%d",
        body.campaign_id,
        body.trigger_type,
        len(matched_lead_ids),
    )

    return MarketingTriggerResponse(
        message="Marketing trigger queued successfully",
        campaign_id=body.campaign_id,
        trigger_type=body.trigger_type,
        matched_leads=len(matched_lead_ids),
        status="queued",
    )


# ── GET /metrics — Cross-campaign performance metrics ────────────


@router.get(
    "/metrics",
    response_model=MetricsResponse,
    summary="Cross-campaign performance metrics",
)
async def get_marketing_metrics(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("marketing", "read")),
) -> MetricsResponse:
    """Aggregate performance metrics across all campaigns."""
    user_id = _get_user_id(current_user)

    base_filter = and_(
        Campaign.user_id == user_id,
        Campaign.is_deleted == False,  # noqa: E712
    )

    # Aggregate totals
    totals = (
        db.query(
            func.count(Campaign.id).label("total"),
            func.sum(case((Campaign.status == ModelCampaignStatus.ACTIVE, 1), else_=0)).label("active"),
            func.coalesce(func.sum(Campaign.budget), 0).label("budget"),
            func.coalesce(func.sum(Campaign.spent), 0).label("spent"),
            func.coalesce(func.sum(Campaign.impressions), 0).label("impressions"),
            func.coalesce(func.sum(Campaign.clicks), 0).label("clicks"),
            func.coalesce(func.sum(Campaign.conversions), 0).label("conversions"),
        )
        .filter(base_filter)
        .first()
    )

    total_campaigns = totals.total or 0
    active_campaigns = totals.active or 0
    total_budget = float(totals.budget or 0)
    total_spent = float(totals.spent or 0)
    total_impressions = int(totals.impressions or 0)
    total_clicks = int(totals.clicks or 0)
    total_conversions = int(totals.conversions or 0)

    overall_ctr = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0.0
    overall_cvr = (total_conversions / total_clicks * 100) if total_clicks > 0 else 0.0
    overall_roi = ((total_conversions * 100 - total_spent) / total_spent * 100) if total_spent > 0 else 0.0

    # Per-platform breakdown
    platform_rows = (
        db.query(
            Campaign.platform,
            func.count(Campaign.id).label("count"),
            func.coalesce(func.sum(Campaign.spent), 0).label("spent"),
            func.coalesce(func.sum(Campaign.impressions), 0).label("impressions"),
            func.coalesce(func.sum(Campaign.clicks), 0).label("clicks"),
            func.coalesce(func.sum(Campaign.conversions), 0).label("conversions"),
        )
        .filter(base_filter)
        .group_by(Campaign.platform)
        .all()
    )

    by_platform = []
    for row in platform_rows:
        platform_name = row.platform.value if row.platform else "unknown"
        impr = int(row.impressions or 0)
        clk = int(row.clicks or 0)
        conv = int(row.conversions or 0)
        by_platform.append({
            "platform": platform_name,
            "campaigns": row.count,
            "spent": float(row.spent or 0),
            "impressions": impr,
            "clicks": clk,
            "conversions": conv,
            "ctr": round(clk / impr * 100, 2) if impr > 0 else 0.0,
            "conversion_rate": round(conv / clk * 100, 2) if clk > 0 else 0.0,
        })

    return MetricsResponse(
        total_campaigns=total_campaigns,
        active_campaigns=active_campaigns,
        total_budget=total_budget,
        total_spent=total_spent,
        total_impressions=total_impressions,
        total_clicks=total_clicks,
        total_conversions=total_conversions,
        overall_ctr=round(overall_ctr, 2),
        overall_conversion_rate=round(overall_cvr, 2),
        overall_roi=round(overall_roi, 2),
        by_platform=by_platform,
    )


# ── GET /audiences — Get audience segments from voice data ───────


@router.get(
    "/audiences",
    response_model=list[AudienceSegment],
    summary="Get audience segments",
)
async def get_audience_segments(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("marketing", "read")),
) -> list[AudienceSegment]:
    """Get pre-built audience segments based on voice analysis data."""
    user_id = _get_user_id(current_user)

    segments: list[AudienceSegment] = []

    # Emotion-based segments
    emotion_counts = (
        db.query(VoiceAnalysis.emotion, func.count(distinct(VoiceAnalysis.lead_id)))
        .filter(
            VoiceAnalysis.user_id == user_id,
            VoiceAnalysis.lead_id.isnot(None),
            VoiceAnalysis.emotion.isnot(None),
        )
        .group_by(VoiceAnalysis.emotion)
        .all()
    )
    for emotion_val, count in emotion_counts:
        if emotion_val is None:
            continue
        emotion_name = emotion_val.value if hasattr(emotion_val, "value") else str(emotion_val)
        segments.append(AudienceSegment(
            segment_id=f"emotion_{emotion_name}",
            name=f"{emotion_name.title()} Callers",
            description=f"Leads whose most recent voice analysis detected '{emotion_name}' emotion",
            size=count,
            criteria={"audience_type": "emotion_based", "emotions": [emotion_name]},
        ))

    # Intent-based segments
    intent_counts = (
        db.query(VoiceAnalysis.intent, func.count(distinct(VoiceAnalysis.lead_id)))
        .filter(
            VoiceAnalysis.user_id == user_id,
            VoiceAnalysis.lead_id.isnot(None),
            VoiceAnalysis.intent.isnot(None),
        )
        .group_by(VoiceAnalysis.intent)
        .all()
    )
    for intent_val, count in intent_counts:
        if intent_val is None:
            continue
        intent_name = intent_val.value if hasattr(intent_val, "value") else str(intent_val)
        segments.append(AudienceSegment(
            segment_id=f"intent_{intent_name}",
            name=f"{intent_name.replace('_', ' ').title()} Intent",
            description=f"Leads with '{intent_name}' marketing intent",
            size=count,
            criteria={"audience_type": "intent_based", "intents": [intent_name]},
        ))

    # Score-based segments
    score_ranges = [
        ("high_score", "High Score Leads", "Leads with voice lead score >= 70", 70, 100),
        ("medium_score", "Medium Score Leads", "Leads with voice lead score 40-69", 40, 69),
        ("low_score", "Low Score Leads", "Leads with voice lead score < 40", 0, 39),
    ]
    for seg_id, name, desc, min_s, max_s in score_ranges:
        count = (
            db.query(func.count(distinct(VoiceAnalysis.lead_id)))
            .filter(
                VoiceAnalysis.user_id == user_id,
                VoiceAnalysis.lead_id.isnot(None),
                VoiceAnalysis.lead_score >= min_s,
                VoiceAnalysis.lead_score <= max_s,
            )
            .scalar()
        ) or 0
        if count > 0:
            segments.append(AudienceSegment(
                segment_id=seg_id,
                name=name,
                description=desc,
                size=count,
                criteria={"audience_type": "score_based", "min_score": min_s, "max_score": max_s},
            ))

    # Dialect-based segments
    dialect_counts = (
        db.query(VoiceAnalysis.dialect, func.count(distinct(VoiceAnalysis.lead_id)))
        .filter(
            VoiceAnalysis.user_id == user_id,
            VoiceAnalysis.lead_id.isnot(None),
            VoiceAnalysis.dialect.isnot(None),
            VoiceAnalysis.dialect != DialectType.UNKNOWN,
        )
        .group_by(VoiceAnalysis.dialect)
        .all()
    )
    for dialect_val, count in dialect_counts:
        if dialect_val is None:
            continue
        dialect_name = dialect_val.value if hasattr(dialect_val, "value") else str(dialect_val)
        segments.append(AudienceSegment(
            segment_id=f"dialect_{dialect_name}",
            name=f"{dialect_name.replace('_', ' ').title()} Speakers",
            description=f"Leads speaking '{dialect_name}' dialect",
            size=count,
            criteria={"audience_type": "dialect_based", "dialects": [dialect_name]},
        ))

    return segments


# ── POST /audiences/preview — Preview audience size ──────────────


@router.post(
    "/audiences/preview",
    summary="Preview audience size",
)
async def preview_audience(
    body: AudiencePreviewRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("marketing", "read")),
) -> dict:
    """Preview the audience size for given criteria without triggering any campaign."""
    user_id = _get_user_id(current_user)
    audience_query = _build_audience_query(db, user_id, body.audience_type, body.criteria)
    count = audience_query.count()

    return {
        "audience_type": body.audience_type,
        "criteria": body.criteria,
        "estimated_size": count,
    }
