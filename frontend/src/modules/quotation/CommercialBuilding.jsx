/**
 * CommercialBuilding — minimal Three.js 3D shell for a 2-storey office /
 * commercial building. Used as a *structural reference* for the AI render
 * pipeline (Gemini fills in photoreal detail from this geometry + a style
 * anchor image), so we deliberately stay schematic and fast.
 *
 * Same `data` prop shape as PEBBuilding so AIImage / Viewer3D can swap them.
 *
 * Reads (with defaults):
 *   building_length, building_width, full_height, wall_height
 *   wall_color_hex, accent_color_hex, trim_color_hex
 *   glazing_type — 'curtain_wall' (default) | 'ribbon_window' | 'punched_windows'
 *   front_door_type — 'glazed_entrance' (default) | 'sectional' | 'roller_shutter'
 */

import { useMemo } from "react"
import * as THREE from "three"

// ── helpers ──
const FT = 1   // we work in "feet" units; orbit camera is also in feet
const HEX = (c, fallback = "#FFFFFF") => {
  if (!c || typeof c !== "string") return fallback
  const v = c.trim()
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback
}

// Build a curtain-wall texture: a regular grid of mullions on tinted glass.
let _curtainCache = null
function makeCurtainTexture(tintHex) {
  if (_curtainCache && _curtainCache.tint === tintHex) return _curtainCache.tex
  const w = 256, h = 256
  const c = document.createElement("canvas")
  c.width = w; c.height = h
  const ctx = c.getContext("2d")
  ctx.fillStyle = tintHex
  ctx.fillRect(0, 0, w, h)
  // dark anodised aluminium mullion grid
  ctx.fillStyle = "rgba(20,20,28,0.85)"
  // 4 vertical mullions
  for (let i = 1; i < 5; i++) {
    const x = (i / 5) * w
    ctx.fillRect(x - 2, 0, 4, h)
  }
  // 3 horizontal transoms
  for (let i = 1; i < 4; i++) {
    const y = (i / 4) * h
    ctx.fillRect(0, y - 2, w, 4)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 16
  _curtainCache = { tint: tintHex, tex }
  return tex
}

// Punched-window texture: small evenly spaced rectangles on a wall colour.
function makePunchedWindowTexture(wallHex, windowHex) {
  const w = 256, h = 256
  const c = document.createElement("canvas")
  c.width = w; c.height = h
  const ctx = c.getContext("2d")
  ctx.fillStyle = wallHex
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = windowHex
  // 3 windows across, 1 row vertically
  const winW = 36, winH = 56
  const rowY = (h - winH) / 2
  for (let i = 0; i < 3; i++) {
    const x = (w / 4) * (i + 1) - winW / 2
    ctx.fillRect(x, rowY, winW, winH)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 16
  return tex
}


export default function CommercialBuilding({ data = {} }) {
  // Pull dimensions with sensible commercial defaults
  const L = +data.building_length || 80     // length along X
  const W = +data.building_width  || 50     // depth along Z
  const H = +data.full_height     || 45     // total height
  // Floor split — if wall_height looks like a PEB warehouse value (small),
  // split evenly between the 2 storeys instead.
  const wallH = +data.wall_height || 0
  const groundH = (wallH >= 10 && wallH <= H * 0.6) ? wallH : H * 0.45
  const upperH  = H - groundH - 2  // -2 leaves room for the parapet trim

  const wallColor   = HEX(data.wall_color_hex,   "#FFFFFF")
  const accentColor = HEX(data.accent_color_hex, "#1F4E79")  // glazing tint
  const trimColor   = HEX(data.trim_color_hex,   "#E63946")
  const glazing     = data.glazing_type     || "curtain_wall"
  const door        = data.front_door_type  || "glazed_entrance"

  // ── Materials (memoized — disposed on unmount) ──
  const mats = useMemo(() => {
    const wall = new THREE.MeshStandardMaterial({
      color: wallColor, roughness: 0.85, metalness: 0.0,
    })
    const trim = new THREE.MeshStandardMaterial({
      color: trimColor, roughness: 0.45, metalness: 0.1,
    })
    const ground = new THREE.MeshStandardMaterial({
      color: "#2a2a2e", roughness: 0.95,
    })
    // Curtain wall — emissive glass with mullion grid
    const curtainTex = makeCurtainTexture(accentColor)
    const curtain = new THREE.MeshStandardMaterial({
      map: curtainTex,
      color: "#ffffff",
      roughness: 0.18, metalness: 0.6,
      transparent: false,
    })
    // Ribbon window — same material with stretched repeat
    const ribbonTex = makeCurtainTexture(accentColor)
    ribbonTex.repeat.set(4, 1)
    const ribbon = new THREE.MeshStandardMaterial({
      map: ribbonTex, color: "#ffffff", roughness: 0.18, metalness: 0.6,
    })
    // Punched windows
    const punchedTex = makePunchedWindowTexture(wallColor, accentColor)
    punchedTex.repeat.set(2, 1)
    const punched = new THREE.MeshStandardMaterial({
      map: punchedTex, roughness: 0.85,
    })
    // Door panel
    const doorPanel = new THREE.MeshStandardMaterial({
      color: door === "glazed_entrance" ? accentColor : "#777",
      roughness: door === "glazed_entrance" ? 0.2 : 0.7,
      metalness: door === "glazed_entrance" ? 0.5 : 0.3,
    })
    // Door trim
    const doorTrim = new THREE.MeshStandardMaterial({
      color: trimColor, roughness: 0.4, metalness: 0.2,
    })
    return { wall, trim, ground, curtain, ribbon, punched, doorPanel, doorTrim }
  }, [wallColor, accentColor, trimColor, door])

  // ── Geometry calculations ──
  const upperGlazingMaterial =
    glazing === "ribbon_window" ? mats.ribbon :
    glazing === "punched_windows" ? mats.punched :
    mats.curtain

  // Door: roughly 8ft wide x 9ft tall, centered on the front wall
  const doorW = Math.min(12, L * 0.18)
  const doorH = Math.min(10, groundH * 0.85)

  // Ground tile size
  const tileSize = Math.max(L, W) * 1.6

  return (
    <group>
      {/* ── Ground plane ── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow material={mats.ground}>
        <planeGeometry args={[tileSize, tileSize]} />
      </mesh>

      {/* ── Ground floor: white masonry box with punched windows on sides ── */}
      {/* Front face (ground) — punched windows + door cutout via overlay */}
      <mesh position={[0, groundH / 2, W / 2 + 0.01]} castShadow receiveShadow material={mats.punched}>
        <boxGeometry args={[L, groundH, 0.1 * FT]} />
      </mesh>
      {/* Back face (ground) */}
      <mesh position={[0, groundH / 2, -W / 2 - 0.01]} castShadow receiveShadow material={mats.punched}>
        <boxGeometry args={[L, groundH, 0.1 * FT]} />
      </mesh>
      {/* Left face (ground) */}
      <mesh position={[-L / 2 - 0.01, groundH / 2, 0]} castShadow receiveShadow material={mats.punched}>
        <boxGeometry args={[0.1 * FT, groundH, W]} />
      </mesh>
      {/* Right face (ground) */}
      <mesh position={[L / 2 + 0.01, groundH / 2, 0]} castShadow receiveShadow material={mats.punched}>
        <boxGeometry args={[0.1 * FT, groundH, W]} />
      </mesh>
      {/* Solid wall fill (so it's not hollow when looking through the windows) */}
      <mesh position={[0, groundH / 2, 0]} material={mats.wall}>
        <boxGeometry args={[L - 0.4, groundH - 0.1, W - 0.4]} />
      </mesh>

      {/* ── Door on the front face ── */}
      <mesh position={[0, doorH / 2, W / 2 + 0.06]} castShadow material={mats.doorPanel}>
        <boxGeometry args={[doorW, doorH, 0.05]} />
      </mesh>
      {/* Door frame trim */}
      <mesh position={[0, doorH + 0.2, W / 2 + 0.07]} material={mats.doorTrim}>
        <boxGeometry args={[doorW + 0.6, 0.4, 0.06]} />
      </mesh>

      {/* ── Upper storey: curtain wall / ribbon / punched glazing ── */}
      <mesh position={[0, groundH + upperH / 2, W / 2 + 0.01]} castShadow receiveShadow material={upperGlazingMaterial}>
        <boxGeometry args={[L, upperH, 0.1 * FT]} />
      </mesh>
      <mesh position={[0, groundH + upperH / 2, -W / 2 - 0.01]} castShadow receiveShadow material={upperGlazingMaterial}>
        <boxGeometry args={[L, upperH, 0.1 * FT]} />
      </mesh>
      <mesh position={[-L / 2 - 0.01, groundH + upperH / 2, 0]} castShadow receiveShadow material={upperGlazingMaterial}>
        <boxGeometry args={[0.1 * FT, upperH, W]} />
      </mesh>
      <mesh position={[L / 2 + 0.01, groundH + upperH / 2, 0]} castShadow receiveShadow material={upperGlazingMaterial}>
        <boxGeometry args={[0.1 * FT, upperH, W]} />
      </mesh>
      {/* Inner solid box behind the glazing */}
      <mesh position={[0, groundH + upperH / 2, 0]} material={mats.wall}>
        <boxGeometry args={[L - 0.4, upperH - 0.1, W - 0.4]} />
      </mesh>

      {/* ── Floor slab between storeys (visible thin band) ── */}
      <mesh position={[0, groundH + 0.5, 0]} material={mats.wall}>
        <boxGeometry args={[L + 0.5, 1, W + 0.5]} />
      </mesh>

      {/* ── Flat parapet roof + trim line ── */}
      <mesh position={[0, H - 1, 0]} castShadow material={mats.wall}>
        <boxGeometry args={[L + 0.4, 2, W + 0.4]} />
      </mesh>
      {/* Coloured trim band running around the top of the parapet */}
      <mesh position={[0, H + 0.2, 0]} material={mats.trim}>
        <boxGeometry args={[L + 0.6, 0.8, W + 0.6]} />
      </mesh>
    </group>
  )
}
