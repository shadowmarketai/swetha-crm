/**
 * PEBBuilding — Three.js 3D PEB Building (Phase 1: Production Quality)
 *
 * Upgrades over schematic version:
 *  - Real I-section structural members (ExtrudeGeometry from steel profile shape)
 *  - Procedural corrugation normal maps for cladding & roof (no external assets)
 *  - Procedural brick texture for masonry base
 *  - Memoized PBR materials with envMapIntensity for HDRI interaction
 *  - Geometry disposal on unmount/dim change (no memory leaks)
 *  - Base plates at column footings
 *  - Refined mezzanine with deck slab + edge beams + supporting columns
 *  - Roof BufferGeometry now has UV attributes for proper texture mapping
 *  - Optional accessory geometries:
 *      • Turbo ventilator (dome + throat)
 *      • Ridge monitor (raised clerestory)
 *      • Light sheets (translucent panels in roof)
 *      • Louvers (slatted upper-wall panel)
 *      • Rolling shutter (segmented door on end wall)
 *      • Walk doors and windows on perimeter
 *      • EOT crane rail (interior at user-defined height)
 *  - X-Ray mode (translucent cladding to reveal structural steel)
 */

import { useMemo, useEffect, useRef } from "react"
import * as THREE from "three"

/* ═══════════════════════════════════════════
   PROCEDURAL TEXTURES (cached at module level)
   ═══════════════════════════════════════════ */

let _corrugationCanvas = null
function getCorrugationCanvas() {
  if (_corrugationCanvas) return _corrugationCanvas
  // Higher resolution gives crisper rib transitions (was 32x16)
  const w = 128, h = 32
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  const img = ctx.createImageData(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w
      const phase = u * Math.PI * 2
      // Sharper trapezoidal slope with stronger amplitude
      const dx = Math.tanh(Math.cos(phase) * 3.0) * 0.75
      const nz = 1 / Math.sqrt(dx * dx + 1)
      const nx = dx * nz
      const i = (y * w + x) * 4
      img.data[i + 0] = Math.round(128 + nx * 127)
      img.data[i + 1] = 128
      img.data[i + 2] = Math.round(nz * 255)
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  _corrugationCanvas = canvas
  return canvas
}

function makeCorrugationTexture(repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(getCorrugationCanvas())
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeatX, repeatY)
  t.anisotropy = 16     // max — eliminates blur at angled views
  t.magFilter = THREE.LinearFilter
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.generateMipmaps = true
  return t
}

let _brickCanvas = null
function getBrickCanvas() {
  if (_brickCanvas) return _brickCanvas
  const w = 64, h = 32
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  ctx.fillStyle = "#a8978a"
  ctx.fillRect(0, 0, w, h)
  // Mortar
  ctx.strokeStyle = "#6b5e54"
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, 16); ctx.lineTo(w, 16)
  ctx.moveTo(0, 0);  ctx.lineTo(0, 16)
  ctx.moveTo(32, 0); ctx.lineTo(32, 16)
  ctx.moveTo(w, 0);  ctx.lineTo(w, 16)
  ctx.moveTo(0, 16); ctx.lineTo(0, h)
  ctx.moveTo(16, 16); ctx.lineTo(16, h)
  ctx.moveTo(48, 16); ctx.lineTo(48, h)
  ctx.moveTo(w, 16); ctx.lineTo(w, h)
  ctx.stroke()
  // Variation noise
  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`
    ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3)
  }
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`
    ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2)
  }
  _brickCanvas = canvas
  return canvas
}

function makeBrickTexture(repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(getBrickCanvas())
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeatX, repeatY)
  t.anisotropy = 16
  t.magFilter = THREE.LinearFilter
  t.minFilter = THREE.LinearMipmapLinearFilter
  return t
}

let _concreteCanvas = null
function getConcreteCanvas() {
  if (_concreteCanvas) return _concreteCanvas
  const w = 128, h = 128
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  ctx.fillStyle = "#b8b8b3"
  ctx.fillRect(0, 0, w, h)
  // Multi-pass speckle for richer texture
  for (let i = 0; i < 600; i++) {
    ctx.fillStyle = `rgba(${100 + Math.random() * 80}, ${100 + Math.random() * 80}, ${100 + Math.random() * 80}, ${Math.random() * 0.35})`
    ctx.fillRect(Math.random() * w, Math.random() * h, 1.5 + Math.random() * 2.5, 1.5 + Math.random() * 2.5)
  }
  for (let i = 0; i < 100; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.15})`
    ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1)
  }
  _concreteCanvas = canvas
  return canvas
}

function makeConcreteTexture(repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(getConcreteCanvas())
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeatX, repeatY)
  t.anisotropy = 16
  t.magFilter = THREE.LinearFilter
  t.minFilter = THREE.LinearMipmapLinearFilter
  return t
}

/* ═══════════════════════════════════════════
   I-SECTION SHAPE & STRUCTURAL PRIMITIVES
   ═══════════════════════════════════════════ */

function createISection({ depth, flange, tw, tf }) {
  const s = new THREE.Shape()
  const d2 = depth / 2, f2 = flange / 2, w2 = tw / 2
  s.moveTo(-f2, -d2)
  s.lineTo(f2, -d2)
  s.lineTo(f2, -d2 + tf)
  s.lineTo(w2, -d2 + tf)
  s.lineTo(w2, d2 - tf)
  s.lineTo(f2, d2 - tf)
  s.lineTo(f2, d2)
  s.lineTo(-f2, d2)
  s.lineTo(-f2, d2 - tf)
  s.lineTo(-w2, d2 - tf)
  s.lineTo(-w2, -d2 + tf)
  s.lineTo(-f2, -d2 + tf)
  s.lineTo(-f2, -d2)
  return s
}

const PROFILES = {
  column: { depth: 0.85, flange: 0.45, tw: 0.10, tf: 0.14 },
  rafter: { depth: 0.70, flange: 0.40, tw: 0.08, tf: 0.12 },
  ridge:  { depth: 0.55, flange: 0.30, tw: 0.07, tf: 0.10 },
  eave:   { depth: 0.40, flange: 0.25, tw: 0.06, tf: 0.09 },
  purlin: { depth: 0.45, flange: 0.22, tw: 0.05, tf: 0.08 },
  craneb: { depth: 0.65, flange: 0.35, tw: 0.08, tf: 0.12 },
}

/**
 * IBeam — extruded I-section between two 3D points.
 * up: world axis the I-beam's "depth" (web direction) should align with.
 */
function IBeam({
  start, end, profile = "column",
  color = "#dc2626", metalness = 0.85, roughness = 0.32,
  up = [0, 0, 1], name,
}) {
  const startKey = start.join(",")
  const endKey = end.join(",")
  const upKey = up.join(",")

  const length = useMemo(
    () => Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [startKey, endKey]
  )

  const geometry = useMemo(() => {
    const p = PROFILES[profile] || PROFILES.column
    const shape = createISection(p)
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: length, bevelEnabled: false, steps: 1,
    })
    geo.computeVertexNormals()
    return geo
  }, [length, profile])

  useEffect(() => () => geometry.dispose(), [geometry])

  const rotation = useMemo(() => {
    const dx = end[0] - start[0], dy = end[1] - start[1], dz = end[2] - start[2]
    const newZ = new THREE.Vector3(dx, dy, dz)
    if (newZ.lengthSq() < 1e-8) return [0, 0, 0]
    newZ.normalize()
    let newY = new THREE.Vector3(...up)
    newY.sub(newZ.clone().multiplyScalar(newY.dot(newZ)))
    if (newY.lengthSq() < 1e-4) {
      newY.set(0, 1, 0).sub(newZ.clone().multiplyScalar(newZ.y))
      if (newY.lengthSq() < 1e-4) newY.set(1, 0, 0).sub(newZ.clone().multiplyScalar(newZ.x))
    }
    newY.normalize()
    const newX = new THREE.Vector3().crossVectors(newY, newZ).normalize()
    const m = new THREE.Matrix4().makeBasis(newX, newY, newZ)
    const e = new THREE.Euler().setFromRotationMatrix(m)
    return [e.x, e.y, e.z]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startKey, endKey, upKey])

  const displayName = name || (profile.charAt(0).toUpperCase() + profile.slice(1))

  return (
    <mesh
      position={start} rotation={rotation}
      castShadow receiveShadow geometry={geometry}
      userData={{ name: displayName }}
    >
      <meshStandardMaterial
        color={color}
        metalness={metalness}
        roughness={roughness}
        envMapIntensity={1.1}
      />
    </mesh>
  )
}

/** Cylindrical thin member (sag rods, X-bracing rods, downspouts) */
function Rod({ start, end, radius = 0.05, color = "#94a3b8", metalness = 0.7, roughness = 0.4 }) {
  const startKey = start.join(",")
  const endKey = end.join(",")
  const mid = useMemo(
    () => [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [startKey, endKey]
  )
  const length = useMemo(
    () => Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [startKey, endKey]
  )
  const rotation = useMemo(() => {
    const dir = new THREE.Vector3(end[0] - start[0], end[1] - start[1], end[2] - start[2]).normalize()
    const up = new THREE.Vector3(0, 1, 0)
    const quat = new THREE.Quaternion().setFromUnitVectors(up, dir)
    const e = new THREE.Euler().setFromQuaternion(quat)
    return [e.x, e.y, e.z]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startKey, endKey])
  return (
    <mesh position={mid} rotation={rotation} castShadow>
      <cylinderGeometry args={[radius, radius, length, 10]} />
      <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
    </mesh>
  )
}

/* ═══════════════════════════════════════════
   STRUCTURAL DETAILS (Phase 2)
   ═══════════════════════════════════════════ */

/**
 * Haunch — triangular knee-brace gusset at column-rafter joint.
 * Visually: thickening of section where bending moment peaks.
 */
function Haunch({ x, z, H, ridgeH, W, color = "#cf6f1a", size = 3.2, thickness = 0.5 }) {
  const sgn = z > 0 ? 1 : -1
  const slope = Math.max((ridgeH - H) / (W / 2), 0.001)
  const angle = Math.atan(slope)

  const geometry = useMemo(() => {
    // Triangle vertices (front face = +X side):
    //  A: corner at (x, H, z)
    //  B: down the column by `size`
    //  C: along the rafter direction by `size`
    const ax = thickness / 2
    const Ay = H,                     Az = z
    const By = H - size,              Bz = z
    const Cy = H + size * Math.sin(angle)
    const Cz = z - sgn * size * Math.cos(angle)

    const v = [
      // Front face (+X)
      x + ax, Ay, Az,    // 0
      x + ax, By, Bz,    // 1
      x + ax, Cy, Cz,    // 2
      // Back face (-X)
      x - ax, Ay, Az,    // 3
      x - ax, By, Bz,    // 4
      x - ax, Cy, Cz,    // 5
    ]
    const idx = [
      0, 1, 2,           // front
      3, 5, 4,           // back (reversed)
      0, 3, 4, 0, 4, 1,  // edge A-B
      1, 4, 5, 1, 5, 2,  // edge B-C
      2, 5, 3, 2, 3, 0,  // edge C-A
    ]

    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(v), 3))
    geo.setIndex(new THREE.BufferAttribute(new Uint16Array(idx), 1))
    geo.computeVertexNormals()
    return geo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x, z, H, ridgeH, W, size, thickness])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={color} metalness={0.85} roughness={0.32} envMapIntensity={1.1} />
    </mesh>
  )
}

/**
 * SplicePlate — web splice connection plate with bolt heads.
 * Used at rafter midspan to join two fabricated rafter halves.
 */
function SplicePlate({ start, end, depth = 0.85, color = "#2d3748" }) {
  const startKey = start.join(",")
  const endKey = end.join(",")

  const mid = useMemo(
    () => [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [startKey, endKey]
  )

  const rotation = useMemo(() => {
    const dx = end[0] - start[0], dy = end[1] - start[1], dz = end[2] - start[2]
    const newZ = new THREE.Vector3(dx, dy, dz)
    if (newZ.lengthSq() < 1e-8) return [0, 0, 0]
    newZ.normalize()
    let newY = new THREE.Vector3(0, 0, 1)
    newY.sub(newZ.clone().multiplyScalar(newY.dot(newZ)))
    if (newY.lengthSq() < 1e-4) {
      newY.set(0, 1, 0).sub(newZ.clone().multiplyScalar(newZ.y))
    }
    newY.normalize()
    const newX = new THREE.Vector3().crossVectors(newY, newZ).normalize()
    const m = new THREE.Matrix4().makeBasis(newX, newY, newZ)
    const e = new THREE.Euler().setFromRotationMatrix(m)
    return [e.x, e.y, e.z]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startKey, endKey])

  const plateH = depth * 0.85
  const plateL = 1.6
  const plateT = 0.04

  return (
    <group position={mid} rotation={rotation}>
      {/* Plate +X side */}
      <mesh position={[plateT * 1.5, 0, 0]} castShadow>
        <boxGeometry args={[plateT, plateH, plateL]} />
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.45} />
      </mesh>
      {/* Plate -X side */}
      <mesh position={[-plateT * 1.5, 0, 0]} castShadow>
        <boxGeometry args={[plateT, plateH, plateL]} />
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.45} />
      </mesh>
      {/* Bolt heads on +X face (4 columns × 2 rows) */}
      {[-0.6, -0.25, 0.25, 0.6].flatMap(bz =>
        [-plateH * 0.32, plateH * 0.32].map(by => (
          <mesh key={`bolt-${bz}-${by}`} position={[plateT * 2.1, by, bz]}>
            <sphereGeometry args={[0.06, 8, 6]} />
            <meshStandardMaterial color="#0f0f0f" metalness={0.85} roughness={0.4} />
          </mesh>
        ))
      )}
    </group>
  )
}

/**
 * RidgePlate — apex connection between two opposing rafters.
 */
function RidgePlate({ x, ridgeH, color = "#2d3748" }) {
  return (
    <group position={[x, ridgeH - 0.45, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.05, 0.9, 1.6]} />
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.45} />
      </mesh>
      {/* Bolts row */}
      {[-0.6, -0.2, 0.2, 0.6].map((bz, i) => (
        <mesh key={i} position={[0.04, 0, bz]}>
          <sphereGeometry args={[0.06, 8, 6]} />
          <meshStandardMaterial color="#0f0f0f" metalness={0.85} roughness={0.4} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * PurlinCleats — small angle/Z brackets at every purlin-rafter intersection.
 * Uses InstancedMesh — one draw call for N×M cleats.
 */
function PurlinCleats({ frames, purlinZs, roofType, gableRise, W, H }) {
  const meshRef = useRef()
  const count = frames.length * purlinZs.length

  useEffect(() => {
    if (!meshRef.current || count === 0) return
    const tmp = new THREE.Object3D()
    let i = 0
    frames.forEach(x => {
      purlinZs.forEach(z => {
        const y = roofType === "gable"
          ? H + gableRise * (1 - Math.abs(z) / (W / 2))
          : H + gableRise * ((z + W / 2) / W)
        tmp.position.set(x, y - 0.05, z)
        tmp.rotation.set(0, 0, 0)
        tmp.scale.set(1, 1, 1)
        tmp.updateMatrix()
        meshRef.current.setMatrixAt(i++, tmp.matrix)
      })
    })
    meshRef.current.instanceMatrix.needsUpdate = true
    meshRef.current.computeBoundingSphere?.()
  }, [frames, purlinZs, roofType, gableRise, W, H, count])

  if (count === 0) return null

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} castShadow receiveShadow>
      <boxGeometry args={[0.12, 0.22, 0.55]} />
      <meshStandardMaterial color="#3a3a3a" metalness={0.7} roughness={0.45} />
    </instancedMesh>
  )
}

/**
 * InstancedAnchorBolts — replaces individual bolt cylinders at every column base.
 */
function InstancedAnchorBolts({ frames, W }) {
  const meshRef = useRef()
  // 4 bolts per column × 2 columns per frame
  const count = frames.length * 2 * 4

  useEffect(() => {
    if (!meshRef.current || count === 0) return
    const tmp = new THREE.Object3D()
    let i = 0
    frames.forEach(x => {
      [-W / 2, W / 2].forEach(z => {
        [[-0.4, -0.3], [0.4, -0.3], [-0.4, 0.3], [0.4, 0.3]].forEach(([bx, bz]) => {
          tmp.position.set(x + bx, 1.32, z + bz)
          tmp.rotation.set(0, 0, 0)
          tmp.updateMatrix()
          meshRef.current.setMatrixAt(i++, tmp.matrix)
        })
      })
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  }, [frames, W, count])

  if (count === 0) return null

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} castShadow>
      <cylinderGeometry args={[0.05, 0.05, 0.18, 8]} />
      <meshStandardMaterial color="#1a1a1a" metalness={0.85} roughness={0.4} />
    </instancedMesh>
  )
}

/**
 * FoundationSystem — concrete pedestals + perimeter plinth beam + (X-ray) footings.
 */
function FoundationSystem({ frames, L, W, xRayMode, concreteTex }) {
  const PLINTH_H = 0.55
  const PED_H = 1.2
  const PED_W = 1.65
  const FTG_H = 1.6
  const FTG_W = 4.2

  return (
    <group>
      {/* Plinth beams (perimeter, RCC) */}
      <mesh position={[0, PLINTH_H / 2, -W / 2]} receiveShadow castShadow>
        <boxGeometry args={[L + 0.4, PLINTH_H, 0.65]} />
        <meshStandardMaterial map={concreteTex} color="#a8a8a3" roughness={0.85} metalness={0.05} />
      </mesh>
      <mesh position={[0, PLINTH_H / 2, W / 2]} receiveShadow castShadow>
        <boxGeometry args={[L + 0.4, PLINTH_H, 0.65]} />
        <meshStandardMaterial map={concreteTex} color="#a8a8a3" roughness={0.85} metalness={0.05} />
      </mesh>
      <mesh position={[L / 2, PLINTH_H / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[0.65, PLINTH_H, W + 0.4]} />
        <meshStandardMaterial map={concreteTex} color="#a8a8a3" roughness={0.85} metalness={0.05} />
      </mesh>
      <mesh position={[-L / 2, PLINTH_H / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[0.65, PLINTH_H, W + 0.4]} />
        <meshStandardMaterial map={concreteTex} color="#a8a8a3" roughness={0.85} metalness={0.05} />
      </mesh>

      {/* Pedestals at each column (taller, lighter concrete) */}
      {frames.flatMap((x, fi) =>
        [-W / 2, W / 2].map((z, si) => (
          <mesh key={`ped-${fi}-${si}`} position={[x, PED_H / 2, z]} castShadow receiveShadow>
            <boxGeometry args={[PED_W, PED_H, PED_W]} />
            <meshStandardMaterial map={concreteTex} color="#b8b8b3" roughness={0.85} metalness={0.05} />
          </mesh>
        ))
      )}

      {/* Underground footings (X-ray only) */}
      {xRayMode && frames.flatMap((x, fi) =>
        [-W / 2, W / 2].map((z, si) => (
          <group key={`ftg-${fi}-${si}`}>
            {/* Footing pad */}
            <mesh position={[x, -FTG_H / 2 - 0.05, z]} receiveShadow>
              <boxGeometry args={[FTG_W, FTG_H, FTG_W]} />
              <meshStandardMaterial
                color="#a8a8a3"
                roughness={0.9}
                metalness={0.05}
                transparent
                opacity={0.5}
                depthWrite={false}
              />
            </mesh>
            {/* Rebar suggestion (top mat) */}
            <mesh position={[x, -0.25, z]}>
              <boxGeometry args={[FTG_W * 0.85, 0.04, FTG_W * 0.85]} />
              <meshStandardMaterial
                color="#cc4444" roughness={0.6} metalness={0.3}
                transparent opacity={0.55} depthWrite={false}
              />
            </mesh>
            {/* Rebar bottom mat */}
            <mesh position={[x, -FTG_H + 0.15, z]}>
              <boxGeometry args={[FTG_W * 0.85, 0.04, FTG_W * 0.85]} />
              <meshStandardMaterial
                color="#cc4444" roughness={0.6} metalness={0.3}
                transparent opacity={0.55} depthWrite={false}
              />
            </mesh>
            {/* PCC layer below footing (lean concrete) */}
            <mesh position={[x, -FTG_H - 0.15, z]} receiveShadow>
              <boxGeometry args={[FTG_W + 0.3, 0.18, FTG_W + 0.3]} />
              <meshStandardMaterial
                color="#76766f" roughness={0.92} metalness={0.04}
                transparent opacity={0.45} depthWrite={false}
              />
            </mesh>
          </group>
        ))
      )}
    </group>
  )
}


/* ═══════════════════════════════════════════
   PORTAL FRAME (column + rafter + base plates)
   ═══════════════════════════════════════════ */

function PortalFrame({ x, W, H, ridgeH, roofType }) {
  const COL = "#c2380e"      // weathered red oxide steel
  const RAF = "#cf6f1a"      // amber-orange rafter
  const colRaf = PROFILES.rafter

  return (
    <group>
      {/* Columns (start at y=0.2, atop concrete plinth conceptually) */}
      <IBeam start={[x, 0.2, -W / 2]} end={[x, H, -W / 2]} profile="column" color={COL} />
      <IBeam start={[x, 0.2, W / 2]} end={[x, H, W / 2]} profile="column" color={COL} />

      {/* Rafters */}
      {roofType === "gable" ? (
        <>
          <IBeam start={[x, H, -W / 2]} end={[x, ridgeH, 0]} profile="rafter" color={RAF} />
          <IBeam start={[x, H, W / 2]} end={[x, ridgeH, 0]} profile="rafter" color={RAF} />
        </>
      ) : (
        <IBeam start={[x, H, -W / 2]} end={[x, ridgeH, W / 2]} profile="rafter" color={RAF} />
      )}

      {/* Knee-brace haunches at column-rafter joints */}
      <Haunch x={x} z={-W / 2} H={H} ridgeH={ridgeH} W={W} color={RAF} size={Math.min(3.5, W * 0.06)} />
      <Haunch x={x} z={W / 2} H={H} ridgeH={ridgeH} W={W} color={RAF} size={Math.min(3.5, W * 0.06)} />

      {/* Splice plates at rafter midspan */}
      {roofType === "gable" ? (
        <>
          <SplicePlate
            start={[x, H, -W / 2]} end={[x, ridgeH, 0]}
            depth={colRaf.depth}
          />
          <SplicePlate
            start={[x, H, W / 2]} end={[x, ridgeH, 0]}
            depth={colRaf.depth}
          />
        </>
      ) : (
        <SplicePlate
          start={[x, H, -W / 2]} end={[x, ridgeH, W / 2]}
          depth={colRaf.depth}
        />
      )}

      {/* Ridge plate (gable only) */}
      {roofType === "gable" && <RidgePlate x={x} ridgeH={ridgeH} />}
    </group>
  )
}

/* ═══════════════════════════════════════════
   MAIN BUILDING COMPONENT
   ═══════════════════════════════════════════ */

const DEFAULT_LAYERS = {
  foundation: true, structure: true, envelope: true,
  accessories: true, mezzanine: true, fixtures: true,
}

export default function PEBBuilding({ data, layers: layersProp }) {
  const layers = { ...DEFAULT_LAYERS, ...(layersProp || {}) }
  const L = +data.building_length
  const W = +data.building_width
  const H = +data.full_height
  const Hw = +data.wall_height
  const roofType = data.roof_type
  const hasMezz = data.mezzanine_required
  const mL = +data.mezz_length || 0
  const mW = +data.mezz_width || 0

  // Optional accessories (default to false unless user enables in viewer)
  const showTurboVent = !!data.turbo_vent
  const showRidgeMonitor = !!data.ridge_monitor
  const showLightSheets = !!data.light_sheets
  const showLouvers = !!data.louvers
  const showShutter = data.shutter_in_section !== false
  const showCrane = !!data.crane_required
  const craneH = Math.min(Hw - 3, +data.crane_height || Hw * 0.6)
  const xRayMode = data.x_ray_mode !== undefined ? !!data.x_ray_mode : true

  // Geometry — H = ridge level (user "Full Height"), Hw = eave level (user "Wall Height")
  // gableRise = computed from user-set difference. Floor at 0.5 to avoid degenerate rise.
  const gableRise = Math.max(H - Hw, 0.5)
  const ridgeH = H              // ridge sits at user-set full_height
  const masonryH = Math.min(Hw * 0.25, 5)
  // Cladding spans from top of masonry to eave (Hw)
  const cladHeight = Math.max(Hw - masonryH, 0.5)
  const cladCenterY = (masonryH + Hw) / 2

  /* ── Roof / Cladding Colors (Industrial PEB scheme: teal accent + white) ── */
  const roofIsPuf = (data.roof_sheet_type || "").includes("puf")
  const cladIsPuf = (data.side_cladding_type || "").includes("puf")
  // Color overrides via data (allow per-quote customization)
  const roofColor = data.roof_color || (roofIsPuf ? "#0e7490" : "#0d9488")
  const cladColorTeal = data.clad_color_primary || (cladIsPuf ? "#0e7490" : "#0d9488")
  const cladColorWhite = data.clad_color_secondary || "#f0f0ec"
  const cladColor = cladColorTeal       // alias for legacy refs
  const wallColor = "#f5f5f0"           // white dwarf-wall
  const eaveTrimColor = "#0f766e"       // darker teal trim
  const trimAccentColor = "#0d9488"     // teal accent band

  /* ── Frame Spacing ── */
  const frameSpacing = Math.min(25, L / 4)
  const frameCount = Math.max(2, Math.ceil(L / frameSpacing) + 1)
  const frames = useMemo(() => {
    const arr = []
    for (let i = 0; i < frameCount; i++) {
      arr.push(-L / 2 + i * (L / (frameCount - 1)))
    }
    return arr
  }, [L, frameCount])

  /* ── Purlin Positions (along Z, on roof) ── */
  const purlinSpacingZ = 5
  const purlinCount = Math.max(2, Math.ceil(W / purlinSpacingZ))

  /* ── Procedural Textures ── */
  const cladRibsPerFt = 2.0  // visible rib every 0.5 ft
  const longCladTex = useMemo(() => makeCorrugationTexture(L * cladRibsPerFt, 1), [L])
  const shortCladTex = useMemo(() => makeCorrugationTexture(W * cladRibsPerFt, 1), [W])
  const gableCladTex = useMemo(() => makeCorrugationTexture(W * cladRibsPerFt, 0.6), [W])
  const roofTex = useMemo(() => makeCorrugationTexture(L * cladRibsPerFt, 1), [L])

  const brickTexLong = useMemo(() => makeBrickTexture(L / 4, masonryH / 2), [L, masonryH])
  const brickTexShort = useMemo(() => makeBrickTexture(W / 4, masonryH / 2), [W, masonryH])

  const concreteTex = useMemo(() => makeConcreteTexture(8, 8), [])

  /* ── Texture Disposal ── */
  useEffect(() => () => {
    [longCladTex, shortCladTex, gableCladTex, roofTex, brickTexLong, brickTexShort, concreteTex]
      .forEach(t => t?.dispose?.())
  }, [longCladTex, shortCladTex, gableCladTex, roofTex, brickTexLong, brickTexShort, concreteTex])

  /* ── Roof Panels (BufferGeometry with UVs) ── */
  const roofPanels = useMemo(() => {
    // Reduced overhangs: gable ends flush (just trim), modest eave overhang for gutters
    const ovL = 0.3, ovW = 0.6
    const buildPanel = (verts, uvs) => {
      const geo = new THREE.BufferGeometry()
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3))
      geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvs), 2))
      geo.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 1, 3, 2]), 1))
      geo.computeVertexNormals()
      return geo
    }

    if (roofType === "gable") {
      // Left panel (eave -W/2 → ridge 0). Eave at Hw, ridge at H.
      const left = buildPanel(
        [
          -(L / 2 + ovL), Hw, -(W / 2 + ovW),
          (L / 2 + ovL), Hw, -(W / 2 + ovW),
          -(L / 2 + ovL), ridgeH, 0,
          (L / 2 + ovL), ridgeH, 0,
        ],
        [0, 0, 1, 0, 0, 1, 1, 1]
      )
      const right = buildPanel(
        [
          -(L / 2 + ovL), ridgeH, 0,
          (L / 2 + ovL), ridgeH, 0,
          -(L / 2 + ovL), Hw, (W / 2 + ovW),
          (L / 2 + ovL), Hw, (W / 2 + ovW),
        ],
        [0, 1, 1, 1, 0, 0, 1, 0]
      )
      return [left, right]
    } else {
      const single = buildPanel(
        [
          -(L / 2 + ovL), Hw, -(W / 2 + ovW),
          (L / 2 + ovL), Hw, -(W / 2 + ovW),
          -(L / 2 + ovL), ridgeH, (W / 2 + ovW),
          (L / 2 + ovL), ridgeH, (W / 2 + ovW),
        ],
        [0, 0, 1, 0, 0, 1, 1, 1]
      )
      return [single]
    }
  }, [L, W, Hw, ridgeH, roofType])

  /* ── Cleanup roof geometries on change ── */
  useEffect(() => () => roofPanels.forEach(g => g.dispose()), [roofPanels])

  /* ── Gable End Triangles (with UVs) ── Base at eave (Hw), apex at ridge */
  const gableGeometries = useMemo(() => {
    if (roofType !== "gable") return []
    const buildGable = () => {
      const geo = new THREE.BufferGeometry()
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([
        0, Hw, -W / 2,
        0, Hw, W / 2,
        0, ridgeH, 0,
      ]), 3))
      geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([
        0, 0, 1, 0, 0.5, 1,
      ]), 2))
      geo.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2]), 1))
      geo.computeVertexNormals()
      return geo
    }
    return [buildGable(), buildGable()]
  }, [W, Hw, ridgeH, roofType])

  useEffect(() => () => gableGeometries.forEach(g => g?.dispose?.()), [gableGeometries])

  /* ── Material Memos ── */
  const cladOpacity = xRayMode ? 0.55 : 1
  const cladMaterialProps = {
    metalness: cladIsPuf ? 0.45 : 0.75,
    roughness: cladIsPuf ? 0.45 : 0.32,
    transparent: xRayMode,
    opacity: cladOpacity,
    side: THREE.DoubleSide,
    envMapIntensity: 1.0,
  }

  const roofMaterialProps = {
    metalness: roofIsPuf ? 0.4 : 0.78,
    roughness: roofIsPuf ? 0.5 : 0.28,
    transparent: xRayMode,
    opacity: xRayMode ? 0.65 : 1,
    side: THREE.DoubleSide,
    envMapIntensity: 1.0,
  }

  return (
    <group>
      {/* ───────── GROUND PLANE ───────── */}
      <mesh position={[0, -0.05, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[Math.max(L, W) * 4, Math.max(L, W) * 4, 1, 1]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.95} metalness={0} />
      </mesh>
      {/* ═══════════════ FOUNDATION LAYER ═══════════════ */}
      <group visible={layers.foundation}>
        {/* Concrete apron around building */}
        <mesh position={[0, 0.0, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]} userData={{ name: "Concrete Apron" }}>
          <planeGeometry args={[L + 16, W + 16]} />
          <meshStandardMaterial map={concreteTex} color="#9b9b95" roughness={0.85} metalness={0.05} />
        </mesh>
        {/* Building floor slab (sits atop plinth beam top) */}
        <mesh position={[0, 0.6, 0]} receiveShadow userData={{ name: "Floor Slab" }}>
          <boxGeometry args={[L - 0.5, 0.1, W - 0.5]} />
          <meshStandardMaterial color="#cdcdc6" roughness={0.7} metalness={0.05} />
        </mesh>

        {/* FOUNDATION SYSTEM (Phase 2) */}
        <FoundationSystem
          frames={frames} L={L} W={W}
          xRayMode={xRayMode}
          concreteTex={concreteTex}
        />

        {/* Base plates atop pedestals (steel) */}
        {frames.flatMap((x, fi) =>
          [-W / 2, W / 2].map((z, si) => (
            <mesh
              key={`bp-${fi}-${si}`}
              position={[x, 1.27, z]} castShadow receiveShadow
              userData={{ name: "Base Plate" }}
            >
              <boxGeometry args={[1.4, 0.08, 1.2]} />
              <meshStandardMaterial color="#3a3a3a" metalness={0.7} roughness={0.45} />
            </mesh>
          ))
        )}

        {/* Anchor bolts (instanced, all 4-per-base in a single draw call) */}
        <InstancedAnchorBolts frames={frames} W={W} />
      </group>

      {/* ═══════════════ ENVELOPE LAYER ═══════════════ */}
      <group visible={layers.envelope}>

      {/* ───────── MASONRY BASE WALLS (0 → masonryH) ───────── */}
      {/* Long sides */}
      <mesh position={[0, masonryH / 2, -W / 2]} castShadow receiveShadow>
        <boxGeometry args={[L, masonryH, 0.45]} />
        <meshStandardMaterial map={brickTexLong} color={wallColor} roughness={0.85} metalness={0.05} />
      </mesh>
      <mesh position={[0, masonryH / 2, W / 2]} castShadow receiveShadow>
        <boxGeometry args={[L, masonryH, 0.45]} />
        <meshStandardMaterial map={brickTexLong} color={wallColor} roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Short sides */}
      <mesh position={[L / 2, masonryH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.45, masonryH, W]} />
        <meshStandardMaterial map={brickTexShort} color={wallColor} roughness={0.85} metalness={0.05} />
      </mesh>
      <mesh position={[-L / 2, masonryH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.45, masonryH, W]} />
        <meshStandardMaterial map={brickTexShort} color={wallColor} roughness={0.85} metalness={0.05} />
      </mesh>

      {/* ───────── SIDE CLADDING (alternating teal+white panels, matching ref) ───────── */}
      {(() => {
        // Long-side cladding (along ±W/2)
        const numPanels = Math.max(4, Math.round(L / 11))
        const panelW = (L + 0.3) / numPanels
        return [-W / 2 - 0.05, W / 2 + 0.05].map((zPos, side) =>
          Array.from({ length: numPanels }).map((_, i) => {
            const xCenter = -L / 2 - 0.15 + panelW * (i + 0.5)
            const isTeal = i % 2 === 0
            return (
              <mesh
                key={`clad-long-${side}-${i}`}
                position={[xCenter, cladCenterY, zPos]}
                castShadow receiveShadow
                userData={{ name: isTeal ? "Cladding (Teal)" : "Cladding (White)" }}
              >
                <boxGeometry args={[panelW * 0.99, cladHeight, 0.16]} />
                <meshStandardMaterial
                  color={isTeal ? cladColorTeal : cladColorWhite}
                  normalMap={isTeal ? longCladTex : null}
                  metalness={isTeal ? 0.5 : 0.18}
                  roughness={isTeal ? 0.38 : 0.62}
                  transparent={xRayMode}
                  opacity={xRayMode ? cladOpacity : 1}
                  side={THREE.DoubleSide}
                  envMapIntensity={1.0}
                />
              </mesh>
            )
          })
        )
      })()}

      {/* End-side cladding (short walls ±L/2) — alternating panels along Z */}
      {(() => {
        const numPanels = Math.max(3, Math.round(W / 11))
        const panelW = (W + 0.3) / numPanels
        return [L / 2 + 0.05, -L / 2 - 0.05].map((xPos, side) =>
          Array.from({ length: numPanels }).map((_, i) => {
            const zCenter = -W / 2 - 0.15 + panelW * (i + 0.5)
            const isTeal = i % 2 === 0
            return (
              <mesh
                key={`clad-end-${side}-${i}`}
                position={[xPos, cladCenterY, zCenter]}
                castShadow receiveShadow
                userData={{ name: isTeal ? "End Clad (Teal)" : "End Clad (White)" }}
              >
                <boxGeometry args={[0.16, cladHeight, panelW * 0.99]} />
                <meshStandardMaterial
                  color={isTeal ? cladColorTeal : cladColorWhite}
                  normalMap={isTeal ? shortCladTex : null}
                  metalness={isTeal ? 0.5 : 0.18}
                  roughness={isTeal ? 0.38 : 0.62}
                  transparent={xRayMode}
                  opacity={xRayMode ? cladOpacity : 1}
                  side={THREE.DoubleSide}
                  envMapIntensity={1.0}
                />
              </mesh>
            )
          })
        )
      })()}

      {/* Horizontal trim band — teal strip just below eave (top of cladding) */}
      <mesh position={[0, Hw - 0.4, -W / 2 - 0.06]}>
        <boxGeometry args={[L + 0.5, 0.5, 0.22]} />
        <meshStandardMaterial color={trimAccentColor} metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[0, Hw - 0.4, W / 2 + 0.06]}>
        <boxGeometry args={[L + 0.5, 0.5, 0.22]} />
        <meshStandardMaterial color={trimAccentColor} metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[L / 2 + 0.06, Hw - 0.4, 0]}>
        <boxGeometry args={[0.22, 0.5, W + 0.5]} />
        <meshStandardMaterial color={trimAccentColor} metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[-L / 2 - 0.06, Hw - 0.4, 0]}>
        <boxGeometry args={[0.22, 0.5, W + 0.5]} />
        <meshStandardMaterial color={trimAccentColor} metalness={0.55} roughness={0.35} />
      </mesh>

      {/* Horizontal trim band — teal strip just above masonry (bottom of cladding) */}
      <mesh position={[0, masonryH + 0.25, -W / 2 - 0.06]}>
        <boxGeometry args={[L + 0.4, 0.4, 0.22]} />
        <meshStandardMaterial color={trimAccentColor} metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[0, masonryH + 0.25, W / 2 + 0.06]}>
        <boxGeometry args={[L + 0.4, 0.4, 0.22]} />
        <meshStandardMaterial color={trimAccentColor} metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[L / 2 + 0.06, masonryH + 0.25, 0]}>
        <boxGeometry args={[0.22, 0.4, W + 0.4]} />
        <meshStandardMaterial color={trimAccentColor} metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[-L / 2 - 0.06, masonryH + 0.25, 0]}>
        <boxGeometry args={[0.22, 0.4, W + 0.4]} />
        <meshStandardMaterial color={trimAccentColor} metalness={0.55} roughness={0.35} />
      </mesh>

      {/* ───────── EAVE TRIM (decorative metal trim) ───────── */}
      {[-W / 2, W / 2].map((z, i) => (
        <mesh key={`eaveh-${i}`} position={[0, Hw, z]} castShadow>
          <boxGeometry args={[L + 0.6, 0.35, 0.32]} />
          <meshStandardMaterial color={eaveTrimColor} metalness={0.7} roughness={0.25} envMapIntensity={1.2} />
        </mesh>
      ))}
      {[-L / 2, L / 2].map((x, i) => (
        <mesh key={`eavev-${i}`} position={[x, Hw, 0]}>
          <boxGeometry args={[0.32, 0.35, W + 0.6]} />
          <meshStandardMaterial color={eaveTrimColor} metalness={0.7} roughness={0.25} envMapIntensity={1.2} />
        </mesh>
      ))}

      {/* ───────── GABLE END TRIANGLES ───────── */}
      {roofType === "gable" && gableGeometries.map((geo, i) => (
        <mesh key={`gable-${i}`} position={[i === 0 ? L / 2 : -L / 2, 0, 0]} castShadow geometry={geo}>
          <meshStandardMaterial color={cladColor} normalMap={gableCladTex} {...cladMaterialProps} />
        </mesh>
      ))}

      {/* ───────── EAVE TRIM AT TOP (at eave level Hw) ───────── */}
      <mesh position={[0, Hw, -W / 2]}>
        <boxGeometry args={[L + 0.6, 0.25, 0.18]} />
        <meshStandardMaterial color={eaveTrimColor} metalness={0.7} roughness={0.25} />
      </mesh>
      <mesh position={[0, Hw, W / 2]}>
        <boxGeometry args={[L + 0.6, 0.25, 0.18]} />
        <meshStandardMaterial color={eaveTrimColor} metalness={0.7} roughness={0.25} />
      </mesh>

      {/* ───────── GUTTERS (along long eaves) ───────── */}
      {[-W / 2 - 0.45, W / 2 + 0.45].map((z, i) => (
        <mesh key={`gutter-${i}`} position={[0, Hw + 0.15, z]} castShadow userData={{ name: "Gutter" }}>
          <boxGeometry args={[L + 1.5, 0.35, 0.32]} />
          <meshStandardMaterial color="#dddddd" metalness={0.7} roughness={0.4} />
        </mesh>
      ))}

      {/* ───────── DOWNTAKE PIPES (corners, descending from gutter to ground) ───────── */}
      {[
        [L / 2 - 0.4, W / 2 + 0.7],
        [-L / 2 + 0.4, W / 2 + 0.7],
        [L / 2 - 0.4, -W / 2 - 0.7],
        [-L / 2 + 0.4, -W / 2 - 0.7],
      ].map(([x, z], i) => (
        <mesh key={`dpipe-${i}`} position={[x, Hw / 2, z]} castShadow userData={{ name: "Downspout" }}>
          <cylinderGeometry args={[0.12, 0.12, Hw, 8]} />
          <meshStandardMaterial color="#888888" metalness={0.6} roughness={0.45} />
        </mesh>
      ))}

      {/* ───────── ROOF PANELS ───────── */}
      {roofPanels.map((geo, i) => (
        <mesh key={`roof-${i}`} geometry={geo} castShadow receiveShadow userData={{ name: "Roof Sheet" }}>
          <meshStandardMaterial color={roofColor} normalMap={roofTex} {...roofMaterialProps} />
        </mesh>
      ))}

      </group>{/* /ENVELOPE */}

      {/* ═══════════════ STRUCTURE LAYER ═══════════════ */}
      <group visible={layers.structure}>

      {/* ───────── PORTAL FRAMES ───────── */}
      {frames.map((x, i) => (
        <PortalFrame
          key={`pf-${i}`}
          x={x} W={W} H={Hw} ridgeH={ridgeH} roofType={roofType}
        />
      ))}

      {/* ───────── PURLINS (along X, distributed across roof slope) ───────── */}
      {Array.from({ length: purlinCount + 1 }, (_, i) => {
        const z = -W / 2 + i * (W / purlinCount)
        const y = roofType === "gable"
          ? Hw + gableRise * (1 - Math.abs(z) / (W / 2))
          : Hw + gableRise * ((z + W / 2) / W)
        return (
          <IBeam
            key={`p${i}`}
            start={[-L / 2, y - 0.1, z]} end={[L / 2, y - 0.1, z]}
            profile="purlin" color="#5b21b6" up={[0, 1, 0]}
          />
        )
      })}

      {/* Purlin cleats at every frame × purlin intersection (single InstancedMesh) */}
      <PurlinCleats
        frames={frames}
        purlinZs={Array.from({ length: purlinCount + 1 }, (_, i) => -W / 2 + i * (W / purlinCount))}
        roofType={roofType}
        gableRise={gableRise}
        W={W} H={Hw}
      />

      {/* ───────── EAVE STRUTS (along long eaves) ───────── */}
      <IBeam start={[-L / 2, Hw, -W / 2]} end={[L / 2, Hw, -W / 2]} profile="eave" color="#7c2d12" up={[0, 1, 0]} />
      <IBeam start={[-L / 2, Hw, W / 2]} end={[L / 2, Hw, W / 2]} profile="eave" color="#7c2d12" up={[0, 1, 0]} />

      {/* ───────── RIDGE BEAM ───────── */}
      {roofType === "gable" && (
        <IBeam
          start={[-L / 2 - 1, ridgeH - 0.1, 0]} end={[L / 2 + 1, ridgeH - 0.1, 0]}
          profile="ridge" color="#cf6f1a" up={[0, 1, 0]}
        />
      )}

      {/* ───────── RIDGE CAP (gable only) ───────── */}
      {roofType === "gable" && (
        <mesh position={[0, ridgeH + 0.18, 0]}>
          <boxGeometry args={[L + 4, 0.25, 0.5]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.75} roughness={0.3} envMapIntensity={1.2} />
        </mesh>
      )}

      {/* ───────── X-BRACING (end bays) ───────── */}
      {frames.length >= 2 && [0, frames.length - 2].map((i) => {
        if (i < 0 || i + 1 >= frames.length) return null
        const x1 = frames[i], x2 = frames[i + 1]
        return (
          <group key={`brace-${i}`}>
            {/* Side wall X-bracing (front) */}
            <Rod start={[x1, 0.5, -W / 2]} end={[x2, Hw - 0.5, -W / 2]} radius={0.06} color="#7e22ce" />
            <Rod start={[x2, 0.5, -W / 2]} end={[x1, Hw - 0.5, -W / 2]} radius={0.06} color="#7e22ce" />
            {/* Side wall X-bracing (back) */}
            <Rod start={[x1, 0.5, W / 2]} end={[x2, Hw - 0.5, W / 2]} radius={0.06} color="#7e22ce" />
            <Rod start={[x2, 0.5, W / 2]} end={[x1, Hw - 0.5, W / 2]} radius={0.06} color="#7e22ce" />
          </group>
        )
      })}

      {/* ───────── SAG RODS (between purlins) ───────── */}
      {frames.slice(0, -1).map((x1, i) => {
        const x2 = frames[i + 1]
        const xMid = (x1 + x2) / 2
        return (
          <group key={`sag-${i}`}>
            {[-W / 4, W / 4].map((z, k) => {
              const y = roofType === "gable"
                ? Hw + gableRise * (1 - Math.abs(z) / (W / 2))
                : Hw + gableRise * ((z + W / 2) / W)
              return (
                <Rod
                  key={k}
                  start={[xMid, y - 0.25, z - W / (purlinCount * 2)]}
                  end={[xMid, y - 0.25, z + W / (purlinCount * 2)]}
                  radius={0.025} color="#475569"
                />
              )
            })}
          </group>
        )
      })}

      </group>{/* /STRUCTURE */}

      {/* ═══════════════ MEZZANINE LAYER ═══════════════ */}
      <group visible={layers.mezzanine}>

      {/* ───────── MEZZANINE ───────── */}
      {hasMezz && mL > 0 && mW > 0 && (() => {
        const mezzY = Math.min(Hw * 0.55, +data.cladding_height || Hw * 0.55)
        const mezzX = -(L - mL) / 2
        return (
          <group>
            {/* Deck slab (wood/concrete) */}
            <mesh position={[mezzX, mezzY, 0]} castShadow receiveShadow>
              <boxGeometry args={[mL, 0.4, mW]} />
              <meshStandardMaterial color="#6b7280" roughness={0.6} metalness={0.1} />
            </mesh>
            {/* Top deck finish */}
            <mesh position={[mezzX, mezzY + 0.21, 0]} receiveShadow>
              <boxGeometry args={[mL, 0.05, mW]} />
              <meshStandardMaterial color="#94a3b8" roughness={0.5} metalness={0.15} />
            </mesh>

            {/* Edge railings (only on open edges, not against walls) */}
            {/* Front edge (towards W=+W/2 if not at wall) */}
            {mW < W * 0.95 && (
              <>
                <mesh position={[mezzX, mezzY + 0.7, mW / 2]} castShadow>
                  <boxGeometry args={[mL, 0.06, 0.06]} />
                  <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.4} />
                </mesh>
                <mesh position={[mezzX, mezzY + 1.4, mW / 2]} castShadow>
                  <boxGeometry args={[mL, 0.06, 0.06]} />
                  <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.4} />
                </mesh>
                {/* Vertical posts every 6ft */}
                {Array.from({ length: Math.ceil(mL / 6) + 1 }, (_, i) => {
                  const px = mezzX - mL / 2 + i * (mL / Math.ceil(mL / 6))
                  return (
                    <mesh key={`post-${i}`} position={[px, mezzY + 0.85, mW / 2]} castShadow>
                      <boxGeometry args={[0.06, 1.4, 0.06]} />
                      <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.4} />
                    </mesh>
                  )
                })}
              </>
            )}
            {/* End edge (towards L if not at wall) */}
            {mL < L * 0.95 && (
              <>
                <mesh position={[mezzX + mL / 2, mezzY + 0.7, 0]} castShadow>
                  <boxGeometry args={[0.06, 0.06, mW]} />
                  <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.4} />
                </mesh>
                <mesh position={[mezzX + mL / 2, mezzY + 1.4, 0]} castShadow>
                  <boxGeometry args={[0.06, 0.06, mW]} />
                  <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.4} />
                </mesh>
              </>
            )}

            {/* Supporting columns under mezzanine (along mezzanine perimeter, every 12ft) */}
            {(() => {
              const supports = []
              const stepX = Math.max(8, mL / Math.ceil(mL / 12))
              const stepZ = Math.max(8, mW / Math.ceil(mW / 12))
              const xs = []
              for (let xx = -mL / 2; xx <= mL / 2 + 0.01; xx += stepX) xs.push(xx)
              const zs = []
              for (let zz = -mW / 2; zz <= mW / 2 + 0.01; zz += stepZ) zs.push(zz)
              xs.forEach((xx, ix) => zs.forEach((zz, iz) => {
                // Skip if supporting column would coincide with portal column at end-walls
                if (Math.abs(xx + mezzX - (-L / 2)) < 1) return
                if (Math.abs(zz - (-W / 2)) < 1) return
                if (Math.abs(zz - W / 2) < 1) return
                supports.push(
                  <mesh key={`mc-${ix}-${iz}`} position={[xx + mezzX, mezzY / 2, zz]} castShadow>
                    <boxGeometry args={[0.32, mezzY, 0.32]} />
                    <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.4} />
                  </mesh>
                )
              }))
              return supports
            })()}

            {/* Stair (perimeter side, near front) */}
            {(() => {
              const stairs = []
              const stairCount = 8
              const stairLen = 5
              const stairZ = mL > L * 0.6 ? mW / 2 + 0.5 : mW / 2 + 0.5
              for (let i = 0; i < stairCount; i++) {
                stairs.push(
                  <mesh
                    key={`st-${i}`}
                    position={[
                      mezzX + mL / 2 - 0.5 + i * (stairLen / stairCount),
                      ((i + 1) / stairCount) * mezzY,
                      stairZ,
                    ]}
                    castShadow
                  >
                    <boxGeometry args={[stairLen / stairCount + 0.1, 0.06, 1.5]} />
                    <meshStandardMaterial color="#64748b" metalness={0.65} roughness={0.5} />
                  </mesh>
                )
              }
              return stairs
            })()}
          </group>
        )
      })()}

      </group>{/* /MEZZANINE */}

      {/* ═══════════════ FIXTURES LAYER (doors, windows, shutter) ═══════════════ */}
      <group visible={layers.fixtures}>

      {/* ───────── ROLLING SHUTTER (centered on -L end wall) ───────── */}
      {showShutter && (() => {
        const shW = Math.min(L * 0.18, 16, W * 0.3)
        const shH = Math.min(Hw * 0.85, 16)
        const awningH = shH + 1.2
        const awningD = 5     // depth projecting outward
        const awningW = shW * 1.7
        return (
          <group position={[-L / 2 - 0.05, 0, 0]}>
            {/* Shutter frame */}
            <mesh position={[0, shH / 2, 0]} castShadow>
              <boxGeometry args={[0.25, shH, shW]} />
              <meshStandardMaterial color="#3a3a3a" metalness={0.6} roughness={0.5} />
            </mesh>
            {/* Shutter slats — segmented box */}
            <mesh position={[0.05, shH / 2, 0]} castShadow>
              <boxGeometry args={[0.05, shH * 0.95, shW * 0.95]} />
              <meshStandardMaterial color="#a8a190" metalness={0.45} roughness={0.55} />
            </mesh>
            {/* Slat ribs (horizontal lines) */}
            {Array.from({ length: Math.floor(shH * 1.5) }, (_, i) => (
              <mesh key={`slat-${i}`} position={[0.08, 0.4 + i * 0.7, 0]}>
                <boxGeometry args={[0.05, 0.04, shW * 0.9]} />
                <meshStandardMaterial color="#7a7160" metalness={0.5} roughness={0.5} />
              </mesh>
            ))}
            {/* Top hood box */}
            <mesh position={[0.2, shH + 0.6, 0]} castShadow>
              <boxGeometry args={[0.7, 0.7, shW * 1.05]} />
              <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.5} />
            </mesh>

            {/* ── AWNING / CANOPY OVER SHUTTER (matches ref image) ── */}
            <group position={[-(awningD / 2) - 0.1, awningH, 0]}>
              {/* Roof slab (slightly tilted forward) */}
              <mesh castShadow>
                <boxGeometry args={[awningD, 0.35, awningW]} />
                <meshStandardMaterial color={trimAccentColor} metalness={0.55} roughness={0.35} />
              </mesh>
              {/* Front edge fascia (white trim) */}
              <mesh position={[-awningD / 2, -0.1, 0]} castShadow>
                <boxGeometry args={[0.18, 0.6, awningW + 0.2]} />
                <meshStandardMaterial color="#f5f5f0" metalness={0.4} roughness={0.5} />
              </mesh>
              {/* Diagonal support brackets (front-side connecting to wall) */}
              {[-awningW * 0.4, awningW * 0.4].map((zPos, i) => (
                <mesh
                  key={`awbrace-${i}`}
                  position={[-awningD * 0.25, -1.0, zPos]}
                  rotation={[0, 0, -Math.atan2(2.0, awningD * 0.5)]}
                  castShadow
                >
                  <boxGeometry args={[Math.hypot(2.0, awningD * 0.5), 0.16, 0.16]} />
                  <meshStandardMaterial color={trimAccentColor} metalness={0.55} roughness={0.4} />
                </mesh>
              ))}
              {/* Side panels (closing off the awning ends) */}
              {[-awningW / 2, awningW / 2].map((zPos, i) => (
                <mesh key={`awside-${i}`} position={[0, -0.55, zPos]} castShadow>
                  <boxGeometry args={[awningD, 1.0, 0.1]} />
                  <meshStandardMaterial color={trimAccentColor} metalness={0.5} roughness={0.45} />
                </mesh>
              ))}
            </group>
          </group>
        )
      })()}

      {/* ───────── WALK DOORS (one on each long side) ───────── */}
      {[-W / 2 - 0.05, W / 2 + 0.05].map((z, i) => {
        const dirX = i === 0 ? -1 : 1
        const x = i === 0 ? L / 4 : -L / 4
        const facing = i === 0 ? -1 : 1
        return (
          <group key={`door-${i}`} position={[x, 0, z]}>
            <mesh position={[0, 1.75, 0]} castShadow>
              <boxGeometry args={[3.0, 3.5, 0.15]} />
              <meshStandardMaterial color="#0f766e" metalness={0.4} roughness={0.55} />
            </mesh>
            {/* Frame */}
            <mesh position={[0, 1.75, facing * 0.08]}>
              <boxGeometry args={[3.2, 3.7, 0.08]} />
              <meshStandardMaterial color="#1f2937" metalness={0.5} roughness={0.6} />
            </mesh>
            {/* Handle */}
            <mesh position={[1.0 * dirX, 1.75, facing * 0.13]}>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshStandardMaterial color="#fbbf24" metalness={0.85} roughness={0.2} />
            </mesh>
          </group>
        )
      })}

      {/* ───────── WINDOWS (along long sides at eye level) ───────── */}
      {[-W / 2 - 0.08, W / 2 + 0.08].map((z, side) => {
        const winCount = Math.max(2, Math.floor(L / 22))
        return Array.from({ length: winCount }, (_, i) => {
          const x = -L / 2 + (i + 1) * (L / (winCount + 1))
          // Skip if too close to door
          if (Math.abs(x - (side === 0 ? L / 4 : -L / 4)) < 4) return null
          return (
            <group key={`win-${side}-${i}`} position={[x, 4, z]}>
              <mesh castShadow>
                <boxGeometry args={[6, 4, 0.1]} />
                <meshPhysicalMaterial
                  color="#bae6fd"
                  metalness={0.1}
                  roughness={0.05}
                  transmission={0.85}
                  transparent
                  opacity={0.6}
                  envMapIntensity={1.5}
                />
              </mesh>
              {/* Window frame */}
              <mesh>
                <boxGeometry args={[6.2, 4.2, 0.06]} />
                <meshStandardMaterial color="#1f2937" metalness={0.5} roughness={0.6} />
              </mesh>
              {/* Mullion */}
              <mesh>
                <boxGeometry args={[0.1, 4, 0.13]} />
                <meshStandardMaterial color="#1f2937" metalness={0.5} roughness={0.6} />
              </mesh>
              <mesh>
                <boxGeometry args={[6, 0.1, 0.13]} />
                <meshStandardMaterial color="#1f2937" metalness={0.5} roughness={0.6} />
              </mesh>
            </group>
          )
        })
      })}

      </group>{/* /FIXTURES */}

      {/* ═══════════════ ACCESSORIES LAYER ═══════════════ */}
      <group visible={layers.accessories}>

      {/* ───────── LOUVERS (upper section of long walls) ───────── */}
      {showLouvers && [-W / 2 - 0.08, W / 2 + 0.08].map((z, side) => (
        <group key={`louver-${side}`} position={[L / 2 - 4, Hw - 1.5, z]}>
          <mesh>
            <boxGeometry args={[5, 2.4, 0.15]} />
            <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.5} />
          </mesh>
          {Array.from({ length: 8 }, (_, i) => (
            <mesh key={i} position={[0, -1.0 + i * 0.28, side === 0 ? -0.06 : 0.06]} rotation={[Math.PI / 12, 0, 0]}>
              <boxGeometry args={[4.7, 0.08, 0.18]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.6} roughness={0.4} />
            </mesh>
          ))}
        </group>
      ))}

      {/* ───────── RIDGE MONITOR (raised clerestory along ridge) ───────── */}
      {showRidgeMonitor && roofType === "gable" && (() => {
        const rmW = Math.min(W * 0.3, 12)
        const rmL = Math.min(L * 0.7, 60)
        const rmH = 4
        return (
          <group position={[0, ridgeH, 0]}>
            {/* Side walls of monitor */}
            <mesh position={[0, rmH / 2, -rmW / 2]} castShadow>
              <boxGeometry args={[rmL, rmH, 0.15]} />
              <meshStandardMaterial color={cladColor} metalness={0.5} roughness={0.4} />
            </mesh>
            <mesh position={[0, rmH / 2, rmW / 2]} castShadow>
              <boxGeometry args={[rmL, rmH, 0.15]} />
              <meshStandardMaterial color={cladColor} metalness={0.5} roughness={0.4} />
            </mesh>
            {/* End caps */}
            <mesh position={[rmL / 2, rmH / 2, 0]} castShadow>
              <boxGeometry args={[0.15, rmH, rmW]} />
              <meshStandardMaterial color={cladColor} metalness={0.5} roughness={0.4} />
            </mesh>
            <mesh position={[-rmL / 2, rmH / 2, 0]} castShadow>
              <boxGeometry args={[0.15, rmH, rmW]} />
              <meshStandardMaterial color={cladColor} metalness={0.5} roughness={0.4} />
            </mesh>
            {/* Mini gable cap */}
            <mesh position={[0, rmH + 0.3, 0]}>
              <boxGeometry args={[rmL + 0.4, 0.6, rmW + 1]} />
              <meshStandardMaterial color={roofColor} metalness={0.65} roughness={0.35} />
            </mesh>
            {/* Louvered openings */}
            {[-rmW / 2 + 0.12, rmW / 2 - 0.12].map((zPos, idx) => (
              Array.from({ length: 4 }, (_, k) => (
                <mesh key={`rmlv-${idx}-${k}`} position={[0, 0.6 + k * 0.7, zPos]}>
                  <boxGeometry args={[rmL * 0.85, 0.1, 0.04]} />
                  <meshStandardMaterial color="#cbd5e1" metalness={0.55} roughness={0.4} />
                </mesh>
              ))
            ))}
          </group>
        )
      })()}

      {/* ───────── TURBO VENTILATORS (rotating exhaust on ridge) ───────── */}
      {showTurboVent && (() => {
        const ventCount = roofType === "gable" ? 4 : 2
        const ventR = 1.0
        return Array.from({ length: ventCount }, (_, i) => {
          const x = -L / 2 + (i + 1) * (L / (ventCount + 1))
          const y = roofType === "gable" ? ridgeH : Hw + gableRise * 0.5
          const z = roofType === "gable" ? 0 : 0
          return (
            <group key={`tv-${i}`} position={[x, y, z]}>
              {/* Throat (collar from roof) */}
              <mesh position={[0, 0.4, 0]} castShadow>
                <cylinderGeometry args={[ventR * 0.8, ventR * 0.8, 0.8, 16]} />
                <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.45} />
              </mesh>
              {/* Spinning ball / fan dome */}
              <mesh position={[0, 1.4, 0]} castShadow>
                <sphereGeometry args={[ventR, 16, 12]} />
                <meshStandardMaterial color="#cbd5e1" metalness={0.7} roughness={0.35} envMapIntensity={1.2} />
              </mesh>
              {/* Top cap */}
              <mesh position={[0, 2.5, 0]} castShadow>
                <coneGeometry args={[ventR * 0.4, 0.4, 12]} />
                <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.45} />
              </mesh>
              {/* Fins */}
              {Array.from({ length: 8 }, (_, k) => {
                const ang = (k / 8) * Math.PI * 2
                return (
                  <mesh key={k} position={[Math.cos(ang) * ventR * 0.7, 1.4, Math.sin(ang) * ventR * 0.7]}
                    rotation={[0, -ang, Math.PI / 8]}>
                    <boxGeometry args={[0.05, 0.7, 0.45]} />
                    <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.4} />
                  </mesh>
                )
              })}
            </group>
          )
        })
      })()}

      {/* ───────── LIGHT SHEETS (translucent panels in roof) ───────── */}
      {showLightSheets && (() => {
        // Place 2 light sheet zones per slope, each 2 ft × 8 ft
        const sheets = []
        const lsW = 2.5, lsL = 8
        if (roofType === "gable") {
          // Left slope (between eave and ridge, t = 0.3)
          const positions = [-L * 0.3, L * 0.3]
          positions.forEach((cx, i) => {
            // Position in the middle of left slope
            const t = 0.4
            const z = -W / 2 + t * (W / 2 - 0)
            const y = Hw + gableRise * (1 - Math.abs(z) / (W / 2))
            sheets.push(
              <mesh key={`ls-l${i}`} position={[cx, y + 0.05, z]} rotation={[Math.atan2(gableRise, W / 2), 0, 0]} castShadow>
                <boxGeometry args={[lsL, 0.05, lsW]} />
                <meshPhysicalMaterial
                  color="#fef3c7"
                  metalness={0.05}
                  roughness={0.1}
                  transmission={0.7}
                  transparent
                  opacity={0.75}
                  emissive="#fef9c3"
                  emissiveIntensity={0.3}
                />
              </mesh>
            )
            // Right slope
            const z2 = W / 2 - t * (W / 2)
            sheets.push(
              <mesh key={`ls-r${i}`} position={[cx, y + 0.05, z2]} rotation={[-Math.atan2(gableRise, W / 2), 0, 0]} castShadow>
                <boxGeometry args={[lsL, 0.05, lsW]} />
                <meshPhysicalMaterial
                  color="#fef3c7"
                  metalness={0.05}
                  roughness={0.1}
                  transmission={0.7}
                  transparent
                  opacity={0.75}
                  emissive="#fef9c3"
                  emissiveIntensity={0.3}
                />
              </mesh>
            )
          })
        }
        return sheets
      })()}

      {/* ───────── EOT CRANE RAIL & BRIDGE ───────── */}
      {showCrane && craneH > 4 && craneH < Hw - 1 && (() => {
        const railOffset = 0.8 // distance from column inward
        return (
          <group>
            {/* Crane corbel brackets on columns + rail */}
            <IBeam
              start={[-L / 2 + 1.5, craneH, -W / 2 + railOffset]}
              end={[L / 2 - 1.5, craneH, -W / 2 + railOffset]}
              profile="craneb" color="#fbbf24" up={[0, 1, 0]}
            />
            <IBeam
              start={[-L / 2 + 1.5, craneH, W / 2 - railOffset]}
              end={[L / 2 - 1.5, craneH, W / 2 - railOffset]}
              profile="craneb" color="#fbbf24" up={[0, 1, 0]}
            />
            {/* Crane bridge (girder) */}
            <mesh position={[0, craneH + 1.0, 0]} castShadow>
              <boxGeometry args={[2.0, 1.2, W - 2 * railOffset]} />
              <meshStandardMaterial color="#facc15" metalness={0.7} roughness={0.4} envMapIntensity={1.2} />
            </mesh>
            {/* Crane trolley */}
            <mesh position={[0, craneH + 0.7, 0]} castShadow>
              <boxGeometry args={[1.5, 0.7, 1.5]} />
              <meshStandardMaterial color="#a16207" metalness={0.6} roughness={0.5} />
            </mesh>
            {/* Hook block */}
            <mesh position={[0, craneH - 4, 0]} castShadow>
              <boxGeometry args={[0.6, 0.6, 0.6]} />
              <meshStandardMaterial color="#1f1f1f" metalness={0.85} roughness={0.3} />
            </mesh>
            {/* Hook cable */}
            <mesh position={[0, craneH - 1.7, 0]}>
              <cylinderGeometry args={[0.04, 0.04, 4.5, 8]} />
              <meshStandardMaterial color="#1f1f1f" />
            </mesh>
          </group>
        )
      })()}

      </group>{/* /ACCESSORIES */}

      {/* ═══════════════ ALWAYS-ON HELPERS ═══════════════ */}
      {/* ───────── GROUND GRID (subtle helper) ───────── */}
      <gridHelper
        args={[Math.max(L, W) * 2, 24, "#334155", "#1e293b"]}
        position={[0, 0.01, 0]}
      />
    </group>
  )
}
