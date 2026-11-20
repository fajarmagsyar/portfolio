"use client";

import { useEffect, useMemo } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { pluck, strum } from "@/audio/guitar";
import { Interactive } from "../Interactive";
import { POS } from "../layout";
import { useRoom } from "../store";

// Models: see CREDITS.md.
//  - "Fender Telecaster 1952" by Kanade_Tatibana (CC BY 4.0)
//  - "Marshall Guitar Amp" by D3 (CC BY 4.0)
//  - "Wooden guitar stand | Guitar rack asset" by Hineline (CC BY 4.0)
const TELE = "/models/sk/telecaster.glb";
const AMP = "/models/sk/amp.glb";
const STAND = "/models/sk/guitar_stand.glb";

/** Clone of a loaded scene with shadows switched on. */
export function useClone(url: string) {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return c;
  }, [scene]);
}

// The guitar file lies flat, face up, headstock towards -z, 13.8 units long.
// These numbers are in the file's own units.
const T = {
  scale: 0.99 / 13.8, // a real one is about 99 cm long
  axisX: -0.035, // centre line of the strings
  backY: 8.842, // back of the body
  bottomZ: 6.872, // strap-button end of the body
  frontY: 9.59, // height of the strings above the back
  bridgeZ: 4.987,
  nutZ: -4.115,
  // string meshes, low E first, and where each one sits across the neck
  strings: ["Object_51", "Object_52", "Object_53", "Object_54", "Object_55", "Object_56"],
  stringX: [-0.368, -0.221, -0.103, 0.038, 0.166, 0.305],
};

const now = () => performance.now() / 1000;

/**
 * The Telecaster, stood upright: origin at the bottom of the body on the string axis,
 * +y towards the headstock, +z out of the front.
 */
function Telecaster() {
  const scene = useClone(TELE);
  const focus = useRoom((s) => s.focus);
  const markPluck = useRoom((s) => s.markPluck);

  const strings = useMemo(
    () => T.strings.map((name) => scene.getObjectByName(name) ?? null).map((o) => (o ? { o, x: o.position.x } : null)),
    [scene],
  );

  const doPluck = (i: number, velocity = 1) => {
    if (pluck(i, velocity)) markPluck(i, now());
  };

  // keys 1-6 pluck single strings, space strums (shift = upstroke)
  useEffect(() => {
    if (focus !== "guitar") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 6) doPluck(n - 1);
      if (e.key === " ") {
        e.preventDefault();
        strum((s) => useRoom.getState().markPluck(s, now()), e.shiftKey);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  // a plucked string shivers sideways for a couple of seconds
  useFrame(() => {
    const t = now();
    const plucks = useRoom.getState().plucks;
    strings.forEach((s, i) => {
      if (!s) return;
      const age = t - plucks[i];
      s.o.position.x = s.x + (age < 2.5 ? Math.sin(age * (70 + i * 14)) * 0.022 * Math.exp(-age * 2.6) : 0);
    });
  });

  const y0 = (T.bottomZ - T.bridgeZ) * T.scale;
  const y1 = (T.bottomZ - T.nutZ) * T.scale;
  const z = (T.frontY - T.backY) * T.scale + 0.004;
  return (
    <group>
      <group rotation={[Math.PI / 2, 0, 0]} scale={T.scale}>
        <primitive object={scene} position={[-T.axisX, -T.backY, -T.bottomZ]} />
      </group>
      {/* an invisible strip over each string catches the pointer */}
      {T.stringX.map((sx, i) => (
        <mesh
          key={i}
          position={[(sx - T.axisX) * T.scale, (y0 + y1) / 2, z]}
          onPointerEnter={(e: ThreeEvent<PointerEvent>) => {
            if (focus !== "guitar") return;
            e.stopPropagation();
            doPluck(i, 0.55 + Math.min(0.45, Math.abs(e.movementX ?? 0) / 20));
          }}
          onPointerDown={(e: ThreeEvent<PointerEvent>) => {
            if (focus !== "guitar") return;
            e.stopPropagation();
            doPluck(i);
          }}
        >
          <planeGeometry args={[0.0092, y1 - y0]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function Amp() {
  const scene = useClone(AMP);
  // the file is 0.136 wide and centred on its middle; a practice combo is about 45 cm
  const s = 0.45 / 0.136;
  return (
    <group position={POS.amp} rotation={[0, 0.5, 0]}>
      <primitive object={scene} scale={s} position={[0, 0.0669 * s, 0]} />
    </group>
  );
}

export function Guitar() {
  const stand = useClone(STAND);
  return (
    <>
      <Amp />
      <Interactive target="guitar" position={POS.guitar} rotation={[0, 0.45, 0]}>
        {/* the stand's two sides meet at a right angle; turned 45 degrees its cradle faces forward */}
        <primitive object={stand} rotation={[0, Math.PI / 4, 0]} />
        {/* body resting in the cradle, neck leaning back on the upright */}
        <group position={[0, 0.062, 0.168]} rotation={[-0.4, 0, 0]}>
          <Telecaster />
        </group>
      </Interactive>
    </>
  );
}

useGLTF.preload(TELE);
useGLTF.preload(AMP);
useGLTF.preload(STAND);
