"""
AI-Powered Quotation Router — Swetha Structures
=================================================
Endpoints for intelligent quotation generation:
  POST /ai-quote/voice     — Natural language → BOQ params
  POST /ai-quote/photo     — Site photo → dimension estimate → BOQ
  GET  /ai-quote/rates     — Steel rate prediction + market data
  POST /ai-quote/market    — Competitor price intelligence for a quote
"""

import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from api.dependencies import get_current_user
from api.services.ai_quotation import (
    voice_to_quote,
    photo_to_quote,
    predict_steel_rates,
    get_market_position,
)
from api.services.boq_engine import generate_full_boq

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ai-quote", tags=["AI Quotation"])


# ── Request/Response schemas ──────────────────────────────────────

class VoiceQuoteRequest(BaseModel):
    text: str
    auto_calculate: bool = True


class MarketPositionRequest(BaseModel):
    total_amount: float
    floor_area: float


# ── POST /voice — Voice/Text to Quote ─────────────────────────────

@router.post("/voice")
async def ai_voice_to_quote(
    body: VoiceQuoteRequest,
    user: dict = Depends(get_current_user),
):
    """Convert natural language to PEB building parameters + BOQ.

    Examples:
        "100 by 60, gable roof, 30 feet height"
        "Large warehouse 150x80 with PUF insulation and mezzanine"
        "Small workshop 40 by 30, single slope"
    """
    try:
        result = await voice_to_quote(body.text)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error("Voice-to-quote failed: %s", e)
        raise HTTPException(status_code=500, detail=f"AI processing failed: {str(e)}")

    # Auto-calculate BOQ if requested
    if body.auto_calculate and result.get("building_params"):
        try:
            boq = generate_full_boq(result["building_params"])
            result["boq_results"] = boq
            result["total_amount"] = boq.get("total_amount", 0)
            result["rate_per_sqft"] = boq.get("rate_per_sqft", 0)
        except Exception as e:
            logger.warning("BOQ calculation failed for voice quote: %s", e)
            result["boq_results"] = None

    # Add market position
    if result.get("total_amount") and result.get("boq_results"):
        floor_area = result["boq_results"].get("floor_area", 0)
        if floor_area > 0:
            result["market_position"] = get_market_position(result["total_amount"], floor_area)

    return result


# ── POST /photo — Photo to Quote ─────────────────────────────────

@router.post("/photo")
async def ai_photo_to_quote(
    file: UploadFile = File(...),
    context: str = Form(default=""),
    auto_calculate: bool = Form(default=True),
    user: dict = Depends(get_current_user),
):
    """Analyze a site/building photo and generate PEB quotation.

    Upload a JPEG/PNG image. Optionally provide context like
    "1 acre plot in Coimbatore industrial area".
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Please upload an image file (JPEG/PNG)")

    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(400, "Image too large. Max 10MB.")

    try:
        result = await photo_to_quote(image_bytes, context)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error("Photo-to-quote failed: %s", e)
        raise HTTPException(status_code=500, detail=f"AI processing failed: {str(e)}")

    # Auto-calculate BOQ
    if auto_calculate and result.get("building_params"):
        try:
            boq = generate_full_boq(result["building_params"])
            result["boq_results"] = boq
            result["total_amount"] = boq.get("total_amount", 0)
            result["rate_per_sqft"] = boq.get("rate_per_sqft", 0)
        except Exception as e:
            logger.warning("BOQ calculation failed for photo quote: %s", e)

    # Add market position
    if result.get("total_amount") and result.get("boq_results"):
        floor_area = result["boq_results"].get("floor_area", 0)
        if floor_area > 0:
            result["market_position"] = get_market_position(result["total_amount"], floor_area)

    return result


# ── GET /rates — Steel Rate Prediction ────────────────────────────

@router.get("/rates")
async def ai_rate_prediction(
    weeks_ahead: int = 2,
    user: dict = Depends(get_current_user),
):
    """Get steel rate prediction and market intelligence.

    Returns current rates, predicted rates, trend analysis,
    and impact on typical quotes.
    """
    if weeks_ahead < 1 or weeks_ahead > 12:
        raise HTTPException(400, "weeks_ahead must be between 1 and 12")

    return predict_steel_rates(weeks_ahead)


# ── POST /market — Market Position Analysis ───────────────────────

@router.post("/market")
async def ai_market_position(
    body: MarketPositionRequest,
    user: dict = Depends(get_current_user),
):
    """Analyze a quotation's market competitiveness.

    Compares your quote against industry benchmarks and
    simulated competitor pricing.
    """
    if body.floor_area <= 0:
        raise HTTPException(400, "floor_area must be positive")
    if body.total_amount <= 0:
        raise HTTPException(400, "total_amount must be positive")

    return get_market_position(body.total_amount, body.floor_area)
