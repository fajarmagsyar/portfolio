"use client";

/* eslint-disable react-hooks/immutability -- the key meshes are moved every frame; three.js objects are mutable by design */

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { click } from "@/audio/sfx";
import { POS } from "../layout";
import { useRoom } from "../store";
import { useClone } from "./Guitar";

// Model: "Old Keyboard" by T4iri (CC BY-NC 4.0). See CREDITS.md.
// Every key is its own piece in the file, so the keyboard on the desk follows the real one:
// press a key and the same key goes down here, with a click.
const KEYBOARD = "/models/sk/old_keyboard.glb";

// The file is 341 units wide; on the desk it is 40 cm. Its middle, front to back, is at z = 48.
const SCALE = 0.4 / 341.2;
const MID_Z = 48.2;
const BASE = -1.88;
const TRAVEL = 2.6; // how far a key goes down, in the file's units

// Where each key's middle is in the file (x across, z towards the front), by the browser's
// name for the physical key. Rows, back to front.
const ROW = { fn: 17.2, num: 45, q: 58.4, a: 71.4, z: 84.6, space: 97.7 };
const across = (z: number, codes: string, xs: number[]) => codes.split(" ").map((code, i) => [code, xs[i], z] as const);
const SPOTS = new Map<string, readonly [number, number]>(
  [
    ...across(ROW.fn, "Escape F1 F2 F3 F4 F5 F6 F7 F8 F9 F10 F11 F12 PrintScreen ScrollLock Pause", [-144.8, -120.3, -107.2, -94.1, -81, -60, -46.9, -33.8, -20.6, -1.1, 12.1, 25.2, 38.3, 58.2, 71.3, 84.5]),
    ...across(
      ROW.num,
      "Backquote Digit1 Digit2 Digit3 Digit4 Digit5 Digit6 Digit7 Digit8 Digit9 Digit0 Minus Equal Backspace Insert Home PageUp NumLock NumpadDivide NumpadMultiply NumpadSubtract",
      [-144.8, -131.7, -118.6, -105.5, -92.4, -79.2, -66.1, -53, -39.9, -26.8, -13.6, -0.5, 12.6, 32.1, 58.2, 71.3, 84.5, 104.4, 117.5, 130.6, 143.7],
    ),
    ...across(
      ROW.q,
      "Tab KeyQ KeyW KeyE KeyR KeyT KeyY KeyU KeyI KeyO KeyP BracketLeft BracketRight Backslash Delete End PageDown Numpad7 Numpad8 Numpad9 NumpadAdd",
      [-142, -125.4, -112.3, -99.2, -86.1, -73, -59.8, -46.7, -33.6, -20.5, -7.4, 5.8, 18.9, 35.3, 58.2, 71.3, 84.5, 104.4, 117.5, 130.6, 143.7],
    ),
    ...across(ROW.a, "CapsLock KeyA KeyS KeyD KeyF KeyG KeyH KeyJ KeyK KeyL Semicolon Quote Enter Numpad4 Numpad5 Numpad6", [-140, -121.9, -108.8, -95.7, -82.6, -69.5, -56.3, -43.2, -30.1, -17, -3.9, 9.3, 30.6, 104.4, 117.5, 130.6]),
    ...across(
      ROW.z,
      "ShiftLeft KeyZ KeyX KeyC KeyV KeyB KeyN KeyM Comma Period Slash ShiftRight ArrowUp Numpad1 Numpad2 Numpad3 NumpadEnter",
      [-136.6, -115.1, -102, -88.9, -75.9, -62.8, -49.6, -36.5, -23.4, -10.3, 2.8, 27.2, 71.3, 104.4, 117.5, 130.6, 143.7],
    ),
    ...across(ROW.space, "ControlLeft AltLeft Space AltRight ControlRight ArrowLeft ArrowDown ArrowRight Numpad0 NumpadDecimal", [-142, -108.9, -53, 2.4, 35.3, 58.2, 71.3, 84.5, 111, 130.6]),
  ].map(([code, x, z]) => [code, [x, z] as const]),
);

type Key = { mesh: THREE.Object3D; rest: THREE.Vector3; down: THREE.Vector3; at: number };

/** The keys currently held on the real keyboard. Module-wide, so nothing re-renders as you type. */
const held = new Set<string>();

export function Keyboard() {
  const scene = useClone(KEYBOARD);
  const booted = useRoom((s) => s.booted);

  const keys = useMemo(() => {
    scene.updateMatrixWorld(true);
    const out = new Map<string, Key>();
    const boxes: { mesh: THREE.Mesh; box: THREE.Box3 }[] = [];
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      // the file marks the whole keyboard as see-through, which it is not
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      mat.transparent = false;
      mat.depthWrite = true;
      // and as glowing all over; only its lock lights should, and those are off
      mat.emissiveIntensity = 0;
      // pale plastic a hand's width from the tube: taken down so it does not burn out in its light
      mat.color.multiplyScalar(0.42);
      mat.envMapIntensity = 0.5;
      m.material = mat;
      const box = new THREE.Box3().setFromObject(m);
      // the case and the plate under the keys are the two big pieces; everything else is a key
      if (box.max.x - box.min.x < 120) boxes.push({ mesh: m, box });
    });
    for (const [code, [x, z]] of SPOTS) {
      const hit = boxes.find(({ box }) => x > box.min.x && x < box.max.x && z > box.min.z && z < box.max.z);
      if (!hit || !hit.mesh.parent) continue;
      const parent = hit.mesh.parent;
      const down = parent.worldToLocal(new THREE.Vector3(0, -TRAVEL, 0)).sub(parent.worldToLocal(new THREE.Vector3()));
      out.set(code, { mesh: hit.mesh, rest: hit.mesh.position.clone(), down, at: 0 });
    }
    return out;
  }, [scene]);

  // Listens before anything else can swallow the key (the TV takes some for itself), and
  // never claims it: this only watches.
  useEffect(() => {
    if (!booted) return;
    const down = (e: KeyboardEvent) => {
      if (e.repeat || held.has(e.code)) return;
      held.add(e.code);
      // wide keys land with a lower note
      const big = e.code === "Space" || e.code === "Enter" || e.code === "Backspace" || e.code.startsWith("Shift");
      click((big ? 0.62 : 0.95) + Math.random() * 0.22);
    };
    const up = (e: KeyboardEvent) => {
      if (held.delete(e.code)) click(1.5 + Math.random() * 0.2);
    };
    // a key let go while the window was elsewhere would otherwise stay down for good
    const clear = () => held.clear();
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
      window.removeEventListener("blur", clear);
      held.clear();
    };
  }, [booted]);

  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 38);
    for (const [code, key] of keys) {
      key.at += ((held.has(code) ? 1 : 0) - key.at) * k;
      key.mesh.position.copy(key.rest).addScaledVector(key.down, key.at);
    }
  });

  return (
    <group position={POS.keyboard} scale={SCALE}>
      <primitive object={scene} position={[0, -BASE, -MID_Z]} />
    </group>
  );
}

useGLTF.preload(KEYBOARD);
