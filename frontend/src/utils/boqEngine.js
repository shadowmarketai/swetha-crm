/**
 * PEB BOQ Calculation Engine
 * ==========================
 * Matches Swetha Structures actual proposal format.
 * Roof and Side Cladding are SEPARATE items.
 * Rates use Material + Labour split, editable per quote.
 */

export const STEEL_RATE_MAIN = 1.8   // kg per sqft (main building)
export const STEEL_RATE_MEZZ = 3.4   // kg per sqft (mezzanine)

// Geometry: slope-adjusted dimensions
export function slopeAdjust(L, W, H, Hw, roofType) {
  const ridgeH = H - Hw
  if (roofType === 'monoslope') {
    const slopeLen = Math.sqrt(W * W + ridgeH * ridgeH)
    const slopeFactor = W > 0 ? slopeLen / W : 1
    return {
      adjL: L + 12.92,
      adjW: W * slopeFactor + 4,
      slopeFactor,
    }
  }
  // A-Type (gable)
  const halfSpan = W / 2
  const slopeLen = Math.sqrt(halfSpan * halfSpan + ridgeH * ridgeH)
  const slopeFactor = halfSpan > 0 ? slopeLen / halfSpan : 1
  return {
    adjL: L + 12.92,
    adjW: W * slopeFactor + 4,
    slopeFactor,
  }
}

// Get rate from _rates map or fall back to default
function getRate(rates, id, fallback) {
  if (rates && rates[id]) return rates[id].total || fallback
  return fallback
}

function getRateSplit(rates, id, fallbackMat, fallbackLab) {
  if (rates && rates[id]) {
    return {
      material_rate: rates[id].material ?? fallbackMat,
      labour_rate: rates[id].labour ?? fallbackLab,
      rate: (rates[id].material ?? fallbackMat) + (rates[id].labour ?? fallbackLab),
    }
  }
  return { material_rate: fallbackMat, labour_rate: fallbackLab, rate: fallbackMat + fallbackLab }
}

// Determine if roof sheet is PUF type
function isPuf(sheetType) {
  return (sheetType || '').startsWith('puf_panel')
}

// Get sheet description for PDF
function roofSheetDesc(sheetType) {
  if (!sheetType) return 'BARE galvalume sheet 0.47mm thickness'
  if (sheetType.startsWith('puf_panel')) {
    const mm = sheetType.replace('puf_panel_', '').replace('mm', '')
    return `PUF panel ${mm}MM thickness`
  }
  const mm = sheetType.replace('bare_galvalume_', '').replace('mm', '')
  return `BARE galvalume sheet ${mm}mm thickness`
}

function sideCladdingDesc(sheetType) {
  if (!sheetType) return 'profiled COLOUR coated galvalume sheet 0.47mm thickness'
  if (sheetType.startsWith('puf_panel')) {
    const mm = sheetType.replace('puf_panel_', '').replace('mm', '')
    return `PUF panel ${mm}MM thickness`
  }
  const mm = sheetType.replace('bare_colour_galvalume_', '').replace('mm', '')
  return `profiled COLOUR coated galvalume sheet ${mm}mm thickness`
}

export function calcBOQ(form) {
  const L  = +form.building_length || 0
  const W  = +form.building_width || 0
  const H  = +form.full_height || 0
  const Hw = +form.wall_height || 0
  const Hclad = H - Hw  // Cladding height = full_height - wall_height
  const hasMezz = !!form.mezzanine_required
  const mL = hasMezz ? (+form.mezz_length || 0) : 0
  const mW = hasMezz ? (+form.mezz_width || 0) : 0
  const rt = form.roof_type || 'a_type'
  const roofSheet = form.roof_sheet_type || 'bare_galvalume_0.47mm'
  const sideSheet = form.side_cladding_type || 'bare_colour_galvalume_0.47mm'
  const rates = form._rates || {}

  // --- Steel Tonnage ---
  const steelRateMain = +(form.steel_rate_main || STEEL_RATE_MAIN)
  const steelRateMezz = +(form.steel_rate_mezz || STEEL_RATE_MEZZ)
  const mainArea = L * W
  const mainKg = mainArea * steelRateMain
  const mezzArea = hasMezz ? mL * mW : 0
  const mezzKg = hasMezz ? mezzArea * steelRateMezz : 0
  const totalKg = mainKg + mezzKg

  // --- Geometry ---
  const { adjL, adjW, slopeFactor } = slopeAdjust(L, W, H, Hw, rt)
  const roofArea = adjL * adjW

  // Side cladding on all 4 walls using Hclad
  const ridgeH = H - Hw
  const triArea = (rt === 'a_type' || rt === 'gable') ? 2 * (0.5 * W * ridgeH) : 0
  const northSouth = 2 * (adjL * Hclad)
  const eastWest = 2 * (adjW * Hclad)
  const totalWallArea = northSouth + eastWest + triArea

  // Ridge/flashing
  const ridgeRft = 2 * (adjL + adjW)

  // Polycarbonate lighting (5% of roof area)
  const lightSheetQty = +(roofArea * 0.05).toFixed(2)

  // --- Build ABSTRACT items with Material + Labour split ---
  const items = []

  // 1.00 — STRUCTURAL STEEL WORKS
  const steelR = getRateSplit(rates, 'structural_steel', 70, 35)
  items.push({
    item_no: '1.00', category: 'STRUCTURAL STEEL WORKS',
    description: 'Supplying, fabrication and erecting in position for all structural member using MS Sections for Trusses, Base plate, Cap plate, connection plates, EN8 Anchor bolts, Cold formed Purlins, etc., including making connection, aligning, Cleaning etc., with one coat of zinc chromate metal primer and two coats of enamel paint (Asian). Conveyance and fixing charges etc., complete.\n(All Structural members, Purlin, Sag rods, connection plates & Bolts etc considered)',
    unit: 'Kg', quantity: +totalKg.toFixed(2),
    material_rate: steelR.material_rate, labour_rate: steelR.labour_rate,
    rate: steelR.rate, amount: +(totalKg * steelR.rate).toFixed(2),
  })

  // 2.00 — ROOFING AND SIDE CLADDING WORKS

  // 2.01 — Roof Sheet (separate item)
  const roofR = getRateSplit(rates, 'roof_sheet', 42, 18)
  items.push({
    item_no: '2.01', category: 'ROOFING AND SIDE CLADDING WORKS',
    description: `Supplying and laying of ${roofSheetDesc(roofSheet)} for Roofing with necessary sealant, EPDM metal washers, Bolt and nuts, necessary flashings etc., complete.`,
    unit: 'Sqft', quantity: +roofArea.toFixed(2),
    material_rate: roofR.material_rate, labour_rate: roofR.labour_rate,
    rate: roofR.rate, amount: +(roofArea * roofR.rate).toFixed(2),
  })

  // 2.02 — Side Cladding (separate item)
  const cladR = getRateSplit(rates, 'side_cladding', 40, 18)
  items.push({
    item_no: '2.02', category: 'ROOFING AND SIDE CLADDING WORKS',
    description: `Supplying and laying of ${sideCladdingDesc(sideSheet)} for side cladding with necessary sealant, EPDM metal washers, Bolt and nuts, necessary flashings etc., complete.`,
    unit: 'Sqft', quantity: +totalWallArea.toFixed(2),
    material_rate: cladR.material_rate, labour_rate: cladR.labour_rate,
    rate: cladR.rate, amount: +(totalWallArea * cladR.rate).toFixed(2),
  })

  // 2.03 — Ridge, Flash, Gutter, Downspout
  const ridgeR = getRateSplit(rates, 'ridge_flashing', 60, 50)
  items.push({
    item_no: '2.03', category: 'ROOFING AND SIDE CLADDING WORKS',
    description: 'Supplying and laying of profiled colour coated galvalume sheet 0.47mm thickness with 550 MPA for Ridge, L Flash, Trip Flash, Gutter, Downspout., etc.',
    unit: 'Rft', quantity: +ridgeRft.toFixed(2),
    material_rate: ridgeR.material_rate, labour_rate: ridgeR.labour_rate,
    rate: ridgeR.rate, amount: +(ridgeRft * ridgeR.rate).toFixed(2),
  })

  // 2.04 — Polycarbonate Lighting Sheet
  const polyR = getRateSplit(rates, 'polycarbonate', 60, 50)
  items.push({
    item_no: '2.04', category: 'ROOFING AND SIDE CLADDING WORKS',
    description: 'Supplying and laying of POLYCARBONATE SHEET (Lighting sheet) 1.5mm thickness including making connection, aligning, Cleaning etc.',
    unit: 'Sqft', quantity: +lightSheetQty.toFixed(2),
    material_rate: polyR.material_rate, labour_rate: polyR.labour_rate,
    rate: polyR.rate, amount: +(lightSheetQty * polyR.rate).toFixed(2),
  })

  // 3.00 — MEZZANINE WORKS
  if (hasMezz && mezzArea > 0) {
    // Mezzanine steel
    const mSteelR = getRateSplit(rates, 'mezzanine_steel', 70, 35)
    const mezzSteelAmt = +(mezzKg * mSteelR.rate).toFixed(2)
    items.push({
      item_no: '3.01', category: 'MEZZANINE WORKS',
      description: 'Supplying, fabrication and erecting in position for all structural member for mezzanine floor, including connection plates, bolts etc., complete.',
      unit: 'Kg', quantity: +mezzKg.toFixed(2),
      material_rate: mSteelR.material_rate, labour_rate: mSteelR.labour_rate,
      rate: mSteelR.rate, amount: mezzSteelAmt,
    })

    // Mezzanine decking
    const deckR = getRateSplit(rates, 'mezzanine_decking', 110, 25)
    items.push({
      item_no: '3.02', category: 'MEZZANINE WORKS',
      description: 'Supplying and laying of Deck Sheet for mezzanine floor with concrete (100mm avg thickness), complete.',
      unit: 'Sqft', quantity: +mezzArea.toFixed(2),
      material_rate: deckR.material_rate, labour_rate: deckR.labour_rate,
      rate: deckR.rate, amount: +(mezzArea * deckR.rate).toFixed(2),
    })
  }

  // --- Totals ---
  const total = +items.reduce((s, i) => s + i.amount, 0).toFixed(2)
  const flrArea = mainArea + mezzArea
  const ratePerSqft = flrArea > 0 ? +(total / flrArea).toFixed(2) : 0

  return {
    items,
    total_amount: total,
    floor_area: flrArea,
    rate_per_sqft: ratePerSqft,
    steel_summary: {
      total_steel_kg: +totalKg.toFixed(2),
      total_steel_ton: +(totalKg / 1000).toFixed(3),
      main_steel_kg: +mainKg.toFixed(2),
      mezz_steel_kg: +mezzKg.toFixed(2),
      main_area_sqft: mainArea,
      mezz_area_sqft: mezzArea,
      steel_amount: +(totalKg * steelR.rate).toFixed(2),
    },
    cladding_summary: {
      adjL: +adjL.toFixed(2), adjW: +adjW.toFixed(2),
      slope_factor: +slopeFactor.toFixed(4),
      roof_area_sqft: +roofArea.toFixed(2),
      wall_area_sqft: +totalWallArea.toFixed(2),
      ridge_rft: +ridgeRft.toFixed(2),
      lighting_sqft: lightSheetQty,
      floor_area_sqft: mainArea,
      cladding_height: +Hclad.toFixed(2),
    },
  }
}
