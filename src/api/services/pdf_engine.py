"""
PDF Quotation Generator — Premium tenant-branded multi-page PDF
================================================================
Generates professional PEB quotation PDFs using reportlab.

Backward compatible:
    generate_quotation_pdf(data: dict, boq: dict) -> bytes      (legacy)
    generate_quotation_pdf(quotation, lead=None, *,
                            tenant_branding=None,
                            portal_url=None,
                            render_3d_path=None) -> bytes       (new premium)
"""

import io
import os
from datetime import datetime
from urllib.parse import urlparse

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
        PageBreak, Image, KeepTogether,
    )
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False

try:
    import qrcode  # noqa: F401
    QR_AVAILABLE = True
except ImportError:
    QR_AVAILABLE = False


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fmt_inr(value) -> str:
    try:
        return f"Rs. {float(value):,.2f}"
    except Exception:
        return str(value)


def _fmt_qty(value) -> str:
    try:
        return f"{float(value):,.2f}"
    except Exception:
        return str(value)


def _hex(color_str, default="#1e293b"):
    """Safely parse a hex color string."""
    try:
        if not color_str:
            return colors.HexColor(default)
        if not color_str.startswith("#"):
            color_str = "#" + color_str
        return colors.HexColor(color_str)
    except Exception:
        return colors.HexColor(default)


def _get_attr(obj, key, default=None):
    """Get attribute from object or key from dict."""
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _resolve_image_path(path):
    """Return a local path or URL ready for reportlab Image; or None."""
    if not path:
        return None
    try:
        parsed = urlparse(str(path))
        if parsed.scheme in ("http", "https"):
            # reportlab can fetch http(s) via Image when PIL is present.
            return str(path)
        if os.path.exists(str(path)):
            return str(path)
    except Exception:
        return None
    return None


def _generate_qr_bytes(url: str):
    """Generate a QR PNG and return BytesIO, or None if unavailable."""
    if not QR_AVAILABLE or not url:
        return None
    try:
        import qrcode
        qr = qrcode.QRCode(box_size=4, border=2)
        qr.add_data(url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        bio = io.BytesIO()
        img.save(bio, format="PNG")
        bio.seek(0)
        return bio
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Legacy renderer (kept for backward compatibility with existing dict callers)
# ---------------------------------------------------------------------------

def _render_legacy(data: dict, boq: dict) -> bytes:
    """Original Swetha Structures branded single-page-ish renderer."""
    if not REPORTLAB_AVAILABLE:
        raise RuntimeError("reportlab not installed. Run: pip install reportlab")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        rightMargin=15 * mm, leftMargin=15 * mm,
        topMargin=15 * mm, bottomMargin=15 * mm,
    )

    dark_blue = colors.HexColor("#1e3a5f")
    accent = colors.HexColor("#D97706")
    light_bg = colors.HexColor("#fffbeb")
    light_row = colors.HexColor("#fefce8")

    H1 = ParagraphStyle("h1", fontSize=16, textColor=colors.white, alignment=TA_CENTER,
                         fontName="Helvetica-Bold", spaceAfter=4)
    H2 = ParagraphStyle("h2", fontSize=11, textColor=dark_blue, fontName="Helvetica-Bold",
                         spaceAfter=3)
    SMALL = ParagraphStyle("small", fontSize=7.5, fontName="Helvetica", leading=10)
    SMALL_BOLD = ParagraphStyle("sb", fontSize=8, fontName="Helvetica-Bold", leading=10)
    FOOTER = ParagraphStyle("footer", fontSize=7, textColor=colors.grey,
                             alignment=TA_CENTER, fontName="Helvetica-Oblique")

    story = []

    header_table = Table(
        [[
            Paragraph("SWETHA STRUCTURES PVT LTD", H1),
            Paragraph("www.swethastructures.com", ParagraphStyle(
                "web", fontSize=9, alignment=TA_RIGHT, textColor=colors.white,
                fontName="Helvetica"))
        ]],
        colWidths=["70%", "30%"]
    )
    header_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), accent),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.white),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 6 * mm))

    quote_date = datetime.now().strftime("%d %b %Y")
    project_name = data.get("project_name", "Proposed Industrial Building")
    L = data.get("building_length", 0)
    W = data.get("building_width", 0)
    H = data.get("full_height", 0)
    wh = data.get("wall_height", 0)
    roof_type = data.get("roof_type", "gable").replace("_", " ").title()
    roof_sheet = "PUF Panel 30mm" if data.get("roof_sheet_type") == "puf" else "Bare Galvalume"
    wall_sheet = "PUF Panel 30mm" if data.get("side_cladding_type") == "puf" else "Bare Galvalume"
    has_mezz = data.get("mezzanine_required", False)
    size_str = f"{L:.0f}'x{W:.0f}' HT {H:.0f}'"
    if has_mezz:
        size_str += f" MEZZ {data.get('mezz_length', 0):.0f}'x{data.get('mezz_width', 0):.0f}'"

    story.append(Paragraph(
        f"ABSTRACT ESTIMATE FOR PEB WORKS - INDUSTRIAL BUILDING ({size_str})", H2
    ))
    story.append(Spacer(1, 3 * mm))

    info_data = [
        [Paragraph("<b>Project Name:</b>", SMALL_BOLD), Paragraph(project_name, SMALL),
         Paragraph("<b>Date:</b>", SMALL_BOLD), Paragraph(quote_date, SMALL)],
        [Paragraph("<b>Client:</b>", SMALL_BOLD), Paragraph(data.get("client_name", "—"), SMALL),
         Paragraph("<b>Location:</b>", SMALL_BOLD), Paragraph(data.get("client_location", "—"), SMALL)],
        [Paragraph("<b>Building Size:</b>", SMALL_BOLD), Paragraph(f"L={L}' x W={W}'", SMALL),
         Paragraph("<b>Height:</b>", SMALL_BOLD), Paragraph(f"Full={H}' | Wall={wh}'", SMALL)],
        [Paragraph("<b>Roof Type:</b>", SMALL_BOLD), Paragraph(roof_type, SMALL),
         Paragraph("<b>Roofing:</b>", SMALL_BOLD), Paragraph(roof_sheet, SMALL)],
        [Paragraph("<b>Side Cladding:</b>", SMALL_BOLD), Paragraph(wall_sheet, SMALL),
         Paragraph("<b>Mezzanine:</b>", SMALL_BOLD), Paragraph("Yes" if has_mezz else "No", SMALL)],
    ]
    info_table = Table(info_data, colWidths=["18%", "32%", "18%", "32%"])
    info_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), light_bg),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#d4a574")),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#e5c9a0")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph("BILL OF QUANTITIES", H2))
    story.append(Spacer(1, 2 * mm))

    col_w = ["8%", "42%", "8%", "12%", "12%", "18%"]
    col_widths_pt = [float(c.strip("%")) / 100 * (A4[0] - 30 * mm) for c in col_w]

    boq_header = [
        Paragraph("<b>Item No</b>", SMALL_BOLD),
        Paragraph("<b>Description of Work</b>", SMALL_BOLD),
        Paragraph("<b>Unit</b>", SMALL_BOLD),
        Paragraph("<b>Quantity</b>", SMALL_BOLD),
        Paragraph("<b>Rate (Rs.)</b>", SMALL_BOLD),
        Paragraph("<b>Amount (Rs.)</b>", SMALL_BOLD),
    ]

    items = boq.get("items", []) if boq else []
    rows = [boq_header]
    prev_cat = ""
    for item in items:
        cat = item.get("category", "")
        if cat != prev_cat:
            rows.append([
                Paragraph("", SMALL_BOLD),
                Paragraph(f"<b>{cat}</b>", SMALL_BOLD),
                "", "", "", ""
            ])
            prev_cat = cat

        desc_text = item.get("description", "")
        if item.get("sub_note"):
            desc_text += f"\n<i>({item['sub_note']})</i>"

        R_STYLE = ParagraphStyle("r", fontSize=7.5, alignment=TA_RIGHT, fontName="Helvetica")
        R_BOLD = ParagraphStyle("rb", fontSize=7.5, alignment=TA_RIGHT, fontName="Helvetica-Bold")

        rows.append([
            Paragraph(str(item.get("item_no", "")), SMALL),
            Paragraph(desc_text.replace("\n", "<br/>"), SMALL),
            Paragraph(str(item.get("unit", "")), SMALL),
            Paragraph(_fmt_qty(item.get("quantity", 0)), R_STYLE),
            Paragraph(_fmt_qty(item.get("rate", 0)), R_STYLE),
            Paragraph(_fmt_qty(item.get("amount", 0)), R_BOLD),
        ])

    rows.append([
        Paragraph("", SMALL),
        Paragraph("<b>TOTAL ESTIMATED AMOUNT (Rs.)</b>", SMALL_BOLD),
        "", "", "",
        Paragraph(f"<b>{_fmt_qty(boq.get('total_amount', 0))}</b>",
                  ParagraphStyle("tot", fontSize=8, alignment=TA_RIGHT, fontName="Helvetica-Bold")),
    ])

    boq_table = Table(rows, colWidths=col_widths_pt, repeatRows=1)
    ts = TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), accent),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("TOPPADDING", (0, 0), (-1, 0), 6),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("TOPPADDING", (0, 1), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.75, accent),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#e5c9a0")),
        ("BACKGROUND", (0, -1), (-1, -1), light_bg),
        ("LINEABOVE", (0, -1), (-1, -1), 1, accent),
    ])

    for i in range(1, len(rows)):
        if i % 2 == 0:
            ts.add("BACKGROUND", (0, i), (-1, i), light_row)

    boq_table.setStyle(ts)
    story.append(boq_table)
    story.append(Spacer(1, 6 * mm))

    # ── SUMMARY section ──
    story.append(Paragraph("SUMMARY", H2))
    story.append(Spacer(1, 2 * mm))

    steel_summary = boq.get("steel_summary", {})
    cladding_summary = boq.get("cladding_summary", {})
    floor_area = boq.get("floor_area", data.get("building_length", 0) * data.get("building_width", 0))
    steel_ton = steel_summary.get("total_steel_ton", 0)
    roof_area = cladding_summary.get("roof_area_sqft", 0)
    wall_area = cladding_summary.get("wall_area_sqft", 0)
    rate_sqft = boq.get("rate_per_sqft", 0)
    total_amt = boq.get("total_amount", 0)

    summary_data = [
        [Paragraph("<b>Area of Building (Sqft)</b>", SMALL_BOLD),
         Paragraph(_fmt_qty(floor_area), SMALL),
         Paragraph("<b>Steel Tonnage (MT)</b>", SMALL_BOLD),
         Paragraph(f"{steel_ton} MT", SMALL)],
        [Paragraph("<b>Rate / Sqft (Rs.)</b>", SMALL_BOLD),
         Paragraph(_fmt_qty(rate_sqft), SMALL),
         Paragraph("<b>Roof Area (Sqft)</b>", SMALL_BOLD),
         Paragraph(_fmt_qty(roof_area), SMALL)],
        [Paragraph("<b>Total Amount (Rs.)</b>", SMALL_BOLD),
         Paragraph(f"Rs. {total_amt:,.2f}", SMALL),
         Paragraph("<b>Wall Cladding (Sqft)</b>", SMALL_BOLD),
         Paragraph(_fmt_qty(wall_area), SMALL)],
    ]
    summary_table = Table(summary_data, colWidths=["25%", "25%", "25%", "25%"])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), light_bg),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#d4a574")),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#e5c9a0")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 6 * mm))

    # ── NOTES & EXCLUSIONS ──
    NOTES_STYLE = ParagraphStyle("notes_h", fontSize=9, fontName="Helvetica-Bold",
                                  textColor=dark_blue, spaceAfter=3)
    NOTE_ITEM = ParagraphStyle("note_item", fontSize=7.5, fontName="Helvetica",
                                leading=10, spaceAfter=2)

    story.append(Paragraph("NOTES &amp; EXCLUSIONS:", NOTES_STYLE))
    notes = [
        "Aluminium Foil, Fixed Louvers, Special Elevations, Foundation &amp; Civil Works, "
        "Rolling Shutters, Windows with Safety Grills, Doors, Electrical &amp; Plumbing Works "
        "are NOT included.",
        "All rates are exclusive of GST (18% applicable on structural steel works, "
        "12% on PEB fabrication and erection).",
        "This quote is valid for 30 days from the date of issue.",
        "Payment terms: 30% advance, 60% on delivery, 10% on completion.",
    ]
    for i, note in enumerate(notes, 1):
        story.append(Paragraph(f"{i}. {note}", NOTE_ITEM))
    story.append(Spacer(1, 6 * mm))

    # ── Footer ──
    story.append(HRFlowable(width="100%", thickness=1, color=accent))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(
        f"Swetha Structures Pvt Ltd | www.swethastructures.com | "
        f"Quote generated on {quote_date}",
        FOOTER
    ))

    doc.build(story)
    buf.seek(0)
    return buf.read()


# ---------------------------------------------------------------------------
# Premium tenant-branded renderer (multi-page)
# ---------------------------------------------------------------------------

def _render_premium(quotation, lead=None, tenant_branding=None,
                    portal_url=None, render_3d_path=None) -> bytes:
    if not REPORTLAB_AVAILABLE:
        raise RuntimeError("reportlab not installed. Run: pip install reportlab")

    # ----- Branding -----
    tb = tenant_branding or {}
    tenant_name = tb.get("name") or "Your Company"
    primary = _hex(tb.get("primary_color"), default="#6366f1")  # indigo
    slate = colors.HexColor("#1e293b")
    slate_light = colors.HexColor("#64748b")
    bg_light = colors.HexColor("#f8fafc")
    border_light = colors.HexColor("#e2e8f0")
    logo_url = tb.get("logo_url")

    # ----- Quotation data extraction -----
    q_id = _get_attr(quotation, "id", "—")
    project_name = _get_attr(quotation, "project_name", "Untitled Project") or "Untitled Project"
    client_name = _get_attr(quotation, "client_name", "") or ""
    client_phone = _get_attr(quotation, "client_phone", "") or _get_attr(lead, "phone", "") or ""
    client_email = _get_attr(quotation, "client_email", "") or _get_attr(lead, "email", "") or ""
    client_location = _get_attr(quotation, "client_location", "") or ""

    building_params = _get_attr(quotation, "building_params", {}) or {}
    form_data = _get_attr(quotation, "form_data", {}) or {}
    specs = building_params or form_data or {}

    boq_results = _get_attr(quotation, "boq_results", {}) or {}
    total_amount = (
        _get_attr(quotation, "total_amount", None)
        or boq_results.get("total_amount", 0)
        or 0
    )

    created_at = _get_attr(quotation, "created_at", None) or datetime.now()
    valid_until = _get_attr(quotation, "valid_until", None)
    revision = _get_attr(quotation, "revision", 1) or 1

    template = _get_attr(quotation, "template", None)
    terms_text = _get_attr(template, "terms_conditions", None)

    # ----- Document setup -----
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        rightMargin=18 * mm, leftMargin=18 * mm,
        topMargin=18 * mm, bottomMargin=18 * mm,
        title=f"Quotation Q-{q_id} - {project_name}",
        author=tenant_name,
    )
    page_w = A4[0] - 36 * mm

    # ----- Styles -----
    H_HUGE = ParagraphStyle("huge", fontSize=34, leading=40, textColor=slate,
                             fontName="Helvetica-Bold", alignment=TA_LEFT, spaceAfter=4)
    H_BIG = ParagraphStyle("big", fontSize=22, leading=26, textColor=primary,
                            fontName="Helvetica-Bold", alignment=TA_LEFT, spaceAfter=2)
    H_PAGE = ParagraphStyle("hpage", fontSize=18, leading=22, textColor=slate,
                             fontName="Helvetica-Bold", spaceAfter=8)
    H_SECTION = ParagraphStyle("hsec", fontSize=11, leading=14, textColor=primary,
                                fontName="Helvetica-Bold", spaceAfter=4,
                                spaceBefore=4)
    LABEL = ParagraphStyle("label", fontSize=8, textColor=slate_light,
                            fontName="Helvetica-Bold", leading=10, spaceAfter=2)
    VALUE = ParagraphStyle("value", fontSize=11, textColor=slate,
                            fontName="Helvetica", leading=14, spaceAfter=6)
    BODY = ParagraphStyle("body", fontSize=10, textColor=slate, leading=14,
                           fontName="Helvetica")
    SMALL = ParagraphStyle("small", fontSize=8, textColor=slate_light, leading=11,
                            fontName="Helvetica")
    META = ParagraphStyle("meta", fontSize=10, textColor=slate_light,
                           fontName="Helvetica", leading=14)
    TOTAL_HUGE = ParagraphStyle("tothuge", fontSize=42, leading=48, textColor=primary,
                                 fontName="Helvetica-Bold", alignment=TA_LEFT)
    TERMS_ITEM = ParagraphStyle("terms", fontSize=10, textColor=slate, leading=15,
                                 fontName="Helvetica", spaceAfter=8, leftIndent=18,
                                 firstLineIndent=-18)

    story = []

    # ===========================================================
    # PAGE 1 — COVER
    # ===========================================================
    # Logo area
    logo_flowable = None
    if logo_url:
        resolved = _resolve_image_path(logo_url)
        if resolved:
            try:
                logo_flowable = Image(resolved, width=40 * mm, height=20 * mm,
                                       kind="proportional")
            except Exception:
                logo_flowable = None
    if logo_flowable is None:
        # Colored square placeholder with initials
        initials = "".join([w[0] for w in tenant_name.split()[:2]]).upper() or "•"
        logo_box = Table(
            [[Paragraph(f"<font color='white'>{initials}</font>",
                        ParagraphStyle("li", fontSize=20, fontName="Helvetica-Bold",
                                        alignment=TA_CENTER, textColor=colors.white))]],
            colWidths=[20 * mm], rowHeights=[20 * mm]
        )
        logo_box.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), primary),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("BOX", (0, 0), (-1, -1), 0, primary),
        ]))
        logo_flowable = logo_box

    # Top bar: logo + tenant name
    top_bar = Table(
        [[logo_flowable, Paragraph(tenant_name, H_BIG)]],
        colWidths=[45 * mm, page_w - 45 * mm]
    )
    top_bar.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(top_bar)
    story.append(Spacer(1, 4 * mm))
    story.append(HRFlowable(width="100%", thickness=2, color=primary))
    story.append(Spacer(1, 14 * mm))

    # Quotation metadata
    quote_date = created_at.strftime("%d %b %Y") if hasattr(created_at, "strftime") else str(created_at)
    valid_str = valid_until.strftime("%d %b %Y") if hasattr(valid_until, "strftime") else (str(valid_until) if valid_until else "—")

    story.append(Paragraph("QUOTATION", ParagraphStyle(
        "qlbl", fontSize=10, textColor=slate_light, fontName="Helvetica-Bold",
        spaceAfter=4
    )))
    story.append(Paragraph(f"#Q-{q_id} &nbsp;&nbsp;·&nbsp;&nbsp; Rev {revision}",
                            ParagraphStyle("qid", fontSize=12, textColor=slate,
                                            fontName="Helvetica", spaceAfter=18)))

    # Huge project name
    story.append(Paragraph(project_name, H_HUGE))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(f"Prepared for <b>{client_name or '—'}</b>", META))
    story.append(Spacer(1, 14 * mm))

    # Total amount card
    total_card_data = [
        [Paragraph("TOTAL CONTRACT VALUE", LABEL)],
        [Paragraph(_fmt_inr(total_amount), TOTAL_HUGE)],
    ]
    total_card = Table(total_card_data, colWidths=[page_w])
    total_card.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg_light),
        ("BOX", (0, 0), (-1, -1), 0, border_light),
        ("LEFTPADDING", (0, 0), (-1, -1), 18),
        ("RIGHTPADDING", (0, 0), (-1, -1), 18),
        ("TOPPADDING", (0, 0), (0, 0), 14),
        ("BOTTOMPADDING", (0, 1), (0, 1), 14),
        ("LINEBEFORE", (0, 0), (0, -1), 4, primary),
    ]))
    story.append(total_card)
    story.append(Spacer(1, 10 * mm))

    # Date / valid until row
    date_row = Table(
        [[
            Paragraph("ISSUED", LABEL),
            Paragraph("VALID UNTIL", LABEL),
        ],
         [
            Paragraph(quote_date, VALUE),
            Paragraph(valid_str, VALUE),
         ]],
        colWidths=[page_w / 2, page_w / 2]
    )
    date_row.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(date_row)
    story.append(Spacer(1, 10 * mm))

    # Hero render
    hero_path = _resolve_image_path(render_3d_path)
    if hero_path:
        try:
            hero_img = Image(hero_path, width=page_w, height=85 * mm,
                              kind="proportional")
            story.append(hero_img)
        except Exception:
            pass

    story.append(PageBreak())

    # ===========================================================
    # PAGE 2 — PROJECT DETAILS
    # ===========================================================
    story.append(Paragraph("Project Details", H_PAGE))
    story.append(HRFlowable(width="100%", thickness=1, color=primary))
    story.append(Spacer(1, 8 * mm))

    # Client column
    client_rows = [
        [Paragraph("CLIENT NAME", LABEL)],
        [Paragraph(client_name or "—", VALUE)],
        [Paragraph("PHONE", LABEL)],
        [Paragraph(client_phone or "—", VALUE)],
        [Paragraph("EMAIL", LABEL)],
        [Paragraph(client_email or "—", VALUE)],
        [Paragraph("SITE LOCATION", LABEL)],
        [Paragraph(client_location or "—", VALUE)],
    ]

    # Building specs column
    spec_rows = [[Paragraph("BUILDING SPECIFICATIONS", LABEL)]]
    if specs:
        spec_keys = [
            ("building_length", "Length", "ft"),
            ("building_width", "Width", "ft"),
            ("full_height", "Full Height", "ft"),
            ("wall_height", "Wall Height", "ft"),
            ("roof_type", "Roof Type", ""),
            ("roof_sheet_type", "Roof Sheet", ""),
            ("side_cladding_type", "Side Cladding", ""),
            ("mezzanine_required", "Mezzanine", ""),
        ]
        for key, label, unit in spec_keys:
            if key in specs and specs[key] not in (None, ""):
                val = specs[key]
                if isinstance(val, bool):
                    val = "Yes" if val else "No"
                elif isinstance(val, (int, float)) and unit:
                    val = f"{val} {unit}"
                else:
                    val = str(val).replace("_", " ").title()
                spec_rows.append([Paragraph(
                    f"<font color='#64748b'>{label}:</font> &nbsp;<b>{val}</b>",
                    BODY
                )])
        # Floor area if available
        L = specs.get("building_length")
        W = specs.get("building_width")
        if L and W:
            try:
                area = float(L) * float(W)
                spec_rows.append([Paragraph(
                    f"<font color='#64748b'>Floor Area:</font> &nbsp;<b>{area:,.0f} sqft</b>",
                    BODY
                )])
            except Exception:
                pass
    else:
        spec_rows.append([Paragraph("No specifications provided.", SMALL)])

    client_table = Table(client_rows, colWidths=[(page_w - 8 * mm) / 2])
    client_table.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
    ]))
    spec_table = Table(spec_rows, colWidths=[(page_w - 8 * mm) / 2])
    spec_table.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))

    grid = Table(
        [[client_table, spec_table]],
        colWidths=[(page_w - 8 * mm) / 2 + 4 * mm, (page_w - 8 * mm) / 2 + 4 * mm]
    )
    grid.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(grid)
    story.append(PageBreak())

    # ===========================================================
    # PAGE 3 — BOQ TABLE
    # ===========================================================
    story.append(Paragraph("Bill of Quantities", H_PAGE))
    story.append(HRFlowable(width="100%", thickness=1, color=primary))
    story.append(Spacer(1, 6 * mm))

    SMALL_BOLD = ParagraphStyle("sb", fontSize=8, fontName="Helvetica-Bold",
                                 leading=10, textColor=colors.white)
    CELL = ParagraphStyle("cell", fontSize=8, fontName="Helvetica", leading=11,
                           textColor=slate)
    CELL_R = ParagraphStyle("cellr", fontSize=8, fontName="Helvetica", leading=11,
                             alignment=TA_RIGHT, textColor=slate)
    CELL_RB = ParagraphStyle("cellrb", fontSize=8, fontName="Helvetica-Bold",
                              leading=11, alignment=TA_RIGHT, textColor=slate)

    col_pct = [0.08, 0.40, 0.10, 0.12, 0.13, 0.17]
    col_widths = [p * page_w for p in col_pct]

    boq_header = [
        Paragraph("Item", SMALL_BOLD),
        Paragraph("Description", SMALL_BOLD),
        Paragraph("Unit", SMALL_BOLD),
        Paragraph("Qty", ParagraphStyle("hr", parent=SMALL_BOLD, alignment=TA_RIGHT)),
        Paragraph("Rate", ParagraphStyle("hr2", parent=SMALL_BOLD, alignment=TA_RIGHT)),
        Paragraph("Amount", ParagraphStyle("hr3", parent=SMALL_BOLD, alignment=TA_RIGHT)),
    ]

    items = boq_results.get("items", []) if isinstance(boq_results, dict) else []
    boq_rows = [boq_header]
    for item in items:
        desc_text = item.get("description", "")
        if item.get("sub_note"):
            desc_text += f"<br/><font size='7' color='#64748b'><i>{item['sub_note']}</i></font>"
        boq_rows.append([
            Paragraph(str(item.get("item_no", "")), CELL),
            Paragraph(desc_text, CELL),
            Paragraph(str(item.get("unit", "")), CELL),
            Paragraph(_fmt_qty(item.get("quantity", 0)), CELL_R),
            Paragraph(_fmt_qty(item.get("rate", 0)), CELL_R),
            Paragraph(_fmt_qty(item.get("amount", 0)), CELL_RB),
        ])

    # Total row
    boq_rows.append([
        "", Paragraph("<b>TOTAL</b>", ParagraphStyle(
            "tot", fontSize=10, fontName="Helvetica-Bold", textColor=colors.white)),
        "", "", "",
        Paragraph(f"<b>{_fmt_inr(total_amount)}</b>", ParagraphStyle(
            "totr", fontSize=11, fontName="Helvetica-Bold",
            alignment=TA_RIGHT, textColor=colors.white))
    ])

    boq_table = Table(boq_rows, colWidths=col_widths, repeatRows=1)
    ts = TableStyle([
        # Header
        ("BACKGROUND", (0, 0), (-1, 0), primary),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("TOPPADDING", (0, 0), (-1, 0), 8),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        # Body
        ("TOPPADDING", (0, 1), (-1, -2), 6),
        ("BOTTOMPADDING", (0, 1), (-1, -2), 6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, border_light),
        # Total row
        ("BACKGROUND", (0, -1), (-1, -1), primary),
        ("TOPPADDING", (0, -1), (-1, -1), 10),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 10),
        ("SPAN", (1, -1), (4, -1)),
    ])
    # Zebra
    for i in range(1, len(boq_rows) - 1):
        if i % 2 == 0:
            ts.add("BACKGROUND", (0, i), (-1, i), bg_light)

    boq_table.setStyle(ts)
    story.append(boq_table)
    story.append(PageBreak())

    # ===========================================================
    # PAGE 4 — TERMS & CONDITIONS
    # ===========================================================
    story.append(Paragraph("Terms &amp; Conditions", H_PAGE))
    story.append(HRFlowable(width="100%", thickness=1, color=primary))
    story.append(Spacer(1, 8 * mm))

    if terms_text:
        # Try to parse as numbered or line-separated list
        if isinstance(terms_text, (list, tuple)):
            terms_list = [str(t) for t in terms_text]
        else:
            raw = str(terms_text).strip()
            terms_list = [ln.strip() for ln in raw.split("\n") if ln.strip()]
    else:
        terms_list = [
            "All rates are exclusive of GST. Applicable taxes will be charged at actuals.",
            "This quotation is valid for 30 days from the date of issue.",
            "Payment terms: 30% advance with PO, 60% on material delivery, 10% on completion.",
            "Foundation, civil works, electrical, plumbing, and finishing works are not included.",
            "Delivery timeline: 8-12 weeks from receipt of advance and approved drawings.",
            "Site should be accessible for trailers and provide adequate space for material storage.",
            "Any change in specifications or scope will be charged extra as per mutual agreement.",
            "Force majeure conditions apply.",
        ]

    for idx, t in enumerate(terms_list, 1):
        # Strip any leading numbering already in the source
        cleaned = t.lstrip("0123456789.) ").strip() or t
        story.append(Paragraph(f"<b>{idx}.</b>&nbsp;&nbsp;{cleaned}", TERMS_ITEM))

    story.append(PageBreak())

    # ===========================================================
    # PAGE 5 — SIGNATURES + QR
    # ===========================================================
    story.append(Paragraph("Acceptance", H_PAGE))
    story.append(HRFlowable(width="100%", thickness=1, color=primary))
    story.append(Spacer(1, 14 * mm))

    sign_label = ParagraphStyle("sl", fontSize=9, textColor=slate_light,
                                 fontName="Helvetica-Bold", spaceAfter=2)
    sign_for = ParagraphStyle("sf", fontSize=11, textColor=slate,
                               fontName="Helvetica-Bold", spaceAfter=30)
    sign_meta = ParagraphStyle("sm", fontSize=8, textColor=slate_light,
                                fontName="Helvetica", leading=11)

    def _signature_box(for_text):
        cell = [
            [Paragraph("AUTHORISED SIGNATORY", sign_label)],
            [Paragraph(for_text, sign_for)],
            [Spacer(1, 18 * mm)],
            [HRFlowable(width="90%", thickness=0.75, color=slate)],
            [Paragraph("Signature", sign_meta)],
            [Spacer(1, 4 * mm)],
            [HRFlowable(width="60%", thickness=0.75, color=slate)],
            [Paragraph("Name &amp; Date", sign_meta)],
        ]
        t = Table(cell, colWidths=[(page_w - 10 * mm) / 2])
        t.setStyle(TableStyle([
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("BOX", (0, 0), (-1, -1), 0.5, border_light),
        ]))
        return t

    sig_grid = Table(
        [[_signature_box(f"For {tenant_name}"), _signature_box("For the Client")]],
        colWidths=[(page_w) / 2, (page_w) / 2]
    )
    sig_grid.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(sig_grid)
    story.append(Spacer(1, 18 * mm))

    # QR code
    if portal_url and QR_AVAILABLE:
        qr_bio = _generate_qr_bytes(portal_url)
        if qr_bio is not None:
            try:
                qr_img = Image(qr_bio, width=32 * mm, height=32 * mm)
                qr_caption = Paragraph(
                    "<b>Scan to view 3D model, drawings, and negotiate price</b><br/>"
                    f"<font size='8' color='#64748b'>{portal_url}</font>",
                    ParagraphStyle("qrcap", fontSize=10, textColor=slate,
                                    fontName="Helvetica", leading=14)
                )
                qr_table = Table(
                    [[qr_img, qr_caption]],
                    colWidths=[40 * mm, page_w - 40 * mm]
                )
                qr_table.setStyle(TableStyle([
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("BACKGROUND", (0, 0), (-1, -1), bg_light),
                    ("BOX", (0, 0), (-1, -1), 0, border_light),
                    ("LINEBEFORE", (0, 0), (0, -1), 3, primary),
                    ("LEFTPADDING", (0, 0), (-1, -1), 12),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                    ("TOPPADDING", (0, 0), (-1, -1), 10),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ]))
                story.append(qr_table)
            except Exception:
                pass

    # ----- Footer on each page -----
    def _footer(canvas, doc_):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(slate_light)
        footer_text = f"{tenant_name}  ·  Quotation #Q-{q_id}  ·  Page {doc_.page}"
        canvas.drawCentredString(A4[0] / 2, 10 * mm, footer_text)
        canvas.setStrokeColor(primary)
        canvas.setLineWidth(1)
        canvas.line(18 * mm, 13 * mm, A4[0] - 18 * mm, 13 * mm)
        canvas.restoreState()

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    buf.seek(0)
    return buf.read()


# ---------------------------------------------------------------------------
# Public entry point — backward compatible dispatcher
# ---------------------------------------------------------------------------

def generate_quotation_pdf(quotation, lead=None, *,
                            tenant_branding=None,
                            portal_url=None,
                            render_3d_path=None,
                            **legacy_kwargs) -> bytes:
    """Generate a quotation PDF.

    Backward-compatible signature:
        - Legacy: generate_quotation_pdf(data: dict, boq: dict)
            -> renders the original Swetha-branded layout.
        - Premium: generate_quotation_pdf(quotation_obj,
                                          lead=None,
                                          tenant_branding={...},
                                          portal_url=...,
                                          render_3d_path=...)
            -> renders the multi-page tenant-branded layout.

    Detection: if `quotation` is a dict and `lead` is also a dict, the legacy
    renderer is used (preserving the existing quotation_service caller).
    """
    # Legacy path: both positionals are dicts (data, boq).
    if isinstance(quotation, dict) and isinstance(lead, dict):
        return _render_legacy(quotation, lead)

    # Premium path: quotation may be an ORM object or dict-like.
    return _render_premium(
        quotation,
        lead=lead,
        tenant_branding=tenant_branding,
        portal_url=portal_url,
        render_3d_path=render_3d_path,
    )
