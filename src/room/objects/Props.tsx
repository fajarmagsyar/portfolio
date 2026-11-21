"use client";

import { useMemo, useRef } from "react";
import { useFrame, type ThreeElements } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { Interactive } from "../Interactive";
import { POS } from "../layout";
import { TUBE, TvScreen } from "./TvScreen";

const path = (id: string) => `/models/${id}/${id}.gltf`;

/** A downloaded Poly Haven model (CC0), cloned so it can be placed more than once, with shadows on. */
export function Model({ asset, ...props }: { asset: string } & ThreeElements["group"]) {
  const { scene } = useGLTF(path(asset));
  const clone = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return c;
  }, [scene]);
  return (
    <group {...props}>
      <primitive object={clone} />
    </group>
  );
}

/** Invisible box that only exists to catch the pointer: small objects are hard to hit from across the room. */
export function HitBox({ size, ...props }: { size: [number, number, number] } & ThreeElements["mesh"]) {
  return (
    <mesh {...props}>
      <boxGeometry args={size} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

function Television() {
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (light.current) light.current.intensity = 2.6 + Math.sin(clock.elapsedTime * 9) * 0.1 + Math.sin(clock.elapsedTime * 2.3) * 0.22;
  });
  return (
    <Interactive target="tv" position={POS.tv} rotation={[0, 0.08, 0]}>
      <Model asset="Television_01" />
      <TvScreen url={path("Television_01")} />
      <pointLight ref={light} position={[(TUBE.x0 + TUBE.x1) / 2, (TUBE.y0 + TUBE.y1) / 2, 0.5]} color="#3fdcff" distance={5.5} decay={1.7} />
    </Interactive>
  );
}

// Model: "Saturn Desk Lamp" by MooseMannequin (Sketchfab Standard licence). See CREDITS.md.
const SATURN = "/models/sk/saturn_lamp.glb";
// The file is in metres and 35 cm tall; on this desk it is a smaller one.
const SATURN_SCALE = 0.44;
/** the middle of the globe, above the lamp's feet, in the file's own units */
const SATURN_GLOBE = 0.215;

/** The Saturn lamp at the right-hand end of the desk: a warm ember of a globe, for the side the desk lamp does not reach. */
function SaturnLamp() {
  const { scene } = useGLTF(SATURN);
  const light = useRef<THREE.PointLight>(null);
  const lamp = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = (m.material as THREE.MeshPhysicalMaterial).clone();
      if (mat.name.startsWith("saturn_")) {
        // the globe: lit from inside, a deep warm amber a shade redder than the desk lamp.
        // It is the light, so it casts no shadow of its own.
        mat.transmission = 0;
        mat.transparent = false;
        mat.depthWrite = true;
        mat.color.set("#2a0d04");
        mat.emissive.set("#ff5a1c");
        mat.emissiveIntensity = 1.6;
        mat.toneMapped = false;
      } else {
        m.castShadow = true;
        m.receiveShadow = true;
        mat.envMapIntensity = 1.6;
      }
      m.material = mat;
    });
    return c;
  }, [scene]);
  useFrame(({ clock }) => {
    // a slow breath, barely there
    if (light.current) light.current.intensity = 0.85 + Math.sin(clock.elapsedTime * 0.7) * 0.04;
  });
  return (
    <group position={POS.saturn} rotation={[0, 0.9, 0]}>
      <primitive object={lamp} scale={SATURN_SCALE} />
      <pointLight ref={light} position={[0, SATURN_GLOBE * SATURN_SCALE, 0]} color="#ff6a2c" distance={4} decay={1.7} />
    </group>
  );
}

export function Props() {
  return (
    <group>
      <Television />
      {/* console and pad belong to the TV: clicking them opens the TV too */}
      <Interactive target="tv">
        <Model asset="gaming_console" position={POS.console} rotation={[0, 0.35, 0]} scale={0.82} />
        <Model asset="gamepad" position={POS.gamepad} rotation={[0, 0.9, 0]} scale={0.8} />
      </Interactive>
      {/* lamp on the left of the desk, its shade turned towards the middle */}
      <Model asset="desk_lamp_arm_01" position={POS.lamp} rotation={[0, -1.9, 0]} />
      <SaturnLamp />
      <Model asset="potted_plant_02" position={POS.deskPlant} scale={0.5} />
      <Model asset="potted_plant_02" position={POS.plant} rotation={[0, 2, 0]} scale={1.15} />
    </group>
  );
}

for (const id of [
  "Television_01",
  "gaming_console",
  "gamepad",
  "desk_lamp_arm_01",
  "potted_plant_02",
  "hanging_picture_frame_01",
  "hanging_picture_frame_02",
  "painted_wooden_table",
]) {
  useGLTF.preload(path(id));
}
useGLTF.preload(SATURN);
