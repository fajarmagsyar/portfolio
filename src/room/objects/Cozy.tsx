"use client";

/* eslint-disable react-hooks/immutability -- three.js uniforms are mutable by design */

import { asset } from "@/asset";
import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Sparkles, useGLTF } from "@react-three/drei";
import { POS } from "../layout";
import { useRoom } from "../store";
import { useClone } from "./Guitar";

// Small things that make the room feel lived in and the air feel thick: a hot coffee,
// the glow of the lamp, and dust hanging in its light.
// Apart from the mug itself, everything here is built in code.

const noise = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
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

// Model: "Coffee Cup" by jeffbas (CC BY 4.0). See CREDITS.md.
const CUP = asset("/models/sk/coffee_cup.glb");
// The file's mug is 0.9 units tall and 0.8 across, standing off-centre with its handle towards +x.
const CUP_SCALE = 0.095 / 0.9;
const CUP_MID: [number, number] = [-0.168, -0.041];

/** A mug of coffee on a cork coaster, still steaming. */
export function Coffee() {
  const uniforms = useClock();
  const mug = useClone(CUP);
  return (
    <group position={POS.coffee} rotation={[0, -0.7, 0]}>
      <mesh position={[0, 0.002, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.056, 0.056, 0.004, 32]} />
        <meshStandardMaterial color="#a67c52" roughness={0.95} />
      </mesh>
      <primitive object={mug} scale={CUP_SCALE} position={[-CUP_MID[0] * CUP_SCALE, 0.004, -CUP_MID[1] * CUP_SCALE]} />
      {/* steam: turned back to face the room whatever way the mug sits */}
      <mesh position={[0, 0.2, 0]} rotation={[0, 0.7, 0]}>
        <planeGeometry args={[0.13, 0.26]} />
        <shaderMaterial vertexShader={plainVert} fragmentShader={steamFrag} uniforms={uniforms} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
useGLTF.preload(CUP);

/** Where the desk lamp's bulb sits inside its shade. */
export const BULB: [number, number, number] = [POS.lamp[0] + 0.215, POS.lamp[1] + 0.665, POS.lamp[2] + 0.075];

/** The lamp's bulb itself. */
export function LampGlow() {
  return (
    <group position={BULB}>
      <mesh>
        <sphereGeometry args={[0.024, 16, 12]} />
        <meshBasicMaterial color={[6, 3.8, 1.8]} toneMapped={false} fog={false} />
      </mesh>
    </group>
  );
}

/** Dust turning in the lamplight. */
export function Haze() {
  // up close to the tube, motes drifting across the picture are only a distraction
  const atTv = useRoom((s) => s.focus === "tv");
  return (
    <Sparkles visible={!atTv} count={140} position={[-0.2, 1.35, 0.15]} scale={[2.8, 1.3, 1.3]} size={0.4} speed={0.1} opacity={0.4} noise={0.5} color="#c9a67a" />
  );
}
