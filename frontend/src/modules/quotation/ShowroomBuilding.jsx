/**
 * ShowroomBuilding — single-storey commercial with a large glazed front face
 * and masonry side/back walls. Used as a structural reference for AI photoreal
 * rendering. Same `data` prop interface as PEBBuilding / CommercialBuilding.
 */

import { useMemo } from "react"
import * as THREE from "three"

const HEX = (c, fb = "#FFFFFF") => {
  if (!c || typeof c !== "string") return fb
  const v = c.trim()
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : fb
}

let _curtainCache = null
function makeCurtainTexture(tintHex) {
  if (_curtainCache && _curtainCache.tint === tintHex) return _curtainCache.tex
  const w = 256, h = 256
  const c = document.createElement("canvas")
  c.width = w; c.height = h
  const ctx = c.getContext("2d")
  ctx.fillStyle = tintHex
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = "rgba(20,20,28,0.85)"
  for (let i = 1; i < 5; i++) ctx.fillRect((i / 5) * w - 2, 0, 4, h)
  for (let i = 1; i < 3; i++) ctx.fillRect(0, (i / 3) * h - 2, w, 4)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 16
  _curtainCache = { tint: tintHex, tex }
  return tex
}


export default function ShowroomBuilding({ data = {} }) {
  const L = +data.building_length || 60
  const W = +data.building_width  || 40
  const H = +data.full_height     || 22

  const wallColor   = HEX(data.wall_color_hex,   "#FFFFFF")
  const accentColor = HEX(data.accent_color_hex, "#1F4E79")
  const trimColor   = HEX(data.trim_color_hex,   "#2A2D34")

  const mats = useMemo(() => {
    const wall = new THREE.MeshStandardMaterial({
      color: wallColor, roughness: 0.85, metalness: 0.0,
    })
    const trim = new THREE.MeshStandardMaterial({
      color: trimColor, roughness: 0.4, metalness: 0.2,
    })
    const ground = new THREE.MeshStandardMaterial({
      color: "#2a2a2e", roughness: 0.95,
    })
    const curtainTex = makeCurtainTexture(accentColor)
    const curtain = new THREE.MeshStandardMaterial({
      map: curtainTex, color: "#ffffff",
      roughness: 0.18, metalness: 0.6,
    })
    return { wall, trim, ground, curtain }
  }, [wallColor, accentColor, trimColor])

  const tileSize = Math.max(L, W) * 1.6
  const eaveOverhang = 4

  return (
    <group>
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow material={mats.ground}>
        <planeGeometry args={[tileSize, tileSize]} />
      </mesh>

      {/* Front face — full-height curtain wall */}
      <mesh position={[0, H / 2, W / 2 + 0.01]} castShadow receiveShadow material={mats.curtain}>
        <boxGeometry args={[L * 0.95, H * 0.92, 0.1]} />
      </mesh>

      {/* Trim band around the front (header + sill + side jambs) */}
      <mesh position={[0, H * 0.965, W / 2 + 0.05]} material={mats.trim}>
        <boxGeometry args={[L, 0.6, 0.06]} />
      </mesh>
      <mesh position={[0, H * 0.04, W / 2 + 0.05]} material={mats.trim}>
        <boxGeometry args={[L, 0.6, 0.06]} />
      </mesh>

      {/* Side and back walls — masonry */}
      <mesh position={[0, H / 2, -W / 2 - 0.01]} castShadow receiveShadow material={mats.wall}>
        <boxGeometry args={[L, H, 0.2]} />
      </mesh>
      <mesh position={[-L / 2 - 0.01, H / 2, 0]} castShadow receiveShadow material={mats.wall}>
        <boxGeometry args={[0.2, H, W]} />
      </mesh>
      <mesh position={[L / 2 + 0.01, H / 2, 0]} castShadow receiveShadow material={mats.wall}>
        <boxGeometry args={[0.2, H, W]} />
      </mesh>

      {/* Solid interior block (so it's not visually hollow) */}
      <mesh position={[0, H / 2, 0]} material={mats.wall}>
        <boxGeometry args={[L - 0.5, H - 0.2, W - 0.5]} />
      </mesh>

      {/* Flat parapet with overhanging trim */}
      <mesh position={[0, H + 0.5, 0]} material={mats.wall}>
        <boxGeometry args={[L + 0.6, 1, W + 0.6]} />
      </mesh>
      <mesh position={[0, H + 0.5, W / 2 + eaveOverhang / 2]} material={mats.trim}>
        <boxGeometry args={[L + 1, 0.5, eaveOverhang]} />
      </mesh>
    </group>
  )
}
