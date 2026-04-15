"""
Quotation calculation dispatcher.

Takes a template + form_data and produces a BOQ-shaped result:
    {
        total_amount, rate_per_sqft, floor_area, items[], steel_summary, meta{}
    }

Two engines:
    - "peb"     → delegates to existing boq_engine.generate_full_boq()
    - "generic" → evaluates rate_items formulas over form fields
                  (simple multiplication / addition; no conditionals in v1)
"""

import ast
import logging
import operator
from typing import Any, Optional

from api.models.quotation_template import QuotationTemplate, TemplateEngine
from api.services.boq_engine import generate_full_boq

logger = logging.getLogger(__name__)


# ───────────────────────────────────── Safe formula evaluator ──
# Whitelisted AST nodes + binops so tenants can't execute arbitrary code.
_ALLOWED_BINOPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
    ast.Mod: operator.mod,
    ast.FloorDiv: operator.floordiv,
}

_ALLOWED_UNARYOPS = {
    ast.UAdd: operator.pos,
    ast.USub: operator.neg,
}

_ALLOWED_FUNCS = {
    "max": max,
    "min": min,
    "abs": abs,
    "round": round,
    "int": int,
    "float": float,
}


def _safe_eval(expr: str, context: dict) -> float:
    """Evaluate a simple numeric expression with whitelisted operators + context names."""
    if not expr or not expr.strip():
        return 0.0
    try:
        tree = ast.parse(expr, mode="eval")
    except SyntaxError:
        return 0.0

    def _eval(node):
        if isinstance(node, ast.Expression):
            return _eval(node.body)
        if isinstance(node, ast.Constant):
            if isinstance(node.value, (int, float)):
                return float(node.value)
            return 0.0
        if isinstance(node, ast.Num):  # py<3.8
            return float(node.n)
        if isinstance(node, ast.Name):
            val = context.get(node.id, 0)
            try:
                return float(val) if val is not None else 0.0
            except (TypeError, ValueError):
                return 0.0
        if isinstance(node, ast.BinOp) and type(node.op) in _ALLOWED_BINOPS:
            return _ALLOWED_BINOPS[type(node.op)](_eval(node.left), _eval(node.right))
        if isinstance(node, ast.UnaryOp) and type(node.op) in _ALLOWED_UNARYOPS:
            return _ALLOWED_UNARYOPS[type(node.op)](_eval(node.operand))
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            fn = _ALLOWED_FUNCS.get(node.func.id)
            if fn is None:
                return 0.0
            args = [_eval(a) for a in node.args]
            try:
                return float(fn(*args))
            except Exception:
                return 0.0
        raise ValueError(f"Unsupported expression node: {type(node).__name__}")

    try:
        return float(_eval(tree))
    except Exception as e:
        logger.debug(f"Formula eval failed for '{expr}': {e}")
        return 0.0


# ─────────────────────────────────────────────── Engines ──

def _calc_peb(template: QuotationTemplate, form_data: dict) -> dict:
    """
    PEB engine — delegates to existing generate_full_boq().
    Pulls rate overrides from template.rate_items into the boq_engine params.
    """
    # Build payload expected by existing boq_engine
    payload = {
        "building_length": float(form_data.get("building_length", 0) or 0),
        "building_width": float(form_data.get("building_width", 0) or 0),
        "full_height": float(form_data.get("full_height", 0) or 0),
        "wall_height": float(form_data.get("wall_height", 0) or 0),
        "cladding_height": float(form_data.get("cladding_height", 0) or 0),
        "roof_type": form_data.get("roof_type", "gable"),
        "roof_sheet_type": form_data.get("roof_sheet_type", "bare"),
        "side_cladding_type": form_data.get("side_cladding_type", "bare"),
        "mezzanine_required": bool(form_data.get("mezzanine_required", False)),
        "mezz_length": float(form_data.get("mezz_length", 0) or 0),
        "mezz_width": float(form_data.get("mezz_width", 0) or 0),
    }

    # Rate overrides from template.rate_items (id → material + labour)
    if template.rate_items:
        rate_map = {
            item.get("id"): float(item.get("material_rate", 0) or 0) + float(item.get("labour_rate", 0) or 0)
            for item in template.rate_items
        }
        # Map rate_item ids to boq_engine keys (mirrors MaterialCost.jsx mapping)
        key_map = {
            "structural_steel": "rate_structural_steel",
            "bare_galvalume": "rate_bare_galvalume",
            "puf_panel_roof": "rate_puf_panel_roof",
            "puf_panel_wall": "rate_puf_panel_wall",
            "ridge_flashing": "rate_ridge_flashing",
            "polycarbonate": "rate_polycarbonate",
            "mezzanine_decking": "rate_mezzanine_decking",
        }
        for rate_id, rate_total in rate_map.items():
            boq_key = key_map.get(rate_id)
            if boq_key:
                payload[boq_key] = rate_total

    # Steel factor overrides from peb_config
    if template.peb_config:
        if "steel_rate_main" in template.peb_config:
            payload["steel_rate_main"] = float(template.peb_config["steel_rate_main"])
        if "steel_rate_mezz" in template.peb_config:
            payload["steel_rate_mezz"] = float(template.peb_config["steel_rate_mezz"])

    try:
        result = generate_full_boq(payload)
    except Exception as e:
        logger.exception(f"PEB BOQ generation failed: {e}")
        return {
            "total_amount": 0.0,
            "rate_per_sqft": 0.0,
            "floor_area": 0.0,
            "items": [],
            "steel_summary": None,
            "meta": {"engine": "peb", "error": str(e)},
        }

    result.setdefault("meta", {})
    result["meta"]["engine"] = "peb"
    return result


def _calc_generic(template: QuotationTemplate, form_data: dict) -> dict:
    """
    Generic engine — evaluates rate_items[].formula against form_data numeric fields.
    Each rate item becomes one BOQ line with:
        quantity = eval(formula)
        rate     = material_rate + labour_rate
        amount   = quantity * rate
    """
    context = {}
    for k, v in form_data.items():
        try:
            context[k] = float(v) if v is not None else 0.0
        except (TypeError, ValueError):
            context[k] = 0.0

    items = []
    total = 0.0
    for idx, item in enumerate(template.rate_items or [], start=1):
        label = item.get("label", f"Item {idx}")
        unit = item.get("unit", "")
        material_rate = float(item.get("material_rate", 0) or 0)
        labour_rate = float(item.get("labour_rate", 0) or 0)
        rate = material_rate + labour_rate

        formula = item.get("formula") or ""
        quantity = _safe_eval(formula, context) if formula else 0.0
        amount = round(quantity * rate, 2)

        items.append({
            "item_no": f"{idx}",
            "description": label,
            "unit": unit,
            "quantity": round(quantity, 2),
            "rate": rate,
            "material_rate": material_rate,
            "labour_rate": labour_rate,
            "amount": amount,
        })
        total += amount

    return {
        "total_amount": round(total, 2),
        "rate_per_sqft": None,
        "floor_area": None,
        "items": items,
        "steel_summary": None,
        "meta": {"engine": "generic"},
    }


# ─────────────────────────────────────────────── Dispatch ──

def calculate(template: QuotationTemplate, form_data: dict) -> dict:
    """
    Run the template's calculation engine and return a BOQ-shaped dict.
    Never raises — returns a zero-total result on error.
    """
    engine = (template.engine or TemplateEngine.GENERIC.value).lower()
    try:
        if engine == TemplateEngine.PEB.value:
            return _calc_peb(template, form_data)
        return _calc_generic(template, form_data)
    except Exception as e:
        logger.exception(f"Calculation dispatch failed: {e}")
        return {
            "total_amount": 0.0,
            "rate_per_sqft": 0.0,
            "floor_area": 0.0,
            "items": [],
            "steel_summary": None,
            "meta": {"engine": engine, "error": str(e)},
        }
