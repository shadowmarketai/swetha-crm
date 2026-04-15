"""
Tendent Quotation Engine router.

Three logical surfaces:
    1. Tenant-authenticated template CRUD       → /api/v1/quotation-templates
    2. Tenant-authenticated calc + offers       → /api/v1/quotation-templates/calc
                                                  /api/v1/quotations/{id}/offers/*
    3. Public (no-auth) intake + client portal  → /api/v1/public/intake/*
                                                  /api/v1/public/quote/{token}/*
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from api.database import get_db
from api.permissions import require_permission
from api.models.quotation import Quotation, QuotationLog, QuotationStatus
from api.models.quotation_template import (
    QuotationTemplate,
    ClientIntake,
    QuotationOffer,
    IntakeStatus,
    OfferStatus,
    PortalTokenKind,
)
from api.schemas.quotation_template import (
    TemplateCreate,
    TemplateUpdate,
    TemplateResponse,
    IntakeSubmit,
    IntakeResponse,
    CalcRequest,
    CalcResponse,
    OfferPropose,
    OfferResponse,
    OfferDecision,
    PublicQuoteView,
    PublicQuestion,
)
from api.services.quotation_calculator import calculate as calc_from_template
from api.services.quotation_portal_token import (
    create_token,
    get_token,
    record_access,
    revoke_tokens_for_quotation,
)

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════
# Tenant-auth router (tenant admins / users)
# ═══════════════════════════════════════════════════════════════
router = APIRouter(prefix="/api/v1/quotation-templates", tags=["Quotation Templates"])


def _tenant_id(current_user: dict) -> str:
    tid = current_user.get("tenant_id")
    if not tid:
        raise HTTPException(status_code=400, detail="User has no tenant")
    return str(tid)


def _user_id(current_user: dict) -> str:
    return str(current_user.get("id") or current_user.get("user_id") or "unknown")


def _load_tenant_branding(db: Session, tenant_id: str) -> dict:
    """Read tenant branding from platform_tenants for public-facing pages."""
    row = db.execute(
        text(
            "SELECT name, app_name, logo_url, favicon_url, primary_color, "
            "secondary_color, accent_color, font_family, slug "
            "FROM platform_tenants WHERE id = :tid"
        ),
        {"tid": tenant_id},
    ).fetchone()
    if not row:
        return {
            "name": "Tendent",
            "primary_color": "#6366f1",
            "accent_color": "#ec4899",
        }
    return {
        "name": row[0],
        "app_name": row[1] or row[0],
        "logo_url": row[2],
        "favicon_url": row[3],
        "primary_color": row[4] or "#6366f1",
        "secondary_color": row[5] or "#1e293b",
        "accent_color": row[6] or "#8b5cf6",
        "font_family": row[7] or "Inter",
        "slug": row[8],
    }


# ───────────────────────────────────── Template CRUD ──

@router.get("", response_model=list[TemplateResponse])
def list_templates(
    active_only: bool = False,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("quotation", "read")),
):
    tenant_id = _tenant_id(current_user)
    q = db.query(QuotationTemplate).filter(
        QuotationTemplate.tenant_id == tenant_id,
        QuotationTemplate.is_deleted == False,  # noqa: E712
    )
    if active_only:
        q = q.filter(QuotationTemplate.is_active == True)  # noqa: E712
    return q.order_by(QuotationTemplate.id.desc()).all()


@router.post("", response_model=TemplateResponse, status_code=201)
def create_template(
    payload: TemplateCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("quotation", "create")),
):
    tenant_id = _tenant_id(current_user)

    # Ensure unique slug per tenant
    existing = (
        db.query(QuotationTemplate)
        .filter(
            QuotationTemplate.tenant_id == tenant_id,
            QuotationTemplate.slug == payload.slug,
            QuotationTemplate.is_deleted == False,  # noqa: E712
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Slug already exists for this tenant")

    tpl = QuotationTemplate(
        tenant_id=tenant_id,
        **payload.model_dump(),
    )
    db.add(tpl)
    db.commit()
    db.refresh(tpl)
    return tpl


@router.get("/{template_id}", response_model=TemplateResponse)
def get_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("quotation", "read")),
):
    tenant_id = _tenant_id(current_user)
    tpl = (
        db.query(QuotationTemplate)
        .filter(
            QuotationTemplate.id == template_id,
            QuotationTemplate.tenant_id == tenant_id,
            QuotationTemplate.is_deleted == False,  # noqa: E712
        )
        .first()
    )
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return tpl


@router.put("/{template_id}", response_model=TemplateResponse)
def update_template(
    template_id: int,
    payload: TemplateUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("quotation", "update")),
):
    tenant_id = _tenant_id(current_user)
    tpl = (
        db.query(QuotationTemplate)
        .filter(
            QuotationTemplate.id == template_id,
            QuotationTemplate.tenant_id == tenant_id,
            QuotationTemplate.is_deleted == False,  # noqa: E712
        )
        .first()
    )
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(tpl, key, value)
    db.commit()
    db.refresh(tpl)
    return tpl


@router.delete("/{template_id}", status_code=204)
def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("quotation", "delete")),
):
    tenant_id = _tenant_id(current_user)
    tpl = (
        db.query(QuotationTemplate)
        .filter(
            QuotationTemplate.id == template_id,
            QuotationTemplate.tenant_id == tenant_id,
            QuotationTemplate.is_deleted == False,  # noqa: E712
        )
        .first()
    )
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    tpl.is_deleted = True
    tpl.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return None


# ───────────────────────────────────────── Calculate ──

@router.post("/calc", response_model=CalcResponse)
def calc_template(
    payload: CalcRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("quotation", "read")),
):
    tenant_id = _tenant_id(current_user)
    tpl = (
        db.query(QuotationTemplate)
        .filter(
            QuotationTemplate.id == payload.template_id,
            QuotationTemplate.tenant_id == tenant_id,
        )
        .first()
    )
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    result = calc_from_template(tpl, payload.form_data)
    return CalcResponse(**result)


# ═══════════════════════════════════════════════════════════════
# Offer decisions (tenant-side)
# ═══════════════════════════════════════════════════════════════
offers_router = APIRouter(
    prefix="/api/v1/quotations/{quotation_id}/offers",
    tags=["Quotation Offers"],
)


@offers_router.get("", response_model=list[OfferResponse])
def list_offers(
    quotation_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("quotation", "read")),
):
    tenant_id = _tenant_id(current_user)
    # Ensure quote belongs to tenant
    q = db.query(Quotation).filter(Quotation.id == quotation_id).first()
    if not q or (q.tenant_id and q.tenant_id != tenant_id):
        raise HTTPException(status_code=404, detail="Quotation not found")

    return (
        db.query(QuotationOffer)
        .filter(QuotationOffer.quotation_id == quotation_id)
        .order_by(QuotationOffer.created_at.desc())
        .all()
    )


@offers_router.post("/{offer_id}/decide", response_model=OfferResponse)
def decide_offer(
    quotation_id: int,
    offer_id: int,
    payload: OfferDecision,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("quotation", "update")),
):
    tenant_id = _tenant_id(current_user)
    q = db.query(Quotation).filter(Quotation.id == quotation_id).first()
    if not q or (q.tenant_id and q.tenant_id != tenant_id):
        raise HTTPException(status_code=404, detail="Quotation not found")

    offer = (
        db.query(QuotationOffer)
        .filter(
            QuotationOffer.id == offer_id,
            QuotationOffer.quotation_id == quotation_id,
        )
        .first()
    )
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    if offer.status != OfferStatus.CLIENT_PROPOSED.value:
        raise HTTPException(status_code=409, detail=f"Offer is already {offer.status}")

    now = datetime.now(timezone.utc)

    if payload.action == "approve":
        offer.status = OfferStatus.TENANT_APPROVED.value
        offer.resolved_at = now
        offer.resolved_by_user_id = _user_id(current_user)
        offer.tenant_response = payload.tenant_response
        # Update quotation final_amount + accept
        q.final_amount = offer.proposed_amount
        q.status = QuotationStatus.ACCEPTED.value
        db.add(QuotationLog(
            quotation_id=q.id,
            user_id=_user_id(current_user),
            action="offer_approved",
            details={"offer_id": offer.id, "amount": offer.proposed_amount},
        ))

    elif payload.action == "counter":
        if not payload.counter_amount or payload.counter_amount <= 0:
            raise HTTPException(status_code=400, detail="counter_amount required")
        offer.status = OfferStatus.TENANT_COUNTERED.value
        offer.resolved_at = now
        offer.resolved_by_user_id = _user_id(current_user)
        offer.tenant_response = payload.tenant_response
        # Create a new offer representing the tenant's counter
        counter = QuotationOffer(
            quotation_id=q.id,
            tenant_id=tenant_id,
            proposed_amount=payload.counter_amount,
            original_amount=q.total_amount,
            discount_pct=round((1 - payload.counter_amount / q.total_amount) * 100, 2)
                if q.total_amount else 0,
            tenant_response=payload.tenant_response,
            status=OfferStatus.TENANT_COUNTERED.value,
            resolved_by_user_id=_user_id(current_user),
        )
        db.add(counter)
        db.add(QuotationLog(
            quotation_id=q.id,
            user_id=_user_id(current_user),
            action="offer_countered",
            details={"offer_id": offer.id, "counter_amount": payload.counter_amount},
        ))

    elif payload.action == "reject":
        offer.status = OfferStatus.TENANT_REJECTED.value
        offer.resolved_at = now
        offer.resolved_by_user_id = _user_id(current_user)
        offer.tenant_response = payload.tenant_response
        db.add(QuotationLog(
            quotation_id=q.id,
            user_id=_user_id(current_user),
            action="offer_rejected",
            details={"offer_id": offer.id},
        ))

    db.commit()
    db.refresh(offer)
    return offer


# ═══════════════════════════════════════════════════════════════
# PUBLIC (no-auth) — intake + client portal
# ═══════════════════════════════════════════════════════════════
public_router = APIRouter(prefix="/api/v1/public", tags=["Public Quotation"])


@public_router.get("/intake/{tenant_slug}/{template_slug}")
def get_intake_template(
    tenant_slug: str,
    template_slug: str,
    db: Session = Depends(get_db),
):
    """Fetch a template + branding for rendering the public intake form."""
    row = db.execute(
        text("SELECT id FROM platform_tenants WHERE slug = :s AND is_active = 1"),
        {"s": tenant_slug},
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Tenant not found")
    tenant_id = row[0]

    tpl = (
        db.query(QuotationTemplate)
        .filter(
            QuotationTemplate.tenant_id == tenant_id,
            QuotationTemplate.slug == template_slug,
            QuotationTemplate.is_active == True,  # noqa: E712
            QuotationTemplate.is_deleted == False,  # noqa: E712
        )
        .first()
    )
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")

    branding = _load_tenant_branding(db, tenant_id)

    return {
        "template": {
            "id": tpl.id,
            "name": tpl.name,
            "slug": tpl.slug,
            "description": tpl.description,
            "icon": tpl.icon,
            "engine": tpl.engine,
            "fields_schema": tpl.fields_schema,
            "terms_conditions": tpl.terms_conditions,
        },
        "tenant": branding,
    }


@public_router.post("/intake/{tenant_slug}/{template_slug}", status_code=201)
def submit_intake(
    tenant_slug: str,
    template_slug: str,
    payload: IntakeSubmit,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Public intake submission.
        1. Resolve tenant + template
        2. Create ClientIntake row
        3. Auto-calculate BOQ
        4. Create DRAFT Quotation linked to the intake
        5. Return { intake_id, quotation_id, preview_url }
    """
    row = db.execute(
        text("SELECT id FROM platform_tenants WHERE slug = :s AND is_active = 1"),
        {"s": tenant_slug},
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Tenant not found")
    tenant_id = row[0]

    tpl = (
        db.query(QuotationTemplate)
        .filter(
            QuotationTemplate.tenant_id == tenant_id,
            QuotationTemplate.slug == template_slug,
            QuotationTemplate.is_active == True,  # noqa: E712
            QuotationTemplate.is_deleted == False,  # noqa: E712
        )
        .first()
    )
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")

    # 1. Create intake row
    intake = ClientIntake(
        tenant_id=tenant_id,
        template_id=tpl.id,
        client_name=payload.client_name,
        client_email=payload.client_email,
        client_phone=payload.client_phone,
        client_company=payload.client_company,
        client_location=payload.client_location,
        form_data=payload.form_data,
        status=IntakeStatus.PROCESSING.value,
        source_ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "")[:500],
    )
    db.add(intake)
    db.flush()

    # 2. Auto-calculate
    calc = calc_from_template(tpl, payload.form_data)
    intake.calc_result = calc

    # 3. Create draft quotation
    valid_until = datetime.now(timezone.utc) + timedelta(days=tpl.default_validity_days)
    project_name = (
        payload.form_data.get("project_name")
        or f"{tpl.name} for {payload.client_name}"
    )
    quote = Quotation(
        tenant_id=tenant_id,
        template_id=tpl.id,
        intake_id=intake.id,
        lead_id=0,  # no CRM lead yet
        user_id="public-intake",
        project_name=project_name,
        client_name=payload.client_name,
        client_phone=payload.client_phone,
        client_email=payload.client_email,
        client_location=payload.client_location,
        building_params=payload.form_data if tpl.engine == "peb" else None,
        form_data=payload.form_data,
        boq_results=calc,
        total_amount=float(calc.get("total_amount") or 0),
        rate_per_sqft=float(calc.get("rate_per_sqft") or 0),
        status=QuotationStatus.DRAFT.value,
        negotiation_enabled=bool(tpl.negotiation_enabled),
        max_discount_pct=float(tpl.max_discount_pct or 0),
        valid_until=valid_until,
    )
    db.add(quote)
    db.flush()
    intake.quotation_id = quote.id
    intake.status = IntakeStatus.READY.value

    db.add(QuotationLog(
        quotation_id=quote.id,
        user_id="public-intake",
        action="intake_submitted",
        details={
            "intake_id": intake.id,
            "template_id": tpl.id,
            "total": quote.total_amount,
        },
    ))

    db.commit()
    db.refresh(quote)
    db.refresh(intake)

    # NOTE: Background job to generate 3D/drawings/AI render lives in Task #22
    # For now, we leave those URL fields null; the review inbox shows
    # "renders pending" until the worker produces them.

    return {
        "intake_id": intake.id,
        "quotation_id": quote.id,
        "status": intake.status,
        "total_amount": quote.total_amount,
        "message": "Thank you! Your quote request has been received. Our team will review and send you the final quotation shortly.",
    }


# ───────────────────────────────────────── Portal (signed token) ──

@public_router.get("/quote/{token}", response_model=PublicQuoteView)
def public_view_quote(
    token: str,
    request: Request,
    db: Session = Depends(get_db),
):
    token_row = get_token(db, token)
    if not token_row:
        raise HTTPException(status_code=404, detail="Invalid or expired link")

    record_access(db, token_row, ip=request.client.host if request.client else None)

    quote = db.query(Quotation).filter(Quotation.id == token_row.quotation_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quotation not found")

    branding = _load_tenant_branding(db, quote.tenant_id or token_row.tenant_id)

    template_name = None
    if quote.template_id:
        tpl = db.query(QuotationTemplate).filter(QuotationTemplate.id == quote.template_id).first()
        if tpl:
            template_name = tpl.name

    min_acceptable = (
        round(quote.total_amount * (1 - (quote.max_discount_pct or 0) / 100), 2)
        if quote.total_amount
        else 0.0
    )

    offers = (
        db.query(QuotationOffer)
        .filter(QuotationOffer.quotation_id == quote.id)
        .order_by(QuotationOffer.created_at.desc())
        .all()
    )
    offers_public = [
        {
            "id": o.id,
            "proposed_amount": o.proposed_amount,
            "discount_pct": o.discount_pct,
            "status": o.status,
            "client_message": o.client_message,
            "tenant_response": o.tenant_response,
            "created_at": o.created_at.isoformat() if o.created_at else None,
        }
        for o in offers
    ]

    return PublicQuoteView(
        quotation_id=quote.id,
        project_name=quote.project_name,
        client_name=quote.client_name,
        status=quote.status,
        total_amount=quote.total_amount,
        final_amount=quote.final_amount,
        revision=quote.revision,
        valid_until=quote.valid_until,
        sent_at=quote.sent_at,
        boq_results=quote.boq_results,
        render_3d_url=quote.render_3d_url,
        drawings_url=quote.drawings_url,
        ai_render_urls=quote.ai_render_urls,
        negotiation_enabled=bool(quote.negotiation_enabled),
        max_discount_pct=quote.max_discount_pct or 0.0,
        min_acceptable_amount=min_acceptable,
        tenant=branding,
        template_name=template_name,
        terms_conditions=None,  # TODO: pull from template
        offers=offers_public,
    )


@public_router.post("/quote/{token}/accept")
def public_accept_quote(token: str, db: Session = Depends(get_db)):
    token_row = get_token(db, token)
    if not token_row:
        raise HTTPException(status_code=404, detail="Invalid or expired link")

    quote = db.query(Quotation).filter(Quotation.id == token_row.quotation_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quotation not found")

    if quote.status in (QuotationStatus.ACCEPTED.value, QuotationStatus.REJECTED.value):
        raise HTTPException(status_code=409, detail=f"Quotation already {quote.status}")

    quote.status = QuotationStatus.ACCEPTED.value
    quote.final_amount = quote.final_amount or quote.total_amount
    db.add(QuotationLog(
        quotation_id=quote.id,
        user_id="client-portal",
        action="quote_accepted",
        details={"final_amount": quote.final_amount},
    ))
    db.commit()
    return {"status": "accepted", "final_amount": quote.final_amount}


@public_router.post("/quote/{token}/reject")
def public_reject_quote(token: str, db: Session = Depends(get_db)):
    token_row = get_token(db, token)
    if not token_row:
        raise HTTPException(status_code=404, detail="Invalid or expired link")
    quote = db.query(Quotation).filter(Quotation.id == token_row.quotation_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quotation not found")
    if quote.status == QuotationStatus.REJECTED.value:
        return {"status": "rejected"}
    quote.status = QuotationStatus.REJECTED.value
    db.add(QuotationLog(
        quotation_id=quote.id,
        user_id="client-portal",
        action="quote_rejected",
    ))
    db.commit()
    return {"status": "rejected"}


@public_router.post("/quote/{token}/offer", response_model=OfferResponse)
def public_propose_offer(
    token: str,
    payload: OfferPropose,
    db: Session = Depends(get_db),
):
    """
    Client proposes a counter-price. System enforces the tenant's floor:
        min_acceptable = total_amount * (1 - max_discount_pct / 100)

    Below floor  → auto_rejected immediately, 409 with reject message
    Within floor → client_proposed, tenant gets 1-click decision
    """
    token_row = get_token(db, token)
    if not token_row:
        raise HTTPException(status_code=404, detail="Invalid or expired link")

    quote = db.query(Quotation).filter(Quotation.id == token_row.quotation_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quotation not found")

    if not quote.negotiation_enabled:
        raise HTTPException(status_code=403, detail="Negotiation is disabled for this quote")

    if quote.status in (QuotationStatus.ACCEPTED.value, QuotationStatus.REJECTED.value):
        raise HTTPException(status_code=409, detail=f"Quotation is {quote.status}")

    original = quote.total_amount
    if original <= 0:
        raise HTTPException(status_code=400, detail="Quote has no base amount")

    proposed = float(payload.proposed_amount)
    discount_pct = round((1 - proposed / original) * 100, 2)
    min_acceptable = original * (1 - (quote.max_discount_pct or 0) / 100)

    # Load template for custom reject message
    reject_msg = None
    if quote.template_id:
        tpl = db.query(QuotationTemplate).filter(QuotationTemplate.id == quote.template_id).first()
        if tpl and tpl.negotiation_reject_message:
            reject_msg = tpl.negotiation_reject_message.format(
                min_price=f"{min_acceptable:,.0f}"
            )

    # BELOW FLOOR → auto reject
    if proposed < min_acceptable:
        offer = QuotationOffer(
            quotation_id=quote.id,
            tenant_id=quote.tenant_id or token_row.tenant_id,
            proposed_amount=proposed,
            original_amount=original,
            discount_pct=discount_pct,
            client_message=payload.client_message,
            tenant_response=reject_msg or "Below minimum acceptable price",
            status=OfferStatus.AUTO_REJECTED.value,
            resolved_at=datetime.now(timezone.utc),
        )
        db.add(offer)
        db.add(QuotationLog(
            quotation_id=quote.id,
            user_id="client-portal",
            action="offer_auto_rejected",
            details={
                "proposed": proposed,
                "discount_pct": discount_pct,
                "floor": min_acceptable,
            },
        ))
        db.commit()
        raise HTTPException(
            status_code=409,
            detail={
                "error": "below_floor",
                "message": reject_msg or f"Minimum acceptable price is {min_acceptable:,.0f}",
                "min_acceptable_amount": round(min_acceptable, 2),
            },
        )

    # WITHIN FLOOR → await tenant decision
    offer = QuotationOffer(
        quotation_id=quote.id,
        tenant_id=quote.tenant_id or token_row.tenant_id,
        proposed_amount=proposed,
        original_amount=original,
        discount_pct=discount_pct,
        client_message=payload.client_message,
        status=OfferStatus.CLIENT_PROPOSED.value,
    )
    db.add(offer)
    db.add(QuotationLog(
        quotation_id=quote.id,
        user_id="client-portal",
        action="offer_proposed",
        details={"proposed": proposed, "discount_pct": discount_pct},
    ))
    db.commit()
    db.refresh(offer)
    return offer


@public_router.post("/quote/{token}/ask")
def public_ask_question(
    token: str,
    payload: PublicQuestion,
    db: Session = Depends(get_db),
):
    token_row = get_token(db, token)
    if not token_row:
        raise HTTPException(status_code=404, detail="Invalid or expired link")
    quote = db.query(Quotation).filter(Quotation.id == token_row.quotation_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quotation not found")

    db.add(QuotationLog(
        quotation_id=quote.id,
        user_id="client-portal",
        action="client_question",
        details={"message": payload.message[:2000]},
    ))
    db.commit()
    return {"status": "received", "message": "Your question has been sent to the team."}


# ═══════════════════════════════════════════════════════════════
# Tenant: generate portal token for a quotation (before send)
# ═══════════════════════════════════════════════════════════════
@router.post("/tokens/{quotation_id}")
def generate_portal_token_for_quote(
    quotation_id: int,
    expires_in_days: int = 30,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("quotation", "update")),
):
    tenant_id = _tenant_id(current_user)
    quote = db.query(Quotation).filter(Quotation.id == quotation_id).first()
    if not quote or (quote.tenant_id and quote.tenant_id != tenant_id):
        raise HTTPException(status_code=404, detail="Quotation not found")

    token_row = create_token(
        db,
        quotation_id=quote.id,
        tenant_id=tenant_id,
        kind=PortalTokenKind.VIEW.value,
        expires_in_days=expires_in_days,
    )
    return {
        "token": token_row.token,
        "kind": token_row.kind,
        "expires_at": token_row.expires_at.isoformat(),
    }


@router.post("/tokens/{quotation_id}/revoke")
def revoke_portal_tokens(
    quotation_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("quotation", "update")),
):
    tenant_id = _tenant_id(current_user)
    quote = db.query(Quotation).filter(Quotation.id == quotation_id).first()
    if not quote or (quote.tenant_id and quote.tenant_id != tenant_id):
        raise HTTPException(status_code=404, detail="Quotation not found")
    count = revoke_tokens_for_quotation(db, quotation_id)
    return {"revoked": count}
