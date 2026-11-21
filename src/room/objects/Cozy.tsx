"use client";

/* eslint-disable react-hooks/immutability -- three.js uniforms are mutable by design */

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Sparkles, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { POS } from "../layout";
import { useRoom } from "../store";
import { useClone } from "./Guitar";

// Small things that make the room feel lived in and the air feel thick: a hot coffee,
// the glow of the lamp, and haze and dust hanging in its light.
// Apart from the mug itself, everything here is built in code.

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

// Model: "Coffee Cup" by jeffbas (CC BY 4.0). See CREDITS.md.
const CUP = "/models/sk/coffee_cup.glb";
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

const screenVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Laid over the whole picture, so it is there from every seat and every close-up. It is the same
// even veil of cyan with a little lamp amber everywhere, drifting slowly.
const screenHazeFrag = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  ${noise}
  void main() {
    float n = fbm(vUv * vec2(3.2, 2.0) + vec2(uTime * 0.012, uTime * 0.005));
    vec3 col = vec3(0.2, 0.85, 1.0) * 0.5 + vec3(1.0, 0.66, 0.36) * 0.25;
    gl_FragColor = vec4(col * (0.4 + 0.6 * n) * 0.07, 1.0);
  }
`;

/** Haze over the whole screen, and dust turning in the lamplight. */
export function Haze() {
  const time = useClock();
  const uniforms = useMemo(() => ({ uTime: time.uTime }), [time]);
  // up close to the tube, motes drifting across the picture are only a distraction
  const atTv = useRoom((s) => s.focus === "tv");
  return (
    <group>
      <mesh frustumCulled={false} renderOrder={10}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          vertexShader={screenVert}
          fragmentShader={screenHazeFrag}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <Sparkles visible={!atTv} count={140} position={[-0.2, 1.35, 0.15]} scale={[2.8, 1.3, 1.3]} size={0.4} speed={0.1} opacity={0.4} noise={0.5} color="#c9a67a" />
    </group>
  );
}
