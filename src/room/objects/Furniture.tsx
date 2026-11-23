"use client";

import { asset } from "@/asset";
import { useGLTF } from "@react-three/drei";
import { Interactive } from "../Interactive";
import { POS, WALL_Z } from "../layout";
import { useRoom } from "../store";
import { Clock } from "./Clock";
import { FadeOnFocus, Model, fadable } from "./Props";

// What stands around the desk, so the room is not bare when the view is turned: a bookshelf
// against the back wall on the right with a reading chair in front of it, and a chest of
// drawers along the left wall. All of it is from Poly Haven (CC0), fetched by
// scripts/fetch-assets.mjs; nothing here is built in code. Heights are the models' own:
// the bookshelf's shelves are at 0.06, 0.38, 0.95 and 1.65 m and its top at 2.06; the
// chest's top is at 1.09 before scaling; the side table's at 0.55.

const SHELF: [number, number, number] = [2.2, 0, WALL_Z + 0.3];
const CHEST: [number, number, number] = [-1.98, 0, 0.7];
const CHEST_SCALE = 0.64;
const CHEST_TOP = 1.09 * CHEST_SCALE;
const TABLE: [number, number, number] = [2.95, 0, 0.5];

/** The reading chair stands between the camera and the guitar, so it fades away while the guitar is looked at. */
function LoungeChair() {
  return (
    <FadeOnFocus focuses={["guitar"]}>
      <Model asset="mid_century_lounge_chair" position={[-0.9, 0, 0.6]} rotation={[0, 2.7, 0]} scale={0.8} process={fadable} />
    </FadeOnFocus>
  );
}

export function Furniture() {
  return (
    <group>
      {/* right: the bookshelf, with what is kept on it */}
      <group position={SHELF}>
        <Model asset="wooden_bookshelf_worn" />
        <Model asset="book_encyclopedia_set_01" position={[-0.58, 0.95, 0.02]} />
        <Model asset="book_encyclopedia_set_01" position={[0.02, 1.65, 0.0]} rotation={[0, 0.04, 0]} />
        <Model asset="book_encyclopedia_set_01" position={[-0.5, 0.38, 0.03]} />
        <Model asset="potted_plant_04" position={[0.4, 0.95, 0.04]} scale={1.1} />
        <Clock position={[0.3, 0.38 + 0.13, 0.08]} rotation={[-0.12, -0.2, 0]} scale={0.8} />
      </group>
      {/* a chair to read in, turned towards the desk, and a small table beside it */}
      <LoungeChair />
      <Model asset="side_table_01" position={TABLE} rotation={[0, 0, 0]} />
      <Model asset="potted_plant_04" position={[TABLE[0], 0.55, TABLE[2]]} rotation={[0, 1.2, 0]} scale={1.4} />

      {/* left: the chest of drawers along the wall, with the boombox on it */}
      <Model asset="vintage_wooden_drawer_01" position={CHEST} rotation={[0, Math.PI / 2, 0]} scale={CHEST_SCALE} />
      <Model asset="boombox" position={[CHEST[0] - 0.05 * CHEST_SCALE, CHEST_TOP, CHEST[2] + 0.05 * CHEST_SCALE]} rotation={[0, Math.PI / 2 - 0.12, 0]} />
      {/* and a clock on the back wall beside the window, where a glance from the desk finds it. Both clocks keep the real time. */}
      <Interactive target="clock" position={POS.clock}>
        <group
          onPointerMove={(e) => {
            if (useRoom.getState().focus !== "clock") return;
            e.stopPropagation();
            document.body.style.cursor = "crosshair";
          }}
          onPointerOut={() => {
            if (document.body.style.cursor === "crosshair") document.body.style.cursor = "";
          }}
          onClick={(e) => {
            const s = useRoom.getState();
            if (s.focus !== "clock") return;
            e.stopPropagation();
            s.nudgeClock();
          }}
        >
          <Clock scale={0.8} />
        </group>
      </Interactive>
    </group>
  );
}

for (const id of ["wooden_bookshelf_worn", "book_encyclopedia_set_01", "boombox", "mid_century_lounge_chair", "side_table_01", "vintage_wooden_drawer_01", "wall_clock", "potted_plant_04"]) {
  useGLTF.preload(asset(`/models/${id}/${id}.gltf`));
}
