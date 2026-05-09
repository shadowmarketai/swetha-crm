"""
Swetha Structures CRM - Analytics Router
==========================================
Analytics: summary metrics, campaign comparisons, lead funnels,
time-series trends, custom queries, CSV export.

Voice analytics (emotions, intents, dialects) are produced by the external
VoiceFlow SaaS and surfaced per-lead via the /voiceflow endpoints.
"""

import csv
import io
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, case, extract, cast, Date
from sqlalchemy.orm import Session

from api.database import get_db
from api.permissions import require_permission
from api.models.analytics import AnalyticsEvent
from api.models.campaign import Campaign, CampaignStatus as ModelCampaignStatus
from api.models.crm import Lead, LeadStatus, Deal, DealStage
from api.models.voiceflow import VoiceflowConversation

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/analytics", tags=["Analytics"])


# ── Response Schemas ─────────────────────────────────────────────


class SummaryResponse(BaseModel):
    """Overview metrics."""

    total_calls: int = 0
    total_leads: int = 0
    total_conversions: int = 0
    total_revenue: float = 0.0
    active_campaigns: int = 0
    avg_lead_score: float = 0.0
    avg_sentiment: float = 0.0
    total_voiceflow_conversations: int = 0

    model_config = ConfigDict(from_attributes=True)


class CampaignAnalytics(BaseModel):
    campaign_id: int
    name: str
    status: str
    platform: Optional[str] = None
    budget: float = 0.0
    spent: float = 0.0
    impressions: int = 0
    clicks: int = 0
    conversions: int = 0
    ctr: float = 0.0
    conversion_rate: float = 0.0
    roi: float = 0.0

    model_config = ConfigDict(from_attributes=True)


class FunnelStage(BaseModel):
    stage: str
    count: int
    percentage: float

    model_config = ConfigDict(from_attributes=True)


class TrendDataPoint(BaseModel):
    date: str
    calls: int = 0
    leads: int = 0
    conversions: int = 0
    revenue: float = 0.0

    model_config = ConfigDict(from_attributes=True)


class CustomQueryRequest(BaseModel):
    """Flexible analytics query."""

    event_type: Optional[str] = Field(default=None, description="Filter by event type")
    event_category: Optional[str] = Field(default=None, description="Filter by category: voice, crm, marketing, billing")
    date_from: Optional[str] = Field(default=None, description="Start date (ISO 8601)")
    date_to: Optional[str] = Field(default=None, description="End date (ISO 8601)")
    group_by: Optional[str] = Field(
        default=None,
        description="Group by: event_type, event_category, day, week, month",
    )
    limit: int = Field(default=100, ge=1, le=1000)

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


def _parse_date_range(
    date_from: Optional[str],
    date_to: Optional[str],
    default_days: int = 30,
) -> tuple[datetime, datetime]:
    """Parse date range from query parameters, defaulting to last N days."""
    now = datetime.now(timezone.utc)
    if date_to:
        try:
            end = datetime.fromisoformat(date_to)
        except ValueError:
            end = now
    else:
        end = now

    if date_from:
        try:
            start = datetime.fromisoformat(date_from)
        except ValueError:
            start = end - timedelta(days=default_days)
    else:
        start = end - timedelta(days=default_days)

    return start, end


def _conversations_for_user_query(db: Session, user_id: int):
    """Query VoiceflowConversation joined to Lead so we can filter by tenant user."""
    return (
        db.query(VoiceflowConversation)
        .join(Lead, VoiceflowConversation.lead_id == Lead.id)
        .filter(Lead.user_id == user_id)
    )


# ── GET /summary — Overview metrics ──────────────────────────────


@router.get(
    "/summary",
    response_model=SummaryResponse,
    summary="Overview metrics",
)
async def get_summary(
    date_from: Optional[str] = Query(None, description="Start date (ISO 8601)"),
    date_to: Optional[str] = Query(None, description="End date (ISO 8601)"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("analytics", "read")),
) -> SummaryResponse:
    """Get overview metrics: total calls, leads, conversions, revenue."""
    user_id = _get_user_id(current_user)
    start, end = _parse_date_range(date_from, date_to)

    # VoiceFlow conversations = calls
    total_calls = (
        db.query(func.count(VoiceflowConversation.id))
        .join(Lead, VoiceflowConversation.lead_id == Lead.id)
        .filter(
            Lead.user_id == user_id,
            VoiceflowConversation.created_at >= start,
            VoiceflowConversation.created_at <= end,
        )
        .scalar()
    ) or 0

    # Leads
    total_leads = (
        db.query(func.count(Lead.id))
        .filter(
            Lead.user_id == user_id,
            Lead.created_at >= start,
            Lead.created_at <= end,
        )
        .scalar()
    ) or 0

    # Conversions (leads that reached WON status)
    total_conversions = (
        db.query(func.count(Lead.id))
        .filter(
            Lead.user_id == user_id,
            Lead.status == LeadStatus.WON,
            Lead.created_at >= start,
            Lead.created_at <= end,
        )
        .scalar()
    ) or 0

    # Revenue from won deals
    total_revenue = (
        db.query(func.coalesce(func.sum(Deal.deal_value), 0))
        .filter(
            Deal.user_id == user_id,
            Deal.stage == DealStage.CLOSED_WON,
            Deal.created_at >= start,
            Deal.created_at <= end,
        )
        .scalar()
    ) or 0.0

    # Active campaigns
    active_campaigns = (
        db.query(func.count(Campaign.id))
        .filter(
            Campaign.user_id == user_id,
            Campaign.status == ModelCampaignStatus.ACTIVE,
            Campaign.is_deleted == False,  # noqa: E712
        )
        .scalar()
    ) or 0

    # Average lead score from Lead model; average sentiment from VoiceFlow conversations
    avg_lead_score = (
        db.query(func.coalesce(func.avg(Lead.lead_score), 0))
        .filter(Lead.user_id == user_id)
        .scalar()
    ) or 0.0

    avg_sentiment = (
        db.query(func.coalesce(func.avg(VoiceflowConversation.sentiment), 0))
        .join(Lead, VoiceflowConversation.lead_id == Lead.id)
        .filter(
            Lead.user_id == user_id,
            VoiceflowConversation.created_at >= start,
            VoiceflowConversation.created_at <= end,
        )
        .scalar()
    ) or 0.0

    return SummaryResponse(
        total_calls=total_calls,
        total_leads=total_leads,
        total_conversions=total_conversions,
        total_revenue=float(total_revenue),
        active_campaigns=active_campaigns,
        avg_lead_score=round(float(avg_lead_score), 2),
        avg_sentiment=round(float(avg_sentiment), 2),
        total_voiceflow_conversations=total_calls,
    )


# ── GET /campaigns — Campaign performance comparison ─────────────


@router.get(
    "/campaigns",
    response_model=list[CampaignAnalytics],
    summary="Campaign performance comparison",
)
async def get_campaign_analytics(
    limit: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("analytics", "read")),
) -> list[CampaignAnalytics]:
    """Compare performance across campaigns."""
    user_id = _get_user_id(current_user)

    query = db.query(Campaign).filter(
        Campaign.user_id == user_id,
        Campaign.is_deleted == False,  # noqa: E712
    )

    if status_filter:
        try:
            model_status = ModelCampaignStatus(status_filter)
            query = query.filter(Campaign.status == model_status)
        except ValueError:
            pass

    campaigns = (
        query.order_by(Campaign.created_at.desc())
        .limit(limit)
        .all()
    )

    results = []
    for c in campaigns:
        impr = c.impressions or 0
        clicks = c.clicks or 0
        conv = c.conversions or 0
        spent = c.spent or 0.0
        budget = c.budget or 0.0

        ctr = (clicks / impr * 100) if impr > 0 else 0.0
        cvr = (conv / clicks * 100) if clicks > 0 else 0.0
        roi = ((conv * 100 - spent) / spent * 100) if spent > 0 else 0.0

        results.append(CampaignAnalytics(
            campaign_id=c.id,
            name=c.name,
            status=c.status.value if c.status else "draft",
            platform=c.platform.value if c.platform else None,
            budget=budget,
            spent=spent,
            impressions=impr,
            clicks=clicks,
            conversions=conv,
            ctr=round(ctr, 2),
            conversion_rate=round(cvr, 2),
            roi=round(roi, 2),
        ))

    return results


# ── GET /leads — Lead conversion funnel metrics ──────────────────


@router.get(
    "/leads",
    response_model=list[FunnelStage],
    summary="Lead conversion funnel",
)
async def get_lead_funnel(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("analytics", "read")),
) -> list[FunnelStage]:
    """Get lead conversion funnel metrics by status."""
    user_id = _get_user_id(current_user)

    rows = (
        db.query(
            Lead.status,
            func.count(Lead.id).label("count"),
        )
        .filter(Lead.user_id == user_id)
        .group_by(Lead.status)
        .all()
    )

    total = sum(row.count for row in rows) or 1

    funnel_order = [
        LeadStatus.NEW,
        LeadStatus.CONTACTED,
        LeadStatus.QUALIFIED,
        LeadStatus.PROPOSAL,
        LeadStatus.NEGOTIATION,
        LeadStatus.WON,
        LeadStatus.LOST,
    ]

    status_counts = {row.status: row.count for row in rows}

    result = []
    for lead_status in funnel_order:
        count = status_counts.get(lead_status, 0)
        result.append(FunnelStage(
            stage=lead_status.value,
            count=count,
            percentage=round(count / total * 100, 2),
        ))

    for row in rows:
        if row.status not in funnel_order:
            status_name = row.status.value if hasattr(row.status, "value") else str(row.status)
            result.append(FunnelStage(
                stage=status_name,
                count=row.count,
                percentage=round(row.count / total * 100, 2),
            ))

    return result


# ── GET /trends — Time-series trends ─────────────────────────────


@router.get(
    "/trends",
    response_model=list[TrendDataPoint],
    summary="Time-series trends",
)
async def get_trends(
    period: str = Query("daily", description="daily, weekly, or monthly"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("analytics", "read")),
) -> list[TrendDataPoint]:
    """Get time-series trends for calls, leads, conversions, and revenue."""
    user_id = _get_user_id(current_user)

    if period == "monthly":
        default_days = 365
    elif period == "weekly":
        default_days = 90
    else:
        default_days = 30

    start, end = _parse_date_range(date_from, date_to, default_days=default_days)

    if period == "monthly":
        call_rows = (
            db.query(
                extract("year", VoiceflowConversation.created_at).label("yr"),
                extract("month", VoiceflowConversation.created_at).label("mn"),
                func.count(VoiceflowConversation.id).label("count"),
            )
            .join(Lead, VoiceflowConversation.lead_id == Lead.id)
            .filter(
                Lead.user_id == user_id,
                VoiceflowConversation.created_at >= start,
                VoiceflowConversation.created_at <= end,
            )
            .group_by("yr", "mn")
            .order_by("yr", "mn")
            .all()
        )

        lead_rows = (
            db.query(
                extract("year", Lead.created_at).label("yr"),
                extract("month", Lead.created_at).label("mn"),
                func.count(Lead.id).label("count"),
                func.sum(case((Lead.status == LeadStatus.WON, 1), else_=0)).label("conversions"),
            )
            .filter(
                Lead.user_id == user_id,
                Lead.created_at >= start,
                Lead.created_at <= end,
            )
            .group_by("yr", "mn")
            .order_by("yr", "mn")
            .all()
        )

        deal_rows = (
            db.query(
                extract("year", Deal.created_at).label("yr"),
                extract("month", Deal.created_at).label("mn"),
                func.coalesce(func.sum(Deal.deal_value), 0).label("revenue"),
            )
            .filter(
                Deal.user_id == user_id,
                Deal.stage == DealStage.CLOSED_WON,
                Deal.created_at >= start,
                Deal.created_at <= end,
            )
            .group_by("yr", "mn")
            .order_by("yr", "mn")
            .all()
        )

        data: dict[str, dict] = {}
        for row in call_rows:
            key = f"{int(row.yr):04d}-{int(row.mn):02d}"
            data.setdefault(key, {"calls": 0, "leads": 0, "conversions": 0, "revenue": 0.0})
            data[key]["calls"] = row.count
        for row in lead_rows:
            key = f"{int(row.yr):04d}-{int(row.mn):02d}"
            data.setdefault(key, {"calls": 0, "leads": 0, "conversions": 0, "revenue": 0.0})
            data[key]["leads"] = row.count
            data[key]["conversions"] = int(row.conversions or 0)
        for row in deal_rows:
            key = f"{int(row.yr):04d}-{int(row.mn):02d}"
            data.setdefault(key, {"calls": 0, "leads": 0, "conversions": 0, "revenue": 0.0})
            data[key]["revenue"] = float(row.revenue or 0)

        return [
            TrendDataPoint(date=k, **v) for k, v in sorted(data.items())
        ]

    else:
        call_rows = (
            db.query(
                cast(VoiceflowConversation.created_at, Date).label("dt"),
                func.count(VoiceflowConversation.id).label("count"),
            )
            .join(Lead, VoiceflowConversation.lead_id == Lead.id)
            .filter(
                Lead.user_id == user_id,
                VoiceflowConversation.created_at >= start,
                VoiceflowConversation.created_at <= end,
            )
            .group_by("dt")
            .order_by("dt")
            .all()
        )

        lead_rows = (
            db.query(
                cast(Lead.created_at, Date).label("dt"),
                func.count(Lead.id).label("count"),
                func.sum(case((Lead.status == LeadStatus.WON, 1), else_=0)).label("conversions"),
            )
            .filter(
                Lead.user_id == user_id,
                Lead.created_at >= start,
                Lead.created_at <= end,
            )
            .group_by("dt")
            .order_by("dt")
            .all()
        )

        deal_rows = (
            db.query(
                cast(Deal.created_at, Date).label("dt"),
                func.coalesce(func.sum(Deal.deal_value), 0).label("revenue"),
            )
            .filter(
                Deal.user_id == user_id,
                Deal.stage == DealStage.CLOSED_WON,
                Deal.created_at >= start,
                Deal.created_at <= end,
            )
            .group_by("dt")
            .order_by("dt")
            .all()
        )

        data = {}
        for row in call_rows:
            key = str(row.dt)
            data.setdefault(key, {"calls": 0, "leads": 0, "conversions": 0, "revenue": 0.0})
            data[key]["calls"] = row.count
        for row in lead_rows:
            key = str(row.dt)
            data.setdefault(key, {"calls": 0, "leads": 0, "conversions": 0, "revenue": 0.0})
            data[key]["leads"] = row.count
            data[key]["conversions"] = int(row.conversions or 0)
        for row in deal_rows:
            key = str(row.dt)
            data.setdefault(key, {"calls": 0, "leads": 0, "conversions": 0, "revenue": 0.0})
            data[key]["revenue"] = float(row.revenue or 0)

        if period == "weekly":
            weekly_data: dict[str, dict] = {}
            for date_str, vals in data.items():
                try:
                    dt = datetime.strptime(date_str, "%Y-%m-%d")
                    iso_year, iso_week, _ = dt.isocalendar()
                    week_key = f"{iso_year}-W{iso_week:02d}"
                except ValueError:
                    week_key = date_str
                weekly_data.setdefault(week_key, {"calls": 0, "leads": 0, "conversions": 0, "revenue": 0.0})
                weekly_data[week_key]["calls"] += vals["calls"]
                weekly_data[week_key]["leads"] += vals["leads"]
                weekly_data[week_key]["conversions"] += vals["conversions"]
                weekly_data[week_key]["revenue"] += vals["revenue"]
            return [TrendDataPoint(date=k, **v) for k, v in sorted(weekly_data.items())]

        return [TrendDataPoint(date=k, **v) for k, v in sorted(data.items())]


# ── POST /query — Custom analytics query ─────────────────────────


@router.post(
    "/query",
    summary="Custom analytics query",
)
async def custom_analytics_query(
    body: CustomQueryRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("analytics", "read")),
) -> dict:
    """Run a custom analytics query with flexible aggregation on the analytics_events table."""
    user_id = _get_user_id(current_user)

    query = db.query(AnalyticsEvent).filter(AnalyticsEvent.user_id == user_id)

    if body.event_type:
        query = query.filter(AnalyticsEvent.event_type == body.event_type)

    if body.event_category:
        query = query.filter(AnalyticsEvent.event_category == body.event_category)

    if body.date_from:
        try:
            dt_from = datetime.fromisoformat(body.date_from)
            query = query.filter(AnalyticsEvent.event_date >= dt_from)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date_from format",
            )

    if body.date_to:
        try:
            dt_to = datetime.fromisoformat(body.date_to)
            query = query.filter(AnalyticsEvent.event_date <= dt_to)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date_to format",
            )

    if body.group_by == "event_type":
        rows = (
            db.query(
                AnalyticsEvent.event_type,
                func.count(AnalyticsEvent.id).label("count"),
                func.coalesce(func.sum(AnalyticsEvent.value), 0).label("total_value"),
            )
            .filter(AnalyticsEvent.user_id == user_id)
            .group_by(AnalyticsEvent.event_type)
            .limit(body.limit)
            .all()
        )
        return {
            "group_by": "event_type",
            "data": [
                {"event_type": r.event_type, "count": r.count, "total_value": float(r.total_value)}
                for r in rows
            ],
        }

    elif body.group_by == "event_category":
        rows = (
            db.query(
                AnalyticsEvent.event_category,
                func.count(AnalyticsEvent.id).label("count"),
                func.coalesce(func.sum(AnalyticsEvent.value), 0).label("total_value"),
            )
            .filter(AnalyticsEvent.user_id == user_id)
            .group_by(AnalyticsEvent.event_category)
            .limit(body.limit)
            .all()
        )
        return {
            "group_by": "event_category",
            "data": [
                {"event_category": r.event_category, "count": r.count, "total_value": float(r.total_value)}
                for r in rows
            ],
        }

    elif body.group_by in ("day", "week", "month"):
        if body.group_by == "month":
            rows = (
                db.query(
                    AnalyticsEvent.year,
                    AnalyticsEvent.month,
                    func.count(AnalyticsEvent.id).label("count"),
                    func.coalesce(func.sum(AnalyticsEvent.value), 0).label("total_value"),
                )
                .filter(AnalyticsEvent.user_id == user_id)
                .group_by(AnalyticsEvent.year, AnalyticsEvent.month)
                .order_by(AnalyticsEvent.year, AnalyticsEvent.month)
                .limit(body.limit)
                .all()
            )
            return {
                "group_by": "month",
                "data": [
                    {
                        "period": f"{int(r.year or 0):04d}-{int(r.month or 0):02d}",
                        "count": r.count,
                        "total_value": float(r.total_value),
                    }
                    for r in rows
                ],
            }
        elif body.group_by == "week":
            rows = (
                db.query(
                    AnalyticsEvent.year,
                    AnalyticsEvent.week_number,
                    func.count(AnalyticsEvent.id).label("count"),
                    func.coalesce(func.sum(AnalyticsEvent.value), 0).label("total_value"),
                )
                .filter(AnalyticsEvent.user_id == user_id)
                .group_by(AnalyticsEvent.year, AnalyticsEvent.week_number)
                .order_by(AnalyticsEvent.year, AnalyticsEvent.week_number)
                .limit(body.limit)
                .all()
            )
            return {
                "group_by": "week",
                "data": [
                    {
                        "period": f"{int(r.year or 0):04d}-W{int(r.week_number or 0):02d}",
                        "count": r.count,
                        "total_value": float(r.total_value),
                    }
                    for r in rows
                ],
            }
        else:
            rows = (
                db.query(
                    cast(AnalyticsEvent.event_date, Date).label("dt"),
                    func.count(AnalyticsEvent.id).label("count"),
                    func.coalesce(func.sum(AnalyticsEvent.value), 0).label("total_value"),
                )
                .filter(AnalyticsEvent.user_id == user_id)
                .group_by("dt")
                .order_by("dt")
                .limit(body.limit)
                .all()
            )
            return {
                "group_by": "day",
                "data": [
                    {
                        "period": str(r.dt),
                        "count": r.count,
                        "total_value": float(r.total_value),
                    }
                    for r in rows
                ],
            }

    else:
        events = (
            query.order_by(AnalyticsEvent.created_at.desc())
            .limit(body.limit)
            .all()
        )
        return {
            "total": len(events),
            "data": [
                {
                    "id": e.id,
                    "event_type": e.event_type,
                    "event_name": e.event_name,
                    "event_category": e.event_category,
                    "event_action": e.event_action,
                    "properties": e.properties,
                    "value": e.value,
                    "created_at": e.created_at.isoformat() if e.created_at else None,
                }
                for e in events
            ],
        }


# ── GET /export — Export analytics as CSV ─────────────────────────


@router.get(
    "/export",
    summary="Export analytics as CSV",
)
async def export_analytics(
    export_type: str = Query("summary", description="summary, campaigns, leads"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("analytics", "read")),
) -> StreamingResponse:
    """Export analytics data as a CSV file."""
    user_id = _get_user_id(current_user)
    start, end = _parse_date_range(date_from, date_to)

    output = io.StringIO()
    writer = csv.writer(output)

    if export_type == "campaigns":
        writer.writerow([
            "Campaign ID", "Name", "Status", "Platform", "Budget (INR)",
            "Spent (INR)", "Impressions", "Clicks", "Conversions", "CTR%", "CVR%",
        ])
        campaigns = (
            db.query(Campaign)
            .filter(
                Campaign.user_id == user_id,
                Campaign.is_deleted == False,  # noqa: E712
            )
            .order_by(Campaign.created_at.desc())
            .all()
        )
        for c in campaigns:
            impr = c.impressions or 0
            clicks = c.clicks or 0
            conv = c.conversions or 0
            ctr = round(clicks / impr * 100, 2) if impr > 0 else 0
            cvr = round(conv / clicks * 100, 2) if clicks > 0 else 0
            writer.writerow([
                c.id, c.name,
                c.status.value if c.status else "draft",
                c.platform.value if c.platform else "",
                c.budget or 0, c.spent or 0,
                impr, clicks, conv, ctr, cvr,
            ])

    elif export_type == "leads":
        writer.writerow(["Lead ID", "First Name", "Last Name", "Email", "Phone", "Status", "Score", "Source", "Created"])
        leads = (
            db.query(Lead)
            .filter(
                Lead.user_id == user_id,
                Lead.created_at >= start,
                Lead.created_at <= end,
            )
            .order_by(Lead.created_at.desc())
            .all()
        )
        for lead in leads:
            writer.writerow([
                lead.id,
                lead.first_name or "",
                lead.last_name or "",
                lead.email or "",
                lead.phone or "",
                lead.status.value if hasattr(lead.status, "value") else str(lead.status),
                lead.lead_score or 0,
                lead.source.value if hasattr(lead.source, "value") else str(lead.source or ""),
                lead.created_at.isoformat() if lead.created_at else "",
            ])

    else:
        writer.writerow(["Metric", "Value"])
        total_calls = (
            db.query(func.count(VoiceflowConversation.id))
            .join(Lead, VoiceflowConversation.lead_id == Lead.id)
            .filter(Lead.user_id == user_id, VoiceflowConversation.created_at >= start, VoiceflowConversation.created_at <= end)
            .scalar()
        ) or 0
        total_leads = (
            db.query(func.count(Lead.id))
            .filter(Lead.user_id == user_id, Lead.created_at >= start, Lead.created_at <= end)
            .scalar()
        ) or 0
        total_conversions = (
            db.query(func.count(Lead.id))
            .filter(Lead.user_id == user_id, Lead.status == LeadStatus.WON, Lead.created_at >= start, Lead.created_at <= end)
            .scalar()
        ) or 0
        total_revenue = (
            db.query(func.coalesce(func.sum(Deal.deal_value), 0))
            .filter(Deal.user_id == user_id, Deal.stage == DealStage.CLOSED_WON, Deal.created_at >= start, Deal.created_at <= end)
            .scalar()
        ) or 0

        writer.writerow(["Total Calls", total_calls])
        writer.writerow(["Total Leads", total_leads])
        writer.writerow(["Total Conversions", total_conversions])
        writer.writerow(["Total Revenue (INR)", float(total_revenue)])
        writer.writerow(["Date Range", f"{start.date()} to {end.date()}"])

    output.seek(0)
    filename = f"analytics_{export_type}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
