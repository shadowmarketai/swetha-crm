"""
Swetha Structures CRM - Quotation Schemas
===========================================
Pydantic v2 schemas for PEB quotation system.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class QuotationStatus(str, Enum):
    DRAFT = "draft"
    SENT = "sent"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    REVISED = "revised"


class RoofType(str, Enum):
    A_TYPE = "a_type"
    MONOSLOPE = "monoslope"
    # Legacy values (backward compat)
    GABLE = "gable"
    SINGLE_SLOPE = "single_slope"


class RoofSheetType(str, Enum):
    BARE_GALVALUME_04 = "bare_galvalume_0.4mm"
    BARE_GALVALUME_045 = "bare_galvalume_0.45mm"
    BARE_GALVALUME_047 = "bare_galvalume_0.47mm"
    BARE_GALVALUME_05 = "bare_galvalume_0.5mm"
    PUF_PANEL_20 = "puf_panel_20mm"
    PUF_PANEL_30 = "puf_panel_30mm"
    PUF_PANEL_50 = "puf_panel_50mm"
    PUF_PANEL_100 = "puf_panel_100mm"
    # Legacy values
    BARE = "bare"
    PUF = "puf"


class SideCladdingType(str, Enum):
    BARE_COLOUR_04 = "bare_colour_galvalume_0.4mm"
    BARE_COLOUR_045 = "bare_colour_galvalume_0.45mm"
    BARE_COLOUR_047 = "bare_colour_galvalume_0.47mm"
    BARE_COLOUR_05 = "bare_colour_galvalume_0.5mm"
    PUF_PANEL_20 = "puf_panel_20mm"
    PUF_PANEL_30 = "puf_panel_30mm"
    PUF_PANEL_50 = "puf_panel_50mm"
    PUF_PANEL_100 = "puf_panel_100mm"
    # Legacy values
    BARE = "bare"
    PUF = "puf"


# ── PEB Input ────────────────────────────────────────────────────


class PEBInput(BaseModel):
    """Building dimensions and material selection for BOQ calculation."""

    building_length: float = Field(..., gt=0, description="Length in feet")
    building_width: float = Field(..., gt=0, description="Width in feet")
    full_height: float = Field(..., gt=0, description="Full height (ridge) in feet")
    wall_height: float = Field(..., gt=0, description="Eave/wall height in feet")
    cladding_height: Optional[float] = Field(default=None, ge=0, description="Cladding height in feet (auto: full_height - wall_height + 3)")

    roof_type: RoofType = RoofType.A_TYPE
    roof_sheet_type: RoofSheetType = RoofSheetType.BARE_GALVALUME_047
    side_cladding_type: SideCladdingType = SideCladdingType.BARE_COLOUR_047

    mezzanine_required: bool = False
    mezz_length: Optional[float] = Field(default=None, ge=0)
    mezz_width: Optional[float] = Field(default=None, ge=0)

    lighting_sqft: Optional[float] = Field(default=None, ge=0)

    # Optional rate overrides
    steel_rate_main: Optional[float] = None
    steel_rate_mezz: Optional[float] = None

    # Additions
    turbo_ventilator: bool = False
    turbo_ventilator_count: Optional[int] = Field(default=None, ge=0)
    aluminium_foil: bool = False
    crane: bool = False
    crane_count: Optional[int] = Field(default=None, ge=0)
    ridge_vent: bool = False
    ridge_monitor: bool = False
    light_sheet: bool = False
    louvers: bool = False
    louvers_size: Optional[str] = None
    shutters: bool = False
    shutters_count: Optional[int] = Field(default=None, ge=0)
    shutters_size: Optional[str] = None
    ac_sheet: bool = False
    aluminium_sheet: bool = False
    aluminium_sheet_type: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ── BOQ Result ───────────────────────────────────────────────────


class BOQItem(BaseModel):
    item_no: str
    description: str
    unit: str
    quantity: float
    rate: float
    amount: float
    category: str
    sub_note: Optional[str] = None


class BOQResult(BaseModel):
    items: list[BOQItem]
    total_amount: float
    floor_area: float
    rate_per_sqft: float
    steel_summary: dict[str, Any]
    cladding_summary: dict[str, Any]


# ── Quotation CRUD ───────────────────────────────────────────────


class QuotationCreate(BaseModel):
    """Create a new quotation — lead_id is optional."""

    lead_id: Optional[int] = Field(default=None, description="CRM lead ID (optional)")
    project_name: str = Field(..., min_length=1, max_length=500)
    client_name: Optional[str] = Field(default=None, max_length=300)
    client_location: Optional[str] = Field(default=None, max_length=500)
    building_params: PEBInput
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class QuotationUpdate(BaseModel):
    """Update an existing quotation (partial)."""

    project_name: Optional[str] = Field(default=None, max_length=500)
    client_name: Optional[str] = Field(default=None, max_length=300)
    client_location: Optional[str] = Field(default=None, max_length=500)
    building_params: Optional[PEBInput] = None
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class StatusUpdate(BaseModel):
    """Change quotation status."""

    status: QuotationStatus


class QuotationResponse(BaseModel):
    """Full quotation response."""

    id: int
    lead_id: Optional[int] = None
    user_id: str
    project_name: str
    client_name: Optional[str] = None
    client_location: Optional[str] = None
    building_params: Optional[dict[str, Any]] = None
    boq_results: Optional[dict[str, Any]] = None
    total_amount: float = 0.0
    rate_per_sqft: float = 0.0
    status: str = "draft"
    revision: int = 1
    parent_quotation_id: Optional[int] = None
    pdf_path: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class QuotationLogResponse(BaseModel):
    """Audit log entry."""

    id: int
    quotation_id: int
    user_id: str
    action: str
    details: Optional[dict[str, Any]] = None
    created_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class QuotationStatsResponse(BaseModel):
    """Dashboard statistics."""

    total: int = 0
    draft: int = 0
    sent: int = 0
    accepted: int = 0
    rejected: int = 0
    revised: int = 0
    total_amount: float = 0.0
    monthly_amount: float = 0.0


# ── AI Photoreal Render ──────────────────────────────────────────


class AIRenderRequest(BaseModel):
    """Request payload for generating AI photoreal renders."""

    capture_image: str = Field(
        ...,
        description="Three.js viewport screenshot as base64 PNG (with or without "
                    "the 'data:image/png;base64,' prefix).",
    )
    building_params: dict[str, Any] = Field(
        default_factory=dict,
        description="PEB parameters (building_length, full_height, roof_type, ...). "
                    "Falls back to the quotation's stored params when empty and a "
                    "quotation_id is present in the path.",
    )
    angles: Optional[list[str]] = Field(
        default=None,
        description="Optional whitelist of angle ids: exterior / aerial / front. "
                    "Defaults to all three.",
    )
    lead_company: Optional[str] = Field(
        default=None,
        description="Optional company name used for branding context inside the prompt.",
    )
    force_regenerate: bool = Field(
        default=False,
        description="When true, skip the render cache and force a fresh Gemini call. "
                    "Use sparingly — every fresh call costs tokens.",
    )
    check_brand: bool = Field(
        default=False,
        description="When true, run a Gemini-vision check on each output to verify "
                    "the requested brand colours. Adds ~₹0.05 per render.",
    )


class BrandCheckResult(BaseModel):
    passed: bool = True
    score: int = 100
    reason: Optional[str] = None


class AIRenderItem(BaseModel):
    url: str
    style: str
    label: str
    prompt: str
    size_kb: float
    aspect_ratio: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    building_type: Optional[str] = None
    cached: bool = False
    brand_check: Optional[BrandCheckResult] = None


class UpscaleRequest(BaseModel):
    render_url: str = Field(
        ...,
        description="The render URL returned previously, e.g. /renders/q42_ai_exterior_xxx.png",
    )
    scale: int = Field(default=2, ge=2, le=4)


class UpscaleResponse(BaseModel):
    url: str
    width: Optional[int] = None
    height: Optional[int] = None


class AIRenderResponse(BaseModel):
    renders: list[AIRenderItem] = Field(default_factory=list)
    saved_to_quotation: bool = False
    message: Optional[str] = None
