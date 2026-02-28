"""
VoiceFlow Marketing AI - Workflows Router
===========================================
Workflow automation endpoints for n8n/Flowise integration.
Supports creation, activation/deactivation, triggering, and
execution history tracking.
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from api.database import get_db
from api.permissions import require_permission
from api.models.workflow import (
    ExecutionStatus,
    Workflow,
    WorkflowExecution,
    WorkflowType,
)
from api.schemas.workflow import (
    WorkflowCreate,
    WorkflowDetail,
    WorkflowExecutionResponse,
    WorkflowTemplateResponse,
    WorkflowTriggerRequest,
    WorkflowUpdate,
)
from api.schemas.common import PaginatedResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/workflows", tags=["Workflows"])


# ── Helpers ─────────────────────────────────────────────────────


def _workflow_to_dict(wf: Workflow) -> dict:
    """Convert a Workflow ORM object to a dict."""
    return {
        "id": wf.id,
        "name": wf.name,
        "description": wf.description,
        "workflow_type": wf.workflow_type.value if wf.workflow_type else None,
        "n8n_workflow_id": wf.n8n_workflow_id,
        "flowise_flow_id": wf.flowise_flow_id,
        "webhook_url": wf.webhook_url,
        "trigger_config": wf.trigger_config,
        "action_config": wf.action_config,
        "variables": wf.variables,
        "is_active": wf.is_active,
        "version": wf.version,
        "max_executions_per_hour": wf.max_executions_per_hour,
        "cooldown_seconds": wf.cooldown_seconds,
        "total_executions": wf.total_executions,
        "successful_executions": wf.successful_executions,
        "failed_executions": wf.failed_executions,
        "last_execution_at": wf.last_execution_at,
        "avg_execution_time_ms": wf.avg_execution_time_ms,
        "tags": wf.tags,
        "user_id": wf.user_id,
        "created_at": wf.created_at,
        "updated_at": wf.updated_at,
    }


def _execution_to_dict(exe: WorkflowExecution) -> dict:
    """Convert a WorkflowExecution ORM object to a dict."""
    return {
        "id": exe.id,
        "workflow_id": exe.workflow_id,
        "voice_analysis_id": exe.voice_analysis_id,
        "lead_id": exe.lead_id,
        "trigger_type": exe.trigger_type,
        "trigger_data": exe.trigger_data,
        "status": exe.status.value if exe.status else None,
        "error_message": exe.error_message,
        "error_code": exe.error_code,
        "retry_count": exe.retry_count,
        "max_retries": exe.max_retries,
        "output_data": exe.output_data,
        "actions_taken": exe.actions_taken,
        "started_at": exe.started_at,
        "completed_at": exe.completed_at,
        "duration_ms": exe.duration_ms,
        "created_at": exe.created_at,
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


# ── Workflow Templates ──────────────────────────────────────────

WORKFLOW_TEMPLATES = [
    WorkflowTemplateResponse(
        name="Voice-to-Lead Capture",
        description="Automatically create a CRM lead from voice call analysis. Extracts name, intent, and sentiment.",
        workflow_type="voice_to_lead",
        trigger_config={"event": "voice.processed", "min_confidence": 0.7},
        action_config={"action": "create_lead", "assign_to": "auto", "notify": True},
        tags=["voice", "lead", "automation"],
    ),
    WorkflowTemplateResponse(
        name="Emotion-Based Retargeting",
        description="Trigger a marketing campaign when negative emotion is detected during a call.",
        workflow_type="emotion_retarget",
        trigger_config={"event": "voice.processed", "emotion": "negative", "threshold": -0.3},
        action_config={"action": "trigger_campaign", "campaign_type": "retention", "channel": "whatsapp"},
        tags=["emotion", "marketing", "retarget"],
    ),
    WorkflowTemplateResponse(
        name="Churn Prevention Alert",
        description="Send alerts when a customer shows churn signals (negative sentiment, multiple complaints).",
        workflow_type="churn_prevention",
        trigger_config={"event": "lead.score_changed", "score_below": 30, "sentiment": "negative"},
        action_config={"action": "send_notification", "channel": "email", "escalate": True},
        tags=["churn", "retention", "alert"],
    ),
    WorkflowTemplateResponse(
        name="Lead Nurture Sequence",
        description="Automated multi-step nurture campaign for new leads via WhatsApp and email.",
        workflow_type="lead_nurture",
        trigger_config={"event": "lead.created", "status": "new"},
        action_config={
            "sequence": [
                {"delay_hours": 0, "action": "send_whatsapp", "template": "welcome"},
                {"delay_hours": 24, "action": "send_email", "template": "intro"},
                {"delay_hours": 72, "action": "send_whatsapp", "template": "follow_up"},
            ]
        },
        tags=["lead", "nurture", "sequence"],
    ),
    WorkflowTemplateResponse(
        name="CRM Sync to HubSpot",
        description="Bi-directional sync of leads and contacts between VoiceFlow and HubSpot CRM.",
        workflow_type="crm_sync",
        trigger_config={"event": "lead.updated", "sync_fields": ["name", "email", "phone", "score"]},
        action_config={"action": "sync_hubspot", "direction": "bidirectional", "conflict": "latest_wins"},
        tags=["crm", "hubspot", "sync"],
    ),
    WorkflowTemplateResponse(
        name="Auto-Response for Missed Calls",
        description="Send an automatic WhatsApp message when an inbound call is missed.",
        workflow_type="auto_response",
        trigger_config={"event": "call.missed", "channel": "inbound"},
        action_config={"action": "send_whatsapp", "template": "missed_call_followup", "delay_minutes": 5},
        tags=["auto-response", "missed-call", "whatsapp"],
    ),
]


# ── GET /templates ──────────────────────────────────────────────


@router.get(
    "/templates",
    response_model=list[WorkflowTemplateResponse],
    summary="Get workflow templates",
)
async def get_templates(
    current_user: dict = Depends(require_permission("automation", "read")),
) -> list[WorkflowTemplateResponse]:
    """Get predefined workflow templates for quick creation."""
    return WORKFLOW_TEMPLATES


# ── GET / ───────────────────────────────────────────────────────


@router.get(
    "/",
    response_model=PaginatedResponse,
    summary="List workflows",
)
async def list_workflows(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    is_active: bool | None = Query(None),
    workflow_type: str | None = Query(None),
    search: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("automation", "read")),
) -> PaginatedResponse:
    """List workflows for the current user (paginated)."""
    uid = _get_user_id(current_user)

    query = db.query(Workflow).filter(Workflow.user_id == uid)

    if is_active is not None:
        query = query.filter(Workflow.is_active == is_active)

    if workflow_type:
        try:
            wt = WorkflowType(workflow_type)
            query = query.filter(Workflow.workflow_type == wt)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid workflow_type: {workflow_type}",
            )

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(Workflow.name.ilike(search_pattern))

    total = query.count()
    offset = (page - 1) * page_size
    workflows = query.order_by(Workflow.created_at.desc()).offset(offset).limit(page_size).all()

    items = [WorkflowDetail(**_workflow_to_dict(w)) for w in workflows]
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size)


# ── POST / ──────────────────────────────────────────────────────


@router.post(
    "/",
    response_model=WorkflowDetail,
    status_code=201,
    summary="Create workflow",
)
async def create_workflow(
    body: WorkflowCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("automation", "create")),
) -> WorkflowDetail:
    """Create a new workflow."""
    uid = _get_user_id(current_user)

    wf_type = None
    if body.workflow_type:
        wf_type = WorkflowType(body.workflow_type)

    workflow = Workflow(
        name=body.name,
        description=body.description,
        workflow_type=wf_type,
        n8n_workflow_id=body.n8n_workflow_id,
        flowise_flow_id=body.flowise_flow_id,
        webhook_url=body.webhook_url,
        trigger_config=body.trigger_config,
        action_config=body.action_config,
        variables=body.variables,
        is_active=False,
        max_executions_per_hour=body.max_executions_per_hour,
        cooldown_seconds=body.cooldown_seconds,
        tags=body.tags,
        user_id=uid,
    )
    db.add(workflow)
    db.commit()
    db.refresh(workflow)

    logger.info("Workflow created: %s (user=%s)", workflow.name, uid)
    return WorkflowDetail(**_workflow_to_dict(workflow))


# ── GET /{workflow_id} ──────────────────────────────────────────


@router.get(
    "/{workflow_id}",
    response_model=WorkflowDetail,
    summary="Get workflow detail",
)
async def get_workflow(
    workflow_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("automation", "read")),
) -> WorkflowDetail:
    """Get workflow detail by ID."""
    uid = _get_user_id(current_user)

    workflow = db.query(Workflow).filter(
        Workflow.id == workflow_id,
        Workflow.user_id == uid,
    ).first()

    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow {workflow_id} not found",
        )

    return WorkflowDetail(**_workflow_to_dict(workflow))


# ── PUT /{workflow_id} ──────────────────────────────────────────


@router.put(
    "/{workflow_id}",
    response_model=WorkflowDetail,
    summary="Update workflow",
)
async def update_workflow(
    workflow_id: int,
    body: WorkflowUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("automation", "update")),
) -> WorkflowDetail:
    """Update an existing workflow configuration."""
    uid = _get_user_id(current_user)

    workflow = db.query(Workflow).filter(
        Workflow.id == workflow_id,
        Workflow.user_id == uid,
    ).first()

    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow {workflow_id} not found",
        )

    updates = body.model_dump(exclude_unset=True)

    if "workflow_type" in updates and updates["workflow_type"] is not None:
        updates["workflow_type"] = WorkflowType(updates["workflow_type"])

    for field, value in updates.items():
        setattr(workflow, field, value)

    # Increment version on config changes
    config_fields = {"trigger_config", "action_config", "variables", "workflow_type"}
    if config_fields & set(updates.keys()):
        workflow.version += 1

    db.commit()
    db.refresh(workflow)

    logger.info("Workflow updated: %s (user=%s)", workflow.name, uid)
    return WorkflowDetail(**_workflow_to_dict(workflow))


# ── DELETE /{workflow_id} ───────────────────────────────────────


@router.delete(
    "/{workflow_id}",
    status_code=204,
    summary="Delete workflow",
)
async def delete_workflow(
    workflow_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("automation", "delete")),
) -> None:
    """Delete a workflow and its executions."""
    uid = _get_user_id(current_user)

    workflow = db.query(Workflow).filter(
        Workflow.id == workflow_id,
        Workflow.user_id == uid,
    ).first()

    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow {workflow_id} not found",
        )

    if workflow.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete an active workflow. Deactivate it first.",
        )

    db.delete(workflow)
    db.commit()

    logger.info("Workflow deleted: %s (user=%s)", workflow_id, uid)


# ── POST /{workflow_id}/activate ────────────────────────────────


@router.post(
    "/{workflow_id}/activate",
    response_model=WorkflowDetail,
    summary="Activate workflow",
)
async def activate_workflow(
    workflow_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("automation", "update")),
) -> WorkflowDetail:
    """Activate a workflow so it can be triggered."""
    uid = _get_user_id(current_user)

    workflow = db.query(Workflow).filter(
        Workflow.id == workflow_id,
        Workflow.user_id == uid,
    ).first()

    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow {workflow_id} not found",
        )

    if workflow.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Workflow is already active",
        )

    # Validate that workflow has required configuration
    if not workflow.trigger_config and not workflow.webhook_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Workflow must have trigger_config or webhook_url before activation",
        )

    workflow.is_active = True
    db.commit()
    db.refresh(workflow)

    logger.info("Workflow activated: %s (user=%s)", workflow.name, uid)
    return WorkflowDetail(**_workflow_to_dict(workflow))


# ── POST /{workflow_id}/deactivate ──────────────────────────────


@router.post(
    "/{workflow_id}/deactivate",
    response_model=WorkflowDetail,
    summary="Deactivate workflow",
)
async def deactivate_workflow(
    workflow_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("automation", "update")),
) -> WorkflowDetail:
    """Deactivate a workflow to stop it from being triggered."""
    uid = _get_user_id(current_user)

    workflow = db.query(Workflow).filter(
        Workflow.id == workflow_id,
        Workflow.user_id == uid,
    ).first()

    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow {workflow_id} not found",
        )

    if not workflow.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Workflow is already inactive",
        )

    workflow.is_active = False
    db.commit()
    db.refresh(workflow)

    logger.info("Workflow deactivated: %s (user=%s)", workflow.name, uid)
    return WorkflowDetail(**_workflow_to_dict(workflow))


# ── POST /trigger ───────────────────────────────────────────────


@router.post(
    "/trigger",
    response_model=WorkflowExecutionResponse,
    status_code=201,
    summary="Trigger workflow execution",
)
async def trigger_workflow(
    body: WorkflowTriggerRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("automation", "update")),
) -> WorkflowExecutionResponse:
    """Manually trigger a workflow execution."""
    uid = _get_user_id(current_user)

    workflow = db.query(Workflow).filter(
        Workflow.id == body.workflow_id,
        Workflow.user_id == uid,
    ).first()

    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow {body.workflow_id} not found",
        )

    if not workflow.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot trigger an inactive workflow. Activate it first.",
        )

    # Check rate limiting
    if workflow.max_executions_per_hour:
        from datetime import timedelta
        one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
        recent_count = (
            db.query(WorkflowExecution)
            .filter(
                WorkflowExecution.workflow_id == workflow.id,
                WorkflowExecution.created_at >= one_hour_ago,
            )
            .count()
        )
        if recent_count >= workflow.max_executions_per_hour:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Max {workflow.max_executions_per_hour} executions per hour.",
            )

    # Check cooldown
    if workflow.cooldown_seconds and workflow.last_execution_at:
        from datetime import timedelta
        cooldown_end = workflow.last_execution_at + timedelta(seconds=workflow.cooldown_seconds)
        if datetime.now(timezone.utc) < cooldown_end:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Cooldown active. Next execution available after {cooldown_end.isoformat()}",
            )

    now = datetime.now(timezone.utc)

    execution = WorkflowExecution(
        workflow_id=workflow.id,
        voice_analysis_id=body.voice_analysis_id,
        lead_id=body.lead_id,
        trigger_type=body.trigger_type or "manual",
        trigger_data=body.trigger_data,
        status=ExecutionStatus.PENDING,
        started_at=now,
    )
    db.add(execution)

    # Update workflow stats
    workflow.total_executions += 1
    workflow.last_execution_at = now

    # Simulate execution (in production, this would be dispatched via Celery)
    execution.status = ExecutionStatus.RUNNING

    db.commit()
    db.refresh(execution)

    logger.info(
        "Workflow triggered: %s, execution_id=%s (user=%s)",
        workflow.name,
        execution.id,
        uid,
    )
    return WorkflowExecutionResponse(**_execution_to_dict(execution))


# ── GET /{workflow_id}/executions ───────────────────────────────


@router.get(
    "/{workflow_id}/executions",
    response_model=PaginatedResponse,
    summary="List workflow executions",
)
async def list_executions(
    workflow_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("automation", "read")),
) -> PaginatedResponse:
    """List executions for a workflow (paginated)."""
    uid = _get_user_id(current_user)

    # Verify workflow ownership
    workflow = db.query(Workflow).filter(
        Workflow.id == workflow_id,
        Workflow.user_id == uid,
    ).first()

    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow {workflow_id} not found",
        )

    query = db.query(WorkflowExecution).filter(
        WorkflowExecution.workflow_id == workflow_id,
    )

    if status_filter:
        try:
            es = ExecutionStatus(status_filter)
            query = query.filter(WorkflowExecution.status == es)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {status_filter}",
            )

    total = query.count()
    offset = (page - 1) * page_size
    executions = (
        query.order_by(WorkflowExecution.created_at.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )

    items = [WorkflowExecutionResponse(**_execution_to_dict(e)) for e in executions]
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size)
