"use client";

/* eslint-disable react-hooks/immutability -- three.js uniforms are mutable by design */

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { POS } from "../layout";
import { useRoom } from "../store";

// Small things that make the room feel lived in and the air feel thick: a hot coffee,
// the glow of the lamp, and haze and dust hanging in its light.
// Everything here is built in code; nothing is downloaded.

const noise = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    return noise(p) * 0.5 + noise(p * 2.03 + 11.0) * 0.3 + noise(p * 4.1 + 37.0) * 0.2;
  }
`;

const plainVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vPos = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalMatrix * normal;
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

/** Keeps a `uTime` uniform running for a shader material. */
function useClock() {
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
  });
  return uniforms;
}

const steamFrag = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  ${noise}
  void main() {
    // a thin column that wanders more the higher it gets
    float sway = sin(vUv.y * 5.0 + uTime * 0.8) * 0.08 + (noise(vec2(vUv.y * 3.0 - uTime * 0.4, 1.0)) - 0.5) * 0.3;
    float x = (vUv.x - 0.5 - sway * vUv.y) * 2.0;
    float wisps = noise(vec2(x * 2.5, vUv.y * 4.0 - uTime * 0.55)) * 0.6 + noise(vec2(x * 5.0 + 3.0, vUv.y * 8.0 - uTime * 0.9)) * 0.4;
    float a = smoothstep(mix(0.22, 0.8, vUv.y), 0.0, abs(x)) * wisps;
    a *= smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.3, vUv.y);
    gl_FragColor = vec4(1.0, 0.94, 0.86, a * 0.3);
  }
`;

/** A mug of coffee on a cork coaster, still steaming. */
export function Coffee() {
  const uniforms = useClock();
  const mug = useMemo(() => {
    // the wall of the mug in profile, spun around its axis: outside up, over the lip, inside down
    const pts: [number, number][] = [
      [0, 0],
      [0.034, 0],
      [0.038, 0.004],
      [0.04, 0.012],
      [0.041, 0.088],
      [0.0395, 0.092],
      [0.037, 0.088],
      [0.036, 0.014],
      [0, 0.012],
    ];
    return new THREE.LatheGeometry(
      pts.map(([x, y]) => new THREE.Vector2(x, y)),
      40,
    );
  }, []);
  return (
    <group position={POS.coffee} rotation={[0, -0.7, 0]}>
      <mesh position={[0, 0.002, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.056, 0.056, 0.004, 32]} />
        <meshStandardMaterial color="#a67c52" roughness={0.95} />
      </mesh>
      <group position={[0, 0.004, 0]}>
        <mesh geometry={mug} castShadow receiveShadow>
          <meshStandardMaterial color="#e6dccb" roughness={0.3} side={THREE.DoubleSide} />
        </mesh>
        {/* handle */}
        <mesh position={[0.04, 0.05, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
          <torusGeometry args={[0.023, 0.0055, 10, 24, Math.PI]} />
          <meshStandardMaterial color="#e6dccb" roughness={0.3} />
        </mesh>
        {/* a band of glaze around the middle */}
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.0412, 0.0408, 0.016, 40, 1, true]} />
          <meshStandardMaterial color="#b3341f" roughness={0.35} />
        </mesh>
        {/* the coffee */}
        <mesh position={[0, 0.079, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.0368, 32]} />
          <meshStandardMaterial color="#2b1408" roughness={0.12} />
        </mesh>
      </group>
      {/* steam: turned back to face the room whatever way the mug sits */}
      <mesh position={[0, 0.2, 0]} rotation={[0, 0.7, 0]}>
        <planeGeometry args={[0.13, 0.26]} />
        <shaderMaterial vertexShader={plainVert} fragmentShader={steamFrag} uniforms={uniforms} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

const coneFrag = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vView;
  uniform float uTime;
  ${noise}
  void main() {
    float h = 0.5 - vPos.y / 0.66; // 0 at the bulb, 1 where the light meets the desk
    // seen edge-on the cone is thin air; face-on you look through its full depth
    float facing = abs(dot(normalize(vNormal), normalize(vView)));
    float a = pow(1.0 - h, 1.7) * pow(facing, 1.6);
    a *= 0.75 + 0.25 * noise(vec2(vPos.x * 9.0 + uTime * 0.05, vPos.y * 7.0 - uTime * 0.03));
    gl_FragColor = vec4(vec3(1.0, 0.72, 0.42) * a * 0.2, 1.0);
  }
`;

/** Where the desk lamp's bulb sits inside its shade. */
export const BULB: [number, number, number] = [POS.lamp[0] + 0.215, POS.lamp[1] + 0.665, POS.lamp[2] + 0.075];

/** The lamp's bulb itself, and the cone of lit haze under the shade. */
export function LampGlow() {
  const uniforms = useClock();
  return (
    <group position={BULB}>
      <mesh>
        <sphereGeometry args={[0.024, 16, 12]} />
        <meshBasicMaterial color={[4.2, 2.6, 1.2]} toneMapped={false} fog={false} />
      </mesh>
      {/* the cone hangs from the bulb, leaning the way the shade points */}
      <group rotation={[0.12, 0, 0.32]}>
        <mesh position={[0, -0.33, 0]}>
          {/* as wide as the shade's mouth where it leaves it, opening out to the pool of light on the desk */}
          <cylinderGeometry args={[0.055, 0.2, 0.66, 40, 1, true]} />
          <shaderMaterial
            vertexShader={plainVert}
            fragmentShader={coneFrag}
            uniforms={uniforms}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}

const hazeFrag = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  ${noise}
  void main() {
    float n = fbm(vUv * vec2(3.2, 2.0) + vec2(uTime * 0.012, uTime * 0.005));
    // warm where the lamp lights it, cyan in front of the tube and where the night comes in
    float lamp = smoothstep(0.42, 0.0, distance(vUv, vec2(0.425, 0.48)));
    float tube = smoothstep(0.34, 0.0, distance(vUv * vec2(1.0, 0.7), vec2(0.49, 0.245)));
    float night = smoothstep(0.42, 0.0, distance(vUv * vec2(1.0, 0.8), vec2(0.5, 0.5)));
    float saturn = smoothstep(0.2, 0.0, distance(vUv * vec2(1.0, 0.6), vec2(0.65, 0.18)));
    vec3 col = vec3(1.0, 0.66, 0.36) * (0.04 + lamp * 0.6) + vec3(0.2, 0.85, 1.0) * (tube * 0.42 + night * 0.12) + vec3(1.0, 0.42, 0.16) * saturn * 0.28;
    float fade = smoothstep(0.0, 0.25, vUv.y) * smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);
    gl_FragColor = vec4(col * (0.3 + 0.7 * n) * fade * 0.08, 1.0);
  }
`;

/** Smoke-like haze drifting between the chair and the desk, and dust turning in the lamplight. */
export function Haze() {
  const uniforms = useClock();
  // up close to the tube, motes drifting across the picture are only a distraction
  const atTv = useRoom((s) => s.focus === "tv");
  return (
    <group>
      <mesh position={[0, 1.45, 0.78]}>
        <planeGeometry args={[6, 2.9]} />
        <shaderMaterial
          vertexShader={plainVert}
          fragmentShader={hazeFrag}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <Sparkles visible={!atTv} count={70} position={[-0.2, 1.35, 0.15]} scale={[2.8, 1.3, 1.3]} size={1.1} speed={0.12} opacity={0.28} noise={0.5} color="#ffd9a6" />
    </group>
  );
}
