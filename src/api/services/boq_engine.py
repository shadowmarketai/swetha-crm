"""
PEB BOQ Engine — Swetha Structures calculation logic
=====================================================
Steel tonnage, cladding areas, and full BOQ generation.
Adapted from peb-saas/backend/app/modules/peb/boq_engine.py
"""

import math


# ─── CONSTANTS ────────────────────────────────────────────────────────────────
EAVE_OVERHANG_LENGTH = 6.46    # ft each end
EAVE_OVERHANG_WIDTH  = 2.0     # ft each side

STEEL_RATE_MAIN_BUILDING = 1.8  # kg per sqft (main)
STEEL_RATE_MEZZANINE     = 3.4  # kg per sqft (mezzanine)

RATES = {
    "structural_steel":  110,   # Rs/Kg
    "bare_galvalume":     59,   # Rs/Sqft
    "puf_panel_roof":    180,   # Rs/Sqft
    "puf_panel_wall":    181,   # Rs/Sqft
    "ridge_flashing":    110,   # Rs/Rft
    "polycarbonate":     110,   # Rs/Sqft
    "mezzanine_decking": 154,   # Rs/Sqft
}


# ─── GEOMETRY ─────────────────────────────────────────────────────────────────

def slope_adjusted_dimensions(L: float, W: float, H_full: float, H_wall: float):
    ridge_h = H_full - H_wall
    half_span = W / 2
    slope_length = math.sqrt(half_span ** 2 + ridge_h ** 2)
    slope_factor = slope_length / half_span

    adj_L = L + (2 * EAVE_OVERHANG_LENGTH)
    adj_W = W * slope_factor + (2 * EAVE_OVERHANG_WIDTH)
    return adj_L, adj_W, slope_factor


def slope_adjusted_single_slope(L: float, W: float, H_full: float, H_wall: float):
    rise = H_full - H_wall
    slope_len = math.sqrt(W ** 2 + rise ** 2)
    slope_factor = slope_len / W
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

    return {
        "main_area_sqft": round(main_area, 2),
        "main_steel_kg": main_kg,
        "mezz_area_sqft": round(mezz_area, 2),
        "mezz_steel_kg": mezz_kg,
        "total_steel_kg": total_kg,
        "total_steel_ton": total_ton,
        "rate_per_kg": RATES["structural_steel"],
        "steel_amount": round(total_kg * RATES["structural_steel"], 2),
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
    H_clad = data["cladding_height"]
    roof_t = data.get("roof_type", "gable")

    if roof_t == "single_slope":
        adj_L, adj_W, slope_factor = slope_adjusted_single_slope(L, W, H_full, H_wall)
    else:
        adj_L, adj_W, slope_factor = slope_adjusted_dimensions(L, W, H_full, H_wall)

    roof_area = adj_L * adj_W

    if roof_t == "gable":
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
    }


# ─── FULL BOQ ────────────────────────────────────────────────────────────────

def generate_full_boq(data: dict) -> dict:
    roof_sheet = data.get("roof_sheet_type", "bare")
    wall_sheet = data.get("side_cladding_type", "bare")
    has_mezz = data.get("mezzanine_required", False)

    steel = calculate_steel_tonnage(data)
    clad = calculate_cladding_areas(data)

    items = []

    # Item 1: Structural Steel
    items.append({
        "item_no": "1",
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
        "rate": RATES["structural_steel"],
        "amount": steel["steel_amount"],
        "category": "STRUCTURAL STEEL WORKS",
        "sub_note": steel["breakdown_note"],
    })

    # Item 2.01: Roofing Sheet
    if roof_sheet == "puf":
        items.append({
            "item_no": "2.01",
            "description": (
                "Supplying and laying of puff panel 30MM thickness for Roofing and side cladding "
                "for ROOF with necessary sealent, EPDM metal washers, Bolt and nuts, "
                "necessary flashings etc., complete."
            ),
            "unit": "Sqft",
            "quantity": clad["roof_area_sqft"],
            "rate": RATES["puf_panel_roof"],
            "amount": round(clad["roof_area_sqft"] * RATES["puf_panel_roof"], 2),
            "category": "ROOFING AND SIDE CLADDING WORKS",
        })
    else:
        items.append({
            "item_no": "2.01",
            "description": (
                "Supplying and laying of BARE galvalume sheet 0.47mm thickness for Roofing & "
                "profiled COLOUR coated galvalume sheet 0.47mm thickness for side cladding "
                "with necessary sealent, EPDM metal washers, Bolt and nuts, "
                "necessary flashings etc., complete."
            ),
            "unit": "Sqft",
            "quantity": clad["roof_area_sqft"],
            "rate": RATES["bare_galvalume"],
            "amount": round(clad["roof_area_sqft"] * RATES["bare_galvalume"], 2),
            "category": "ROOFING AND SIDE CLADDING WORKS",
        })

    # Side Cladding
    if wall_sheet == "puf":
        items.append({
            "item_no": "3.02",
            "description": (
                "Supplying and laying of puff panel 30MM thickness for Roofing and side cladding "
                "for SIDE CLADDING with necessary sealent, EPDM metal washers, Bolt and nuts, "
                "necessary flashings etc., complete."
            ),
            "unit": "Sqft",
            "quantity": clad["wall_area_sqft"],
            "rate": RATES["puf_panel_wall"],
            "amount": round(clad["wall_area_sqft"] * RATES["puf_panel_wall"], 2),
            "category": "ROOFING AND SIDE CLADDING WORKS",
        })
    else:
        items.append({
            "item_no": "2.02",
            "description": (
                "Supplying and laying of BARE galvalume sheet 0.47mm thickness for Roofing & "
                "profiled COLOUR coated galvalume sheet 0.47mm thickness for side cladding "
                "with necessary sealent, EPDM metal washers, Bolt and nuts, "
                "necessary flashings etc., complete."
            ),
            "unit": "Sqft",
            "quantity": clad["wall_area_sqft"],
            "rate": RATES["bare_galvalume"],
            "amount": round(clad["wall_area_sqft"] * RATES["bare_galvalume"], 2),
            "category": "ROOFING AND SIDE CLADDING WORKS",
        })

    # Ridge, Flashings, Gutters
    items.append({
        "item_no": "2.03",
        "description": (
            "Supplying and laying of profiled colour coated galvalume sheet 0.47mm thickness "
            "with 550 MPA for Ridge, L Flash, Trip Flash, Gutter, Downspout., etc."
        ),
        "unit": "Rft",
        "quantity": clad["ridge_rft"],
        "rate": RATES["ridge_flashing"],
        "amount": round(clad["ridge_rft"] * RATES["ridge_flashing"], 2),
        "category": "ROOFING AND SIDE CLADDING WORKS",
    })

    # Polycarbonate Lighting Sheet
    items.append({
        "item_no": "2.04",
        "description": (
            "Supplying and laying of POLYCARBONATE SHEET (Lighting sheet) 1.5mm thickness "
            "including making connection, aligning, cleaning etc.,"
        ),
        "unit": "Sqft",
        "quantity": clad["lighting_sqft"],
        "rate": RATES["polycarbonate"],
        "amount": round(clad["lighting_sqft"] * RATES["polycarbonate"], 2),
        "category": "ROOFING AND SIDE CLADDING WORKS",
    })

    # Mezzanine
    if has_mezz:
        mezz_area = steel["mezz_area_sqft"]
        items.append({
            "item_no": "3.01",
            "description": (
                "Providing mezzanine floor with decking sheet and concrete (100mm avg thickness), "
                "including structural steel supports, complete."
            ),
            "unit": "Sqft",
            "quantity": mezz_area,
            "rate": RATES["mezzanine_decking"],
            "amount": round(mezz_area * RATES["mezzanine_decking"], 2),
            "category": "MEZZANINE WORKS",
        })

    # Totals
    total_amount = round(sum(i["amount"] for i in items), 2)
    floor_area = clad["floor_area_sqft"]
    rate_per_sqft = round(total_amount / floor_area, 2) if floor_area > 0 else 0

    return {
        "items": items,
        "total_amount": total_amount,
        "floor_area": floor_area,
        "rate_per_sqft": rate_per_sqft,
        "steel_summary": steel,
        "cladding_summary": clad,
    }
