"""
VoiceFlow Marketing AI - CRM Router
=====================================
Full CRUD endpoints for Leads, Companies, Contacts, Deals, Activities,
and a CRM dashboard aggregation endpoint.

All endpoints require JWT authentication and enforce tenant isolation via user_id.

API prefix: /api/v1
Tags: CRM
"""

import csv
import io
import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from api.database import get_db
from api.permissions import require_permission
from api.schemas.common import MessageResponse, PaginatedResponse
from api.schemas.crm import (
    ActivityCreate,
    ActivityResponse,
    ActivityUpdate,
    CompanyCreate,
    CompanyResponse,
    CompanyUpdate,
    ContactCreate,
    ContactResponse,
    ContactUpdate,
    DealCreate,
    DealResponse,
    DealUpdate,
    LeadCreate,
    LeadResponse,
    LeadUpdate,
)
from api.services import crm_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["CRM"])


# ── Helpers ──────────────────────────────────────────────────────────


def _get_user_id(current_user: dict) -> str:
    """Extract user_id string from the current user dict.

    The legacy auth system stores ``id`` as a TEXT string (e.g. "user-001").
    CRM models use String user_id to match.
    """
    return str(current_user.get("id", "user-001"))


def _get_orm_db(conn) -> Session:
    """Return a proper SQLAlchemy ORM Session.

    ``get_db()`` in dependencies.py yields a raw connection (legacy), while
    ``get_db()`` in database.py yields an ORM session.  We import the ORM
    version directly so we always get a Session.
    """
    # If it is already a Session, just return it.
    if isinstance(conn, Session):
        return conn
    # Otherwise open a fresh ORM session from the database module.
    from api.database import get_session_factory
    return get_session_factory()()


# =====================================================================
# LEADS
# =====================================================================


@router.get(
    "/crm-leads",
    response_model=PaginatedResponse,
    summary="List leads (paginated, filterable)",
)
async def list_leads(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=100, description="Page size"),
    status: Optional[str] = Query(None, description="Filter by lead status"),
    source: Optional[str] = Query(None, description="Filter by lead source"),
    assigned_to: Optional[int] = Query(None, description="Filter by assigned user ID"),
    search: Optional[str] = Query(None, description="Search in name, email, phone, company"),
    current_user: dict = Depends(require_permission("crm", "read")),
    db: Session = Depends(get_db),
):
    """Return a paginated list of leads owned by the authenticated user."""
    session = _get_orm_db(db)
    user_id = _get_user_id(current_user)
    result = crm_service.get_leads(
        db=session,
        user_id=user_id,
        skip=skip,
        limit=limit,
        status=status,
        source=source,
        assigned_to=assigned_to,
        search=search,
    )
    return PaginatedResponse(**result)


@router.post(
    "/crm-leads",
    response_model=LeadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new lead",
)
async def create_lead(
    body: LeadCreate,
    current_user: dict = Depends(require_permission("crm", "create")),
    db: Session = Depends(get_db),
):
    """Create a new lead under the authenticated user's tenant."""
    session = _get_orm_db(db)
    user_id = _get_user_id(current_user)
    data = body.model_dump(exclude_none=False)
    result = crm_service.create_lead(db=session, user_id=user_id, data=data)
    # Broadcast real-time event
    from api.broadcast import broadcast_event
    await broadcast_event("lead.created", result)
    return LeadResponse(**result)


@router.get(
    "/crm-leads/{lead_id}",
    response_model=LeadResponse,
    summary="Get lead detail with voice analyses",
)
async def get_lead(
    lead_id: int,
    current_user: dict = Depends(require_permission("crm", "read")),
    db: Session = Depends(get_db),
):
    """Get a single lead by ID, including attached voice analyses."""
    session = _get_orm_db(db)
    user_id = _get_user_id(current_user)
    result = crm_service.get_lead_by_id(db=session, user_id=user_id, lead_id=lead_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    return result


@router.put(
    "/crm-leads/{lead_id}",
    response_model=LeadResponse,
    summary="Update an existing lead",
)
async def update_lead(
    lead_id: int,
    body: LeadUpdate,
    current_user: dict = Depends(require_permission("crm", "update")),
    db: Session = Depends(get_db),
):
    """Update an existing lead (partial update). Only non-null fields are applied."""
    session = _get_orm_db(db)
    user_id = _get_user_id(current_user)
    data = body.model_dump(exclude_none=True)
    result = crm_service.update_lead(db=session, user_id=user_id, lead_id=lead_id, data=data)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    from api.broadcast import broadcast_event
    await broadcast_event("lead.updated", result)
    return LeadResponse(**result)


@router.delete(
    "/crm-leads/{lead_id}",
    response_model=MessageResponse,
    summary="Soft-delete a lead",
)
async def delete_lead(
    lead_id: int,
    current_user: dict = Depends(require_permission("crm", "delete")),
    db: Session = Depends(get_db),
):
    """Soft-delete a lead (sets is_deleted=True)."""
    session = _get_orm_db(db)
    user_id = _get_user_id(current_user)
    success = crm_service.delete_lead(db=session, user_id=user_id, lead_id=lead_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    from api.broadcast import broadcast_event
    await broadcast_event("lead.deleted", {"id": lead_id})
    return MessageResponse(message="Lead deleted successfully", success=True)


@router.post(
    "/crm-leads/import",
    summary="Import leads from CSV file",
)
async def import_leads_csv(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_permission("crm", "create")),
    db: Session = Depends(get_db),
):
    """Import leads from a CSV file. Expected columns: Name, Email, Phone, Company, Source."""
    MAX_BYTES = 5 * 1024 * 1024
    MAX_ROWS = 5000
    ALLOWED_MIME = {"text/csv", "application/vnd.ms-excel", "application/csv", "text/plain"}

    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted")
    if file.content_type and file.content_type not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail=f"Unsupported MIME type: {file.content_type}")

    session = _get_orm_db(db)
    user_id = _get_user_id(current_user)

    content = await file.read()
    if len(content) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="CSV file exceeds 5 MB limit")

    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="CSV must be UTF-8 encoded")

    reader = csv.DictReader(io.StringIO(text))

    imported = 0
    skipped = 0
    errors = []

    for i, row in enumerate(reader, start=2):
        if i - 1 > MAX_ROWS:
            errors.append(f"Row {i}: row limit ({MAX_ROWS}) exceeded — remaining rows ignored")
            break

        # Normalize column names to lowercase
        row = {k.strip().lower(): (v or "").strip() for k, v in row.items() if k}

        name = row.get("name", "")
        if not name:
            skipped += 1
            continue

        name_parts = name.split(None, 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else None

        phone = row.get("phone", "") or row.get("mobile", "")
        if not phone:
            errors.append(f"Row {i}: missing phone/mobile")
            skipped += 1
            continue

        data = {
            "first_name": first_name,
            "last_name": last_name,
            "phone": phone,
            "email": row.get("email") or None,
            "company": row.get("company") or row.get("company_name") or None,
            "source": row.get("source") or "CSV Import",
            "status": "new",
            "tags": ["csv-import"],
        }
        try:
            crm_service.create_lead(db=session, user_id=user_id, data=data)
            imported += 1
        except Exception as exc:
            errors.append(f"Row {i}: {str(exc)[:80]}")
            skipped += 1

    logger.info("CSV import: %d imported, %d skipped, user=%s", imported, skipped, user_id)
    return {
        "imported": imported,
        "skipped": skipped,
        "errors": errors[:10],
        "count": imported,
    }


# =====================================================================
# COMPANIES
# =====================================================================


@router.get(
    "/crm-companies",
    response_model=PaginatedResponse,
    summary="List companies (paginated)",
)
async def list_companies(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search by name, email, phone"),
    industry: Optional[str] = Query(None, description="Filter by industry"),
    current_user: dict = Depends(require_permission("crm", "read")),
    db: Session = Depends(get_db),
):
    """Return a paginated list of companies owned by the authenticated user."""
    session = _get_orm_db(db)
    user_id = _get_user_id(current_user)
    result = crm_service.get_companies(
        db=session, user_id=user_id, skip=skip, limit=limit,
        search=search, industry=industry,
    )
    return PaginatedResponse(**result)


@router.post(
    "/crm-companies",
    response_model=CompanyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new company",
)
async def create_company(
    body: CompanyCreate,
    current_user: dict = Depends(require_permission("crm", "create")),
    db: Session = Depends(get_db),
):
    """Create a new company under the authenticated user's tenant."""
    session = _get_orm_db(db)
    user_id = _get_user_id(current_user)
    data = body.model_dump(exclude_none=False)
    result = crm_service.create_company(db=session, user_id=user_id, data=data)
    from api.broadcast import broadcast_event
    await broadcast_event("company.created", result)
    return CompanyResponse(**result)


@router.get(
    "/crm-companies/{company_id}",
    response_model=CompanyResponse,
    summary="Get company with contacts and deals",
)
async def get_company(
    company_id: int,
    current_user: dict = Depends(require_permission("crm", "read")),
    db: Session = Depends(get_db),
):
    """Get a single company by ID, with attached contacts and deals."""
    session = _get_orm_db(db)
    user_id = _get_user_id(current_user)
    result = crm_service.get_company_by_id(db=session, user_id=user_id, company_id=company_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
    return result


@router.put(
    "/crm-companies/{company_id}",
    response_model=CompanyResponse,
    summary="Update a company",
)
async def update_company(
    company_id: int,
    body: CompanyUpdate,
    current_user: dict = Depends(require_permission("crm", "update")),
    db: Session = Depends(get_db),
):
    """Update an existing company (partial update)."""
    session = _get_orm_db(db)
    user_id = _get_user_id(current_user)
    data = body.model_dump(exclude_none=True)
    result = crm_service.update_company(db=session, user_id=user_id, company_id=company_id, data=data)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
    from api.broadcast import broadcast_event
    await broadcast_event("company.updated", result)
    return CompanyResponse(**result)


@router.delete(
    "/crm-companies/{company_id}",
    response_model=MessageResponse,
    summary="Delete a company",
)
async def delete_company(
    company_id: int,
    current_user: dict = Depends(require_permission("crm", "delete")),
    db: Session = Depends(get_db),
):
    """Soft-delete a company."""
    session = _get_orm_db(db)
    user_id = _get_user_id(current_user)
    success = crm_service.delete_company(db=session, user_id=user_id, company_id=company_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
    from api.broadcast import broadcast_event
    await broadcast_event("company.deleted", {"id": company_id})
    return MessageResponse(message="Company deleted successfully", success=True)


# =====================================================================
# CONTACTS
# =====================================================================


@router.get(
    "/crm-contacts",
    response_model=PaginatedResponse,
    summary="List contacts (paginated, filterable by company)",
)
async def list_contacts(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    company_id: Optional[int] = Query(None, description="Filter by company ID"),
    search: Optional[str] = Query(None, description="Search in name, email, phone"),
    current_user: dict = Depends(require_permission("crm", "read")),
    db: Session = Depends(get_db),
):
    """Return a paginated list of contacts owned by the authenticated user."""
    session = _get_orm_db(db)
    user_id = _get_user_id(current_user)
    result = crm_service.get_contacts(
        db=session, user_id=user_id, skip=skip, limit=limit,
        company_id=company_id, search=search,
    )
    return PaginatedResponse(**result)


@router.post(
    "/crm-contacts",
    response_model=ContactResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new contact",
)
async def create_contact(
    body: ContactCreate,
    current_user: dict = Depends(require_permission("crm", "create")),
    db: Session = Depends(get_db),
):
    """Create a new contact under the authenticated user's tenant."""
    session = _get_orm_db(db)
    user_id = _get_user_id(current_user)
    data = body.model_dump(exclude_none=False)
    result = crm_service.create_contact(db=session, user_id=user_id, data=data)
    from api.broadcast import broadcast_event
    await broadcast_event("contact.created", result)
    return ContactResponse(**result)


@router.get(
    "/crm-contacts/{contact_id}",
    response_model=ContactResponse,
    summary="Get contact detail",
)
async def get_contact(
    contact_id: int,
    current_user: dict = Depends(require_permission("crm", "read")),
    db: Session = Depends(get_db),
):
    """Get a single contact by ID."""
    session = _get_orm_db(db)
    user_id = _get_user_id(current_user)
    result = crm_service.get_contact_by_id(db=session, user_id=user_id, contact_id=contact_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
    return ContactResponse(**result)


@router.put(
    "/crm-contacts/{contact_id}",
    response_model=ContactResponse,
    summary="Update a contact",
)
async def update_contact(
    contact_id: int,
    body: ContactUpdate,
    current_user: dict = Depends(require_permission("crm", "update")),
    db: Session = Depends(get_db),
):
    """Update an existing contact (partial update)."""
    session = _get_orm_db(db)
    user_id = _get_user_id(current_user)
    data = body.model_dump(exclude_none=True)
    result = crm_service.update_contact(db=session, user_id=user_id, contact_id=contact_id, data=data)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
    from api.broadcast import broadcast_event
    await broadcast_event("contact.updated", result)
    return ContactResponse(**result)


@router.delete(
    "/crm-contacts/{contact_id}",
    response_model=MessageResponse,
    summary="Delete a contact",
)
async def delete_contact(
    contact_id: int,
    current_user: dict = Depends(require_permission("crm", "delete")),
    db: Session = Depends(get_db),
):
    """Soft-delete a contact."""
    session = _get_orm_db(db)
    user_id = _get_user_id(current_user)
    success = crm_service.delete_contact(db=session, user_id=user_id, contact_id=contact_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
    from api.broadcast import broadcast_event
    await broadcast_event("contact.deleted", {"id": contact_id})
    return MessageResponse(message="Contact deleted successfully", success=True)


# =====================================================================
# DEALS
# =====================================================================


@router.get(
    "/crm-deals",
    response_model=PaginatedResponse,
    summary="List deals (paginated, filterable by stage)",
)
async def list_deals(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    stage: Optional[str] = Query(None, description="Filter by deal stage"),
    search: Optional[str] = Query(None, description="Search by title or description"),
    current_user: dict = Depends(require_permission("crm", "read")),
    db: Session = Depends(get_db),
):
    """Return a paginated list of deals owned by the authenticated user."""
    session = _get_orm_db(db)
    user_id = _get_user_id(current_user)
    result = crm_service.get_deals(
        db=session, user_id=user_id, skip=skip, limit=limit,
        stage=stage, search=search,
    )
    return PaginatedResponse(**result)


@router.post(
    "/crm-deals",
    response_model=DealResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new deal",
)
async def create_deal(
    body: DealCreate,
    current_user: dict = Depends(require_permission("crm", "create")),
    db: Session = Depends(get_db),
):
    """Create a new deal under the authenticated user's tenant."""
    session = _get_orm_db(db)
    user_id = _get_user_id(current_user)
    data = body.model_dump(exclude_none=False)
    result = crm_service.create_deal(db=session, user_id=user_id, data=data)
    from api.broadcast import broadcast_event
    await broadcast_event("deal.created", result)
    return DealResponse(**result)


@router.get(
    "/crm-deals/{deal_id}",
    response_model=DealResponse,
    summary="Get deal detail",
)
async def get_deal(
    deal_id: int,
    current_user: dict = Depends(require_permission("crm", "read")),
    db: Session = Depends(get_db),
):
    """Get a single deal by ID with attached activities."""
    session = _get_orm_db(db)
    user_id = _get_user_id(current_user)
    result = crm_service.get_deal_by_id(db=session, user_id=user_id, deal_id=deal_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")
    return result


@router.put(
    "/crm-deals/{deal_id}",
    response_model=DealResponse,
    summary="Update a deal (including stage changes)",
)
async def update_deal(
    deal_id: int,
    body: DealUpdate,
    current_user: dict = Depends(require_permission("crm", "update")),
    db: Session = Depends(get_db),
):
    """Update an existing deal (partial update). Handles stage transitions and timestamps."""
    session = _get_orm_db(db)
    user_id = _get_user_id(current_user)
    data = body.model_dump(exclude_none=True)
    result = crm_service.update_deal(db=session, user_id=user_id, deal_id=deal_id, data=data)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")
    from api.broadcast import broadcast_event
    await broadcast_event("deal.updated", result)
    return DealResponse(**result)


@router.delete(
    "/crm-deals/{deal_id}",
    response_model=MessageResponse,
    summary="Delete a deal",
)
async def delete_deal(
    deal_id: int,
    current_user: dict = Depends(require_permission("crm", "delete")),
    db: Session = Depends(get_db),
):
    """Soft-delete a deal."""
    session = _get_orm_db(db)
    user_id = _get_user_id(current_user)
    success = crm_service.delete_deal(db=session, user_id=user_id, deal_id=deal_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")
    from api.broadcast import broadcast_event
    await broadcast_event("deal.deleted", {"id": deal_id})
    return MessageResponse(message="Deal deleted successfully", success=True)


# =====================================================================
# ACTIVITIES
# =====================================================================


@router.get(
    "/crm-activities",
    response_model=PaginatedResponse,
    summary="List activities (filterable by lead/contact/deal)",
)
async def list_activities(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    lead_id: Optional[int] = Query(None, description="Filter by lead ID"),
    contact_id: Optional[int] = Query(None, description="Filter by contact ID"),
    deal_id: Optional[int] = Query(None, description="Filter by deal ID"),
    activity_type: Optional[str] = Query(None, description="Filter by activity type"),
    current_user: dict = Depends(require_permission("crm", "read")),
    db: Session = Depends(get_db),
):
    """Return a paginated list of activities owned by the authenticated user."""
    session = _get_orm_db(db)
    user_id = _get_user_id(current_user)
    result = crm_service.get_activities(
        db=session, user_id=user_id, skip=skip, limit=limit,
        lead_id=lead_id, contact_id=contact_id, deal_id=deal_id,
        activity_type=activity_type,
    )
    return PaginatedResponse(**result)


@router.post(
    "/crm-activities",
    response_model=ActivityResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new activity",
)
async def create_activity(
    body: ActivityCreate,
    current_user: dict = Depends(require_permission("crm", "create")),
    db: Session = Depends(get_db),
):
    """Create a new activity (call log, note, task, etc.)."""
    session = _get_orm_db(db)
    user_id = _get_user_id(current_user)
    data = body.model_dump(exclude_none=False)
    try:
        result = crm_service.create_activity(db=session, user_id=user_id, data=data)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    from api.broadcast import broadcast_event
    await broadcast_event("activity.created", result)
    return ActivityResponse(**result)


@router.get(
    "/crm-activities/{activity_id}",
    response_model=ActivityResponse,
    summary="Get activity detail",
)
async def get_activity(
    activity_id: int,
    current_user: dict = Depends(require_permission("crm", "read")),
    db: Session = Depends(get_db),
):
    """Get a single activity by ID."""
    session = _get_orm_db(db)
    user_id = _get_user_id(current_user)
    result = crm_service.get_activity_by_id(db=session, user_id=user_id, activity_id=activity_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")
    return ActivityResponse(**result)


@router.put(
    "/crm-activities/{activity_id}",
    response_model=ActivityResponse,
    summary="Update an activity",
)
async def update_activity(
    activity_id: int,
    body: ActivityUpdate,
    current_user: dict = Depends(require_permission("crm", "update")),
    db: Session = Depends(get_db),
):
    """Update an existing activity (partial update)."""
    session = _get_orm_db(db)
    user_id = _get_user_id(current_user)
    result = crm_service.update_activity(
        db=session,
        user_id=user_id,
        activity_id=activity_id,
        data=body.model_dump(exclude_unset=True),
    )
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")
    from api.broadcast import broadcast_event
    await broadcast_event("activity.updated", result)
    return ActivityResponse(**result)


@router.delete(
    "/crm-activities/{activity_id}",
    response_model=MessageResponse,
    summary="Delete an activity",
)
async def delete_activity(
    activity_id: int,
    current_user: dict = Depends(require_permission("crm", "delete")),
    db: Session = Depends(get_db),
):
    """Delete an activity."""
    session = _get_orm_db(db)
    user_id = _get_user_id(current_user)
    success = crm_service.delete_activity(db=session, user_id=user_id, activity_id=activity_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")
    from api.broadcast import broadcast_event
    await broadcast_event("activity.deleted", {"id": activity_id})
    return MessageResponse(message="Activity deleted successfully", success=True)


# =====================================================================
# DASHBOARD
# =====================================================================


@router.get(
    "/dashboard",
    summary="CRM dashboard metrics",
)
async def dashboard(
    current_user: dict = Depends(require_permission("crm", "read")),
    db: Session = Depends(get_db),
):
    """Return CRM dashboard metrics: lead counts, conversion rates, pipeline value, etc."""
    session = _get_orm_db(db)
    user_id = _get_user_id(current_user)
    stats = crm_service.get_dashboard_stats(db=session, user_id=user_id)
    return stats
