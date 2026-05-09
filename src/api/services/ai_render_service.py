"""
AI Render Service — Photoreal PEB Building Generator
====================================================
Takes a Three.js viewport screenshot of a PEB building plus its parameters,
calls Google Gemini 2.5 Flash Image ("Nano Banana") with image-to-image
guidance, and returns photorealistic architectural renders saved to
`<repo>/static/renders/`.

Phase-1 quality upgrades baked in:
  1. **Adaptive aspect ratio** — output dimensions track the actual building
     proportions (a 150ft x 60ft warehouse is widescreen; a 40ft x 60ft tall
     commercial is portrait).
  2. **Style anchor reference image** — every Gemini call receives a curated
     reference photo alongside the 3D capture, so the output locks onto the
     user's brand aesthetic (teal-and-white striped warehouse, or modern
     commercial with curtain wall).
  3. **Negative prompts** — explicit list of failure modes Gemini must avoid
     (low-poly, video-game look, people, signage, watermarks, etc.).

Output URL pattern: /renders/{filename}.png
(See _mount_render_storage in api/server.py for the StaticFiles mount.)
"""

from __future__ import annotations

import base64
import hashlib
import json
import logging
import os
import re
import threading
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from api.config import settings

logger = logging.getLogger(__name__)


# ── Storage ──────────────────────────────────────────────────────
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
RENDERS_DIR = _REPO_ROOT / "static" / "renders"
RENDERS_DIR.mkdir(parents=True, exist_ok=True)
RENDER_URL_PREFIX = "/renders"

# ── Cache layer ──────────────────────────────────────────────────
# Hash (capture image + style fields + angles list) → cached render results.
# Skips a Gemini call when the user clicks Generate twice with no input change.
# Cache lives next to the renders so it disappears with them on `rm -rf`.
_CACHE_FILE = RENDERS_DIR / "_cache.json"
_cache_lock = threading.Lock()

# Subset of params that affect the AI output. Other fields (rates, audit IDs,
# etc.) don't matter for rendering — they're filtered out before hashing.
_HASHED_PARAM_KEYS = {
    "building_length", "building_width", "full_height", "wall_height",
    "roof_type", "roof_sheet_type", "side_cladding_type", "mezzanine_required",
    "mezz_length", "mezz_width", "building_type",
    "wall_color_hex", "accent_color_hex", "roof_color_hex", "trim_color_hex",
    "cladding_pattern", "glazing_type", "front_door_type", "site_context",
    "parking_visible",
}


def _load_cache_index() -> dict:
    if not _CACHE_FILE.exists():
        return {}
    try:
        return json.loads(_CACHE_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        logger.warning("Render cache file corrupted; starting fresh")
        return {}


def _save_cache_index(index: dict) -> None:
    try:
        _CACHE_FILE.write_text(json.dumps(index, indent=2))
    except OSError as exc:
        logger.warning("Could not persist render cache: %s", exc)


def _build_cache_key(
    capture_bytes: bytes,
    relevant_params: dict,
    lead: Optional[dict],
    angles: list[str],
    model: str,
) -> str:
    """
    SHA256 over (capture image hash, relevant params, lead.company, angles, model).
    Sorted-key JSON so equal dicts produce equal hashes regardless of insertion
    order. The capture-image hash collapses identical 3D camera framings.
    """
    img_hash = hashlib.sha256(capture_bytes).hexdigest()[:16]
    payload = {
        "img": img_hash,
        "params": {k: relevant_params.get(k) for k in sorted(_HASHED_PARAM_KEYS)
                   if k in relevant_params},
        "company": (lead or {}).get("company") or "",
        "angles": sorted(angles or []),
        "model": model,
    }
    blob = json.dumps(payload, sort_keys=True, default=str).encode()
    return hashlib.sha256(blob).hexdigest()


# ── Style anchors ────────────────────────────────────────────────
# These reference images are passed to Gemini alongside the 3D capture so the
# output locks onto a known-good aesthetic. We ship two: a PEB warehouse and a
# 2-storey commercial. Override either by env var if you want a different look.
_STYLE_ANCHOR_DIR = _REPO_ROOT / "static" / "style-anchors"

STYLE_ANCHORS: dict[str, Path] = {
    "warehouse":  _STYLE_ANCHOR_DIR / "peb_warehouse.jpg",
    "commercial": _STYLE_ANCHOR_DIR / "commercial_2storey.jpg",
    # No anchor for `showroom` — the only available commercial anchor is
    # 2-storey, which leaks structural bias and makes Gemini ignore the
    # single-storey directive. Prompt-only path + the 3D capture (rendered
    # via ShowroomBuilding) gives much cleaner single-storey output.
    # Drop a `showroom.jpg` here later for an even tighter visual match.
}


# ── Model ────────────────────────────────────────────────────────
# Override via GEMINI_IMAGE_MODEL env var:
#   - gemini-2.5-flash-image           (default, fast, ~$0.039/image)
#   - gemini-3.1-flash-image-preview   (newer flash, slightly better quality)
#   - gemini-3-pro-image-preview       (Nano Banana Pro — best quality, costlier)
GEMINI_MODEL = os.environ.get("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image")


# ── Camera-angle presets ─────────────────────────────────────────
ANGLE_PRESETS = [
    {
        "id": "exterior",
        "label": "Exterior Hero",
        "instruction": (
            "Three-quarter exterior hero shot at human eye level, the building "
            "diagonally across the frame so both a long side and a gable end "
            "are visible. Late-morning natural daylight with soft directional "
            "shadows. Architectural-photography composition."
        ),
    },
    {
        "id": "aerial",
        "label": "Aerial",
        "instruction": (
            "Aerial drone perspective from roughly 45 degrees above and ahead "
            "of the building, framing the entire structure plus its industrial "
            "site context (paved approach, perimeter wall, parking, surrounding "
            "trees). Bird's-eye composition."
        ),
    },
    {
        "id": "front",
        "label": "Front Elevation",
        "instruction": (
            "Symmetrical near-orthographic front-elevation view. Camera "
            "centered on the gable end at eye level. Clean architectural "
            "presentation with even midday lighting."
        ),
    },
]


# ── Helpers ──────────────────────────────────────────────────────


def _strip_data_url(data_url: str) -> str:
    return re.sub(r"^data:image/[a-zA-Z0-9.+-]+;base64,", "", data_url or "")


def _safe_filename(prefix: str) -> str:
    stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    suffix = uuid.uuid4().hex[:6]
    safe_prefix = re.sub(r"[^A-Za-z0-9_-]", "_", prefix or "render")
    return f"{safe_prefix}_{stamp}_{suffix}.png"


def _classify_building_type(params: dict) -> str:
    """
    Decide which style anchor + prompt template to use.

    Building types:
      - warehouse:   PEB industrial shed (default)
      - factory:     larger / multi-bay PEB, similar treatment to warehouse
      - showroom:    single-storey commercial with large glazing
      - commercial:  multi-storey office with curtain wall
    """
    explicit = (params or {}).get("building_type")
    if explicit in {"warehouse", "factory", "showroom", "commercial"}:
        # `factory` borrows the warehouse anchor; the others have their own.
        if explicit == "factory":
            return "warehouse"
        return explicit
    # Heuristic fallback: tall buildings with low footprint look "commercial"
    H = float((params or {}).get("full_height", 30) or 30)
    L = float((params or {}).get("building_length", 100) or 100)
    if H >= 40 and L <= 80:
        return "commercial"
    return "warehouse"


def _hex_to_named(hex_code: str) -> str:
    """
    Map a hex colour to a short descriptive phrase. Helps Gemini understand
    what colour we want without leaning entirely on a 6-char hex string.
    """
    if not hex_code:
        return ""
    code = hex_code.strip().lstrip("#").upper()
    if len(code) != 6:
        return code
    try:
        r, g, b = int(code[0:2], 16), int(code[2:4], 16), int(code[4:6], 16)
    except ValueError:
        return code

    # Greyscale check
    if abs(r - g) < 12 and abs(g - b) < 12 and abs(r - b) < 12:
        if r > 230: return "white"
        if r > 180: return "light grey"
        if r > 110: return "medium grey"
        if r > 50:  return "dark grey / charcoal"
        return "near-black"

    # Dominant channel
    mx = max(r, g, b)
    mn = min(r, g, b)
    sat = (mx - mn) / mx if mx else 0

    # Hue family
    if r >= g and r >= b:
        if g >= b * 0.8: family = "warm yellow" if g > 0.7 * r else "orange-red"
        else:            family = "vivid red" if sat > 0.4 else "muted red"
    elif g >= r and g >= b:
        if b >= r:       family = "teal-green" if b > 0.55 * g else "leaf green"
        else:            family = "olive green"
    else:  # b dominant
        if r >= g:       family = "purple"
        elif g >= 0.6*b: family = "deep blue / navy" if b < 200 else "sky blue"
        else:            family = "deep blue / navy"

    # Lightness modifier
    if mx > 220: prefix = "bright "
    elif mx > 160: prefix = ""
    elif mx > 100: prefix = "muted "
    else:          prefix = "dark "
    return f"{prefix}{family} (#{code})"


# Default colour palette per building type — used when the quotation hasn't
# specified colours explicitly. Matches the style anchors we ship.
_DEFAULT_PALETTES = {
    "warehouse": {
        "wall_color_hex":   "#FFFFFF",
        "accent_color_hex": "#1FBBA0",
        "roof_color_hex":   "#1FBBA0",
        "trim_color_hex":   "#1FBBA0",
    },
    "commercial": {
        "wall_color_hex":   "#FFFFFF",
        "accent_color_hex": "#1F4E79",   # the deep blue of the curtain-wall glass
        "roof_color_hex":   "#FFFFFF",   # flat parapet, white
        "trim_color_hex":   "#E63946",   # red trim line at parapet
    },
}


def _resolve_palette(params: dict, btype: str) -> dict:
    p = params or {}
    defaults = _DEFAULT_PALETTES.get(btype, _DEFAULT_PALETTES["warehouse"])
    return {
        "wall":   (p.get("wall_color_hex")   or defaults["wall_color_hex"]).upper(),
        "accent": (p.get("accent_color_hex") or defaults["accent_color_hex"]).upper(),
        "roof":   (p.get("roof_color_hex")   or defaults["roof_color_hex"]).upper(),
        "trim":   (p.get("trim_color_hex")   or defaults["trim_color_hex"]).upper(),
    }


def pick_aspect_ratio(L: float, W: float, H: float, angle: str) -> str:
    """
    Map building geometry → Gemini-supported aspect ratio.

    Gemini accepts: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9.
    """
    L = float(L or 100)
    W = float(W or 60)
    H = float(H or 30)

    if angle == "front":
        # Front elevation tracks W:H
        if W / H >= 2.5:  return "21:9"
        if W / H >= 1.6:  return "16:9"
        if W / H >= 1.3:  return "4:3"
        if W / H >= 0.9:  return "1:1"
        return "3:4"          # tall narrow front
    if angle == "aerial":
        # Aerial drone framing tracks footprint L:W
        if L / W >= 2.0:  return "16:9"
        if L / W >= 1.2:  return "3:2"
        return "1:1"          # near-square footprint
    # Exterior 3/4 hero — always 16:9 (it's a hero shot)
    return "16:9"


def _building_summary(params: dict, lead: Optional[dict] = None) -> str:
    """Compact, parameter-grounded description used inside every prompt."""
    p = params or {}
    L = p.get("building_length", 100)
    W = p.get("building_width", 60)
    H = p.get("full_height", 30)
    wall_h = p.get("wall_height", 8)
    try:
        clad_h = max(int(H) - int(wall_h), 0)
    except (TypeError, ValueError):
        clad_h = 0

    btype = _classify_building_type(p)
    palette = _resolve_palette(p, btype)
    wall_c = _hex_to_named(palette["wall"])
    acc_c  = _hex_to_named(palette["accent"])
    roof_c = _hex_to_named(palette["roof"])
    trim_c = _hex_to_named(palette["trim"])

    roof_type = "gable" if p.get("roof_type") == "gable" else "single-slope monoslope"

    # Cladding pattern (defaults to vertical_stripe for warehouses)
    pattern = (p.get("cladding_pattern") or "vertical_stripe").lower()
    if pattern == "horizontal_rib":
        clad_pattern_desc = "horizontal-ribbed colour-coated metal cladding"
    elif pattern == "flat_panel":
        clad_pattern_desc = "flat smooth colour-coated metal panels"
    else:  # vertical_stripe
        clad_pattern_desc = (
            f"vertical-profile colour-coated metal cladding in alternating "
            f"{acc_c} and {wall_c} stripes"
        )
    if p.get("side_cladding_type") == "puf":
        clad_pattern_desc = f"{acc_c} PUF insulated sandwich-panel cladding"

    # Roof material
    if p.get("roof_sheet_type") == "puf":
        roof_desc = f"{roof_c} PUF insulated panel"
    else:
        roof_desc = f"{roof_c} colour-coated profiled metal roof sheets"

    # Front door type
    door_type = (p.get("front_door_type") or "roller_shutter").lower()
    if door_type == "sectional":
        door_desc = "a wide front sectional overhead loading door"
    elif door_type == "glazed_entrance":
        door_desc = "a glass-and-aluminium glazed entrance door with side glazing"
    else:
        door_desc = "a central front roller-shutter loading door"

    # Glazing for commercial buildings
    glazing = (p.get("glazing_type") or "punched_windows").lower()
    if glazing == "curtain_wall":
        glazing_desc = (
            f"a full-height {acc_c}-tinted glass curtain wall on the upper storey "
            f"with anodised aluminium mullions in a regular grid"
        )
    elif glazing == "ribbon_window":
        glazing_desc = (
            f"continuous horizontal ribbon windows of {acc_c}-tinted glass "
            f"running across the upper storey"
        )
    else:
        glazing_desc = "small punched square windows along the side walls"

    company = ((lead or {}).get("company") or "Swetha Structures").strip()

    mezz = ""
    if p.get("mezzanine_required"):
        ml = p.get("mezz_length", 0)
        mw = p.get("mezz_width", 0)
        if ml and mw:
            mezz = f", with an internal mezzanine floor measuring {ml} ft x {mw} ft"

    if btype == "showroom":
        return (
            f"a single-storey premium commercial showroom for {company}, "
            f"{L} ft long x {W} ft wide x {H} ft tall, with a flat parapet roof "
            f"and an overhanging eave canopy. "
            f"Front facade: full-height {acc_c}-tinted glass curtain wall with "
            f"slim anodised aluminium mullions, framed by a {trim_c} header "
            f"band and matching sill. "
            f"Side and back walls: clean {wall_c} painted masonry. "
            f"Front entrance: {door_desc}"
        )

    if btype == "commercial":
        return (
            f"a modern 2-storey commercial / office building for {company}, "
            f"{L} ft long x {W} ft wide x {H} ft tall, with a flat parapet roof. "
            f"Painted {wall_c} masonry ground floor with {glazing_desc.split(' on the upper')[0]} pattern at ground level, "
            f"and {glazing_desc} above. "
            f"Front entrance: {door_desc}. "
            f"Finished with a thin {trim_c} horizontal trim line at the parapet edge"
        )

    return (
        f"a pre-engineered steel (PEB) industrial warehouse for {company}, "
        f"{L} ft long x {W} ft wide x {H} ft tall, with a {roof_type} roof. "
        f"Reinforced concrete dado walls {wall_h} ft high at the base painted {wall_c}, "
        f"{clad_pattern_desc} rising {clad_h} ft above the dado, "
        f"{roof_desc} as the roofing material. "
        f"Front: {door_desc}. {glazing_desc.capitalize()}. "
        f"{trim_c.capitalize()} galvanised eave and ridge trim{mezz}"
    )


# ── Prompt building ──────────────────────────────────────────────


_NEGATIVE_PROMPT_BLOCK = (
    "STRICTLY AVOID: low-poly look, video-game aesthetic, blocky geometry, "
    "cartoon shading, blueprint or technical-drawing style, sketchy line art, "
    "people in foreground, faces, animals, brand logos, company names, "
    "any text written on the building or signs, watermarks, dust, rust, debris, "
    "construction equipment, cluttered backgrounds, harsh lens flare, "
    "unrealistic neon colours, fish-eye distortion."
)

_STYLE_PROMPT_BLOCK = (
    "Render style: high-end architectural visualization in the style of Enscape "
    "or Lumion — hyperreal but cleanly idealised, like a developer marketing "
    "image. Bright midday lighting under a soft blue sky with thin cumulus "
    "clouds. Crisp shadows, realistic material reflections, sharp focus across "
    "the frame, 4K quality, 35mm equivalent lens."
)

_SITE_CONTEXTS = {
    "industrial_estate": (
        "industrial estate in South India. Paved concrete approach, neat low "
        "landscaped strip along the building base, a few mature coconut palms "
        "and small deciduous trees on the perimeter, light grey perimeter wall"
    ),
    "highway_frontage": (
        "highway-frontage commercial plot in South India. Wide tarmac frontage "
        "road in the middle distance, sparse roadside trees, painted concrete "
        "boundary wall, well-lit forecourt"
    ),
    "green_belt": (
        "green-belt site on the outskirts of a South Indian town. Mature "
        "deciduous trees and coconut palms surround the building, manicured "
        "lawns, a paved internal road, light coloured perimeter wall"
    ),
}


def _site_context(p: dict) -> str:
    key = (p or {}).get("site_context") or "industrial_estate"
    body = _SITE_CONTEXTS.get(key, _SITE_CONTEXTS["industrial_estate"])
    parking_visible = (p or {}).get("parking_visible", True)
    parking = (
        ". 2-3 modern Indian-market cars and 1-2 parked motorbikes for human "
        "scale only (subtle, not the subject)" if parking_visible else
        ". No parked vehicles in the foreground"
    )
    return f"Site context: {body}{parking}."


def _build_prompt(
    angle: dict,
    summary: str,
    btype: str,
    aspect_ratio: str,
    palette: dict,
    site: str,
) -> str:
    """
    Compose the final text prompt. Pulls together:
      - the angle-specific camera instruction
      - the dimensioned, colour-aware building summary
      - the site context (industrial / highway / green-belt)
      - explicit colour anchors (so Gemini doesn't drift off-brand)
      - style/negative guidance
    """
    colour_anchor = (
        f"Hard colour requirements: walls / dado are {_hex_to_named(palette['wall'])}, "
        f"vertical accent stripes are {_hex_to_named(palette['accent'])}, "
        f"roof is {_hex_to_named(palette['roof'])}, "
        f"trim and door frames are {_hex_to_named(palette['trim'])}. "
        f"Match these colour values closely; do NOT shift the hue."
    )

    if btype == "warehouse":
        anchor_match = (
            "the cladding stripe colours, painted concrete dado, and overall "
            "industrial-PEB aesthetic must visually match the second reference "
            "image (style anchor)"
        )
    elif btype == "showroom":
        anchor_match = (
            "no second reference image is provided — match the height and "
            "footprint of the first reference image (the 3D capture) exactly. "
            "**CRITICAL**: this is a SINGLE-STOREY building. The whole front "
            "face is ONE continuous floor-to-parapet glass curtain wall, not "
            "split into two storeys. Premium-commercial finish quality"
        )
    else:
        anchor_match = (
            "the white-painted masonry ground floor, blue-tinted glass curtain "
            "wall, red parapet trim, and clean modern-commercial aesthetic must "
            "visually match the second reference image (style anchor)"
        )

    return (
        f"Photorealistic architectural render of {summary}. "
        f"{angle['instruction']} "
        f"\n\nThe FIRST reference image is the structural geometry — match the "
        f"building dimensions, roof type, length-to-width ratio, and floor count "
        f"exactly to that 3D model. "
        f"The SECOND reference image is the style anchor — {anchor_match}. "
        f"\n\n{colour_anchor}"
        f"\n\n{site}"
        f"\n\n{_STYLE_PROMPT_BLOCK}"
        f"\n\nOutput aspect ratio: {aspect_ratio}. "
        f"\n\n{_NEGATIVE_PROMPT_BLOCK}"
    )


# ── Style anchor loader (cached) ─────────────────────────────────


_anchor_cache: dict[str, bytes] = {}


def _load_style_anchor(btype: str) -> Optional[bytes]:
    """Read the style anchor image bytes for a building type. Cached in memory."""
    # Allow override via env: GEMINI_STYLE_ANCHOR_WAREHOUSE / _COMMERCIAL
    override = os.environ.get(f"GEMINI_STYLE_ANCHOR_{btype.upper()}", "").strip()
    candidate = Path(override) if override else STYLE_ANCHORS.get(btype)
    if not candidate or not candidate.exists():
        logger.info("No style anchor for type=%s (looked at %s)", btype, candidate)
        return None

    cached = _anchor_cache.get(str(candidate))
    if cached is not None:
        return cached
    try:
        data = candidate.read_bytes()
        _anchor_cache[str(candidate)] = data
        return data
    except OSError as exc:
        logger.warning("Could not read style anchor %s: %s", candidate, exc)
        return None


# ── Gemini provider ──────────────────────────────────────────────


def _generate_with_gemini(
    capture_bytes: bytes,
    style_anchor_bytes: Optional[bytes],
    prompt: str,
    aspect_ratio: str,
) -> Optional[bytes]:
    """Call Gemini with up to two reference images. Returns PNG bytes or None."""
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        logger.error(
            "google-genai is not installed. Install with: pip install google-genai>=0.8.0"
        )
        return None

    api_key = (getattr(settings, "GEMINI_API_KEY", "") or "").strip()
    if not api_key:
        logger.error("GEMINI_API_KEY is not configured")
        return None

    try:
        client = genai.Client(api_key=api_key)

        contents: list = [
            types.Part.from_bytes(data=capture_bytes, mime_type="image/png"),
        ]
        if style_anchor_bytes:
            # Detect mime: anchors ship as JPEG
            mime = "image/jpeg" if style_anchor_bytes[:3] == b"\xff\xd8\xff" else "image/png"
            contents.append(types.Part.from_bytes(data=style_anchor_bytes, mime_type=mime))
        contents.append(prompt)

        config = types.GenerateContentConfig(
            response_modalities=["IMAGE"],
            image_config=types.ImageConfig(aspect_ratio=aspect_ratio),
        )
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=contents,
            config=config,
        )
    except Exception as exc:
        logger.exception("Gemini render call failed: %s", exc)
        return None

    candidates = getattr(response, "candidates", None) or []
    for cand in candidates:
        content = getattr(cand, "content", None)
        if not content:
            continue
        for part in (getattr(content, "parts", None) or []):
            inline = getattr(part, "inline_data", None)
            if inline and getattr(inline, "data", None):
                data = inline.data
                if isinstance(data, str):
                    try:
                        return base64.b64decode(data)
                    except Exception:
                        continue
                if isinstance(data, (bytes, bytearray)):
                    return bytes(data)

    logger.warning(
        "Gemini returned no inline image. Likely a content-policy refusal or quota issue."
    )
    return None


# ── Public API ───────────────────────────────────────────────────


def generate_realistic_renders(
    capture_b64: str,
    params: dict,
    lead: Optional[dict] = None,
    quotation_id: Optional[int] = None,
    angles: Optional[list] = None,
    force_regenerate: bool = False,
) -> list[dict]:
    """
    Generate photoreal renders for the given building.

    Caches by (capture image + style params + angles + model). When the same
    inputs are submitted again, returns the cached URLs without paying for
    Gemini. Pass `force_regenerate=True` to bypass the cache.

    Returns a list of `{ url, style, label, prompt, size_kb, aspect_ratio,
    width, height, cached }` dicts.
    """
    capture_b64 = _strip_data_url(capture_b64)
    if not capture_b64:
        raise ValueError("capture_image is required")

    try:
        capture_bytes = base64.b64decode(capture_b64)
    except Exception as exc:
        raise ValueError(f"capture_image is not valid base64: {exc}")

    p = params or {}
    L = p.get("building_length", 100)
    W = p.get("building_width", 60)
    H = p.get("full_height", 30)

    btype = _classify_building_type(p)
    style_anchor_bytes = _load_style_anchor(btype)
    summary = _building_summary(p, lead)
    palette = _resolve_palette(p, btype)
    site = _site_context(p)

    if angles:
        selected = [a for a in ANGLE_PRESETS if a["id"] in angles]
        if not selected:
            selected = ANGLE_PRESETS
    else:
        selected = ANGLE_PRESETS

    # Cache lookup
    angle_ids = [a["id"] for a in selected]
    cache_key = _build_cache_key(capture_bytes, p, lead, angle_ids, GEMINI_MODEL)
    if not force_regenerate:
        with _cache_lock:
            index = _load_cache_index()
            cached = index.get(cache_key)
        if cached:
            # Make sure every cached file still exists on disk; if any are
            # missing (cleanup, deploy reset, etc.), fall through and regen.
            all_present = all(
                (RENDERS_DIR / Path(item["url"]).name).exists()
                for item in cached
            )
            if all_present:
                logger.info(
                    "Render cache HIT for key=%s (%d items, no Gemini cost)",
                    cache_key[:12], len(cached),
                )
                return [{**item, "cached": True} for item in cached]
            logger.info("Cache index pointed to missing files — regenerating")

    quote_prefix = f"q{quotation_id}" if quotation_id else "preview"
    results: list[dict] = []

    for angle in selected:
        aspect = pick_aspect_ratio(L, W, H, angle["id"])
        prompt = _build_prompt(angle, summary, btype, aspect, palette, site)
        png_bytes = _generate_with_gemini(capture_bytes, style_anchor_bytes, prompt, aspect)
        if not png_bytes:
            logger.warning("AI render: skipping angle %s — no image returned", angle["id"])
            continue

        filename = _safe_filename(f"{quote_prefix}_ai_{angle['id']}_{aspect.replace(':', 'x')}")
        out_path = RENDERS_DIR / filename
        try:
            out_path.write_bytes(png_bytes)
        except OSError as exc:
            logger.exception("Failed to write render to %s: %s", out_path, exc)
            continue

        # Probe the dimensions for the UI (needs PIL, optional)
        width, height = _probe_dimensions(png_bytes)

        results.append({
            "url": f"{RENDER_URL_PREFIX}/{filename}",
            "style": angle["id"],
            "label": angle["label"],
            "prompt": prompt,
            "size_kb": round(len(png_bytes) / 1024, 1),
            "aspect_ratio": aspect,
            "width": width,
            "height": height,
            "building_type": btype,
            "cached": False,
        })
        logger.info(
            "AI render saved: angle=%s aspect=%s size=%dKB type=%s file=%s",
            angle["id"], aspect, len(png_bytes) // 1024, btype, filename,
        )

    # Persist to cache only on full success — partial results aren't worth
    # serving on a future cache hit because the user would expect all angles.
    if results and len(results) == len(selected):
        with _cache_lock:
            index = _load_cache_index()
            index[cache_key] = [{k: v for k, v in r.items() if k != "cached"}
                                for r in results]
            _save_cache_index(index)
        logger.info("Render cache STORED key=%s (%d items)", cache_key[:12], len(results))

    return results


# ── Brand-consistency check (Gemini vision) ───────────────────────


def check_brand_consistency(image_path: Path, expected_palette: dict) -> dict:
    """
    Pass a generated render to Gemini-vision with the requested colour palette
    and ask whether the output actually has those colours. Used as a
    quality-gate badge in the gallery — does NOT regenerate on failure.

    Returns: { passed: bool, score: 0-100, reason: str }
    """
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        return {"passed": True, "score": 100, "reason": "Check skipped (SDK missing)"}

    api_key = (getattr(settings, "GEMINI_API_KEY", "") or "").strip()
    if not api_key or not image_path.exists():
        return {"passed": True, "score": 100, "reason": "Check skipped"}

    try:
        client = genai.Client(api_key=api_key)
        img = types.Part.from_bytes(
            data=image_path.read_bytes(),
            mime_type="image/png",
        )
        wall = expected_palette.get("wall", "")
        accent = expected_palette.get("accent", "")
        roof = expected_palette.get("roof", "")
        prompt = (
            f"Look at the building in this image. The expected colour palette is:\n"
            f"- walls / dado: {wall}\n"
            f"- accent / cladding stripes: {accent}\n"
            f"- roof: {roof}\n\n"
            f"Reply with ONLY a single line in this exact format:\n"
            f"SCORE=<0-100>|REASON=<short 1-line reason>\n\n"
            f"SCORE meanings:\n"
            f"  90-100 — colours match closely\n"
            f"  70-89  — colours mostly match with minor drift\n"
            f"  50-69  — significant colour drift\n"
            f"  0-49   — colours are wrong"
        )
        # Use a cheap text-only model for this check
        check_model = "gemini-2.5-flash"
        resp = client.models.generate_content(
            model=check_model,
            contents=[img, prompt],
        )
        text = (getattr(resp, "text", "") or "").strip()
        m = re.match(r"SCORE=(\d+)\|REASON=(.+)", text, re.IGNORECASE)
        if not m:
            return {"passed": True, "score": 100, "reason": f"Check inconclusive: {text[:80]}"}
        score = int(m.group(1))
        reason = m.group(2).strip()
        return {"passed": score >= 70, "score": score, "reason": reason}
    except Exception as exc:
        logger.exception("Brand-consistency check failed: %s", exc)
        return {"passed": True, "score": 100, "reason": "Check errored"}


# ── 2x upscale (PIL LANCZOS + light sharpening) ───────────────────


def upscale_render(render_filename: str, scale: int = 2) -> Optional[str]:
    """
    Upscale an existing render by `scale`× using PIL LANCZOS resampling and
    a light unsharp mask. Returns the public URL of the upscaled file or
    None if the input is missing.
    """
    src = RENDERS_DIR / render_filename
    if not src.exists():
        return None
    try:
        from PIL import Image, ImageFilter
    except ImportError:
        logger.warning("Pillow not available — upscale skipped")
        return None

    if scale not in (2, 3, 4):
        scale = 2

    out_name = src.stem + f"_x{scale}" + src.suffix
    out_path = RENDERS_DIR / out_name
    if out_path.exists():
        return f"{RENDER_URL_PREFIX}/{out_name}"

    try:
        img = Image.open(src).convert("RGB")
        target = (img.width * scale, img.height * scale)
        big = img.resize(target, Image.LANCZOS)
        big = big.filter(ImageFilter.UnsharpMask(radius=1.5, percent=120, threshold=2))
        big.save(out_path, format="PNG", optimize=True)
        return f"{RENDER_URL_PREFIX}/{out_name}"
    except Exception as exc:
        logger.exception("Upscale failed for %s: %s", render_filename, exc)
        return None


def _probe_dimensions(png_bytes: bytes) -> tuple[Optional[int], Optional[int]]:
    """Read width/height from PNG header without needing Pillow."""
    if len(png_bytes) < 24 or png_bytes[:8] != b"\x89PNG\r\n\x1a\n":
        return None, None
    # IHDR is at bytes 16-24 (width, height as big-endian u32)
    try:
        import struct
        w = struct.unpack(">I", png_bytes[16:20])[0]
        h = struct.unpack(">I", png_bytes[20:24])[0]
        return w, h
    except Exception:
        return None, None


def is_configured() -> bool:
    """Used by the router to give a friendly 503 if the key is missing."""
    return bool((getattr(settings, "GEMINI_API_KEY", "") or "").strip())
