/**
 * ThreeScene — full-quality 3D background for the Login page.
 *
 * This is the impressive version (intentionally heavier than the
 * dashboard would tolerate). Login is a one-shot first impression so
 * we lean into the visuals: distorted blob, particle field, multiple
 * floating orbs, ambient glow.
 *
 * Performance notes for this surface:
 *   - Sphere geometry kept at moderate detail (64) — visual quality
 *     dominates over framerate budget here
 *   - Stars limited to 1500 (visually similar to 3000 but lighter)
 *   - DPR capped at 1.5 to keep iGPUs happy
 *   - Wrapped in Suspense so the form paints first
 */

import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, MeshDistortMaterial, Sphere, Stars, Environment } from '@react-three/drei'

// ── Main animated blob ───────────────────────────────────────────

function Blob() {
  const meshRef = useRef()
  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const t = clock.getElapsedTime()
    meshRef.current.rotation.x = Math.sin(t * 0.2) * 0.3
    meshRef.current.rotation.y = t * 0.15
  })

  return (
    <Float speed={1.2} rotationIntensity={0.4} floatIntensity={1.5}>
      <Sphere ref={meshRef} args={[1.6, 64, 64]} position={[0, 0, 0]}>
        <MeshDistortMaterial
          color="#a78bfa"
          attach="material"
          distort={0.45}
          speed={1.6}
          roughness={0.05}
          metalness={1.0}
          emissive="#5b21b6"
          emissiveIntensity={0.25}
          envMapIntensity={1.5}
        />
      </Sphere>
    </Float>
  )
}

// ── Smaller decorative orbs ─────────────────────────────────────

function FloatingOrb({ position, color, size = 0.25, speed = 1 }) {
  return (
    <Float speed={speed} rotationIntensity={1} floatIntensity={2.5}>
      <mesh position={position}>
        <sphereGeometry args={[size, 24, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.8}
          roughness={0.2}
          metalness={0.6}
        />
      </mesh>
    </Float>
  )
}

// ── Camera drift driven by mouse ────────────────────────────────

function CameraRig() {
  useFrame(({ camera, mouse }) => {
    camera.position.x += (mouse.x * 0.6 - camera.position.x) * 0.05
    camera.position.y += (-mouse.y * 0.4 - camera.position.y) * 0.05
    camera.lookAt(0, 0, 0)
  })
  return null
}

// ── Public component ────────────────────────────────────────────

export default function ThreeScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 50 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Suspense fallback={null}>
        {/* Image-based lighting — gives metallic materials something
            to reflect, which is what makes the blob look glossy & 3D.
            Drei ships built-in cube maps for these presets, no HDRI download. */}
        <Environment preset="city" />

        {/* Direct lighting on top of IBL for color accents */}
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} intensity={1.6} color="#c4b5fd" />
        <pointLight position={[-10, -10, -10]} intensity={1.2} color="#f9a8d4" />
        <pointLight position={[0, 5, -10]} intensity={0.8} color="#67e8f9" />
        <directionalLight position={[5, 5, 5]} intensity={0.6} color="#ffffff" />

        {/* Background star field */}
        <Stars
          radius={120}
          depth={60}
          count={1500}
          factor={4}
          saturation={0}
          fade
          speed={0.6}
        />

        {/* Main blob */}
        <Blob />

        {/* Floating orbs at various depths */}
        <FloatingOrb position={[-3, 1.5, -1]}   color="#a855f7" size={0.18} speed={1.2} />
        <FloatingOrb position={[3, -1, -2]}     color="#ec4899" size={0.22} speed={0.9} />
        <FloatingOrb position={[-2, -2, 0.5]}   color="#06b6d4" size={0.14} speed={1.4} />
        <FloatingOrb position={[2.5, 2, 0]}     color="#f59e0b" size={0.16} speed={1.1} />
        <FloatingOrb position={[-3.5, -0.5, 1]} color="#10b981" size={0.12} speed={1.3} />
        <FloatingOrb position={[3.2, 0.5, 1.2]} color="#6366f1" size={0.20} speed={0.8} />

        {/* Camera parallax */}
        <CameraRig />
      </Suspense>
    </Canvas>
  )
}
