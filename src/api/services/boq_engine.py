"""
PEB BOQ Engine — Swetha Structures calculation logic
=====================================================
Matches actual Swetha Structures proposal format.
Roof and Side Cladding are SEPARATE items.
Rates use Material + Labour split, editable per quote.
"""

import math


# ─── CONSTANTS ────────────────────────────────────────────────────────────────
EAVE_OVERHANG_LENGTH = 6.46    # ft each end
EAVE_OVERHANG_WIDTH  = 2.0     # ft each side

STEEL_RATE_MAIN_BUILDING = 1.8  # kg per sqft (main)
STEEL_RATE_MEZZANINE     = 3.4  # kg per sqft (mezzanine)

# Default rates: {id: (material, labour)}
DEFAULT_RATES = {
    "structural_steel":  (70, 35),
    "purlin":            (90, 15),
    "roof_sheet":        (42, 18),
    "side_cladding":     (40, 18),
    "ridge_flashing":    (60, 50),
    "polycarbonate":     (60, 50),
    "mezzanine_steel":   (70, 35),
    "mezzanine_decking": (110, 25),
    "turbo_ventilator_rate": (4500, 1250),
    "rolling_shutter":   (350, 150),
}


# ─── RATE HELPERS ─────────────────────────────────────────────────────────────

def _get_rate(data: dict, rate_id: str) -> tuple:
    """Get (material, labour, total) from data's rates dict or defaults."""
    rates = data.get("rates") or data.get("_rates") or {}
    if rate_id in rates:
        r = rates[rate_id]
        if isinstance(r, dict):
            mat = float(r.get("material", 0) or 0)
            lab = float(r.get("labour", 0) or 0)
            return mat, lab, mat + lab
    default = DEFAULT_RATES.get(rate_id, (0, 0))
    return default[0], default[1], default[0] + default[1]


# ─── GEOMETRY ─────────────────────────────────────────────────────────────────

def slope_adjusted_dimensions(L: float, W: float, H_full: float, H_wall: float, roof_type: str = "a_type"):
    ridge_h = H_full - H_wall

    if roof_type == "monoslope":
        slope_len = math.sqrt(W ** 2 + ridge_h ** 2)
        slope_factor = slope_len / W if W > 0 else 1
    else:
        # A-Type (gable)
        half_span = W / 2
        slope_len = math.sqrt(half_span ** 2 + ridge_h ** 2)
        slope_factor = slope_len / half_span if half_span > 0 else 1

    adj_L = L + (2 * EAVE_OVERHANG_LENGTH)
    adj_W = W * slope_factor + (2 * EAVE_OVERHANG_WIDTH)
    return adj_L, adj_W, slope_factor


# ─── STEEL TONNAGE ────────────────────────────────────────────────────────────

def calculate_steel_tonnage(data: dict) -> dict:
    L = data["building_length"]
    W = data["building_width"]
    mL = data.get("mezz_length", 0) or 0
    mW = data.get("mezz_width", 0) or 0
    has_mezz = data.get("mezzanine_required", False)

    rate_main = data.get("steel_rate_main") or STEEL_RATE_MAIN_BUILDING
    rate_mezz = data.get("steel_rate_mezz") or STEEL_RATE_MEZZANINE

    main_area = L * W
    main_kg = round(main_area * rate_main, 2)

    mezz_area = (mL * mW) if has_mezz else 0
    mezz_kg = round(mezz_area * rate_mezz, 2) if has_mezz else 0

    total_kg = main_kg + mezz_kg
    total_ton = round(total_kg / 1000, 3)

    mat, lab, total_rate = _get_rate(data, "structural_steel")

    return {
        "main_area_sqft": round(main_area, 2),
        "main_steel_kg": main_kg,
        "mezz_area_sqft": round(mezz_area, 2),
        "mezz_steel_kg": mezz_kg,
        "total_steel_kg": total_kg,
        "total_steel_ton": total_ton,
        "material_rate": mat,
        "labour_rate": lab,
        "rate_per_kg": total_rate,
        "steel_amount": round(total_kg * total_rate, 2),
        "breakdown_note": (
            f"Main: {L}x{W}x{rate_main} = {main_kg} Kg"
            + (f" | Mezz: {mL}x{mW}x{rate_mezz} = {mezz_kg} Kg" if has_mezz else "")
        ),
    }


# ─── CLADDING AREAS ──────────────────────────────────────────────────────────

def calculate_cladding_areas(data: dict) -> dict:
    L = data["building_length"]
    W = data["building_width"]
    H_full = data["full_height"]
    H_wall = data["wall_height"]
    # Cladding height = full_height - wall_height (matches all 3 PDF samples)
    H_clad = H_full - H_wall
    roof_t = data.get("roof_type", "a_type")

    adj_L, adj_W, slope_factor = slope_adjusted_dimensions(L, W, H_full, H_wall, roof_t)

    roof_area = adj_L * adj_W

    if roof_t in ("a_type", "gable"):
        ridge_h = H_full - H_wall
        triangular_area = 2 * (0.5 * W * ridge_h)
    else:
        triangular_area = 0

    north_south = 2 * (adj_L * H_clad)
    east_west = 2 * (adj_W * H_clad)
    total_wall = north_south + east_west + triangular_area

    ridge_rft = 2 * (adj_L + adj_W)
    lighting_qty = data.get("lighting_sqft") or round(roof_area * 0.05, 2)

    return {
        "adj_length": round(adj_L, 3),
        "adj_width": round(adj_W, 3),
        "slope_factor": round(slope_factor, 4),
        "roof_area_sqft": round(roof_area, 2),
        "wall_area_sqft": round(total_wall, 2),
        "north_south_sqft": round(north_south, 2),
        "east_west_sqft": round(east_west, 2),
        "triangular_sqft": round(triangular_area, 2),
        "ridge_rft": round(ridge_rft, 2),
        "lighting_sqft": round(lighting_qty, 2),
        "floor_area_sqft": round(L * W, 2),
        "cladding_height": round(H_clad, 2),
    }


# ─── FULL BOQ ────────────────────────────────────────────────────────────────

def _roof_sheet_desc(sheet_type: str) -> str:
    if not sheet_type:
        return "BARE galvalume sheet 0.47mm thickness"
    if sheet_type.startswith("puf_panel"):
        mm = sheet_type.replace("puf_panel_", "").replace("mm", "")
        return f"PUF panel {mm}MM thickness"
    if sheet_type.startswith("bare_galvalume"):
        mm = sheet_type.replace("bare_galvalume_", "").replace("mm", "")
        return f"BARE galvalume sheet {mm}mm thickness"
    # Legacy
    if sheet_type == "puf":
        return "PUF panel 30MM thickness"
    return "BARE galvalume sheet 0.47mm thickness"


def _side_cladding_desc(sheet_type: str) -> str:
    if not sheet_type:
        return "profiled COLOUR coated galvalume sheet 0.47mm thickness"
    if sheet_type.startswith("puf_panel"):
        mm = sheet_type.replace("puf_panel_", "").replace("mm", "")
        return f"PUF panel {mm}MM thickness"
    if sheet_type.startswith("bare_colour_galvalume"):
        mm = sheet_type.replace("bare_colour_galvalume_", "").replace("mm", "")
        return f"profiled COLOUR coated galvalume sheet {mm}mm thickness"
    # Legacy
    if sheet_type == "puf":
        return "PUF panel 30MM thickness"
    return "profiled COLOUR coated galvalume sheet 0.47mm thickness"


def generate_full_boq(data: dict) -> dict:
    roof_sheet = data.get("roof_sheet_type", "bare_galvalume_0.47mm")
    side_sheet = data.get("side_cladding_type", "bare_colour_galvalume_0.47mm")
    has_mezz = data.get("mezzanine_required", False)

    steel = calculate_steel_tonnage(data)
    clad = calculate_cladding_areas(data)

    items = []

    # 1.00 — Structural Steel Works
    mat, lab, rate = _get_rate(data, "structural_steel")
    items.append({
        "item_no": "1.00",
        "description": (
            "Supplying, fabrication and erecting in position for all structural members "
            "using MS Sections for Trusses, Base plate, Cap plate, connection plates, "
            "EN8 Anchor bolts, Cold formed Purlins, etc., including making connection, "
            "aligning, cleaning etc., with one coat of zinc chromate metal primer and "
            "two coats of enamel paint (Asian). Conveyance and fixing charges etc., complete.\n"
            "(All Structural members, Purlins, Sag rods, connection plates & Bolts considered)"
        ),
        "unit": "Kg",
        "quantity": steel["total_steel_kg"],
        "material_rate": mat,
        "labour_rate": lab,
        "rate": rate,
        "amount": round(steel["total_steel_kg"] * rate, 2),
        "category": "STRUCTURAL STEEL WORKS",
        "sub_note": steel["breakdown_note"],
    })

    # 2.01 — Roof Sheet (SEPARATE)
    mat, lab, rate = _get_rate(data, "roof_sheet")
    items.append({
        "item_no": "2.01",
        "description": (
            f"Supplying and laying of {_roof_sheet_desc(roof_sheet)} for Roofing "
            "with necessary sealant, EPDM metal washers, Bolt and nuts, "
            "necessary flashings etc., complete."
        ),
        "unit": "Sqft",
        "quantity": clad["roof_area_sqft"],
        "material_rate": mat,
        "labour_rate": lab,
        "rate": rate,
        "amount": round(clad["roof_area_sqft"] * rate, 2),
        "category": "ROOFING AND SIDE CLADDING WORKS",
    })

    # 2.02 — Side Cladding (SEPARATE)
    mat, lab, rate = _get_rate(data, "side_cladding")
    items.append({
        "item_no": "2.02",
        "description": (
            f"Supplying and laying of {_side_cladding_desc(side_sheet)} for side cladding "
            "with necessary sealant, EPDM metal washers, Bolt and nuts, "
            "necessary flashings etc., complete."
        ),
        "unit": "Sqft",
        "quantity": clad["wall_area_sqft"],
        "material_rate": mat,
        "labour_rate": lab,
        "rate": rate,
        "amount": round(clad["wall_area_sqft"] * rate, 2),
        "category": "ROOFING AND SIDE CLADDING WORKS",
    })

    # 2.03 — Ridge, Flashings, Gutters
    mat, lab, rate = _get_rate(data, "ridge_flashing")
    items.append({
        "item_no": "2.03",
        "description": (
            "Supplying and laying of profiled colour coated galvalume sheet 0.47mm thickness "
            "with 550 MPA for Ridge, L Flash, Trip Flash, Gutter, Downspout., etc."
        ),
        "unit": "Rft",
        "quantity": clad["ridge_rft"],
        "material_rate": mat,
        "labour_rate": lab,
        "rate": rate,
        "amount": round(clad["ridge_rft"] * rate, 2),
        "category": "ROOFING AND SIDE CLADDING WORKS",
    })

    # 2.04 — Polycarbonate Lighting Sheet
    mat, lab, rate = _get_rate(data, "polycarbonate")
    items.append({
        "item_no": "2.04",
        "description": (
            "Supplying and laying of POLYCARBONATE SHEET (Lighting sheet) 1.5mm thickness "
            "including making connection, aligning, cleaning etc.,"
        ),
        "unit": "Sqft",
        "quantity": clad["lighting_sqft"],
        "material_rate": mat,
        "labour_rate": lab,
        "rate": rate,
        "amount": round(clad["lighting_sqft"] * rate, 2),
        "category": "ROOFING AND SIDE CLADDING WORKS",
    })

    # 3.00 — Mezzanine Works
    if has_mezz:
        mezz_area = steel["mezz_area_sqft"]
        mezz_kg = steel["mezz_steel_kg"]

        if mezz_kg > 0:
            mat, lab, rate = _get_rate(data, "mezzanine_steel")
            items.append({
                "item_no": "3.01",
                "description": (
                    "Supplying, fabrication and erecting in position for all structural member "
                    "for mezzanine floor, including connection plates, bolts etc., complete."
                ),
                "unit": "Kg",
                "quantity": mezz_kg,
                "material_rate": mat,
                "labour_rate": lab,
                "rate": rate,
                "amount": round(mezz_kg * rate, 2),
                "category": "MEZZANINE WORKS",
            })

        if mezz_area > 0:
            mat, lab, rate = _get_rate(data, "mezzanine_decking")
            items.append({
                "item_no": "3.02",
                "description": (
                    "Supplying and laying of Deck Sheet for mezzanine floor "
                    "with concrete (100mm avg thickness), complete."
                ),
                "unit": "Sqft",
                "quantity": mezz_area,
                "material_rate": mat,
                "labour_rate": lab,
                "rate": rate,
                "amount": round(mezz_area * rate, 2),
                "category": "MEZZANINE WORKS",
            })

    # Totals
    total_amount = round(sum(i["amount"] for i in items), 2)
    floor_area = clad["floor_area_sqft"] + (steel["mezz_area_sqft"] if has_mezz else 0)
    rate_per_sqft = round(total_amount / floor_area, 2) if floor_area > 0 else 0

    return {
        "items": items,
        "total_amount": total_amount,
        "floor_area": floor_area,
        "rate_per_sqft": rate_per_sqft,
        "steel_summary": steel,
        "cladding_summary": clad,
    }
