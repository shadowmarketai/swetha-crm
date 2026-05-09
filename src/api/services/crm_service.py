"""
VoiceFlow Marketing AI - CRM Service Layer
============================================
Business logic for CRM operations: Leads, Companies, Contacts, Deals, Activities.
All queries enforce tenant isolation via user_id.

KB-017: Call db.refresh() after db.commit()
"""

import logging
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from api.models.crm import (
    Lead,
    Company,
    Contact,
    Deal,
    Activity,
    LeadStatus,
    LeadSource,
    DealStage,
    ActivityType,
)
from api.models.voice import VoiceAnalysis

logger = logging.getLogger(__name__)


# ── Helpers ──────────────────────────────────────────────────────────


def _apply_soft_delete_filter(query, model):
    """Exclude soft-deleted records."""
    if hasattr(model, "is_deleted"):
        query = query.filter(model.is_deleted == False)  # noqa: E712
    return query


def _serialize_datetime(dt: Optional[datetime]) -> Optional[str]:
    """Convert datetime to ISO-8601 string, or None."""
    if dt is None:
        return None
    return dt.isoformat()


def _serialize_enum(val) -> Optional[str]:
    """Convert an enum value to its string, or pass through strings/None."""
    if val is None:
        return None
    if hasattr(val, "value"):
        return val.value
    return str(val)


# ── Lead helpers ─────────────────────────────────────────────────────


def _lead_to_dict(lead: Lead) -> dict[str, Any]:
    """Convert a Lead ORM object to a dict matching LeadResponse schema."""
    return {
        "id": str(lead.id),
        "first_name": lead.first_name,
        "last_name": lead.last_name,
        "phone": lead.phone,
        "email": lead.email,
        "company": lead.company_name,
        "company_id": str(lead.company_id) if lead.company_id else None,
        "source": _serialize_enum(lead.source),
        "status": _serialize_enum(lead.status),
        "lead_score": lead.lead_score or 0.0,
        "notes": lead.notes,
        "assigned_to": str(lead.assigned_to) if lead.assigned_to else None,
        "tags": lead.tags or [],
        "primary_emotion": lead.primary_emotion,
        "primary_intent": lead.primary_intent,
        "detected_dialect": lead.detected_dialect,
        "avg_sentiment": lead.avg_sentiment or 0.0,
        "crm_type": lead.crm_type,
        "crm_record_id": lead.crm_record_id,
        "created_at": _serialize_datetime(lead.created_at),
        "updated_at": _serialize_datetime(lead.updated_at),
    }


def _company_to_dict(company: Company, leads_count: int = 0, orders_count: int = 0) -> dict[str, Any]:
    """Convert a Company ORM object to a dict matching CompanyResponse schema."""
    return {
        "id": str(company.id),
        "name": company.name,
        "contact_person": None,  # Not stored directly; derived from contacts
        "email": company.email,
        "phone": company.phone,
        "website": company.website,
        "industry": company.industry,
        "address": company.address_line1,
        "city": company.city,
        "state": company.state,
        "country": company.country,
        "gstn": company.gstin,
        "notes": company.description,
        "leads_count": leads_count,
        "orders_count": orders_count,
        "created_at": _serialize_datetime(company.created_at),
        "updated_at": _serialize_datetime(company.updated_at),
    }


def _contact_to_dict(contact: Contact) -> dict[str, Any]:
    """Convert a Contact ORM object to a dict matching ContactResponse schema."""
    company_name = None
    if contact.company:
        company_name = contact.company.name
    return {
        "id": str(contact.id),
        "first_name": contact.first_name,
        "last_name": contact.last_name,
        "email": contact.email,
        "phone": contact.phone,
        "mobile": contact.mobile,
        "company_id": str(contact.company_id) if contact.company_id else None,
        "company_name": company_name,
        "designation": contact.title,
        "department": contact.department,
        "address": contact.address_line1,
        "notes": contact.notes,
        "created_at": _serialize_datetime(contact.created_at),
        "updated_at": _serialize_datetime(contact.updated_at),
    }


def _deal_to_dict(deal: Deal) -> dict[str, Any]:
    """Convert a Deal ORM object to a dict matching DealResponse schema."""
    return {
        "id": str(deal.id),
        "title": deal.title,
        "description": deal.description,
        "value": deal.deal_value or 0.0,
        "stage": _serialize_enum(deal.stage),
        "lead_id": str(deal.lead_id) if deal.lead_id else None,
        "company_id": str(deal.company_id) if deal.company_id else None,
        "contact_id": str(deal.contact_id) if deal.contact_id else None,
        "assigned_to": str(deal.assigned_to) if deal.assigned_to else None,
        "expected_close_date": str(deal.expected_close_date) if deal.expected_close_date else None,
        "probability": deal.probability or 0.0,
        "created_at": _serialize_datetime(deal.created_at),
        "updated_at": _serialize_datetime(deal.updated_at),
    }


def _activity_to_dict(activity: Activity) -> dict[str, Any]:
    """Convert an Activity ORM object to a dict matching ActivityResponse schema."""
    return {
        "id": str(activity.id),
        "activity_type": _serialize_enum(activity.activity_type),
        "subject": activity.subject,
        "description": activity.description,
        "lead_id": str(activity.lead_id) if activity.lead_id else None,
        "contact_id": str(activity.contact_id) if activity.contact_id else None,
        "deal_id": str(activity.deal_id) if activity.deal_id else None,
        "due_date": _serialize_datetime(activity.scheduled_at),
        "duration_minutes": activity.duration_minutes,
        "outcome": activity.call_outcome,
        "created_by": str(activity.user_id) if activity.user_id else None,
        "created_at": _serialize_datetime(activity.created_at),
    }


# =====================================================================
# LEAD CRUD
# =====================================================================


def get_leads(
    db: Session,
    user_id: str,
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None,
    source: Optional[str] = None,
    assigned_to: Optional[int] = None,
    search: Optional[str] = None,
) -> dict[str, Any]:
    """List leads for a user with filters and pagination."""
    query = db.query(Lead).filter(Lead.user_id == user_id)
    query = _apply_soft_delete_filter(query, Lead)

    if status:
        try:
            status_enum = LeadStatus(status)
            query = query.filter(Lead.status == status_enum)
        except ValueError:
            logger.warning("Invalid lead status filter: %s", status)

    if source:
        try:
            source_enum = LeadSource(source)
            query = query.filter(Lead.source == source_enum)
        except ValueError:
            logger.warning("Invalid lead source filter: %s", source)

    if assigned_to is not None:
        query = query.filter(Lead.assigned_to == assigned_to)

    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (Lead.first_name.ilike(pattern))
            | (Lead.last_name.ilike(pattern))
            | (Lead.email.ilike(pattern))
            | (Lead.phone.ilike(pattern))
            | (Lead.company_name.ilike(pattern))
        )

    total = query.count()
    leads = query.order_by(Lead.created_at.desc()).offset(skip).limit(limit).all()

    return {
        "items": [_lead_to_dict(lead) for lead in leads],
        "total": total,
        "page": (skip // limit) + 1 if limit > 0 else 1,
        "page_size": limit,
    }


def get_lead_by_id(db: Session, user_id: str, lead_id) -> Optional[dict[str, Any]]:
    """Get a single lead by ID, including voice analyses."""
    lead = (
        db.query(Lead)
        .filter(Lead.id == lead_id, Lead.user_id == user_id)
        .first()
    )
    if not lead:
        return None

    if hasattr(lead, "is_deleted") and lead.is_deleted:
        return None

    lead_dict = _lead_to_dict(lead)

    # Attach voice analyses
    analyses = (
        db.query(VoiceAnalysis)
        .filter(VoiceAnalysis.lead_id == lead_id)
        .order_by(VoiceAnalysis.created_at.desc())
        .limit(50)
        .all()
    )
    lead_dict["voice_analyses"] = [
        {
            "id": a.id,
            "request_id": a.request_id,
            "transcription": a.transcription,
            "emotion": _serialize_enum(a.emotion),
            "intent": _serialize_enum(a.intent),
            "lead_score": a.lead_score,
            "sentiment": a.sentiment,
            "dialect": _serialize_enum(a.dialect),
            "created_at": _serialize_datetime(a.created_at),
        }
        for a in analyses
    ]

    return lead_dict


def create_lead(db: Session, user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    """Create a new lead."""
    # Map schema source string to enum if provided
    source_val = None
    if data.get("source"):
        try:
            source_val = LeadSource(data["source"].lower().replace(" ", "_"))
        except ValueError:
            source_val = LeadSource.MANUAL

    status_val = LeadStatus.NEW
    if data.get("status"):
        try:
            status_val = LeadStatus(data["status"])
        except ValueError:
            pass

    lead = Lead(
        first_name=data["first_name"],
        last_name=data.get("last_name"),
        phone=data.get("phone"),
        email=data.get("email"),
        company_name=data.get("company"),
        company_id=int(data["company_id"]) if data.get("company_id") else None,
        source=source_val,
        status=status_val,
        lead_score=data.get("lead_score", 0.0),
        notes=data.get("notes"),
        assigned_to=int(data["assigned_to"]) if data.get("assigned_to") else None,
        tags=data.get("tags", []),
        utm_source=data.get("utm_source"),
        utm_medium=data.get("utm_medium"),
        utm_campaign=data.get("utm_campaign"),
        user_id=user_id,
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)
    logger.info("Lead created: id=%s, user=%s", lead.id, user_id)
    return _lead_to_dict(lead)


def update_lead(db: Session, user_id: str, lead_id: int, data: dict[str, Any]) -> Optional[dict[str, Any]]:
    """Update an existing lead (partial update)."""
    lead = (
        db.query(Lead)
        .filter(Lead.id == lead_id, Lead.user_id == user_id)
        .first()
    )
    if not lead:
        return None
    if hasattr(lead, "is_deleted") and lead.is_deleted:
        return None

    # Map fields from schema to model
    field_map = {
        "first_name": "first_name",
        "last_name": "last_name",
        "phone": "phone",
        "email": "email",
        "company": "company_name",
        "notes": "notes",
        "lead_score": "lead_score",
        "utm_source": "utm_source",
        "utm_medium": "utm_medium",
        "utm_campaign": "utm_campaign",
    }

    for schema_field, model_field in field_map.items():
        if schema_field in data and data[schema_field] is not None:
            setattr(lead, model_field, data[schema_field])

    # Handle tags
    if "tags" in data and data["tags"] is not None:
        lead.tags = data["tags"]

    # Handle company_id
    if "company_id" in data:
        if data["company_id"] is not None:
            lead.company_id = int(data["company_id"])
        else:
            lead.company_id = None

    # Handle assigned_to
    if "assigned_to" in data:
        if data["assigned_to"] is not None:
            lead.assigned_to = int(data["assigned_to"])
        else:
            lead.assigned_to = None

    # Handle status enum
    if "status" in data and data["status"] is not None:
        try:
            lead.status = LeadStatus(data["status"])
        except ValueError:
            logger.warning("Invalid status value: %s", data["status"])

    # Handle source enum
    if "source" in data and data["source"] is not None:
        try:
            lead.source = LeadSource(data["source"].lower().replace(" ", "_"))
        except ValueError:
            logger.warning("Invalid source value: %s", data["source"])

    db.commit()
    db.refresh(lead)
    logger.info("Lead updated: id=%s, user=%s", lead.id, user_id)
    return _lead_to_dict(lead)


def delete_lead(db: Session, user_id: str, lead_id: int) -> bool:
    """Soft-delete a lead."""
    lead = (
        db.query(Lead)
        .filter(Lead.id == lead_id, Lead.user_id == user_id)
        .first()
    )
    if not lead:
        return False

    lead.is_deleted = True
    lead.deleted_at = datetime.utcnow()
    lead.deleted_by = user_id
    db.commit()
    logger.info("Lead soft-deleted: id=%s, user=%s", lead.id, user_id)
    return True


# =====================================================================
# COMPANY CRUD
# =====================================================================


def get_companies(
    db: Session,
    user_id: str,
    skip: int = 0,
    limit: int = 20,
    search: Optional[str] = None,
    industry: Optional[str] = None,
) -> dict[str, Any]:
    """List companies for a user with pagination."""
    query = db.query(Company).filter(Company.user_id == user_id)
    query = _apply_soft_delete_filter(query, Company)

    if industry:
        query = query.filter(Company.industry.ilike(f"%{industry}%"))

    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (Company.name.ilike(pattern))
            | (Company.email.ilike(pattern))
            | (Company.phone.ilike(pattern))
        )

    total = query.count()
    companies = query.order_by(Company.created_at.desc()).offset(skip).limit(limit).all()

    items = []
    for company in companies:
        leads_count = (
            db.query(func.count(Lead.id))
            .filter(Lead.company_id == company.id, Lead.is_deleted == False)  # noqa: E712
            .scalar()
        ) or 0
        items.append(_company_to_dict(company, leads_count=leads_count))

    return {
        "items": items,
        "total": total,
        "page": (skip // limit) + 1 if limit > 0 else 1,
        "page_size": limit,
    }


def get_company_by_id(db: Session, user_id: str, company_id: int) -> Optional[dict[str, Any]]:
    """Get a single company by ID with contacts and deals."""
    company = (
        db.query(Company)
        .filter(Company.id == company_id, Company.user_id == user_id)
        .first()
    )
    if not company:
        return None
    if hasattr(company, "is_deleted") and company.is_deleted:
        return None

    leads_count = (
        db.query(func.count(Lead.id))
        .filter(Lead.company_id == company.id, Lead.is_deleted == False)  # noqa: E712
        .scalar()
    ) or 0

    company_dict = _company_to_dict(company, leads_count=leads_count)

    # Attach contacts
    contacts = (
        db.query(Contact)
        .filter(Contact.company_id == company.id, Contact.is_deleted == False)  # noqa: E712
        .order_by(Contact.created_at.desc())
        .limit(100)
        .all()
    )
    company_dict["contacts"] = [_contact_to_dict(c) for c in contacts]

    # Attach deals
    deals = (
        db.query(Deal)
        .filter(Deal.company_id == company.id, Deal.is_deleted == False)  # noqa: E712
        .order_by(Deal.created_at.desc())
        .limit(100)
        .all()
    )
    company_dict["deals"] = [_deal_to_dict(d) for d in deals]

    return company_dict


def create_company(db: Session, user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    """Create a new company."""
    company = Company(
        name=data["name"],
        phone=data.get("phone"),
        email=data.get("email"),
        website=data.get("website"),
        industry=data.get("industry"),
        address_line1=data.get("address"),
        city=data.get("city"),
        state=data.get("state"),
        country=data.get("country", "India"),
        gstin=data.get("gstn"),
        description=data.get("notes"),
        user_id=user_id,
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    logger.info("Company created: id=%s, name=%s, user=%s", company.id, company.name, user_id)
    return _company_to_dict(company)


def update_company(
    db: Session, user_id: str, company_id: int, data: dict[str, Any]
) -> Optional[dict[str, Any]]:
    """Update an existing company (partial update)."""
    company = (
        db.query(Company)
        .filter(Company.id == company_id, Company.user_id == user_id)
        .first()
    )
    if not company:
        return None
    if hasattr(company, "is_deleted") and company.is_deleted:
        return None

    field_map = {
        "name": "name",
        "phone": "phone",
        "email": "email",
        "website": "website",
        "industry": "industry",
        "address": "address_line1",
        "city": "city",
        "state": "state",
        "country": "country",
        "gstn": "gstin",
        "notes": "description",
        "contact_person": None,  # Not a direct field on model
    }

    for schema_field, model_field in field_map.items():
        if model_field and schema_field in data and data[schema_field] is not None:
            setattr(company, model_field, data[schema_field])

    db.commit()
    db.refresh(company)
    logger.info("Company updated: id=%s, user=%s", company.id, user_id)
    return _company_to_dict(company)


def delete_company(db: Session, user_id: str, company_id: int) -> bool:
    """Soft-delete a company."""
    company = (
        db.query(Company)
        .filter(Company.id == company_id, Company.user_id == user_id)
        .first()
    )
    if not company:
        return False

    company.is_deleted = True
    company.deleted_at = datetime.utcnow()
    company.deleted_by = user_id
    db.commit()
    logger.info("Company soft-deleted: id=%s, user=%s", company.id, user_id)
    return True


# =====================================================================
# CONTACT CRUD
# =====================================================================


def get_contacts(
    db: Session,
    user_id: str,
    skip: int = 0,
    limit: int = 20,
    company_id: Optional[int] = None,
    search: Optional[str] = None,
) -> dict[str, Any]:
    """List contacts for a user with pagination."""
    query = db.query(Contact).filter(Contact.user_id == user_id)
    query = _apply_soft_delete_filter(query, Contact)

    if company_id is not None:
        query = query.filter(Contact.company_id == company_id)

    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (Contact.first_name.ilike(pattern))
            | (Contact.last_name.ilike(pattern))
            | (Contact.email.ilike(pattern))
            | (Contact.phone.ilike(pattern))
        )

    total = query.count()
    contacts = query.order_by(Contact.created_at.desc()).offset(skip).limit(limit).all()

    return {
        "items": [_contact_to_dict(c) for c in contacts],
        "total": total,
        "page": (skip // limit) + 1 if limit > 0 else 1,
        "page_size": limit,
    }


def get_contact_by_id(db: Session, user_id: str, contact_id: int) -> Optional[dict[str, Any]]:
    """Get a single contact by ID."""
    contact = (
        db.query(Contact)
        .filter(Contact.id == contact_id, Contact.user_id == user_id)
        .first()
    )
    if not contact:
        return None
    if hasattr(contact, "is_deleted") and contact.is_deleted:
        return None

    return _contact_to_dict(contact)


def create_contact(db: Session, user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    """Create a new contact."""
    company_id_val = None
    if data.get("company_id"):
        company_id_val = int(data["company_id"])
        # Verify company belongs to user
        company = (
            db.query(Company)
            .filter(Company.id == company_id_val, Company.user_id == user_id)
            .first()
        )
        if not company:
            company_id_val = None

    contact = Contact(
        first_name=data["first_name"],
        last_name=data.get("last_name"),
        email=data.get("email"),
        phone=data.get("phone"),
        mobile=data.get("mobile"),
        company_id=company_id_val,
        title=data.get("designation"),
        department=data.get("department"),
        address_line1=data.get("address"),
        notes=data.get("notes"),
        user_id=user_id,
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    logger.info("Contact created: id=%s, user=%s", contact.id, user_id)
    return _contact_to_dict(contact)


def update_contact(
    db: Session, user_id: str, contact_id: int, data: dict[str, Any]
) -> Optional[dict[str, Any]]:
    """Update an existing contact (partial update)."""
    contact = (
        db.query(Contact)
        .filter(Contact.id == contact_id, Contact.user_id == user_id)
        .first()
    )
    if not contact:
        return None
    if hasattr(contact, "is_deleted") and contact.is_deleted:
        return None

    field_map = {
        "first_name": "first_name",
        "last_name": "last_name",
        "email": "email",
        "phone": "phone",
        "mobile": "mobile",
        "designation": "title",
        "department": "department",
        "address": "address_line1",
        "notes": "notes",
    }

    for schema_field, model_field in field_map.items():
        if schema_field in data and data[schema_field] is not None:
            setattr(contact, model_field, data[schema_field])

    # Handle company_id
    if "company_id" in data:
        if data["company_id"] is not None:
            cid = int(data["company_id"])
            company = (
                db.query(Company)
                .filter(Company.id == cid, Company.user_id == user_id)
                .first()
            )
            if company:
                contact.company_id = cid
        else:
            contact.company_id = None

    db.commit()
    db.refresh(contact)
    logger.info("Contact updated: id=%s, user=%s", contact.id, user_id)
    return _contact_to_dict(contact)


def delete_contact(db: Session, user_id: str, contact_id: int) -> bool:
    """Soft-delete a contact."""
    contact = (
        db.query(Contact)
        .filter(Contact.id == contact_id, Contact.user_id == user_id)
        .first()
    )
    if not contact:
        return False
    contact.is_deleted = True
    contact.deleted_at = datetime.utcnow()
    db.commit()
    logger.info("Contact soft-deleted: id=%s, user=%s", contact.id, user_id)
    return True


# =====================================================================
# DEAL CRUD
# =====================================================================


def get_deals(
    db: Session,
    user_id: str,
    skip: int = 0,
    limit: int = 20,
    stage: Optional[str] = None,
    search: Optional[str] = None,
) -> dict[str, Any]:
    """List deals for a user with pagination."""
    query = db.query(Deal).filter(Deal.user_id == user_id)
    query = _apply_soft_delete_filter(query, Deal)

    if stage:
        try:
            stage_enum = DealStage(stage)
            query = query.filter(Deal.stage == stage_enum)
        except ValueError:
            logger.warning("Invalid deal stage filter: %s", stage)

    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (Deal.title.ilike(pattern))
            | (Deal.description.ilike(pattern))
        )

    total = query.count()
    deals = query.order_by(Deal.created_at.desc()).offset(skip).limit(limit).all()

    return {
        "items": [_deal_to_dict(deal) for deal in deals],
        "total": total,
        "page": (skip // limit) + 1 if limit > 0 else 1,
        "page_size": limit,
    }


def get_deal_by_id(db: Session, user_id: str, deal_id: int) -> Optional[dict[str, Any]]:
    """Get a single deal by ID."""
    deal = (
        db.query(Deal)
        .filter(Deal.id == deal_id, Deal.user_id == user_id)
        .first()
    )
    if not deal:
        return None
    if hasattr(deal, "is_deleted") and deal.is_deleted:
        return None

    deal_dict = _deal_to_dict(deal)

    # Attach activities
    activities = (
        db.query(Activity)
        .filter(Activity.deal_id == deal.id)
        .order_by(Activity.created_at.desc())
        .limit(50)
        .all()
    )
    deal_dict["activities"] = [_activity_to_dict(a) for a in activities]

    return deal_dict


def create_deal(db: Session, user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    """Create a new deal."""
    stage_val = DealStage.DISCOVERY
    if data.get("stage"):
        try:
            stage_val = DealStage(data["stage"])
        except ValueError:
            pass

    # Parse expected_close_date
    expected_close = None
    if data.get("expected_close_date"):
        try:
            from datetime import date as date_type
            if isinstance(data["expected_close_date"], str):
                expected_close = date_type.fromisoformat(data["expected_close_date"])
            else:
                expected_close = data["expected_close_date"]
        except (ValueError, TypeError):
            logger.warning("Invalid expected_close_date: %s", data["expected_close_date"])

    deal = Deal(
        title=data["title"],
        description=data.get("description"),
        deal_value=data.get("value", 0.0),
        stage=stage_val,
        lead_id=int(data["lead_id"]) if data.get("lead_id") else None,
        company_id=int(data["company_id"]) if data.get("company_id") else None,
        contact_id=int(data["contact_id"]) if data.get("contact_id") else None,
        assigned_to=int(data["assigned_to"]) if data.get("assigned_to") else None,
        expected_close_date=expected_close,
        probability=data.get("probability", 0.0),
        user_id=user_id,
    )
    db.add(deal)
    db.commit()
    db.refresh(deal)
    logger.info("Deal created: id=%s, title=%s, user=%s", deal.id, deal.title, user_id)
    return _deal_to_dict(deal)


def update_deal(db: Session, user_id: str, deal_id: int, data: dict[str, Any]) -> Optional[dict[str, Any]]:
    """Update an existing deal (partial update)."""
    deal = (
        db.query(Deal)
        .filter(Deal.id == deal_id, Deal.user_id == user_id)
        .first()
    )
    if not deal:
        return None
    if hasattr(deal, "is_deleted") and deal.is_deleted:
        return None

    simple_fields = {
        "title": "title",
        "description": "description",
        "probability": "probability",
    }

    for schema_field, model_field in simple_fields.items():
        if schema_field in data and data[schema_field] is not None:
            setattr(deal, model_field, data[schema_field])

    # Handle value -> deal_value
    if "value" in data and data["value"] is not None:
        deal.deal_value = data["value"]

    # Handle stage
    if "stage" in data and data["stage"] is not None:
        try:
            old_stage = deal.stage
            deal.stage = DealStage(data["stage"])
            # Track won/lost timestamps
            if deal.stage == DealStage.CLOSED_WON and old_stage != DealStage.CLOSED_WON:
                deal.won_at = datetime.utcnow()
                deal.actual_close_date = datetime.utcnow().date()
            elif deal.stage == DealStage.CLOSED_LOST and old_stage != DealStage.CLOSED_LOST:
                deal.lost_at = datetime.utcnow()
                deal.actual_close_date = datetime.utcnow().date()
        except ValueError:
            logger.warning("Invalid stage value: %s", data["stage"])

    # Handle FK fields
    fk_fields = {
        "lead_id": "lead_id",
        "company_id": "company_id",
        "contact_id": "contact_id",
        "assigned_to": "assigned_to",
    }
    for schema_field, model_field in fk_fields.items():
        if schema_field in data:
            if data[schema_field] is not None:
                setattr(deal, model_field, int(data[schema_field]))
            else:
                setattr(deal, model_field, None)

    # Handle expected_close_date
    if "expected_close_date" in data:
        if data["expected_close_date"] is not None:
            try:
                from datetime import date as date_type
                if isinstance(data["expected_close_date"], str):
                    deal.expected_close_date = date_type.fromisoformat(data["expected_close_date"])
                else:
                    deal.expected_close_date = data["expected_close_date"]
            except (ValueError, TypeError):
                pass
        else:
            deal.expected_close_date = None

    db.commit()
    db.refresh(deal)
    logger.info("Deal updated: id=%s, user=%s", deal.id, user_id)
    return _deal_to_dict(deal)


def delete_deal(db: Session, user_id: str, deal_id: int) -> bool:
    """Soft-delete a deal."""
    deal = (
        db.query(Deal)
        .filter(Deal.id == deal_id, Deal.user_id == user_id)
        .first()
    )
    if not deal:
        return False
    deal.is_deleted = True
    deal.deleted_at = datetime.utcnow()
    db.commit()
    logger.info("Deal soft-deleted: id=%s, user=%s", deal.id, user_id)
    return True


# =====================================================================
# ACTIVITY CRUD
# =====================================================================


def get_activities(
    db: Session,
    user_id: str,
    skip: int = 0,
    limit: int = 20,
    lead_id: Optional[int] = None,
    contact_id: Optional[int] = None,
    deal_id: Optional[int] = None,
    activity_type: Optional[str] = None,
) -> dict[str, Any]:
    """List activities for a user with filters."""
    query = db.query(Activity).filter(Activity.user_id == user_id)

    if lead_id is not None:
        query = query.filter(Activity.lead_id == lead_id)

    if contact_id is not None:
        query = query.filter(Activity.contact_id == contact_id)

    if deal_id is not None:
        query = query.filter(Activity.deal_id == deal_id)

    if activity_type:
        try:
            type_enum = ActivityType(activity_type)
            query = query.filter(Activity.activity_type == type_enum)
        except ValueError:
            logger.warning("Invalid activity type filter: %s", activity_type)

    total = query.count()
    activities = query.order_by(Activity.created_at.desc()).offset(skip).limit(limit).all()

    return {
        "items": [_activity_to_dict(a) for a in activities],
        "total": total,
        "page": (skip // limit) + 1 if limit > 0 else 1,
        "page_size": limit,
    }


def create_activity(db: Session, user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    """Create a new activity."""
    type_val = ActivityType(data["activity_type"])

    # Parse due_date to scheduled_at
    scheduled = None
    if data.get("due_date"):
        try:
            scheduled = datetime.fromisoformat(data["due_date"])
        except (ValueError, TypeError):
            logger.warning("Invalid due_date: %s", data["due_date"])

    activity = Activity(
        activity_type=type_val,
        subject=data["subject"],
        description=data.get("description"),
        lead_id=int(data["lead_id"]) if data.get("lead_id") else None,
        contact_id=int(data["contact_id"]) if data.get("contact_id") else None,
        deal_id=int(data["deal_id"]) if data.get("deal_id") else None,
        scheduled_at=scheduled,
        duration_minutes=data.get("duration_minutes"),
        call_outcome=data.get("outcome"),
        user_id=user_id,
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)
    logger.info("Activity created: id=%s, type=%s, user=%s", activity.id, type_val.value, user_id)
    return _activity_to_dict(activity)


def get_activity_by_id(db: Session, user_id: str, activity_id: int) -> Optional[dict[str, Any]]:
    """Get a single activity by ID."""
    activity = (
        db.query(Activity)
        .filter(Activity.id == activity_id, Activity.user_id == user_id)
        .first()
    )
    if not activity:
        return None
    return _activity_to_dict(activity)


def update_activity(db: Session, user_id: str, activity_id: int, data: dict[str, Any]) -> Optional[dict[str, Any]]:
    """Update an existing activity (partial update)."""
    activity = (
        db.query(Activity)
        .filter(Activity.id == activity_id, Activity.user_id == user_id)
        .first()
    )
    if not activity:
        return None

    simple_fields = ["subject", "description", "call_outcome", "duration_minutes"]
    for field in simple_fields:
        if field in data and data[field] is not None:
            setattr(activity, field, data[field])

    if "status" in data and data["status"] is not None:
        activity.status = data["status"]

    if "due_date" in data and data["due_date"] is not None:
        try:
            activity.scheduled_at = datetime.fromisoformat(data["due_date"])
        except (ValueError, TypeError):
            pass

    if "completed" in data:
        if data["completed"]:
            activity.completed_at = datetime.utcnow()
        else:
            activity.completed_at = None

    db.commit()
    db.refresh(activity)
    logger.info("Activity updated: id=%s, user=%s", activity.id, user_id)
    return _activity_to_dict(activity)


def delete_activity(db: Session, user_id: str, activity_id: int) -> bool:
    """Delete an activity (hard delete since activities are log entries)."""
    activity = (
        db.query(Activity)
        .filter(Activity.id == activity_id, Activity.user_id == user_id)
        .first()
    )
    if not activity:
        return False
    db.delete(activity)
    db.commit()
    logger.info("Activity deleted: id=%s, user=%s", activity_id, user_id)
    return True


# =====================================================================
# DASHBOARD
# =====================================================================


def get_dashboard_stats(db: Session, user_id: int) -> dict[str, Any]:
    """Compute CRM dashboard metrics for the given user."""

    # --- Lead counts by status ---
    lead_status_counts = (
        db.query(Lead.status, func.count(Lead.id))
        .filter(Lead.user_id == user_id, Lead.is_deleted == False)  # noqa: E712
        .group_by(Lead.status)
        .all()
    )
    status_map: dict[str, int] = {}
    total_leads = 0
    for status_enum, count in lead_status_counts:
        key = status_enum.value if hasattr(status_enum, "value") else str(status_enum)
        status_map[key] = count
        total_leads += count

    # --- Conversion rate ---
    won_count = status_map.get("won", 0)
    conversion_rate = (won_count / total_leads * 100) if total_leads > 0 else 0.0

    # --- Pipeline value (sum of open deal values) ---
    open_stages = [DealStage.DISCOVERY, DealStage.QUALIFICATION, DealStage.PROPOSAL, DealStage.NEGOTIATION]
    pipeline_value = (
        db.query(func.coalesce(func.sum(Deal.deal_value), 0.0))
        .filter(
            Deal.user_id == user_id,
            Deal.is_deleted == False,  # noqa: E712
            Deal.stage.in_(open_stages),
        )
        .scalar()
    ) or 0.0

    # --- Won value ---
    won_value = (
        db.query(func.coalesce(func.sum(Deal.deal_value), 0.0))
        .filter(
            Deal.user_id == user_id,
            Deal.is_deleted == False,  # noqa: E712
            Deal.stage == DealStage.CLOSED_WON,
        )
        .scalar()
    ) or 0.0

    # --- Deal counts by stage ---
    deal_stage_counts = (
        db.query(Deal.stage, func.count(Deal.id))
        .filter(Deal.user_id == user_id, Deal.is_deleted == False)  # noqa: E712
        .group_by(Deal.stage)
        .all()
    )
    deal_stage_map: dict[str, int] = {}
    total_deals = 0
    for stage_enum, count in deal_stage_counts:
        key = stage_enum.value if hasattr(stage_enum, "value") else str(stage_enum)
        deal_stage_map[key] = count
        total_deals += count

    # --- Recent activities count (last 7 days) ---
    from datetime import timedelta
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    recent_activities = (
        db.query(func.count(Activity.id))
        .filter(Activity.user_id == user_id, Activity.created_at >= seven_days_ago)
        .scalar()
    ) or 0

    # --- Average lead score ---
    avg_lead_score = (
        db.query(func.coalesce(func.avg(Lead.lead_score), 0.0))
        .filter(Lead.user_id == user_id, Lead.is_deleted == False)  # noqa: E712
        .scalar()
    ) or 0.0

    # --- Lead source distribution ---
    lead_source_counts = (
        db.query(Lead.source, func.count(Lead.id))
        .filter(Lead.user_id == user_id, Lead.is_deleted == False)  # noqa: E712
        .group_by(Lead.source)
        .all()
    )
    source_map: dict[str, int] = {}
    for source_enum, count in lead_source_counts:
        key = source_enum.value if (source_enum and hasattr(source_enum, "value")) else str(source_enum)
        source_map[key] = count

    # --- Companies and contacts counts ---
    companies_count = (
        db.query(func.count(Company.id))
        .filter(Company.user_id == user_id, Company.is_deleted == False)  # noqa: E712
        .scalar()
    ) or 0

    contacts_count = (
        db.query(func.count(Contact.id))
        .filter(Contact.user_id == user_id, Contact.is_deleted == False)  # noqa: E712
        .scalar()
    ) or 0

    return {
        "total_leads": total_leads,
        "leads_by_status": status_map,
        "conversion_rate": round(conversion_rate, 2),
        "avg_lead_score": round(float(avg_lead_score), 2),
        "leads_by_source": source_map,
        "total_deals": total_deals,
        "deals_by_stage": deal_stage_map,
        "pipeline_value": round(float(pipeline_value), 2),
        "won_value": round(float(won_value), 2),
        "total_companies": companies_count,
        "total_contacts": contacts_count,
        "recent_activities_7d": recent_activities,
    }
