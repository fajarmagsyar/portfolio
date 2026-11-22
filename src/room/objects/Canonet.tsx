"use client";

import { asset } from "@/asset";
import { useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { click } from "@/audio/sfx";
import { Interactive } from "../Interactive";
import { POS } from "../layout";
import { hint } from "../hint";
import { orbit } from "../orbit";
import { useRoom } from "../store";
import { tap } from "../touch";
import { useClone } from "./Guitar";
import { HitBox } from "./Props";

// Model: "Canonet QL17 III" by forpinik (Sketchfab). See CREDITS.md. The file holds a silver
// camera and a black one; the silver one is kept, with its textures reduced for the web.
const CANONET = asset("/models/sk/canonet.glb");

// The body is 21.07 units wide in the file; the real one is 120 mm. These are the file's
// own numbers for the middle of the camera and the underside of its base plate.
const SCALE = 0.12 / 21.07;
const CENTRE: [number, number, number] = [0.1, 0.655, -16.64];
const BASE = -5.732;
/** from the base plate up to the height it turns about when picked up */
const MID = (CENTRE[1] - BASE) * SCALE;
const REST_YAW = 0.42;

function Body() {
  const scene = useClone(CANONET);
  useMemo(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = (m.material as THREE.MeshPhysicalMaterial).clone();
      if (mat.name.includes("glass")) {
        // the file asks for true refraction, which costs a second pass of the whole room;
        // thin clear glass that mirrors the lamp and the tube reads the same at this size
        mat.transmission = 0;
        mat.transparent = true;
        mat.opacity = 0.28;
        mat.depthWrite = false;
        mat.envMapIntensity = 2.5;
      } else {
        mat.envMapIntensity = 1.4;
      }
      m.material = mat;
    });
  }, [scene]);
  return (
    <group rotation={[0, FRONT, 0]} scale={SCALE}>
      <primitive object={scene} position={[-CENTRE[0], -BASE, -CENTRE[2]]} />
    </group>
  );
}

/** which way the lens points in the file, turned to face +z here */
const FRONT = 0;

const TAU = Math.PI * 2;

/** The camera on the desk. Focused, it is picked up: drag turns it over in the hand. */
export function Canonet() {
  const held = useRoom((s) => s.focus === "canonet");
  const peeking = useRoom((s) => s.focus === "canonet" && s.finder);
  const ref = useRef<THREE.Group>(null);
  const turn = useRef({ yaw: REST_YAW, pitch: 0 });

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const t = turn.current;
    // put down, it goes back the short way round however many times it was spun
    if (!held) t.yaw = REST_YAW + ((((t.yaw - REST_YAW + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
    const k = 1 - Math.exp(-dt * (held ? 12 : 6));
    // (while the eye is at the viewfinder the drag is looking about, and the camera keeps as it was)
    t.yaw += ((held ? (peeking ? t.yaw : 0.55 - orbit.yaw) : REST_YAW) - t.yaw) * k;
    t.pitch += ((held ? (peeking ? t.pitch : 0.12 + orbit.pitch) : 0) - t.pitch) * k;
    g.rotation.set(t.pitch, t.yaw, 0);
    // with the eye at its viewfinder the camera itself is not seen: the eye is inside it
    g.visible = !peeking;
    const y = POS.canonet[1] + MID + (held ? 0.105 : 0);
    g.position.y += (y - g.position.y) * (1 - Math.exp(-dt * 6));
  });

  return (
    <Interactive target="canonet">
      <group
        ref={ref}
        position={[POS.canonet[0], POS.canonet[1] + MID, POS.canonet[2]]}
        rotation={[0, REST_YAW, 0]}
        // pointed at, it says what it is and what it means to its owner; held, a click puts the eye to its viewfinder
        onPointerOver={() => {
          // only once it has been picked up; from across the room it is just named
          if (held) hint("canonet_about");
        }}
        onPointerOut={() => {
          if (useRoom.getState().tip === "canonet_about") hint(null);
        }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (!held) return;
          e.stopPropagation();
          tap("canonet-finder", "canonet_about", e.nativeEvent.clientX, e.nativeEvent.clientY, () => {
            click(0.7);
            hint(null);
            useRoom.getState().setFinder(true);
          });
        }}
      >
        <group position={[0, -MID, 0]}>
          <Body />
        </group>
        <HitBox size={[0.14, 0.09, 0.1]} position={[0, 0, 0.012]} />
      </group>
    </Interactive>
  );
}

useGLTF.preload(CANONET);
