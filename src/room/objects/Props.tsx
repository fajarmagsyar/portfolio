"use client";

import { asset } from "@/asset";
import { useMemo, useRef } from "react";
import { useFrame, type ThreeElements } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { Interactive } from "../Interactive";
import { POS } from "../layout";
import { SaturnLamp } from "./Planets";
import { TUBE, TvScreen } from "./TvScreen";

const path = (id: string) => asset(`/models/${id}/${id}.gltf`);

function trimGamepadWire(root: THREE.Group) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry.index ? m.geometry.clone() : m.geometry.toNonIndexed();
    const at = g.attributes.position;
    const idx = g.index;
    if (!idx) return;
    const kept: number[] = [];
    for (let t = 0; t < idx.count; t += 3) {
      const tri = [idx.getX(t), idx.getX(t + 1), idx.getX(t + 2)];
      const maxZ = Math.max(at.getZ(tri[0]), at.getZ(tri[1]), at.getZ(tri[2]));
      if (maxZ >= -0.08) kept.push(tri[0], tri[1], tri[2]);
    }
    g.setIndex(kept);
    m.geometry = g;
  });
}

/** A downloaded Poly Haven model (CC0), cloned so it can be placed more than once, with shadows on. */
export function Model({ asset, process, ...props }: { asset: string; process?: (root: THREE.Group) => void } & ThreeElements["group"]) {
  const { scene } = useGLTF(path(asset));
  const clone = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    process?.(c);
    return c;
  }, [scene, process]);
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
  const light = useRef<THREE.SpotLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    if (light.current) light.current.intensity = 1.15 + Math.sin(clock.elapsedTime * 9) * 0.02 + Math.sin(clock.elapsedTime * 2.3) * 0.04;
  });
  const x = (TUBE.x0 + TUBE.x1) / 2;
  const y = (TUBE.y0 + TUBE.y1) / 2;
  return (
    <Interactive target="tv" position={POS.tv} rotation={[0, 0.08, 0]}>
      <Model asset="Television_01" />
      <TvScreen url={path("Television_01")} />
      <primitive object={target} position={[x, y, 2.4]} />
      <spotLight ref={light} target={target} position={[x, y, 0.42]} color="#2e9eff" distance={4.6} decay={1.9} angle={0.78} penumbra={1} />
    </Interactive>
  );
}

export function Props() {
  return (
    <group>
      <Television />
      {/* console and pad belong to the TV: clicking them opens the TV too */}
      <Interactive target="tv">
        <Model asset="gaming_console" position={POS.console} rotation={[0, 0.35, 0]} scale={0.82} />
        <Model asset="gamepad" position={POS.gamepad} rotation={[0, 0.115, 0]} scale={0.8} process={trimGamepadWire} />
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
]) {
  useGLTF.preload(path(id));
}
