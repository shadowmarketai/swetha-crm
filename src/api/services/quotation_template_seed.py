"""
Default quotation template seeder.
Ensures every tenant has at least one active template so the intake flow
works out of the box. The default is a PEB Building template mirroring
the legacy Swetha Structures flow.
"""

import logging
from typing import Optional

from sqlalchemy.orm import Session

from api.models.quotation_template import (
    QuotationTemplate,
    TemplateEngine,
)

logger = logging.getLogger(__name__)


# ────────────────────────────────────────── Default PEB template ──
PEB_FIELDS_SCHEMA = [
    {"key": "project_name", "label": "Project Name", "type": "text", "required": True, "group": "Project"},
    {"key": "client_location", "label": "Site Location", "type": "text", "required": False, "group": "Project"},
    {"key": "building_length", "label": "Length", "type": "number", "required": True, "unit": "ft", "default": 100, "min": 20, "max": 500, "group": "Dimensions"},
    {"key": "building_width", "label": "Width", "type": "number", "required": True, "unit": "ft", "default": 60, "min": 20, "max": 300, "group": "Dimensions"},
    {"key": "full_height", "label": "Full Height", "type": "number", "required": True, "unit": "ft", "default": 30, "min": 10, "max": 60, "group": "Dimensions"},
    {"key": "wall_height", "label": "Wall Height", "type": "number", "required": True, "unit": "ft", "default": 20, "min": 8, "max": 40, "group": "Dimensions"},
    {"key": "cladding_height", "label": "Cladding Height", "type": "number", "required": True, "unit": "ft", "default": 18, "min": 6, "max": 40, "group": "Dimensions"},
    {"key": "roof_type", "label": "Roof Type", "type": "select", "required": True, "default": "gable",
     "options": [{"value": "gable", "label": "Gable (Dual Slope)"}, {"value": "single_slope", "label": "Single Slope"}],
     "group": "Materials"},
    {"key": "roof_sheet_type", "label": "Roof Sheet", "type": "select", "required": True, "default": "bare",
     "options": [{"value": "bare", "label": "Bare Galvalume"}, {"value": "puf", "label": "PUF Panel 30mm"}],
     "group": "Materials"},
    {"key": "side_cladding_type", "label": "Side Cladding", "type": "select", "required": True, "default": "bare",
     "options": [{"value": "bare", "label": "Bare Galvalume"}, {"value": "puf", "label": "PUF Panel 30mm"}],
     "group": "Materials"},
    {"key": "mezzanine_required", "label": "Mezzanine Required?", "type": "checkbox", "default": False, "group": "Mezzanine"},
    {"key": "mezz_length", "label": "Mezzanine Length", "type": "number", "unit": "ft", "default": 0, "group": "Mezzanine",
     "show_if": {"mezzanine_required": True}},
    {"key": "mezz_width", "label": "Mezzanine Width", "type": "number", "unit": "ft", "default": 0, "group": "Mezzanine",
     "show_if": {"mezzanine_required": True}},
]

# Rate items mirror the existing BOQ_RATE_ITEMS in MaterialCost.jsx
PEB_RATE_ITEMS = [
    {"id": "structural_steel", "label": "Structural Steel Works", "unit": "Rs/Kg", "material_rate": 71, "labour_rate": 39,
     "description": "Supplying, fabrication & erection of MS sections for trusses, purlins, sag rods, base plates, cap plates, anchor bolts."},
    {"id": "bare_galvalume", "label": "Bare Galvalume Roofing & Cladding", "unit": "Rs/Sqft", "material_rate": 43, "labour_rate": 16,
     "description": "Bare galvalume 0.47mm for roofing + profiled colour coated galvalume 0.47mm for side cladding."},
    {"id": "puf_panel_roof", "label": "PUF Panel 30mm — Roof", "unit": "Rs/Sqft", "material_rate": 140, "labour_rate": 40,
     "description": "PUF insulated panel 30mm thickness for roofing."},
    {"id": "puf_panel_wall", "label": "PUF Panel 30mm — Side Cladding", "unit": "Rs/Sqft", "material_rate": 141, "labour_rate": 40,
     "description": "PUF insulated panel 30mm thickness for side cladding."},
    {"id": "ridge_flashing", "label": "Ridge, L Flash, Gutter, Downspout", "unit": "Rs/Rft", "material_rate": 60, "labour_rate": 50,
     "description": "Profiled colour coated galvalume 0.47mm accessories."},
    {"id": "polycarbonate", "label": "Polycarbonate Lighting Sheet", "unit": "Rs/Sqft", "material_rate": 70, "labour_rate": 40,
     "description": "Polycarbonate sheet 1.5mm for natural lighting."},
    {"id": "mezzanine_decking", "label": "Mezzanine Decking + Concrete", "unit": "Rs/Sqft", "material_rate": 120, "labour_rate": 34,
     "description": "Decking sheet + M20 concrete (100mm avg) for mezzanine floor."},
]

PEB_TERMS = """\
1. Quotation is valid for 30 days from the date of issue.
2. GST @ 18% will be applicable extra on the quoted amount.
3. Payment terms: 50% advance with work order, 30% on material delivery,
   20% on completion & handover.
4. Timeline: 8–10 weeks from advance payment & final design approval.
5. Civil works, flooring, electricals, plumbing, rolling shutters, and
   doors/windows are NOT included.
6. Rates are subject to steel market fluctuations. Significant changes
   may require re-quotation.
7. All drawings & renders shared are indicative only. Final engineering
   drawings will be issued post-advance.
"""


def seed_default_template_for_tenant(db: Session, tenant_id: str, force: bool = False) -> Optional[QuotationTemplate]:
    """
    Create a default PEB template for a tenant if none exists.
    Safe to call repeatedly — idempotent unless `force=True`.
    Returns the template (existing or newly created).
    """
    existing = (
        db.query(QuotationTemplate)
        .filter(
            QuotationTemplate.tenant_id == tenant_id,
            QuotationTemplate.slug == "peb-building",
            QuotationTemplate.is_deleted == False,  # noqa: E712
        )
        .first()
    )
    if existing and not force:
        return existing

    if existing and force:
        db.delete(existing)
        db.flush()

    tpl = QuotationTemplate(
        tenant_id=tenant_id,
        name="PEB Building",
        slug="peb-building",
        description="Pre-Engineered Building quotation with auto BOQ, 3D model, drawings & renders.",
        icon="Building2",
        is_active=True,
        engine=TemplateEngine.PEB.value,
        auto_generate_3d=True,
        auto_generate_drawings=True,
        auto_generate_render=True,
        fields_schema=PEB_FIELDS_SCHEMA,
        rate_items=PEB_RATE_ITEMS,
        peb_config={
            "steel_rate_main": 1.8,
            "steel_rate_mezz": 3.4,
        },
        terms_conditions=PEB_TERMS,
        default_validity_days=30,
        negotiation_enabled=True,
        max_discount_pct=10.0,
        negotiation_reject_message="Our best price is already tightly calculated. The minimum we can offer is {min_price}.",
    )
    db.add(tpl)
    db.commit()
    db.refresh(tpl)
    logger.info(f"Seeded default PEB template for tenant {tenant_id}: id={tpl.id}")
    return tpl


def seed_default_template_for_all_tenants(db: Session) -> int:
    """
    Idempotent bulk seed — ensures every platform tenant has a PEB template.
    Reads from the raw-SQL `platform_tenants` table (the authoritative
    SaaS control layer). Returns count of templates created/verified.
    """
    from sqlalchemy import text

    try:
        result = db.execute(text(
            "SELECT id FROM platform_tenants WHERE is_active = 1"
        )).fetchall()
    except Exception as e:
        logger.warning(f"platform_tenants query failed: {e}")
        return 0

    count = 0
    for row in result:
        tenant_id = row[0]  # TEXT primary key like "tenant-swetha"
        if seed_default_template_for_tenant(db, tenant_id):
            count += 1
    logger.info(f"Quotation template seed: verified {count} tenant(s)")
    return count
