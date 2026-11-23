"use client";

import { asset } from "@/asset";
import { useMemo, useRef } from "react";
import { useFrame, type ThreeElements } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { Interactive } from "../Interactive";
import { LAMP_ROTATION, POS } from "../layout";
import { useRoom } from "../store";
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

// The floor lamp's file: 5.6 x 17.7 units, its base at y = -17.667, centred on x = 3.944, z = 8.593.
const LAMP_FLOOR = { cx: 3.9435, cz: 8.5925, base: -17.667, height: 17.684 };
/** Stands the lamp on the origin, at the height of a real one, and lets its shade glow. */
function setUpStandingLamp(root: THREE.Group) {
  root.position.set(-LAMP_FLOOR.cx, -LAMP_FLOOR.base, -LAMP_FLOOR.cz);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    if (mat.name === "Lamp_Shade_mat") {
      // the lamp is not a light here, it only looks lit: the shade is warm from within
      const lit = mat.clone();
      lit.emissive = new THREE.Color("#ffb45e");
      lit.emissiveIntensity = 0.85;
      m.material = lit;
    }
    // transparent from the start, so fading it out later does not make the shaders build again
    (m.material as THREE.Material).transparent = true;
  });
}
/** Makes every material of a model able to fade, from the start, so fading it later does not make the shaders build again. */
export function fadable(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) (m.material as THREE.Material).transparent = true;
  });
}
/** Holds its children and fades them to nothing while the room is looking at any of `focuses`, and back after; hidden once they are gone, so they cost nothing. */
export function FadeOnFocus({ focuses, children }: { focuses: string[]; children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const away = useRoom((s) => s.focus !== null && focuses.includes(s.focus));
  const fade = useRef(1);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    fade.current += ((away ? 0 : 1) - fade.current) * (1 - Math.exp(-dt * 9));
    const v = fade.current;
    g.visible = v > 0.01;
    if (!g.visible) return;
    g.traverse((o) => {
      const m = (o as THREE.Mesh).isMesh ? ((o as THREE.Mesh).material as THREE.Material) : null;
      if (m) m.opacity = v;
    });
  });
  return <group ref={group}>{children}</group>;
}
/**
 * A standing lamp, 1.55 m tall, where the plant on the floor used to be. It fades away while the
 * sticky notes or the clock are looked at: it stands between the camera and them.
 */
function StandingLamp() {
  return (
    <FadeOnFocus focuses={["notes", "clock"]}>
      <Model asset="standing_lamp" position={POS.standingLamp} scale={1.55 / LAMP_FLOOR.height} process={setUpStandingLamp} />
    </FadeOnFocus>
  );
}

// The bin's file: 369 x 301 x 358 units, its base at y = 1.444, centred on x = 6.154, z = -0.387.
const BIN = { cx: 6.1535, cz: -0.3865, base: 1.444, height: 300.963 };
function setUpTrashCan(root: THREE.Group) {
  root.position.set(-BIN.cx, -BIN.base, -BIN.cz);
}
/** A waste bin on the floor at the right-hand end of the desk, 0.45 m tall. */
function TrashCan() {
  return <Model asset="trash_can" position={POS.trashCan} scale={0.45 / BIN.height} process={setUpTrashCan} />;
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
      <Model asset="desk_lamp_arm_01" position={POS.lamp} rotation={[0, LAMP_ROTATION, 0]} />
      <SaturnLamp />
      <Model asset="potted_plant_02" position={POS.deskPlant} scale={0.5} />
      <StandingLamp />
      <TrashCan />
    </group>
  );
}

for (const id of [
  "Television_01",
  "gaming_console",
  "gamepad",
  "desk_lamp_arm_01",
  "potted_plant_02",
  "standing_lamp",
  "trash_can",
  "hanging_picture_frame_01",
  "hanging_picture_frame_02",
]) {
  useGLTF.preload(path(id));
}
