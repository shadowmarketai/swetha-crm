"""
Swetha Structures CRM - Quotation Router
==========================================
13 endpoints for PEB quotation management with audit logging.
All quotations are tied to CRM leads (lead_id is mandatory).
"""

import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from api.database import get_db
from api.permissions import require_permission
from api.schemas.quotation import (
    AIRenderRequest,
    AIRenderResponse,
    BOQResult,
    PEBInput,
    QuotationCreate,
    QuotationUpdate,
    QuotationResponse,
    QuotationLogResponse,
    QuotationStatsResponse,
    StatusUpdate,
    UpscaleRequest,
    UpscaleResponse,
)
from api.schemas.common import MessageResponse, PaginatedResponse
from api.services import quotation_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/quotations", tags=["Quotations"])


def _get_user_id(current_user: dict) -> str:
    """Extract user_id string from the current user dict."""
    return str(current_user.get("id", "user-001"))


def _quotation_to_response(q) -> QuotationResponse:
    return QuotationResponse(
        id=q.id,
        lead_id=q.lead_id,
        user_id=q.user_id,
        project_name=q.project_name,
        client_name=q.client_name,
        client_location=q.client_location,
        building_params=q.building_params,
        boq_results=q.boq_results,
        total_amount=q.total_amount,
        rate_per_sqft=q.rate_per_sqft,
        status=q.status,
        revision=q.revision,
        parent_quotation_id=q.parent_quotation_id,
        pdf_path=q.pdf_path,
        created_at=q.created_at.isoformat() if q.created_at else None,
        updated_at=q.updated_at.isoformat() if q.updated_at else None,
    )


def _log_to_response(log) -> QuotationLogResponse:
    return QuotationLogResponse(
        id=log.id,
        quotation_id=log.quotation_id,
        user_id=log.user_id,
        action=log.action,
        details=log.details,
        created_at=log.created_at.isoformat() if log.created_at else None,
    )


# ── POST /calculate — Calculate BOQ (no save) ────────────────────


@router.post(
    "/calculate",
    response_model=BOQResult,
    summary="Calculate BOQ from PEB input",
)
async def calculate_boq(
    body: PEBInput,
    current_user: dict = Depends(require_permission("quotation", "read")),
) -> dict:
    """Calculate BOQ from building parameters without saving."""
    result = quotation_service.calculate_boq(body.model_dump())
    return result


# ── POST / — Create quotation ────────────────────────────────────


@router.post(
    "/",
    response_model=QuotationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create quotation",
)
async def create_quotation(
    body: QuotationCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("quotation", "create")),
) -> QuotationResponse:
    """Create a new PEB quotation. Lead ID is optional."""
    user_id = _get_user_id(current_user)
    try:
        q = quotation_service.create_quotation(
            db=db,
            lead_id=body.lead_id,
            user_id=user_id,
            project_name=body.project_name,
            building_params=body.building_params.model_dump(),
            client_name=body.client_name,
            client_location=body.client_location,
        )
        return _quotation_to_response(q)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ── GET / — List quotations ──────────────────────────────────────


@router.get(
    "/",
    response_model=PaginatedResponse,
    summary="List quotations",
)
async def list_quotations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    lead_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("quotation", "read")),
) -> PaginatedResponse:
    user_id = _get_user_id(current_user)
    items, total = quotation_service.list_quotations(
        db=db,
        user_id=user_id,
        lead_id=lead_id,
        status_filter=status_filter,
        search=search,
        page=page,
        page_size=page_size,
    )
    return PaginatedResponse(
        items=[_quotation_to_response(q) for q in items],
        total=total,
        page=page,
        page_size=page_size,
    )


# ── GET /stats — Dashboard stats ────────────────────────────────


@router.get(
    "/stats",
    response_model=QuotationStatsResponse,
    summary="Quotation stats",
)
async def get_stats(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("quotation", "read")),
) -> QuotationStatsResponse:
    user_id = _get_user_id(current_user)
    stats = quotation_service.get_stats(db, user_id=user_id)
    return QuotationStatsResponse(**stats)


# ── GET /by-lead/{lead_id} — Quotations for a lead ───────────────


@router.get(
    "/by-lead/{lead_id}",
    summary="Quotations for a lead",
)
async def get_by_lead(
    lead_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("quotation", "read")),
):
    user_id = _get_user_id(current_user)
    items, total = quotation_service.list_quotations(db=db, user_id=user_id, lead_id=lead_id)
    return {"items": [_quotation_to_response(q) for q in items], "total": total}


# ── GET /{quotation_id} — Get single quotation ───────────────────


@router.get(
    "/{quotation_id}",
    response_model=QuotationResponse,
    summary="Get quotation",
)
async def get_quotation(
    quotation_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("quotation", "read")),
) -> QuotationResponse:
    from api.models.quotation import Quotation
    user_id = _get_user_id(current_user)
    q = db.query(Quotation).filter(
        Quotation.id == quotation_id,
        Quotation.user_id == user_id,
        Quotation.is_deleted == False,  # noqa: E712
    ).first()
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return _quotation_to_response(q)


# ── PUT /{quotation_id} — Update quotation ───────────────────────


@router.put(
    "/{quotation_id}",
    response_model=QuotationResponse,
    summary="Update quotation",
)
async def update_quotation(
    quotation_id: int,
    body: QuotationUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("quotation", "update")),
) -> QuotationResponse:
    user_id = _get_user_id(current_user)
    try:
        q = quotation_service.update_quotation(
            db=db,
            quotation_id=quotation_id,
            user_id=user_id,
            updates=body.model_dump(exclude_none=True),
        )
        return _quotation_to_response(q)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ── DELETE /{quotation_id} — Soft-delete ──────────────────────────


@router.delete(
    "/{quotation_id}",
    response_model=MessageResponse,
    summary="Delete quotation",
)
async def delete_quotation(
    quotation_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("quotation", "delete")),
) -> MessageResponse:
    user_id = _get_user_id(current_user)
    try:
        quotation_service.delete_quotation(db, quotation_id, user_id)
        return MessageResponse(message=f"Quotation {quotation_id} deleted")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ── POST /{quotation_id}/pdf — Generate PDF ──────────────────────


@router.post(
    "/{quotation_id}/pdf",
    summary="Generate PDF",
)
async def generate_pdf(
    quotation_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("quotation", "update")),
):
    user_id = _get_user_id(current_user)
    try:
        pdf_bytes = quotation_service.generate_pdf(db, quotation_id, user_id)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=quotation_{quotation_id}.pdf"},
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /{quotation_id}/pdf — Download PDF ───────────────────────


@router.get(
    "/{quotation_id}/pdf",
    summary="Download PDF",
)
async def download_pdf(
    quotation_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("quotation", "read")),
):
    from api.models.quotation import Quotation
    import os
    user_id = _get_user_id(current_user)
    q = db.query(Quotation).filter(
        Quotation.id == quotation_id,
        Quotation.user_id == user_id,
        Quotation.is_deleted == False,  # noqa: E712
    ).first()
    if not q or not q.pdf_path or not os.path.exists(q.pdf_path):
        raise HTTPException(status_code=404, detail="PDF not found. Generate it first.")
    with open(q.pdf_path, "rb") as f:
        pdf_bytes = f.read()
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=quotation_{quotation_id}.pdf"},
    )


# ── POST /{quotation_id}/revise — Create revision ────────────────


@router.post(
    "/{quotation_id}/revise",
    response_model=QuotationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create revision",
)
async def create_revision(
    quotation_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("quotation", "create")),
) -> QuotationResponse:
    user_id = _get_user_id(current_user)
    try:
        q = quotation_service.create_revision(db, quotation_id, user_id)
        return _quotation_to_response(q)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ── PATCH /{quotation_id}/status — Change status ─────────────────


@router.patch(
    "/{quotation_id}/status",
    response_model=QuotationResponse,
    summary="Change status",
)
async def change_status(
    quotation_id: int,
    body: StatusUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("quotation", "update")),
) -> QuotationResponse:
    user_id = _get_user_id(current_user)
    try:
        q = quotation_service.change_status(db, quotation_id, user_id, body.status.value)
        return _quotation_to_response(q)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ── GET /{quotation_id}/logs — Audit logs ────────────────────────


@router.get(
    "/{quotation_id}/logs",
    summary="Get audit logs",
)
async def get_logs(
    quotation_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("quotation", "read")),
):
    user_id = _get_user_id(current_user)
    try:
        logs = quotation_service.get_quotation_logs(db, quotation_id, user_id=user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"items": [_log_to_response(log) for log in logs]}


# ── AI Photoreal Render Endpoints ────────────────────────────────


@router.post(
    "/ai-render/preview",
    response_model=AIRenderResponse,
    summary="Generate photoreal AI renders (no save)",
)
async def preview_ai_render(
    payload: AIRenderRequest,
    current_user: dict = Depends(require_permission("quotation", "read")),
) -> AIRenderResponse:
    """
    Generate photoreal renders from a Three.js capture without persisting them
    to a quotation. Use this when the user is exploring on `/quotation/ai-image`
    before a quote exists, or just wants ad-hoc images.
    """
    from api.services import ai_render_service

    if not ai_render_service.is_configured():
        raise HTTPException(
            status_code=503,
            detail="AI render is not configured. Set GEMINI_API_KEY in the server .env "
                   "and restart the API.",
        )

    try:
        # Gemini calls are blocking I/O (3-15s); run on the thread pool so we
        # don't starve the event loop and other async requests.
        renders = await asyncio.to_thread(
            ai_render_service.generate_realistic_renders,
            capture_b64=payload.capture_image,
            params=payload.building_params,
            lead={"company": payload.lead_company} if payload.lead_company else None,
            angles=payload.angles,
            force_regenerate=payload.force_regenerate,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if not renders:
        return AIRenderResponse(
            renders=[],
            saved_to_quotation=False,
            message="The AI provider did not return any images. Try again, or check the "
                    "API key and quota.",
        )

    if payload.check_brand:
        _attach_brand_checks(renders, payload.building_params)

    msg = None
    if all(r.get("cached") for r in renders):
        msg = "All renders served from cache (no Gemini cost)."
    return AIRenderResponse(renders=renders, saved_to_quotation=False, message=msg)


@router.post(
    "/{quotation_id}/ai-render",
    response_model=AIRenderResponse,
    summary="Generate photoreal AI renders and attach to quotation",
)
async def generate_ai_render_for_quote(
    quotation_id: int,
    payload: AIRenderRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("quotation", "update")),
) -> AIRenderResponse:
    """
    Generate photoreal renders and append their URLs to `quote.ai_render_urls`,
    so the public render gallery (`/view/{token}/render`) picks them up.
    """
    from api.models.quotation import Quotation
    from api.services import ai_render_service

    if not ai_render_service.is_configured():
        raise HTTPException(
            status_code=503,
            detail="AI render is not configured. Set GEMINI_API_KEY in the server .env "
                   "and restart the API.",
        )

    user_id = _get_user_id(current_user)
    quote = (
        db.query(Quotation)
        .filter(
            Quotation.id == quotation_id,
            Quotation.user_id == user_id,
            Quotation.is_deleted == False,  # noqa: E712
        )
        .first()
    )
    if not quote:
        raise HTTPException(status_code=404, detail="Quotation not found")

    # Resolve params: explicit payload wins, fall back to the stored building_params.
    params = payload.building_params or (quote.building_params or {})
    lead_ctx = None
    if payload.lead_company:
        lead_ctx = {"company": payload.lead_company}
    elif quote.client_name:
        lead_ctx = {"company": quote.client_name}

    try:
        # Offload the blocking Gemini call to a worker thread so the async
        # event loop stays free for other tenants' requests.
        renders = await asyncio.to_thread(
            ai_render_service.generate_realistic_renders,
            capture_b64=payload.capture_image,
            params=params,
            lead=lead_ctx,
            quotation_id=quotation_id,
            angles=payload.angles,
            force_regenerate=payload.force_regenerate,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if not renders:
        return AIRenderResponse(
            renders=[],
            saved_to_quotation=False,
            message="The AI provider did not return any images. Nothing was saved.",
        )

    if payload.check_brand:
        _attach_brand_checks(renders, params)

    all_cached = all(r.get("cached") for r in renders)
    new_urls = [r["url"] for r in renders]

    # Only persist new URLs to the quotation when at least one was freshly
    # generated; pure cache hits already exist in ai_render_urls.
    if not all_cached:
        existing_urls = list(quote.ai_render_urls or [])
        # Avoid duplicating if a cached URL is already in the list
        merged = existing_urls + [u for u in new_urls if u not in existing_urls]
        quote.ai_render_urls = merged
        db.add(quote)
        db.commit()
        db.refresh(quote)
        msg = f"{len(renders)} render(s) attached to quotation #{quotation_id}"
    else:
        msg = "All renders served from cache (no Gemini cost, nothing new saved)."

    return AIRenderResponse(
        renders=renders,
        saved_to_quotation=not all_cached,
        message=msg,
    )


# ── Helper: attach brand-consistency checks to a render list ─────


def _attach_brand_checks(renders: list[dict], params: dict) -> None:
    """Mutates `renders` in place — adds a `brand_check` field to each item."""
    from api.services import ai_render_service
    from pathlib import Path as _Path

    btype = ai_render_service._classify_building_type(params)
    palette = ai_render_service._resolve_palette(params, btype)
    for r in renders:
        url = r.get("url", "")
        if not url:
            continue
        filename = url.rsplit("/", 1)[-1]
        path = ai_render_service.RENDERS_DIR / filename
        result = ai_render_service.check_brand_consistency(_Path(path), palette)
        r["brand_check"] = result


# ── POST /ai-render/upscale — 2x resample an existing render ─────


@router.post(
    "/ai-render/upscale",
    response_model=UpscaleResponse,
    summary="Upscale an existing AI render to 2x using LANCZOS resampling",
)
async def upscale_existing_render(
    payload: UpscaleRequest,
    current_user: dict = Depends(require_permission("quotation", "read")),
) -> UpscaleResponse:
    from api.services import ai_render_service

    # Strip URL prefix to get the bare filename
    if not payload.render_url.startswith("/renders/"):
        raise HTTPException(
            status_code=400,
            detail="render_url must look like /renders/filename.png",
        )
    filename = payload.render_url[len("/renders/"):]

    new_url = ai_render_service.upscale_render(filename, scale=payload.scale)
    if not new_url:
        raise HTTPException(
            status_code=404,
            detail="Source render not found, or upscaling failed",
        )

    # Probe dimensions of the new file
    src = ai_render_service.RENDERS_DIR / new_url[len("/renders/"):]
    width = height = None
    try:
        from PIL import Image
        with Image.open(src) as im:
            width, height = im.size
    except Exception:
        pass

    return UpscaleResponse(url=new_url, width=width, height=height)
