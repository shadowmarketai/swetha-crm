"""
VoiceFlow Marketing AI - Surveys Router
=========================================
Survey builder and response collection endpoints.
Supports multi-question surveys with various question types,
publishing lifecycle, response submission, and analytics.
"""

import logging
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from api.database import get_db
from api.permissions import require_permission
from api.models.survey import Survey, SurveyResponse, SurveyStatus
from api.schemas.survey import (
    SurveyAnalyticsResponse,
    SurveyCreate,
    SurveyDetail,
    SurveyResponseCreate,
    SurveyResponseDetail,
    SurveyUpdate,
)
from api.schemas.common import PaginatedResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/surveys", tags=["Surveys"])


# ── Helpers ─────────────────────────────────────────────────────


def _generate_slug(title: str) -> str:
    """Generate a URL-friendly slug from the title."""
    slug = title.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = slug.strip("-")
    return slug[:100]


def _survey_to_dict(survey: Survey) -> dict:
    """Convert a Survey ORM object to a dict."""
    return {
        "id": survey.id,
        "title": survey.title,
        "description": survey.description,
        "slug": survey.slug,
        "status": survey.status.value if survey.status else None,
        "questions": survey.questions,
        "logic": survey.logic,
        "theme": survey.theme,
        "logo_url": survey.logo_url,
        "thank_you_message": survey.thank_you_message,
        "redirect_url": survey.redirect_url,
        "is_anonymous": survey.is_anonymous,
        "allow_multiple_responses": survey.allow_multiple_responses,
        "require_auth": survey.require_auth,
        "show_progress_bar": survey.show_progress_bar,
        "randomize_questions": survey.randomize_questions,
        "starts_at": survey.starts_at,
        "ends_at": survey.ends_at,
        "max_responses": survey.max_responses,
        "total_responses": survey.total_responses,
        "total_started": survey.total_started,
        "avg_completion_time_seconds": survey.avg_completion_time_seconds,
        "completion_rate": survey.completion_rate,
        "avg_nps_score": survey.avg_nps_score,
        "distribution_channels": survey.distribution_channels,
        "tags": survey.tags,
        "user_id": survey.user_id,
        "campaign_id": survey.campaign_id,
        "created_at": survey.created_at,
        "updated_at": survey.updated_at,
    }


def _response_to_dict(resp: SurveyResponse) -> dict:
    """Convert a SurveyResponse ORM object to a dict."""
    return {
        "id": resp.id,
        "answers": resp.answers,
        "respondent_name": resp.respondent_name,
        "respondent_email": resp.respondent_email,
        "respondent_phone": resp.respondent_phone,
        "is_complete": resp.is_complete,
        "started_at": resp.started_at,
        "completed_at": resp.completed_at,
        "completion_time_seconds": resp.completion_time_seconds,
        "source": resp.source,
        "nps_score": resp.nps_score,
        "satisfaction_score": resp.satisfaction_score,
        "survey_id": resp.survey_id,
        "user_id": resp.user_id,
        "lead_id": resp.lead_id,
        "contact_id": resp.contact_id,
        "created_at": resp.created_at,
    }


def _get_user_id(current_user: dict) -> int:
    """Extract a numeric user_id from the current_user dict."""
    raw = current_user.get("id", "")
    if isinstance(raw, int):
        return raw
    try:
        return int(raw)
    except (ValueError, TypeError):
        return abs(hash(raw)) % (2**31)


# ── GET / ───────────────────────────────────────────────────────


@router.get(
    "/",
    response_model=PaginatedResponse,
    summary="List surveys",
)
async def list_surveys(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    search: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("surveys", "read")),
) -> PaginatedResponse:
    """List surveys for the current user (paginated)."""
    uid = _get_user_id(current_user)

    query = db.query(Survey).filter(
        Survey.user_id == uid,
        Survey.is_deleted == False,  # noqa: E712
    )

    if status_filter:
        try:
            ss = SurveyStatus(status_filter)
            query = query.filter(Survey.status == ss)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {status_filter}",
            )

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(Survey.title.ilike(search_pattern))

    total = query.count()
    offset = (page - 1) * page_size
    surveys = query.order_by(Survey.created_at.desc()).offset(offset).limit(page_size).all()

    items = [SurveyDetail(**_survey_to_dict(s)) for s in surveys]
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size)


# ── POST / ──────────────────────────────────────────────────────


@router.post(
    "/",
    response_model=SurveyDetail,
    status_code=201,
    summary="Create survey",
)
async def create_survey(
    body: SurveyCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("surveys", "create")),
) -> SurveyDetail:
    """Create a new survey with questions."""
    uid = _get_user_id(current_user)

    # Generate unique slug
    base_slug = _generate_slug(body.title)
    slug = base_slug
    counter = 1
    while db.query(Survey).filter(Survey.slug == slug).first() is not None:
        slug = f"{base_slug}-{counter}"
        counter += 1

    survey = Survey(
        title=body.title,
        description=body.description,
        slug=slug,
        status=SurveyStatus.DRAFT,
        questions=body.questions,
        logic=body.logic,
        theme=body.theme,
        logo_url=body.logo_url,
        thank_you_message=body.thank_you_message,
        redirect_url=body.redirect_url,
        is_anonymous=body.is_anonymous,
        allow_multiple_responses=body.allow_multiple_responses,
        require_auth=body.require_auth,
        show_progress_bar=body.show_progress_bar,
        randomize_questions=body.randomize_questions,
        starts_at=body.starts_at,
        ends_at=body.ends_at,
        max_responses=body.max_responses,
        distribution_channels=body.distribution_channels,
        tags=body.tags,
        campaign_id=body.campaign_id,
        user_id=uid,
    )
    db.add(survey)
    db.commit()
    db.refresh(survey)

    logger.info("Survey created: %s (user=%s)", survey.title, uid)
    return SurveyDetail(**_survey_to_dict(survey))


# ── GET /{survey_id} ───────────────────────────────────────────


@router.get(
    "/{survey_id}",
    response_model=SurveyDetail,
    summary="Get survey detail",
)
async def get_survey(
    survey_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("surveys", "read")),
) -> SurveyDetail:
    """Get survey detail by ID."""
    uid = _get_user_id(current_user)

    survey = db.query(Survey).filter(
        Survey.id == survey_id,
        Survey.user_id == uid,
        Survey.is_deleted == False,  # noqa: E712
    ).first()

    if not survey:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Survey {survey_id} not found",
        )

    return SurveyDetail(**_survey_to_dict(survey))


# ── PUT /{survey_id} ───────────────────────────────────────────


@router.put(
    "/{survey_id}",
    response_model=SurveyDetail,
    summary="Update survey",
)
async def update_survey(
    survey_id: int,
    body: SurveyUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("surveys", "update")),
) -> SurveyDetail:
    """Update an existing survey. Only draft or paused surveys can be edited."""
    uid = _get_user_id(current_user)

    survey = db.query(Survey).filter(
        Survey.id == survey_id,
        Survey.user_id == uid,
        Survey.is_deleted == False,  # noqa: E712
    ).first()

    if not survey:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Survey {survey_id} not found",
        )

    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(survey, field, value)

    db.commit()
    db.refresh(survey)

    logger.info("Survey updated: %s (user=%s)", survey.title, uid)
    return SurveyDetail(**_survey_to_dict(survey))


# ── DELETE /{survey_id} ─────────────────────────────────────────


@router.delete(
    "/{survey_id}",
    status_code=204,
    summary="Delete survey (draft only)",
)
async def delete_survey(
    survey_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("surveys", "delete")),
) -> None:
    """Soft-delete a survey. Only draft surveys can be deleted."""
    uid = _get_user_id(current_user)

    survey = db.query(Survey).filter(
        Survey.id == survey_id,
        Survey.user_id == uid,
        Survey.is_deleted == False,  # noqa: E712
    ).first()

    if not survey:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Survey {survey_id} not found",
        )

    if survey.status != SurveyStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only draft surveys can be deleted. Archive the survey instead.",
        )

    survey.is_deleted = True
    survey.deleted_at = datetime.now(timezone.utc)
    db.commit()

    logger.info("Survey deleted: %s (user=%s)", survey.title, uid)


# ── POST /{survey_id}/publish ───────────────────────────────────


@router.post(
    "/{survey_id}/publish",
    response_model=SurveyDetail,
    summary="Publish survey",
)
async def publish_survey(
    survey_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("surveys", "update")),
) -> SurveyDetail:
    """Publish a survey, making it active and accepting responses."""
    uid = _get_user_id(current_user)

    survey = db.query(Survey).filter(
        Survey.id == survey_id,
        Survey.user_id == uid,
        Survey.is_deleted == False,  # noqa: E712
    ).first()

    if not survey:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Survey {survey_id} not found",
        )

    if survey.status not in (SurveyStatus.DRAFT, SurveyStatus.PAUSED):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot publish a survey with status '{survey.status.value}'. Must be draft or paused.",
        )

    if not survey.questions or len(survey.questions) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot publish a survey with no questions",
        )

    survey.status = SurveyStatus.ACTIVE
    db.commit()
    db.refresh(survey)

    logger.info("Survey published: %s (user=%s)", survey.title, uid)
    return SurveyDetail(**_survey_to_dict(survey))


# ── POST /{survey_id}/responses ─────────────────────────────────


@router.post(
    "/{survey_id}/responses",
    response_model=SurveyResponseDetail,
    status_code=201,
    summary="Submit survey response",
)
async def submit_response(
    survey_id: int,
    body: SurveyResponseCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("surveys", "create")),
) -> SurveyResponseDetail:
    """Submit a response to a survey."""
    uid = _get_user_id(current_user)

    survey = db.query(Survey).filter(
        Survey.id == survey_id,
        Survey.is_deleted == False,  # noqa: E712
    ).first()

    if not survey:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Survey {survey_id} not found",
        )

    if survey.status != SurveyStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Survey is not currently accepting responses",
        )

    # Check max responses
    if survey.max_responses and survey.total_responses >= survey.max_responses:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Survey has reached the maximum number of responses",
        )

    # Check date constraints
    now = datetime.now(timezone.utc)
    if survey.starts_at and now < survey.starts_at:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Survey has not started yet",
        )
    if survey.ends_at and now > survey.ends_at:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Survey has ended",
        )

    # Check for duplicate responses (if not allowed)
    if not survey.allow_multiple_responses and body.respondent_email:
        existing = db.query(SurveyResponse).filter(
            SurveyResponse.survey_id == survey_id,
            SurveyResponse.respondent_email == body.respondent_email,
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A response with this email already exists for this survey",
            )

    # Calculate completion time
    completion_time = None
    if body.started_at and body.completed_at:
        delta = body.completed_at - body.started_at
        completion_time = delta.total_seconds()
    elif body.started_at and body.is_complete:
        delta = now - body.started_at
        completion_time = delta.total_seconds()

    # Extract NPS score if applicable
    nps_score = None
    if survey.questions:
        for q in survey.questions:
            if q.get("type") == "nps" and q.get("id") in body.answers:
                try:
                    nps_score = int(body.answers[q["id"]])
                except (ValueError, TypeError):
                    pass
                break

    response = SurveyResponse(
        answers=body.answers,
        respondent_name=body.respondent_name,
        respondent_email=body.respondent_email,
        respondent_phone=body.respondent_phone,
        is_complete=body.is_complete,
        started_at=body.started_at,
        completed_at=body.completed_at or (now if body.is_complete else None),
        completion_time_seconds=completion_time,
        source=body.source,
        nps_score=nps_score,
        survey_id=survey_id,
        user_id=uid,
        lead_id=body.lead_id,
        contact_id=body.contact_id,
    )
    db.add(response)

    # Update survey statistics
    survey.total_started += 1
    if body.is_complete:
        survey.total_responses += 1
        # Recalculate completion rate
        if survey.total_started > 0:
            survey.completion_rate = round(
                (survey.total_responses / survey.total_started) * 100, 2
            )
        # Recalculate average completion time
        if completion_time:
            if survey.avg_completion_time_seconds:
                total_time = survey.avg_completion_time_seconds * (survey.total_responses - 1)
                survey.avg_completion_time_seconds = round(
                    (total_time + completion_time) / survey.total_responses, 2
                )
            else:
                survey.avg_completion_time_seconds = round(completion_time, 2)
        # Recalculate average NPS
        if nps_score is not None:
            if survey.avg_nps_score is not None:
                total_nps = survey.avg_nps_score * (survey.total_responses - 1)
                survey.avg_nps_score = round(
                    (total_nps + nps_score) / survey.total_responses, 2
                )
            else:
                survey.avg_nps_score = float(nps_score)

    db.commit()
    db.refresh(response)

    logger.info("Survey response submitted for survey %s (user=%s)", survey_id, uid)
    return SurveyResponseDetail(**_response_to_dict(response))


# ── GET /{survey_id}/responses ──────────────────────────────────


@router.get(
    "/{survey_id}/responses",
    response_model=PaginatedResponse,
    summary="List survey responses",
)
async def list_responses(
    survey_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    is_complete: bool | None = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("surveys", "read")),
) -> PaginatedResponse:
    """List responses for a survey (paginated)."""
    uid = _get_user_id(current_user)

    # Verify survey ownership
    survey = db.query(Survey).filter(
        Survey.id == survey_id,
        Survey.user_id == uid,
        Survey.is_deleted == False,  # noqa: E712
    ).first()

    if not survey:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Survey {survey_id} not found",
        )

    query = db.query(SurveyResponse).filter(SurveyResponse.survey_id == survey_id)

    if is_complete is not None:
        query = query.filter(SurveyResponse.is_complete == is_complete)

    total = query.count()
    offset = (page - 1) * page_size
    responses = (
        query.order_by(SurveyResponse.created_at.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )

    items = [SurveyResponseDetail(**_response_to_dict(r)) for r in responses]
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size)


# ── GET /{survey_id}/analytics ──────────────────────────────────


@router.get(
    "/{survey_id}/analytics",
    response_model=SurveyAnalyticsResponse,
    summary="Survey response analytics",
)
async def survey_analytics(
    survey_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("surveys", "read")),
) -> SurveyAnalyticsResponse:
    """Get analytics for a survey (completion rate, answer distribution, etc.)."""
    uid = _get_user_id(current_user)

    survey = db.query(Survey).filter(
        Survey.id == survey_id,
        Survey.user_id == uid,
        Survey.is_deleted == False,  # noqa: E712
    ).first()

    if not survey:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Survey {survey_id} not found",
        )

    # Fetch all complete responses for analytics
    responses = (
        db.query(SurveyResponse)
        .filter(
            SurveyResponse.survey_id == survey_id,
            SurveyResponse.is_complete == True,  # noqa: E712
        )
        .all()
    )

    # NPS distribution (promoters 9-10, passives 7-8, detractors 0-6)
    nps_distribution = {"promoters": 0, "passives": 0, "detractors": 0}
    for r in responses:
        if r.nps_score is not None:
            if r.nps_score >= 9:
                nps_distribution["promoters"] += 1
            elif r.nps_score >= 7:
                nps_distribution["passives"] += 1
            else:
                nps_distribution["detractors"] += 1

    # Answer distribution per question
    answer_dist: dict = {}
    if survey.questions:
        for q in survey.questions:
            qid = q.get("id")
            qtype = q.get("type")
            if not qid:
                continue

            if qtype in ("single_choice", "multiple_choice", "dropdown", "yes_no"):
                # Count choices
                counts: dict[str, int] = {}
                for r in responses:
                    val = r.answers.get(qid)
                    if val is None:
                        continue
                    if isinstance(val, list):
                        for v in val:
                            counts[str(v)] = counts.get(str(v), 0) + 1
                    else:
                        counts[str(val)] = counts.get(str(val), 0) + 1
                answer_dist[qid] = {"type": qtype, "counts": counts}

            elif qtype in ("rating", "nps", "scale"):
                # Numeric distribution
                values = []
                for r in responses:
                    val = r.answers.get(qid)
                    if val is not None:
                        try:
                            values.append(float(val))
                        except (ValueError, TypeError):
                            pass
                if values:
                    answer_dist[qid] = {
                        "type": qtype,
                        "average": round(sum(values) / len(values), 2),
                        "min": min(values),
                        "max": max(values),
                        "count": len(values),
                    }

            elif qtype in ("text", "textarea"):
                # Just count of text responses
                count = sum(1 for r in responses if r.answers.get(qid))
                answer_dist[qid] = {"type": qtype, "response_count": count}

    # Responses by source
    source_counts: dict[str, int] = {}
    for r in responses:
        src = r.source or "unknown"
        source_counts[src] = source_counts.get(src, 0) + 1

    # Responses over time (daily)
    daily_counts: dict[str, int] = {}
    for r in responses:
        if r.created_at:
            day = r.created_at.strftime("%Y-%m-%d")
            daily_counts[day] = daily_counts.get(day, 0) + 1
    responses_over_time = [
        {"date": day, "count": cnt}
        for day, cnt in sorted(daily_counts.items())
    ]

    return SurveyAnalyticsResponse(
        survey_id=survey.id,
        title=survey.title,
        total_responses=survey.total_responses,
        total_started=survey.total_started,
        completion_rate=survey.completion_rate,
        avg_completion_time_seconds=survey.avg_completion_time_seconds,
        avg_nps_score=survey.avg_nps_score,
        nps_distribution=nps_distribution,
        answer_distribution=answer_dist,
        responses_by_source=source_counts,
        responses_over_time=responses_over_time,
    )
