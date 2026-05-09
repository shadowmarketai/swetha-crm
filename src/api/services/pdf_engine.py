"""
PDF Quotation Generator — Swetha Structures Proposal Format
=============================================================
Generates professional 11+ page PEB quotation PDFs matching the exact
Swetha Structures proposal format (cover letter, scope, design standards,
building desc, material specs, work desc, price & payment, exclusions,
delivery, T&C, summary, abstract BOQ, plan).

Uses reportlab for PDF generation.
"""

import io
import math
from datetime import datetime

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
        PageBreak, KeepTogether,
    )
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False


# ─── Helpers ──────────────────────────────────────────────────────────────────

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


def _fmt_inr_round(value) -> str:
    try:
        return f"Rs.{float(value):,.0f}"
    except Exception:
        return str(value)


def _get_attr(obj, key, default=None):
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _sheet_label(sheet_type: str) -> str:
    """Convert sheet type value to human label."""
    if not sheet_type:
        return "Bare Galvalume 0.47mm"
    return sheet_type.replace("_", " ").replace("bare galvalume", "Bare Galvalume").replace(
        "bare colour galvalume", "Colour Galvalume").replace(
        "puf panel", "PUF Panel").replace("mm", "mm").title()


def _roof_type_label(rt: str) -> str:
    if rt == "a_type":
        return "A Type"
    if rt == "monoslope":
        return "Monoslope"
    return rt.replace("_", " ").title()


# ─── Company Info ─────────────────────────────────────────────────────────────

COMPANY = {
    "name": "SWETHA STRUCTURES PVT LTD",
    "tagline": "Engineers & Contractors",
    "address": "44, Alagu Nagar, Kalapatti Main Road, Saravanampatti, Coimbatore-641035. Tamilnadu",
    "phone": "+91 9597760251 / 9444053074",
    "landline": "0422-3239629",
    "email": "swethastructures@gmail.com",
    "website": "www.swethastructures.com",
    "md_name": "K.Selvam, M.E (Struct), M.I.E, F.I.V",
    "md_title": "Managing Director",
}


# ─── Styles ───────────────────────────────────────────────────────────────────

def _build_styles():
    dark = colors.HexColor("#1e293b")
    accent = colors.HexColor("#D97706")
    return {
        "COMPANY_NAME": ParagraphStyle("cn", fontSize=14, fontName="Helvetica-Bold",
                                        textColor=dark, alignment=TA_CENTER, leading=18),
        "COMPANY_TAG": ParagraphStyle("ct", fontSize=9, fontName="Helvetica",
                                       textColor=colors.grey, alignment=TA_CENTER),
        "COMPANY_ADDR": ParagraphStyle("ca", fontSize=7, fontName="Helvetica",
                                        textColor=colors.grey, alignment=TA_CENTER, leading=10),
        "PAGE_NUM": ParagraphStyle("pn", fontSize=8, fontName="Helvetica",
                                    textColor=colors.grey, alignment=TA_CENTER),
        "H_SECTION": ParagraphStyle("hs", fontSize=12, fontName="Helvetica-Bold",
                                     textColor=dark, spaceAfter=6, spaceBefore=8),
        "BODY": ParagraphStyle("body", fontSize=10, fontName="Helvetica",
                                textColor=dark, leading=14, alignment=TA_JUSTIFY),
        "BODY_BOLD": ParagraphStyle("bb", fontSize=10, fontName="Helvetica-Bold",
                                     textColor=dark, leading=14),
        "SMALL": ParagraphStyle("sm", fontSize=8, fontName="Helvetica",
                                 textColor=dark, leading=11),
        "SMALL_BOLD": ParagraphStyle("sb", fontSize=8, fontName="Helvetica-Bold",
                                      textColor=dark, leading=11),
        "TABLE_HEADER": ParagraphStyle("th", fontSize=8, fontName="Helvetica-Bold",
                                        textColor=colors.white, leading=11),
        "TABLE_HEADER_R": ParagraphStyle("thr", fontSize=8, fontName="Helvetica-Bold",
                                          textColor=colors.white, leading=11, alignment=TA_RIGHT),
        "CELL": ParagraphStyle("cell", fontSize=8, fontName="Helvetica",
                                textColor=dark, leading=11),
        "CELL_R": ParagraphStyle("cellr", fontSize=8, fontName="Helvetica",
                                  textColor=dark, leading=11, alignment=TA_RIGHT),
        "CELL_RB": ParagraphStyle("cellrb", fontSize=8, fontName="Helvetica-Bold",
                                   textColor=dark, leading=11, alignment=TA_RIGHT),
        "BULLET": ParagraphStyle("bullet", fontSize=10, fontName="Helvetica",
                                  textColor=dark, leading=14, leftIndent=15,
                                  bulletIndent=0, spaceBefore=2, spaceAfter=2),
        "FOOTER": ParagraphStyle("footer", fontSize=7, textColor=colors.grey,
                                  alignment=TA_CENTER, fontName="Helvetica-Oblique"),
        "dark": dark,
        "accent": accent,
        "light_bg": colors.HexColor("#f8f9fa"),
        "border": colors.HexColor("#dee2e6"),
    }


# ─── Page Header/Footer ──────────────────────────────────────────────────────

def _make_header_footer(styles, pr_no, page_count_holder):
    """Return onFirstPage and onLaterPages callables."""
    dark = styles["dark"]
    accent = styles["accent"]

    def _draw(canvas, doc):
        canvas.saveState()
        w, h = A4

        # Header
        canvas.setFont("Helvetica-Bold", 12)
        canvas.setFillColor(dark)
        canvas.drawCentredString(w / 2, h - 12 * mm, COMPANY["name"])
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.grey)
        canvas.drawCentredString(w / 2, h - 17 * mm, COMPANY["tagline"])
        canvas.setFont("Helvetica", 6.5)
        canvas.drawCentredString(w / 2, h - 22 * mm,
            f"{COMPANY['address']}")
        canvas.drawCentredString(w / 2, h - 26 * mm,
            f"Mob: {COMPANY['phone']}, Ph: {COMPANY['landline']}, Email: {COMPANY['email']}")
        canvas.drawCentredString(w / 2, h - 30 * mm, COMPANY["website"])

        # Line under header
        canvas.setStrokeColor(accent)
        canvas.setLineWidth(1)
        canvas.line(15 * mm, h - 32 * mm, w - 15 * mm, h - 32 * mm)

        # Page number bottom right
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.grey)
        canvas.drawRightString(w - 15 * mm, 10 * mm, f"{doc.page}")

        canvas.restoreState()

    return _draw, _draw


# ─── Section Builders ─────────────────────────────────────────────────────────

def _cover_letter(story, styles, data, pr_no, quote_date):
    """Page 1: Cover letter."""
    s = styles
    story.append(Spacer(1, 10 * mm))

    # PR No and Date
    story.append(Paragraph(f"<b>PR.NO:</b> {pr_no}", s["BODY"]))
    story.append(Paragraph(f"<b>Date:</b> {quote_date}", s["BODY"]))
    story.append(Spacer(1, 8 * mm))

    # To
    client_name = data.get("client_name", "")
    client_location = data.get("client_location", "")
    story.append(Paragraph("To,", s["BODY"]))
    story.append(Paragraph(f"<b>{client_name or 'Dear Sir/Madam'}</b>", s["BODY"]))
    if client_location:
        story.append(Paragraph(client_location, s["BODY"]))
    story.append(Spacer(1, 6 * mm))

    # Subject
    project_name = data.get("project_name", "Proposed Industrial Building")
    story.append(Paragraph(
        f"<b>Sub:</b> Submission of our proposal for supply and Erection of "
        f"PRE ENGINEERED BUILDING at {client_location or 'site'} — Reg",
        s["BODY"]
    ))
    story.append(Spacer(1, 6 * mm))

    # Body
    story.append(Paragraph(
        "Warm Greetings. We wish to thank you for providing us an opportunity to be "
        "associated with you through the above project. We are sure that our relationship "
        "will strengthen and grow in future.",
        s["BODY"]
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(
        "Herewith we submit the Scope of work, Technical Specifications, Given drawings "
        "for Proposed Building along with our proposal for your review and acceptance.",
        s["BODY"]
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(
        "We assure that our services would be highly satisfactory.",
        s["BODY"]
    ))
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph("Thanking you,", s["BODY"]))
    story.append(Paragraph("Yours Truly,", s["BODY"]))
    story.append(Spacer(1, 12 * mm))
    story.append(Paragraph(f"For {COMPANY['name']}", s["BODY_BOLD"]))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(COMPANY["md_name"], s["BODY_BOLD"]))
    story.append(Paragraph(COMPANY["md_title"], s["BODY"]))
    story.append(PageBreak())


def _contents_page(story, styles):
    """Page 2: Table of contents."""
    s = styles
    story.append(Spacer(1, 10 * mm))
    story.append(Paragraph("PROPOSAL - CONTENTS", s["H_SECTION"]))
    story.append(Spacer(1, 8 * mm))

    sections = [
        "Section-1  Scope of work",
        "Section 2  Design Standards",
        "Section 3  Building Description",
        "Section 4  Basic Material Specifications",
        "Section 5  Work Description",
        "Section 6  Price & Payment terms",
        "Section 7  Exclusions / Client scope",
        "Section 8  Delivery period",
        "Section 9  General Terms & Conditions",
        "Section 10  Drawings",
    ]
    for sec in sections:
        story.append(Paragraph(f"&nbsp;&nbsp;&nbsp;{sec}", s["BODY"]))
        story.append(Spacer(1, 2 * mm))

    story.append(PageBreak())


def _scope_and_standards(story, styles):
    """Page 3: Scope of work + Design Standards."""
    s = styles
    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph("Section-1 Scope of work", s["H_SECTION"]))
    story.append(Paragraph(
        "Swetha Structures Pvt Ltd proposes to construct the Building as per attached drawing "
        "and specifications. Proposal inclusive of necessary materials, Labours &amp; Machinery "
        "for constructions.",
        s["BODY"]
    ))
    story.append(Spacer(1, 8 * mm))

    story.append(Paragraph("Section-2 Design Standards", s["H_SECTION"]))
    story.append(Paragraph(
        "The following codes and standards will be followed for design and constructions.",
        s["BODY"]
    ))
    story.append(Spacer(1, 4 * mm))

    codes = [
        ("IS 875 Part I", "Dead Loads – Unit weights of building Materials and stored materials."),
        ("IS 875 Part II", "Imposed loads."),
        ("IS 875 Part III", "Wind Loads."),
        ("IS 875 Part V", "Special Loads and Combinations."),
        ("IS 456 : 2000", "Plain and Reinforced Concrete Code of Practice."),
        ("SP – 16", "Design aids for reinforced concrete to IS 456."),
        ("SP – 34 – 1987", "Hand book on concrete reinforcement and detailing."),
        ("IS 800 : 1984", "Code of practice for general construction in Steel."),
        ("IS 819-1979, IS 816-1969", "Code of practice for welding."),
        ("AISC Manual", "American Institute of Steel Construction."),
        ("MBMA Manual", "Metal Building Manufacturer Association of the USA."),
    ]

    code_data = [[Paragraph("<b>CODE</b>", s["SMALL_BOLD"]),
                   Paragraph("<b>DESCRIPTION</b>", s["SMALL_BOLD"])]]
    for code, desc in codes:
        code_data.append([
            Paragraph(code, s["SMALL"]),
            Paragraph(desc, s["SMALL"]),
        ])

    code_table = Table(code_data, colWidths=["35%", "65%"])
    code_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), s["accent"]),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, s["border"]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(code_table)
    story.append(PageBreak())


def _building_description(story, styles, data):
    """Page 4: Building Description + Material Specs."""
    s = styles
    params = data.get("building_params", data)

    L = params.get("building_length", 0)
    W = params.get("building_width", 0)
    H = params.get("full_height", 0)
    Hw = params.get("wall_height", 0)
    Hclad = H - Hw
    area = L * W
    roof_type = _roof_type_label(params.get("roof_type", "a_type"))
    roof_sheet = _sheet_label(params.get("roof_sheet_type", ""))
    side_cladding = _sheet_label(params.get("side_cladding_type", ""))
    has_mezz = params.get("mezzanine_required", False)
    mezz_area = 0
    if has_mezz:
        mezz_area = (params.get("mezz_length", 0) or 0) * (params.get("mezz_width", 0) or 0)

    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph("Section-3 Building Description", s["H_SECTION"]))
    story.append(Spacer(1, 4 * mm))

    area_str = f"{area:,.0f} Sqft"
    if has_mezz and mezz_area > 0:
        area_str += f", Mezzanine Area – {mezz_area:,.0f} Sqft"

    desc_data = [
        ["Sl.No", "Description", ""],
        ["1", "Length of building (O/O)", f"{L:.0f}'"],
        ["2", "Width of building (O/O)", f"{W:.0f}'"],
        ["3", "Area of the building", area_str],
        ["4", "Roof Shape", roof_type],
        ["5", "Eave Height", f"{H:.0f}'"],
        ["6", "Wall Height", f"{Hw:.0f}'"],
        ["7", "Cladding Height", f"{Hclad:.0f}'"],
        ["8", "Roof Slope", "1 in 10"],
        ["9", "Column", "Steel column from Finished floor level (FFL)"],
        ["10", "Purlin/Grit sections", "120 GSM Galvanized Cold formed section"],
        ["11", "Frame type", "Rigid"],
        ["12", "Sheeting profile & Area", "Trapezoidal profile & Area as per drawing"],
        ["13", "Ridge type", "Profile Ridge"],
        ["14", "Structural painting", "One Coat - Yellow primer & two Coats - Enamel paint"],
    ]

    desc_rows = []
    for row in desc_data:
        desc_rows.append([
            Paragraph(str(row[0]), s["SMALL_BOLD"] if row[0] == "Sl.No" else s["SMALL"]),
            Paragraph(str(row[1]), s["SMALL_BOLD"] if row[0] == "Sl.No" else s["SMALL"]),
            Paragraph(str(row[2]), s["SMALL_BOLD"] if row[0] == "Sl.No" else s["SMALL"]),
        ])

    desc_table = Table(desc_rows, colWidths=["10%", "45%", "45%"])
    desc_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), s["accent"]),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, s["border"]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(desc_table)
    story.append(Spacer(1, 10 * mm))

    # Section 4 — Material Specs
    story.append(Paragraph("Section-4 Basic Material Specifications", s["H_SECTION"]))
    story.append(Spacer(1, 4 * mm))

    mat_data = [
        ["Grade of Steel sections/Plates/ Make", "F250 Grade / JSW or SAIL or Equivalent"],
        ["Grade of Purlin/Make", "Cold formed section – Yield Strength 240MPA"],
        ["Anchor bolt", "EN8 Grade"],
        ["Roofing Sheet thickness/ Grade", f"{roof_sheet} / JSW or Equivalent"],
        ["Cladding Sheet thickness/ Grade", f"{side_cladding} / JSW or Equivalent"],
        ["Structural members painting", "Enamel paint - Asian or Equivalent Make"],
    ]
    mat_rows = []
    for row in mat_data:
        mat_rows.append([Paragraph(row[0], s["SMALL_BOLD"]), Paragraph(row[1], s["SMALL"])])

    mat_table = Table(mat_rows, colWidths=["40%", "60%"])
    mat_table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, s["border"]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("BACKGROUND", (0, 0), (0, -1), s["light_bg"]),
    ]))
    story.append(mat_table)
    story.append(PageBreak())


def _work_descriptions(story, styles, data):
    """Page 5: Work Descriptions."""
    s = styles
    params = data.get("building_params", data)
    roof_sheet = _sheet_label(params.get("roof_sheet_type", ""))
    side_cladding = _sheet_label(params.get("side_cladding_type", ""))

    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph("Section-5 Work Descriptions", s["H_SECTION"]))
    story.append(Spacer(1, 4 * mm))

    works = [
        ("Anchor bolts", "Supply and fixing EN-8 Anchor bolt at site as per drawing"),
        ("Primary members", "Main frame Column and Rafter, Gable End frame Column and Rafter – Supply & Erection"),
        ("Secondary members", "Purlins, Girts, Bracings, Sag rods – Supply & Erection"),
        ("Welding", "Automatic welding process - Flange & Web plate joined by one side continuous welding"),
        ("Connections", "Primary members connected with 8.8 Grade Black bolts, Secondary members connected with 4.6 Grade GI bolts"),
        ("Painting", "All Structural members will be painted after well cleaned"),
        ("Roofing sheets", f"{roof_sheet} will be used for roofing"),
        ("Cladding sheets", f"{side_cladding} will be used for wall cladding"),
        ("Flashing sheets", "550 Mpa Grade Colour coated Galvalume sheet – Corner Flashing, Gable End flashing & wall flashing"),
        ("Sheeting Screws", "Galvanized self-tapping sheet metal screws will be used"),
        ("Eave Gutter & Down Spouts", "Colour coated Galvalume sheet Eave gutters & Downspouts will be used"),
    ]

    work_rows = [[
        Paragraph("<b>Sl.No</b>", s["SMALL_BOLD"]),
        Paragraph("<b>List of Works</b>", s["SMALL_BOLD"]),
        Paragraph("<b>Descriptions</b>", s["SMALL_BOLD"]),
    ]]
    for i, (name, desc) in enumerate(works, 1):
        work_rows.append([
            Paragraph(str(i), s["SMALL"]),
            Paragraph(name, s["SMALL_BOLD"]),
            Paragraph(desc, s["SMALL"]),
        ])

    work_table = Table(work_rows, colWidths=["8%", "20%", "72%"])
    work_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), s["accent"]),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, s["border"]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(work_table)
    story.append(PageBreak())


def _price_and_payment(story, styles, data, boq, md_quoted_rate=None):
    """Page 6: Price & Payment terms."""
    s = styles
    total_amount = boq.get("total_amount", 0)
    floor_area = boq.get("floor_area", 0)
    rate_per_sqft = boq.get("rate_per_sqft", 0)

    # Use MD quoted rate if provided
    if md_quoted_rate and floor_area > 0:
        total_amount = md_quoted_rate * floor_area
        rate_per_sqft = md_quoted_rate

    gst_amount = total_amount * 0.18
    total_with_gst = total_amount + gst_amount

    params = data.get("building_params", data)
    H = params.get("full_height", 0)

    # Payment schedule defaults
    payment = data.get("payment_schedule", {})
    fab_pct = payment.get("fabrication_pct", 85)
    erection_pct = payment.get("erection_pct", 15)
    fab_total = total_with_gst * fab_pct / 100
    erection_total = total_with_gst * erection_pct / 100

    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph("Section-6 Price &amp; Payment terms", s["H_SECTION"]))
    story.append(Spacer(1, 4 * mm))

    # Main price table
    price_data = [
        [Paragraph("<b>S.NO</b>", s["SMALL_BOLD"]),
         Paragraph("<b>DESCRIPTION</b>", s["SMALL_BOLD"]),
         Paragraph("<b>Total Amount (Rs.)</b>", s["SMALL_BOLD"]),
         Paragraph("<b>Remarks</b>", s["SMALL_BOLD"])],
        [Paragraph("1.0", s["SMALL"]),
         Paragraph("PEB BUILDING - FABRICATION, ERECTION &amp; ROOFING SHEET WORKS AS PER ATTACHED BOQ", s["SMALL"]),
         Paragraph(_fmt_inr(total_amount), s["CELL_R"]),
         Paragraph("", s["SMALL"])],
        [Paragraph("", s["SMALL"]),
         Paragraph("<b>TOTAL AMOUNT (Rs.) (EXCLUDING GST)</b>", s["SMALL_BOLD"]),
         Paragraph(f"<b>{_fmt_inr(total_amount)}</b>", s["CELL_RB"]),
         Paragraph("", s["SMALL"])],
        [Paragraph("", s["SMALL"]),
         Paragraph("<b>GST - 18%</b>", s["SMALL_BOLD"]),
         Paragraph(_fmt_inr(gst_amount), s["CELL_R"]),
         Paragraph("", s["SMALL"])],
        [Paragraph("", s["SMALL"]),
         Paragraph("<b>TOTAL AMOUNT (Rs.)</b>", s["SMALL_BOLD"]),
         Paragraph(f"<b>{_fmt_inr(total_with_gst)}</b>", s["CELL_RB"]),
         Paragraph("", s["SMALL"])],
    ]

    price_table = Table(price_data, colWidths=["8%", "52%", "25%", "15%"])
    price_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), s["accent"]),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, s["border"]),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(price_table)
    story.append(Spacer(1, 6 * mm))

    # Fabrication payment schedule
    story.append(Paragraph(
        f"<b>FABRICATION PAYMENT SCHEDULE ON {fab_pct}% OF TOTAL PROJECT VALUE - {_fmt_inr_round(fab_total)}</b>",
        s["SMALL_BOLD"]
    ))
    story.append(Spacer(1, 2 * mm))

    fab_schedule = [
        ("1", "ADVANCE PAYMENT ALONG WITH WORK ORDER", "10%", fab_total * 0.10),
        ("2", "TO START FABRICATION AFTER APPROVAL OF FABRICATION DRAWING", "60%", fab_total * 0.60),
        ("3", "BEFORE DISPATCH AGAINST OUR PROFORMA INVOICE", "30%", fab_total * 0.30),
    ]
    fab_rows = []
    for no, desc, pct, amt in fab_schedule:
        fab_rows.append([
            Paragraph(no, s["SMALL"]),
            Paragraph(desc, s["SMALL"]),
            Paragraph(pct, s["CELL_R"]),
            Paragraph(_fmt_inr(amt), s["CELL_R"]),
        ])
    fab_table = Table(fab_rows, colWidths=["5%", "60%", "10%", "25%"])
    fab_table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, s["border"]),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(fab_table)
    story.append(Spacer(1, 6 * mm))

    # Erection payment schedule
    story.append(Paragraph(
        f"<b>ERECTION PAYMENT SCHEDULE ON {erection_pct}% OF TOTAL PROJECT VALUE - {_fmt_inr_round(erection_total)}</b>",
        s["SMALL_BOLD"]
    ))
    story.append(Spacer(1, 2 * mm))

    erect_schedule = [
        ("1", "TO COMMENCE THE ERECTION WORKS", "50%", erection_total * 0.50),
        ("2", "TO PARTIAL COMPLETION OF ERECTION WORKS", "40%", erection_total * 0.40),
        ("3", "COMPLETION OF ERECTION & HANDOVER", "10%", erection_total * 0.10),
    ]
    erect_rows = []
    for no, desc, pct, amt in erect_schedule:
        erect_rows.append([
            Paragraph(no, s["SMALL"]),
            Paragraph(desc, s["SMALL"]),
            Paragraph(pct, s["CELL_R"]),
            Paragraph(_fmt_inr(amt), s["CELL_R"]),
        ])
    erect_table = Table(erect_rows, colWidths=["5%", "60%", "10%", "25%"])
    erect_table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, s["border"]),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(erect_table)
    story.append(PageBreak())


def _exclusions(story, styles, data):
    """Page 7: Exclusions / Client scope — dynamic based on additions."""
    s = styles
    params = data.get("building_params", data)

    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph("Section 7 Exclusion / Client scope", s["H_SECTION"]))
    story.append(Spacer(1, 4 * mm))

    # Standard exclusions
    exclusions = [
        "Electricity 3 Phase supply & Water required during Erection to be provided by client.",
        "Accommodation for erection labours to be provided by client.",
        "Civil works and necessary scaffolding for erection excluded.",
        "Except approval drawings additional works will be on client scope.",
        "Grouting under column, civil column correction if any will be on client scope.",
        "Electrical, plumbing, interior, masonry, handrail, partitions, glazing work are excluded.",
        "Windows, doors & Rolling shutters are excluded.",
    ]

    # Dynamic exclusions based on what's NOT included in additions
    dynamic_excluded = []
    if not params.get("turbo_ventilator"):
        dynamic_excluded.append("Turbo Ventilator")
    if not params.get("aluminium_foil"):
        dynamic_excluded.append("Aluminium Foil")
    if not params.get("louvers"):
        dynamic_excluded.append("Fixed Louvers")
    if not params.get("crane"):
        dynamic_excluded.append("Crane Bracket, Crane Girder, Gantry Girder")
    if not params.get("ridge_vent") and not params.get("ridge_monitor"):
        dynamic_excluded.append("Ridge Vent / Ridge Monitor")

    if dynamic_excluded:
        exclusions.append(f"{', '.join(dynamic_excluded)} are excluded.")

    exclusions.append(
        "Contracts are on agreed price basis for the given scope of work only. "
        "We have the rights to claim unused materials from the site."
    )

    for exc in exclusions:
        story.append(Paragraph(f"➤ {exc}", s["BULLET"]))

    story.append(Spacer(1, 10 * mm))

    # Section 8 — Delivery period
    story.append(Paragraph("Section 8 Delivery period", s["H_SECTION"]))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(
        "Fabrication and material delivery duration <b>4 weeks</b> and Erection period "
        "<b>4 weeks</b> from latest date of receipt and acceptance of the following, "
        "whichever is later.",
        s["BODY"]
    ))
    story.append(Spacer(1, 4 * mm))

    delivery_items = [
        "Work order/Purchase order or Signed contract",
        "Fabrication drawing approval from client side",
        "Down payment as per schedule",
        "Change in work order/drawings/specification if any",
        "Site difficulty/Rain during erection if any",
    ]
    for i, item in enumerate(delivery_items, 1):
        story.append(Paragraph(f"{i}. {item}", s["BODY"]))
    story.append(PageBreak())


def _terms_and_conditions(story, styles):
    """Page 8: General T&C."""
    s = styles
    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph("Section 9 General Terms &amp; Conditions", s["H_SECTION"]))
    story.append(Spacer(1, 4 * mm))

    terms = [
        "This quotation is valid for 15 days.",
        "Contractor shall not be responsible or liable for obtaining of Government permits/approval to the construction.",
        ("FORCE MAJEURE: we shall not be liable for any loss or damage to the Client for delay in "
         "delivery due to circumstances beyond control, such as, riots, civil commotion, revolution, "
         "civil war, floods, fires, natural calamities, strikes and delays in non-availability of "
         "transport for reasons such as Truckers Strikes etc. Any other circumstance or event beyond "
         "the control of us."),
        "Completion certificate after handover the buildings to be provided by client.",
    ]
    for i, term in enumerate(terms, 1):
        story.append(Paragraph(f"{i}. {term}", s["BODY"]))
        story.append(Spacer(1, 3 * mm))

    story.append(Spacer(1, 10 * mm))
    story.append(Paragraph("Thanking you,", s["BODY"]))
    story.append(Paragraph("Yours Truly,", s["BODY"]))
    story.append(Spacer(1, 10 * mm))
    story.append(Paragraph(f"For {COMPANY['name']}", s["BODY_BOLD"]))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(COMPANY["md_name"], s["BODY_BOLD"]))
    story.append(Paragraph(COMPANY["md_title"], s["BODY"]))
    story.append(PageBreak())


def _summary_page(story, styles, data, boq, md_quoted_rate=None):
    """Page 9: PROJECT COST SUMMARY."""
    s = styles
    params = data.get("building_params", data)
    total_amount = boq.get("total_amount", 0)
    floor_area = boq.get("floor_area", 0)
    rate_per_sqft = boq.get("rate_per_sqft", 0)
    H = params.get("full_height", 0)

    if md_quoted_rate and floor_area > 0:
        total_amount = md_quoted_rate * floor_area
        rate_per_sqft = md_quoted_rate

    client_name = data.get("client_name", "")
    client_location = data.get("client_location", "")
    project_name = data.get("project_name", "Proposed Industrial Building")

    story.append(Spacer(1, 6 * mm))

    # Project header
    header_data = [
        [Paragraph(f"<b>Project Name :</b> {project_name}", s["SMALL"]),
         Paragraph("", s["SMALL"])],
        [Paragraph("<b>Client :</b>", s["SMALL"]),
         Paragraph("<b>Turnkey Contractor:</b>", s["SMALL"])],
        [Paragraph(f"{client_name}", s["SMALL"]),
         Paragraph(COMPANY["name"], s["SMALL"])],
    ]
    header_table = Table(header_data, colWidths=["50%", "50%"])
    header_table.setStyle(TableStyle([
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 4 * mm))

    story.append(Paragraph("<b>PEB BUILDING - PROJECT COST SUMMARY</b>", s["H_SECTION"]))
    story.append(Spacer(1, 4 * mm))

    # Summary table
    summary_data = [
        [Paragraph("<b>S.NO</b>", s["TABLE_HEADER"]),
         Paragraph("<b>DESCRIPTION</b>", s["TABLE_HEADER"]),
         Paragraph("<b>Area (Sqft)</b>", s["TABLE_HEADER_R"]),
         Paragraph("<b>Rate/Sqft (Rs.)</b>", s["TABLE_HEADER_R"]),
         Paragraph("<b>Total Amount (Rs.)</b>", s["TABLE_HEADER_R"]),
         Paragraph("<b>Remarks</b>", s["TABLE_HEADER"])],
        [Paragraph("1.0", s["CELL"]),
         Paragraph(f"PEB WORKS - FABRICATION, ERECTION &amp; SHEETING (EAVE HEIGHT {H:.0f}')", s["CELL"]),
         Paragraph(f"{floor_area:,.0f}", s["CELL_R"]),
         Paragraph(f"{rate_per_sqft:,.0f}", s["CELL_R"]),
         Paragraph(f"{total_amount:,.2f}", s["CELL_RB"]),
         Paragraph("", s["CELL"])],
    ]

    # Add turbo ventilator, shutters etc. as separate summary items
    additions_items = []
    if params.get("turbo_ventilator") and params.get("turbo_ventilator_count"):
        count = params.get("turbo_ventilator_count", 0)
        rate = 5750  # default
        additions_items.append(("SUPPLYING & FIXING OF TURBO VENTILATOR (IN NOS)", count, rate))

    if params.get("shutters") and params.get("shutters_count"):
        count = params.get("shutters_count", 0)
        size = params.get("shutters_size", "")
        rate = 500
        desc = f"SUPPLYING & FIXING OF ROLLING SHUTTER - {count} NOS"
        if size:
            desc += f" ({size})"
        additions_items.append((desc, count, rate))

    for idx, (desc, qty, rate) in enumerate(additions_items, 2):
        amt = qty * rate
        total_amount += amt
        summary_data.append([
            Paragraph(f"{idx}.0", s["CELL"]),
            Paragraph(desc, s["CELL"]),
            Paragraph(f"{qty:,.0f}", s["CELL_R"]),
            Paragraph(f"{rate:,.0f}", s["CELL_R"]),
            Paragraph(f"{amt:,.2f}", s["CELL_RB"]),
            Paragraph("", s["CELL"]),
        ])

    # Total row
    summary_data.append([
        Paragraph("", s["CELL"]),
        Paragraph("<b>TOTAL AMOUNT (Rs.) (EXCLUDING TAXES)</b>", s["CELL_RB"]),
        Paragraph("", s["CELL"]),
        Paragraph("", s["CELL"]),
        Paragraph(f"<b>{total_amount:,.2f}</b>", s["CELL_RB"]),
        Paragraph("", s["CELL"]),
    ])

    summary_table = Table(summary_data, colWidths=["8%", "37%", "13%", "13%", "18%", "11%"])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), s["accent"]),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, s["border"]),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, -1), (-1, -1), s["light_bg"]),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 6 * mm))

    # Notes
    story.append(Paragraph("<b>NOTE:-</b>", s["SMALL_BOLD"]))
    dynamic_excluded = []
    if not params.get("turbo_ventilator"):
        dynamic_excluded.append("Turbo Ventilator")
    if not params.get("aluminium_foil"):
        dynamic_excluded.append("Aluminium Foil")
    if not params.get("louvers"):
        dynamic_excluded.append("Fixed Louvers")
    if not params.get("crane"):
        dynamic_excluded.append("Crane Bracket, Crane Girder, Gantry Girder")

    excl_parts = dynamic_excluded + [
        "Special Elevations", "Foundation & Civil Works", "Rolling Shutters" if not params.get("shutters") else None,
        "Windows with Safety Grills", "Door", "Electrical & Plumbing Works"
    ]
    excl_parts = [e for e in excl_parts if e]
    story.append(Paragraph(
        f"1. {', '.join(excl_parts)} are not included.",
        s["SMALL"]
    ))
    story.append(PageBreak())


def _abstract_boq(story, styles, data, boq, md_quoted_rate=None):
    """Page 10: ABSTRACT ESTIMATE — the detailed BOQ table."""
    s = styles
    params = data.get("building_params", data)
    client_name = data.get("client_name", "")
    project_name = data.get("project_name", "Proposed Industrial Building")
    client_location = data.get("client_location", "")

    story.append(Spacer(1, 4 * mm))

    # Header
    header_data = [
        [Paragraph(f"<b>Project Name :</b> {project_name}", s["SMALL"]),
         Paragraph("", s["SMALL"])],
        [Paragraph(f"<b>Client :</b> {client_name}", s["SMALL"]),
         Paragraph(f"<b>Turnkey Contractor:</b> {COMPANY['name']}", s["SMALL"])],
    ]
    ht = Table(header_data, colWidths=["50%", "50%"])
    ht.setStyle(TableStyle([
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(ht)
    story.append(Spacer(1, 4 * mm))

    story.append(Paragraph("<b>ABSTRACT ESTIMATE FOR PEB WORKS - INDUSTRIAL BUILDING</b>", s["H_SECTION"]))
    story.append(Spacer(1, 4 * mm))

    items = boq.get("items", [])
    has_rate_split = any(item.get("material_rate") is not None for item in items)

    if has_rate_split:
        # With Material + Labour columns (like Krishnamoorthy PDF)
        col_headers = [
            Paragraph("<b>Item No</b>", s["TABLE_HEADER"]),
            Paragraph("<b>Description of work/Items</b>", s["TABLE_HEADER"]),
            Paragraph("<b>Unit</b>", s["TABLE_HEADER"]),
            Paragraph("<b>Quantity</b>", s["TABLE_HEADER_R"]),
            Paragraph("<b>Material Rate</b>", s["TABLE_HEADER_R"]),
            Paragraph("<b>Labour Rate</b>", s["TABLE_HEADER_R"]),
            Paragraph("<b>Total Rate</b>", s["TABLE_HEADER_R"]),
            Paragraph("<b>Amount</b>", s["TABLE_HEADER_R"]),
        ]
        col_widths = ["7%", "33%", "7%", "10%", "10%", "10%", "10%", "13%"]
    else:
        col_headers = [
            Paragraph("<b>Item No</b>", s["TABLE_HEADER"]),
            Paragraph("<b>Description of work/Items</b>", s["TABLE_HEADER"]),
            Paragraph("<b>Unit</b>", s["TABLE_HEADER"]),
            Paragraph("<b>Quantity</b>", s["TABLE_HEADER_R"]),
            Paragraph("<b>Rate</b>", s["TABLE_HEADER_R"]),
            Paragraph("<b>Amount</b>", s["TABLE_HEADER_R"]),
        ]
        col_widths = ["8%", "42%", "8%", "12%", "12%", "18%"]

    boq_rows = [col_headers]
    prev_cat = ""

    for item in items:
        cat = item.get("category", "")
        if cat and cat != prev_cat:
            if has_rate_split:
                boq_rows.append([
                    Paragraph("", s["SMALL_BOLD"]),
                    Paragraph(f"<b>{cat}</b>", s["SMALL_BOLD"]),
                    "", "", "", "", "", ""
                ])
            else:
                boq_rows.append([
                    Paragraph("", s["SMALL_BOLD"]),
                    Paragraph(f"<b>{cat}</b>", s["SMALL_BOLD"]),
                    "", "", "", ""
                ])
            prev_cat = cat

        desc_text = item.get("description", "").replace("\n", "<br/>")

        if has_rate_split:
            boq_rows.append([
                Paragraph(str(item.get("item_no", "")), s["CELL"]),
                Paragraph(desc_text, s["CELL"]),
                Paragraph(str(item.get("unit", "")), s["CELL"]),
                Paragraph(_fmt_qty(item.get("quantity", 0)), s["CELL_R"]),
                Paragraph(_fmt_qty(item.get("material_rate", 0)), s["CELL_R"]),
                Paragraph(_fmt_qty(item.get("labour_rate", 0)), s["CELL_R"]),
                Paragraph(_fmt_qty(item.get("rate", 0)), s["CELL_R"]),
                Paragraph(_fmt_qty(item.get("amount", 0)), s["CELL_RB"]),
            ])
        else:
            boq_rows.append([
                Paragraph(str(item.get("item_no", "")), s["CELL"]),
                Paragraph(desc_text, s["CELL"]),
                Paragraph(str(item.get("unit", "")), s["CELL"]),
                Paragraph(_fmt_qty(item.get("quantity", 0)), s["CELL_R"]),
                Paragraph(_fmt_qty(item.get("rate", 0)), s["CELL_R"]),
                Paragraph(_fmt_qty(item.get("amount", 0)), s["CELL_RB"]),
            ])

    # Totals
    total_estimated = boq.get("total_amount", 0)
    floor_area = boq.get("floor_area", 0)
    rate_estimated = boq.get("rate_per_sqft", 0)

    quoted_rate = md_quoted_rate or math.floor(rate_estimated)
    quoted_total = quoted_rate * floor_area if floor_area > 0 else total_estimated

    ncols = 8 if has_rate_split else 6
    amt_col = ncols - 1
    span_cols = ncols - 2

    # Total estimated row
    total_row = [""] * ncols
    total_row[0] = ""
    total_row[1] = Paragraph("<b>TOTAL ESTIMATED AMOUNT (RS.)</b>", s["CELL_RB"])
    total_row[amt_col] = Paragraph(f"<b>{_fmt_qty(total_estimated)}</b>", s["CELL_RB"])
    boq_rows.append(total_row)

    # Area row
    area_row = [""] * ncols
    area_row[1] = Paragraph("AREA OF THE BUILDING (SQ.FT)", s["CELL"])
    area_row[amt_col] = Paragraph(f"{floor_area:,.0f}", s["CELL_R"])
    boq_rows.append(area_row)

    # Estimated rate
    est_row = [""] * ncols
    est_row[1] = Paragraph("RATE/ SQFT - ESTIMATED", s["CELL"])
    est_row[amt_col] = Paragraph(f"{rate_estimated:,.2f}", s["CELL_R"])
    boq_rows.append(est_row)

    # Quoted rate + cost
    quoted_row = [""] * ncols
    quoted_row[1] = Paragraph("<b>QUOTED RATE/ SQ.FT  &amp;  PROJECT COST (RS.) (EXCLUDING TAXES)</b>", s["CELL_RB"])
    quoted_row[amt_col] = Paragraph(
        f"<b>{quoted_rate:,.0f} /SFT &amp; RS. {quoted_total:,.2f}</b>", s["CELL_RB"])
    boq_rows.append(quoted_row)

    boq_table = Table(boq_rows, colWidths=col_widths, repeatRows=1)
    ts = TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), s["accent"]),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, s["border"]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, -4), (-1, -1), s["light_bg"]),
        ("LINEABOVE", (0, -4), (-1, -4), 1, s["accent"]),
    ])
    boq_table.setStyle(ts)
    story.append(boq_table)


# ─── Main Entry Point ────────────────────────────────────────────────────────

def generate_quotation_pdf(quotation, lead=None, *,
                            tenant_branding=None,
                            portal_url=None,
                            render_3d_path=None,
                            **legacy_kwargs) -> bytes:
    """Generate a Swetha Structures proposal PDF.

    Backward-compatible:
        - Legacy: generate_quotation_pdf(data: dict, boq: dict)
        - New: generate_quotation_pdf(quotation_obj, lead=None, ...)
    """
    if not REPORTLAB_AVAILABLE:
        raise RuntimeError("reportlab not installed. Run: pip install reportlab")

    # Detect legacy call: both args are dicts
    if isinstance(quotation, dict) and isinstance(lead, dict):
        data = quotation
        boq = lead
    elif isinstance(quotation, dict):
        data = quotation
        boq = quotation.get("boq_results", {}) or {}
    else:
        # ORM object
        data = {
            "project_name": _get_attr(quotation, "project_name", ""),
            "client_name": _get_attr(quotation, "client_name", ""),
            "client_location": _get_attr(quotation, "client_location", ""),
            "building_params": _get_attr(quotation, "building_params", {}) or {},
        }
        boq = _get_attr(quotation, "boq_results", {}) or {}
        if lead:
            data["client_name"] = data["client_name"] or _get_attr(lead, "name", "")
            data["client_location"] = data["client_location"] or _get_attr(lead, "city", "")

    # Extract MD quoted rate
    md_quoted_rate = data.get("md_quoted_rate") or (
        _get_attr(quotation, "md_quoted_rate", None) if not isinstance(quotation, dict) else None
    )

    styles = _build_styles()

    # PR number
    now = datetime.now()
    q_id = data.get("id") or _get_attr(quotation, "id", "001")
    pr_no = f"SS/{now.strftime('%y')}-{int(now.strftime('%y'))+1}/SSPB-{str(q_id).zfill(3)}"
    quote_date = now.strftime("%d %B %Y")

    # Build document
    buf = io.BytesIO()
    on_page, on_later = _make_header_footer(styles, pr_no, [0])

    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        rightMargin=15 * mm, leftMargin=15 * mm,
        topMargin=35 * mm, bottomMargin=18 * mm,
        title=f"PEB Proposal - {data.get('project_name', '')}",
        author=COMPANY["name"],
    )

    story = []

    # Build all sections
    _cover_letter(story, styles, data, pr_no, quote_date)
    _contents_page(story, styles)
    _scope_and_standards(story, styles)
    _building_description(story, styles, data)
    _work_descriptions(story, styles, data)
    _price_and_payment(story, styles, data, boq, md_quoted_rate)
    _exclusions(story, styles, data)
    _terms_and_conditions(story, styles)
    _summary_page(story, styles, data, boq, md_quoted_rate)
    _abstract_boq(story, styles, data, boq, md_quoted_rate)

    doc.build(story, onFirstPage=on_page, onLaterPages=on_later)
    buf.seek(0)
    return buf.read()
