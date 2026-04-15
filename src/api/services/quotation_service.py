"""
Swetha Structures CRM - Quotation Service
===========================================
Business logic for PEB quotations with full audit logging.
"""

import logging
import os
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

from api.models.quotation import Quotation, QuotationLog, QuotationStatus
from api.models.crm import Lead
from api.services.boq_engine import generate_full_boq
from api.services.pdf_engine import generate_quotation_pdf
from api.config import settings

logger = logging.getLogger(__name__)


# ── Audit Log Helper ─────────────────────────────────────────────


def _log_action(
    db: Session,
    quotation_id: int,
    user_id: str,
    action: str,
    details: Optional[dict] = None,
) -> QuotationLog:
    """Create an immutable audit log entry."""
    log = QuotationLog(
        quotation_id=quotation_id,
        user_id=user_id,
        action=action,
        details=details or {},
    )
    db.add(log)
    return log


# ── User ID Helper ───────────────────────────────────────────────


def _get_user_id(current_user: dict) -> int:
    raw = current_user.get("id", 1)
    if isinstance(raw, int):
        return raw
    try:
        return int(raw)
    except (ValueError, TypeError):
        return 1


# ── Calculate BOQ (no save) ──────────────────────────────────────


def calculate_boq(params: dict) -> dict:
    """Calculate BOQ from building parameters without saving."""
    return generate_full_boq(params)


# ── Create Quotation ─────────────────────────────────────────────


def create_quotation(
    db: Session,
    lead_id: Optional[int],
    user_id: str,
    project_name: str,
    building_params: dict,
    client_name: Optional[str] = None,
    client_location: Optional[str] = None,
) -> Quotation:
    """Create a new quotation, optionally linked to a CRM lead."""
    lead = None
    if lead_id:
        lead = db.query(Lead).filter(Lead.id == lead_id).first()
        if not lead:
            raise ValueError(f"Lead {lead_id} not found")

    # Calculate BOQ
    boq = generate_full_boq(building_params)

    quotation = Quotation(
        lead_id=lead_id,
        user_id=user_id,
        project_name=project_name,
        client_name=client_name or (getattr(lead, "name", None) if lead else None),
        client_location=client_location,
        building_params=building_params,
        boq_results=boq,
        total_amount=boq["total_amount"],
        rate_per_sqft=boq["rate_per_sqft"],
        status=QuotationStatus.DRAFT.value,
        revision=1,
    )
    db.add(quotation)
    db.flush()  # get ID before logging

    _log_action(db, quotation.id, user_id, "created", {
        "project_name": project_name,
        "lead_id": lead_id,
        "total_amount": boq["total_amount"],
    })

    db.commit()
    db.refresh(quotation)

    logger.info("Quotation created: id=%s lead=%s user=%s", quotation.id, lead_id, user_id)
    return quotation


# ── Update Quotation ─────────────────────────────────────────────


def update_quotation(
    db: Session,
    quotation_id: int,
    user_id: str,
    updates: dict,
) -> Quotation:
    """Update a quotation and recalculate BOQ if params changed.

    SECURITY: caller must own the quotation.
    """
    quotation = db.query(Quotation).filter(
        Quotation.id == quotation_id,
        Quotation.user_id == user_id,
        Quotation.is_deleted == False,  # noqa: E712
    ).first()
    if not quotation:
        raise ValueError(f"Quotation {quotation_id} not found")

    changes = {}
    for field in ("project_name", "client_name", "client_location"):
        if field in updates and updates[field] is not None:
            old = getattr(quotation, field)
            setattr(quotation, field, updates[field])
            changes[field] = {"old": old, "new": updates[field]}

    if "building_params" in updates and updates["building_params"] is not None:
        params = updates["building_params"]
        if isinstance(params, dict):
            quotation.building_params = params
        else:
            quotation.building_params = params.model_dump()
        boq = generate_full_boq(quotation.building_params)
        quotation.boq_results = boq
        quotation.total_amount = boq["total_amount"]
        quotation.rate_per_sqft = boq["rate_per_sqft"]
        changes["boq_recalculated"] = True

    _log_action(db, quotation.id, user_id, "updated", changes)

    db.commit()
    db.refresh(quotation)
    return quotation


# ── Generate PDF ─────────────────────────────────────────────────


def generate_pdf(db: Session, quotation_id: int, user_id: str) -> bytes:
    """Generate PDF for a quotation. SECURITY: caller must own the quotation."""
    quotation = db.query(Quotation).filter(
        Quotation.id == quotation_id,
        Quotation.user_id == user_id,
        Quotation.is_deleted == False,  # noqa: E712
    ).first()
    if not quotation:
        raise ValueError(f"Quotation {quotation_id} not found")

    # Merge building params with project info for PDF
    pdf_data = {**(quotation.building_params or {})}
    pdf_data["project_name"] = quotation.project_name
    pdf_data["client_name"] = quotation.client_name or ""
    pdf_data["client_location"] = quotation.client_location or ""

    pdf_bytes = generate_quotation_pdf(pdf_data, quotation.boq_results)

    # Save to disk
    pdf_dir = settings.PEB_QUOTATIONS_DIR
    os.makedirs(pdf_dir, exist_ok=True)
    filename = f"quotation_{quotation.id}_rev{quotation.revision}.pdf"
    filepath = os.path.join(pdf_dir, filename)
    with open(filepath, "wb") as f:
        f.write(pdf_bytes)

    quotation.pdf_path = filepath
    _log_action(db, quotation.id, user_id, "pdf_generated", {"filename": filename})
    db.commit()

    return pdf_bytes


# ── Change Status ────────────────────────────────────────────────


def change_status(
    db: Session,
    quotation_id: int,
    user_id: str,
    new_status: str,
) -> Quotation:
    """Change quotation status. SECURITY: caller must own the quotation."""
    quotation = db.query(Quotation).filter(
        Quotation.id == quotation_id,
        Quotation.user_id == user_id,
        Quotation.is_deleted == False,  # noqa: E712
    ).first()
    if not quotation:
        raise ValueError(f"Quotation {quotation_id} not found")

    old_status = quotation.status
    quotation.status = new_status

    action = "sent" if new_status == "sent" else "status_changed"
    _log_action(db, quotation.id, user_id, action, {
        "old_status": old_status,
        "new_status": new_status,
    })

    db.commit()
    db.refresh(quotation)
    return quotation


# ── Create Revision ──────────────────────────────────────────────


def create_revision(
    db: Session,
    quotation_id: int,
    user_id: str,
) -> Quotation:
    """Create a new revision from an existing quotation. SECURITY: caller must own the original."""
    original = db.query(Quotation).filter(
        Quotation.id == quotation_id,
        Quotation.user_id == user_id,
        Quotation.is_deleted == False,  # noqa: E712
    ).first()
    if not original:
        raise ValueError(f"Quotation {quotation_id} not found")

    # Mark original as revised
    original.status = QuotationStatus.REVISED.value

    new_q = Quotation(
        lead_id=original.lead_id,
        user_id=user_id,
        project_name=original.project_name,
        client_name=original.client_name,
        client_location=original.client_location,
        building_params=original.building_params,
        boq_results=original.boq_results,
        total_amount=original.total_amount,
        rate_per_sqft=original.rate_per_sqft,
        status=QuotationStatus.DRAFT.value,
        revision=original.revision + 1,
        parent_quotation_id=original.id,
    )
    db.add(new_q)
    db.flush()

    _log_action(db, original.id, user_id, "revised", {
        "new_quotation_id": new_q.id,
        "new_revision": new_q.revision,
    })
    _log_action(db, new_q.id, user_id, "created", {
        "revision_of": original.id,
        "revision": new_q.revision,
    })

    db.commit()
    db.refresh(new_q)
    return new_q


# ── Soft Delete ──────────────────────────────────────────────────


def delete_quotation(db: Session, quotation_id: int, user_id: str) -> None:
    """Soft-delete a quotation. SECURITY: caller must own the quotation."""
    quotation = db.query(Quotation).filter(
        Quotation.id == quotation_id,
        Quotation.user_id == user_id,
        Quotation.is_deleted == False,  # noqa: E712
    ).first()
    if not quotation:
        raise ValueError(f"Quotation {quotation_id} not found")

    quotation.is_deleted = True
    quotation.deleted_at = datetime.now(timezone.utc)

    _log_action(db, quotation.id, user_id, "deleted", {})
    db.commit()


# ── List Quotations ──────────────────────────────────────────────


def list_quotations(
    db: Session,
    user_id: str,
    lead_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Quotation], int]:
    """List quotations with filters and pagination. SECURITY: scoped to user_id."""
    query = db.query(Quotation).filter(
        Quotation.user_id == user_id,
        Quotation.is_deleted == False,  # noqa: E712
    )

    if lead_id:
        query = query.filter(Quotation.lead_id == lead_id)
    if status_filter:
        query = query.filter(Quotation.status == status_filter)
    if search:
        query = query.filter(Quotation.project_name.ilike(f"%{search}%"))

    total = query.count()
    offset = (page - 1) * page_size
    items = query.order_by(Quotation.created_at.desc()).offset(offset).limit(page_size).all()

    return items, total


# ── Get Logs ─────────────────────────────────────────────────────


def get_quotation_logs(db: Session, quotation_id: int, user_id: str) -> list[QuotationLog]:
    """Get all audit logs for a quotation. SECURITY: caller must own the quotation."""
    # First verify ownership of the quotation
    owned = db.query(Quotation).filter(
        Quotation.id == quotation_id,
        Quotation.user_id == user_id,
    ).first()
    if not owned:
        raise ValueError(f"Quotation {quotation_id} not found")
    return (
        db.query(QuotationLog)
        .filter(QuotationLog.quotation_id == quotation_id)
        .order_by(QuotationLog.created_at.desc())
        .all()
    )


# ── Stats ────────────────────────────────────────────────────────


def get_stats(db: Session, user_id: str) -> dict:
    """Get quotation dashboard statistics. SECURITY: scoped to user_id."""
    base = db.query(Quotation).filter(
        Quotation.user_id == user_id,
        Quotation.is_deleted == False,  # noqa: E712
    )

    total = base.count()
    draft = base.filter(Quotation.status == "draft").count()
    sent = base.filter(Quotation.status == "sent").count()
    accepted = base.filter(Quotation.status == "accepted").count()
    rejected = base.filter(Quotation.status == "rejected").count()
    revised = base.filter(Quotation.status == "revised").count()

    total_amount = db.query(func.coalesce(func.sum(Quotation.total_amount), 0.0)).filter(
        Quotation.is_deleted == False,  # noqa: E712
        Quotation.status == "accepted",
    ).scalar()

    # Monthly (current month)
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    monthly_amount = db.query(func.coalesce(func.sum(Quotation.total_amount), 0.0)).filter(
        Quotation.is_deleted == False,  # noqa: E712
        Quotation.status == "accepted",
        Quotation.created_at >= month_start,
    ).scalar()

    return {
        "total": total,
        "draft": draft,
        "sent": sent,
        "accepted": accepted,
        "rejected": rejected,
        "revised": revised,
        "total_amount": float(total_amount),
        "monthly_amount": float(monthly_amount),
    }
