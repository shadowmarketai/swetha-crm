/**
 * PEBBuilding — Three.js 3D PEB Building Component
 * Ported from peb-saas project. Full geometry: masonry walls, cladding,
 * gable triangles, portal frames, purlins, ridge beam, mezzanine, ground.
 */

import { useMemo } from "react";
import * as THREE from "three";

function Beam({ start, end, radius = 0.15, color = "#94a3b8" }) {
  const mid = useMemo(() => [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    (start[2] + end[2]) / 2,
  ], [start, end]);

  const length = useMemo(() => {
    const dx = end[0] - start[0], dy = end[1] - start[1], dz = end[2] - start[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }, [start, end]);

  const rotation = useMemo(() => {
    const dir = new THREE.Vector3(end[0] - start[0], end[1] - start[1], end[2] - start[2]).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
    const euler = new THREE.Euler().setFromQuaternion(quat);
    return [euler.x, euler.y, euler.z];
  }, [start, end]);

  return (
    <mesh position={mid} rotation={rotation} castShadow>
      <cylinderGeometry args={[radius, radius, length, 8]} />
      <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} />
    </mesh>
  );
}

function PortalFrame({ x, W, H, ridgeH, roofType }) {
  const beams = [];
  beams.push({ start: [x, 0, -W / 2], end: [x, H, -W / 2], color: "#dc2626" });
  beams.push({ start: [x, 0, W / 2], end: [x, H, W / 2], color: "#dc2626" });

  if (roofType === "gable") {
    beams.push({ start: [x, H, -W / 2], end: [x, ridgeH, 0], color: "#f59e0b" });
    beams.push({ start: [x, H, W / 2], end: [x, ridgeH, 0], color: "#f59e0b" });
  } else {
    beams.push({ start: [x, H, -W / 2], end: [x, ridgeH, W / 2], color: "#f59e0b" });
  }

  beams.push({ start: [x, H, -W / 2], end: [x, H, W / 2], color: "#f97316" });

  return (
    <group>
      {beams.map((b, i) => (
        <Beam key={i} start={b.start} end={b.end} color={b.color} radius={0.25} />
      ))}
    </group>
  );
}

export default function PEBBuilding({ data }) {
  const L = +data.building_length, W = +data.building_width;
  const H = +data.full_height, Hw = +data.wall_height;
  const roofType = data.roof_type;
  const hasMezz = data.mezzanine_required;
  const mL = +data.mezz_length || 0, mW = +data.mezz_width || 0;

  // Gable rise: Excel formula = W/2/10 (e.g. 60/2/10 = 3ft)
  const gableRise = roofType === "gable" ? W / 2 / 10 : W / 10;
  const ridgeH = H + gableRise;

  const wallColor = "#94a3b8";
  const cladColor = data.side_cladding_type === "puf" ? "#2563eb" : "#64748b";
  const roofColor = data.roof_sheet_type === "puf" ? "#1d4ed8" : "#b45309";
  const eaveColor = "#d4a017";

  const frameSpacing = Math.min(25, L / 4);
  const frameCount = Math.max(2, Math.ceil(L / frameSpacing) + 1);
  const frames = useMemo(() => {
    const arr = [];
    for (let i = 0; i < frameCount; i++) {
      arr.push(-L / 2 + i * (L / (frameCount - 1)));
    }
    return arr;
  }, [L, frameCount]);

  const purlinCount = Math.ceil(W / 6);

  const roofPanels = useMemo(() => {
    const ovL = 2, ovW = 1.5;

    if (roofType === "gable") {
      const leftGeo = new THREE.BufferGeometry();
      const lv = new Float32Array([
        -(L / 2 + ovL), H, -(W / 2 + ovW),
         (L / 2 + ovL), H, -(W / 2 + ovW),
        -(L / 2 + ovL), ridgeH, 0,
         (L / 2 + ovL), ridgeH, 0,
      ]);
      leftGeo.setAttribute("position", new THREE.BufferAttribute(lv, 3));
      leftGeo.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 1, 3, 2]), 1));
      leftGeo.computeVertexNormals();

      const rightGeo = new THREE.BufferGeometry();
      const rv = new Float32Array([
        -(L / 2 + ovL), ridgeH, 0,
         (L / 2 + ovL), ridgeH, 0,
        -(L / 2 + ovL), H, (W / 2 + ovW),
         (L / 2 + ovL), H, (W / 2 + ovW),
      ]);
      rightGeo.setAttribute("position", new THREE.BufferAttribute(rv, 3));
      rightGeo.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 1, 3, 2]), 1));
      rightGeo.computeVertexNormals();

      return [leftGeo, rightGeo];
    } else {
      const geo = new THREE.BufferGeometry();
      const v = new Float32Array([
        -(L / 2 + ovL), H, -(W / 2 + ovW),
         (L / 2 + ovL), H, -(W / 2 + ovW),
        -(L / 2 + ovL), ridgeH, (W / 2 + ovW),
         (L / 2 + ovL), ridgeH, (W / 2 + ovW),
      ]);
      geo.setAttribute("position", new THREE.BufferAttribute(v, 3));
      geo.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 1, 3, 2]), 1));
      geo.computeVertexNormals();
      return [geo];
    }
  }, [L, W, H, ridgeH, roofType]);

  const cladH = H - Hw;

  return (
    <group>
      {/* Masonry Walls (0 → Hw) */}
      <mesh position={[0, Hw / 2, -W / 2]} castShadow>
        <boxGeometry args={[L, Hw, 0.5]} />
        <meshStandardMaterial color={wallColor} metalness={0.2} roughness={0.8} />
      </mesh>
      <mesh position={[0, Hw / 2, W / 2]} castShadow>
        <boxGeometry args={[L, Hw, 0.5]} />
        <meshStandardMaterial color={wallColor} metalness={0.2} roughness={0.8} />
      </mesh>
      <mesh position={[L / 2, Hw / 2, 0]} castShadow>
        <boxGeometry args={[0.5, Hw, W]} />
        <meshStandardMaterial color={wallColor} metalness={0.2} roughness={0.8} />
      </mesh>
      <mesh position={[-L / 2, Hw / 2, 0]} castShadow>
        <boxGeometry args={[0.5, Hw, W]} />
        <meshStandardMaterial color={wallColor} metalness={0.2} roughness={0.8} />
      </mesh>

      {/* Eave Trim at Hw */}
      <mesh position={[0, Hw, -W / 2]}>
        <boxGeometry args={[L + 0.5, 0.4, 0.3]} />
        <meshStandardMaterial color={eaveColor} metalness={0.7} roughness={0.2} />
      </mesh>
      <mesh position={[0, Hw, W / 2]}>
        <boxGeometry args={[L + 0.5, 0.4, 0.3]} />
        <meshStandardMaterial color={eaveColor} metalness={0.7} roughness={0.2} />
      </mesh>
      <mesh position={[L / 2, Hw, 0]}>
        <boxGeometry args={[0.3, 0.4, W + 0.5]} />
        <meshStandardMaterial color={eaveColor} metalness={0.7} roughness={0.2} />
      </mesh>
      <mesh position={[-L / 2, Hw, 0]}>
        <boxGeometry args={[0.3, 0.4, W + 0.5]} />
        <meshStandardMaterial color={eaveColor} metalness={0.7} roughness={0.2} />
      </mesh>

      {/* Side Cladding (Hw → H) — long sides */}
      <mesh position={[0, Hw + cladH / 2, -W / 2]} castShadow>
        <boxGeometry args={[L, cladH, 0.3]} />
        <meshStandardMaterial color={cladColor} metalness={0.5} roughness={0.3} transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, Hw + cladH / 2, W / 2]} castShadow>
        <boxGeometry args={[L, cladH, 0.3]} />
        <meshStandardMaterial color={cladColor} metalness={0.5} roughness={0.3} transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>

      {/* End Cladding (Hw → H) — short sides */}
      <mesh position={[L / 2, Hw + cladH / 2, 0]} castShadow>
        <boxGeometry args={[0.3, cladH, W]} />
        <meshStandardMaterial color={cladColor} metalness={0.5} roughness={0.3} transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-L / 2, Hw + cladH / 2, 0]} castShadow>
        <boxGeometry args={[0.3, cladH, W]} />
        <meshStandardMaterial color={cladColor} metalness={0.5} roughness={0.3} transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>

      {/* Gable triangles (H → ridgeH) */}
      {roofType === "gable" && (
        <>
          <mesh position={[L / 2, 0, 0]} castShadow>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                array={new Float32Array([0, H, -W / 2, 0, H, W / 2, 0, ridgeH, 0])}
                count={3} itemSize={3}
              />
            </bufferGeometry>
            <meshStandardMaterial color={cladColor} metalness={0.4} roughness={0.4} transparent opacity={0.8} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[-L / 2, 0, 0]} castShadow>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                array={new Float32Array([0, H, -W / 2, 0, H, W / 2, 0, ridgeH, 0])}
                count={3} itemSize={3}
              />
            </bufferGeometry>
            <meshStandardMaterial color={cladColor} metalness={0.4} roughness={0.4} transparent opacity={0.8} side={THREE.DoubleSide} />
          </mesh>
        </>
      )}

      {/* Eave Trim at H */}
      <mesh position={[0, H, -W / 2]}>
        <boxGeometry args={[L + 0.5, 0.3, 0.2]} />
        <meshStandardMaterial color={eaveColor} metalness={0.7} roughness={0.2} />
      </mesh>
      <mesh position={[0, H, W / 2]}>
        <boxGeometry args={[L + 0.5, 0.3, 0.2]} />
        <meshStandardMaterial color={eaveColor} metalness={0.7} roughness={0.2} />
      </mesh>

      {/* Roof Panels */}
      {roofPanels.map((geo, i) => (
        <mesh key={`roof-${i}`} geometry={geo} castShadow>
          <meshStandardMaterial color={roofColor} metalness={0.6} roughness={0.25} transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Portal Frames */}
      {frames.map((x, i) => (
        <PortalFrame key={i} x={x} W={W} H={H} ridgeH={ridgeH} roofType={roofType} />
      ))}

      {/* Purlins */}
      {Array.from({ length: purlinCount + 1 }, (_, i) => {
        const z = -W / 2 + i * (W / purlinCount);
        const y = roofType === "gable"
          ? H + gableRise * (1 - Math.abs(z) / (W / 2))
          : H + gableRise * ((z + W / 2) / W);
        return (
          <Beam key={`p${i}`} start={[-L / 2, y, z]} end={[L / 2, y, z]} radius={0.1} color="#6366f1" />
        );
      })}

      {/* Ridge Beam */}
      {roofType === "gable" && (
        <Beam start={[-L / 2 - 2, ridgeH, 0]} end={[L / 2 + 2, ridgeH, 0]} radius={0.18} color="#f59e0b" />
      )}

      {/* Mezzanine Floor */}
      {hasMezz && mL > 0 && mW > 0 && (() => {
        const mezzH = +(data.cladding_height || Hw);
        return (
          <group>
            <mesh position={[-(L - mL) / 2, mezzH, 0]} castShadow>
              <boxGeometry args={[mL, 0.5, mW]} />
              <meshStandardMaterial color="#10b981" metalness={0.3} roughness={0.5} transparent opacity={0.75} />
            </mesh>
            <mesh position={[-(L - mL) / 2, mezzH - 0.35, 0]}>
              <boxGeometry args={[mL, 0.1, mW]} />
              <meshStandardMaterial color="#059669" />
            </mesh>
          </group>
        );
      })()}

      {/* Ground Plane */}
      <mesh position={[0, -0.1, 0]} receiveShadow>
        <boxGeometry args={[L + 40, 0.2, W + 40]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[L + 10, 0.04, W + 10]} />
        <meshStandardMaterial color="#334155" />
      </mesh>

      {/* Grid */}
      <gridHelper args={[Math.max(L, W) * 1.5, 20, "#1e293b", "#0f172a"]} position={[0, 0.02, 0]} />

    </group>
  );
}
