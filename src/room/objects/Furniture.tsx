"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { Interactive } from "../Interactive";
import { POS, WALL_Z } from "../layout";
import { Clock } from "./Clock";
import { Model } from "./Props";

// What stands around the desk, so the room is not bare when the view is turned: a bookshelf
// against the back wall on the right with a reading chair in front of it, and a chest of
// drawers along the left wall. All of it is from Poly Haven (CC0), fetched by
// scripts/fetch-assets.mjs; nothing here is built in code. Heights are the models' own:
// the bookshelf's shelves are at 0.06, 0.38, 0.95 and 1.65 m and its top at 2.06; the
// chest's top is at 1.09; the side table's at 0.55.

const SHELF: [number, number, number] = [2.2, 0, WALL_Z + 0.3];
const CHEST: [number, number, number] = [-2.75, 0, 0.75];
const TABLE: [number, number, number] = [2.95, 0, 0.5];
/** the flame of the oil lamp on the chest */
const FLAME: [number, number, number] = [CHEST[0] - 0.05, 1.09 + 0.52, CHEST[2] - 0.62];

export function Furniture() {
  const flame = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    // an oil flame is never quite steady
    const t = clock.elapsedTime;
    if (flame.current) flame.current.intensity = 0.9 + Math.sin(t * 7.3) * 0.06 + Math.sin(t * 2.1) * 0.08;
  });
  return (
    <group>
      {/* right: the bookshelf, with what is kept on it */}
      <group position={SHELF}>
        <Model asset="wooden_bookshelf_worn" />
        <Model asset="book_encyclopedia_set_01" position={[-0.58, 0.95, 0.02]} />
        <Model asset="book_encyclopedia_set_01" position={[0.02, 1.65, 0.0]} rotation={[0, 0.04, 0]} />
        <Model asset="book_encyclopedia_set_01" position={[-0.5, 0.38, 0.03]} />
        <Model asset="potted_plant_04" position={[0.4, 0.95, 0.04]} scale={1.1} />
        <Model asset="ceramic_vase_03" position={[-0.4, 1.65, 0.02]} scale={0.85} />
        <Clock position={[0.3, 0.38 + 0.13, 0.08]} rotation={[-0.12, -0.2, 0]} scale={0.8} />
      </group>
      {/* a chair to read in, turned towards the desk, and a small table beside it */}
      <Model asset="mid_century_lounge_chair" position={[2.3, 0, 1.3]} rotation={[0, -2.35, 0]} />
      <Model asset="side_table_01" position={TABLE} rotation={[0, -0.3, 0]} />
      <Model asset="potted_plant_04" position={[TABLE[0], 0.55, TABLE[2]]} rotation={[0, 1.2, 0]} scale={1.4} />

      {/* left: the chest of drawers along the wall, with the boombox, a vase and an oil lamp on it */}
      <Model asset="vintage_wooden_drawer_01" position={CHEST} rotation={[0, Math.PI / 2, 0]} />
      <Model asset="boombox" position={[CHEST[0] - 0.05, 1.09, CHEST[2] + 0.05]} rotation={[0, Math.PI / 2 - 0.12, 0]} />
      <Model asset="ceramic_vase_03" position={[CHEST[0] - 0.1, 1.09, CHEST[2] + 0.66]} />
      <Model asset="vintage_oil_lamp" position={[FLAME[0], 1.09, FLAME[2]]} scale={0.7} />
      <pointLight ref={flame} position={FLAME} color="#ffb060" distance={3.2} decay={1.8} />
      {/* and a clock on the back wall beside the window, where a glance from the desk finds it. Both clocks keep the real time. */}
      <Interactive target="clock" position={POS.clock}>
        <Clock scale={0.8} />
      </Interactive>
    </group>
  );
}

for (const id of ["wooden_bookshelf_worn", "book_encyclopedia_set_01", "boombox", "mid_century_lounge_chair", "side_table_01", "vintage_wooden_drawer_01", "wall_clock", "potted_plant_04", "ceramic_vase_03", "vintage_oil_lamp"]) {
  useGLTF.preload(`/models/${id}/${id}.gltf`);
}
