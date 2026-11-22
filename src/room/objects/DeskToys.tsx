"use client";

import { asset } from "@/asset";
import { useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { click } from "@/audio/sfx";
import { hint } from "../hint";
import { Interactive } from "../Interactive";
import { POS } from "../layout";
import { useRoom } from "../store";
import { holdCancel, holdMove, holdStart, tap } from "../touch";
import { canvasTexture, rng } from "../textures";
import { useClone } from "./Guitar";

// Models: see CREDITS.md.
//  - "Simple PC Mouse" by SugarSatea (Sketchfab Standard licence)
//  - "RPG Dice Set" by ghosted (CC BY 4.0): the file has seven sets, one of each colour; the orange one is kept
const MOUSE = asset("/models/sk/mouse.glb");
const DICE = asset("/models/sk/dice.glb");

/* ---------- the mouse ---------- */

// The mouse in the file is 12 cm across; a real one is about 6.5.
const MOUSE_SCALE = 0.54;
/** how far it slides about its place as the real one is moved, in metres */
const REACH = { x: 0.045, z: 0.03 };

// The grain moulded into old computer plastic: fine, even, and dull.
let pebble: THREE.Texture | null = null;
function plastic() {
  pebble ??= (() => {
    const t = canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = "rgb(190,190,190)";
      ctx.fillRect(0, 0, w, h);
      const r = rng(53);
      for (let i = 0; i < 14000; i++) {
        const v = r() > 0.5 ? 255 : 90;
        ctx.fillStyle = `rgba(${v},${v},${v},${0.1 + r() * 0.25})`;
        ctx.fillRect(r() * w, r() * h, 1 + r() * 1.5, 1 + r() * 1.5);
      }
    });
    t.colorSpace = THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(6, 6);
    return t;
  })();
  return pebble;
}

/** The mouse beside the keyboard. It goes where the visitor's own mouse goes, on its own small patch of desk. */
export function Mouse() {
  const whole = useClone(MOUSE);
  const scene = useMemo(() => {
    // The file's mouse is gloss black. This one is from the same years as the keyboard:
    // grey-beige plastic with a moulded grain, gone a little dull.
    const grain = plastic();
    const shell = new THREE.MeshStandardMaterial({ color: "#8e8b84", roughness: 0.92, envMapIntensity: 0.35 });
    whole.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (m.geometry.attributes.uv) {
        shell.roughnessMap = grain;
        shell.bumpMap = grain;
        shell.bumpScale = 0.5;
      }
      m.material = shell;
    });
    return whole;
  }, [whole]);
  const ref = useRef<THREE.Group>(null);
  useFrame(({ pointer }, dt) => {
    const g = ref.current;
    if (!g) return;
    // only while sitting at the desk with a mouse: on touch there is no cursor to follow
    const s = useRoom.getState();
    const used = s.booted && s.focus === null && s.input !== "touch";
    const k = 1 - Math.exp(-dt * 14);
    g.position.x += (POS.mouse[0] + (used ? pointer.x * REACH.x : 0) - g.position.x) * k;
    g.position.z += (POS.mouse[2] - (used ? pointer.y * REACH.z : 0) - g.position.z) * k;
  });
  return (
    <group ref={ref} position={POS.mouse} rotation={[0, 0.06, 0]}>
      <primitive object={scene} scale={MOUSE_SCALE} />
    </group>
  );
}

/* ---------- the dice ---------- */

// The dice in the file are about 1.2 units across, and a real d20 is about 22 mm. The orange
// set lies around this point of the file.
const DICE_SCALE = 0.0185;
const DICE_MID: [number, number] = [-7.66, 5.27];
/** the patch of desk they are thrown on, about where they lie: they bounce back off its edges */
const TRAY = { x: [-0.1, 0.1], z: [-0.075, 0.05] };
const GRAVITY = 9.8;

type Face = { normal: THREE.Vector3; depth: number };
/** A die as the file has it. */
type Shape = {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
  /** half its width, near enough: it is treated as a ball while it is in the air */
  radius: number;
  /** the flat faces it can come to rest on: which way each points, and how far it is from the middle */
  faces: Face[];
  /** where it lies to begin with */
  home: THREE.Vector3;
};
/** A die on the desk: where it is and how it is moving. */
type Die = {
  radius: number;
  faces: Face[];
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  quat: THREE.Quaternion;
  turn: THREE.Vector3;
  /** lying still (or settling onto a face); when not, it is in flight */
  resting: boolean;
  restQuat: THREE.Quaternion;
  restY: number;
};

const a = new THREE.Vector3();
const b = new THREE.Vector3();
const c = new THREE.Vector3();
const n = new THREE.Vector3();
const dq = new THREE.Quaternion();
const DOWN = new THREE.Vector3(0, -1, 0);

/** The flat faces of a die: its triangles gathered by which way they point, leaving out the bevels between them. */
function facesOf(g: THREE.BufferGeometry): Face[] {
  const pos = g.attributes.position;
  const index = g.index;
  const found: { normal: THREE.Vector3; area: number }[] = [];
  const count = index ? index.count : pos.count;
  for (let t = 0; t < count; t += 3) {
    const at = (k: number) => (index ? index.getX(t + k) : t + k);
    a.fromBufferAttribute(pos, at(0));
    b.fromBufferAttribute(pos, at(1));
    c.fromBufferAttribute(pos, at(2));
    n.crossVectors(b.sub(a), c.sub(a));
    const area = n.length() / 2;
    if (area < 1e-12) continue;
    n.normalize();
    const same = found.find((f) => f.normal.dot(n) > 0.985);
    if (same) same.area += area;
    else found.push({ normal: n.clone(), area });
  }
  const largest = Math.max(...found.map((f) => f.area));
  return found
    .filter((f) => f.area > largest * 0.35)
    .map((f) => {
      let depth = 0;
      for (let i = 0; i < pos.count; i++) depth = Math.max(depth, a.fromBufferAttribute(pos, i).dot(f.normal));
      return { normal: f.normal, depth };
    });
}

/** Each die of the set as a thing of its own: its shape about its own middle, in metres, and where it lies. */
function useDice() {
  const { scene } = useGLTF(DICE);
  return useMemo(() => {
    scene.updateMatrixWorld(true);
    const dice: Shape[] = [];
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
      g.translate(-DICE_MID[0], 0, -DICE_MID[1]).scale(DICE_SCALE, DICE_SCALE, DICE_SCALE);
      g.computeBoundingBox();
      const mid = g.boundingBox!.getCenter(new THREE.Vector3());
      g.translate(-mid.x, -mid.y, -mid.z);
      g.computeBoundingSphere();
      dice.push({
        geometry: g,
        material: m.material,
        radius: g.boundingSphere!.radius * 0.8,
        faces: facesOf(g),
        home: mid,
      });
    });
    return dice;
  }, [scene]);
}

/** Comes down on whichever face is lowest: turned the least it needs to lie flat on it. */
function settle(d: Die) {
  let low: Face | null = null;
  let lowest = Infinity;
  for (const f of d.faces) {
    const y = n.copy(f.normal).applyQuaternion(d.quat).y;
    if (y < lowest) {
      lowest = y;
      low = f;
    }
  }
  d.resting = true;
  if (!low) return;
  d.restQuat.setFromUnitVectors(n.copy(low.normal).applyQuaternion(d.quat), DOWN).multiply(d.quat);
  d.restY = low.depth;
}

/**
 * A set of polyhedral dice. Looked at close, a click picks them all up and throws them: they
 * fly, knock against each other and the edges of their patch of desk, and each comes to rest
 * on one of its faces.
 */
export function Dice() {
  const shapes = useDice();
  const focus = useRoom((s) => s.focus);
  const live = focus === "dice";
  const table = useRef<Die[] | null>(null);
  /** the dice as they are now; to begin with, as the file left them */
  const all = () =>
    (table.current ??= shapes.map((d) => ({
      radius: d.radius,
      faces: d.faces,
      pos: d.home.clone(),
      vel: new THREE.Vector3(),
      quat: new THREE.Quaternion(),
      turn: new THREE.Vector3(),
      resting: true,
      restQuat: new THREE.Quaternion(),
      restY: d.home.y,
    })));
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const heard = useRef(0);

  const knock = (speed: number) => {
    const t = performance.now();
    if (speed < 0.35 || t - heard.current < 45) return;
    heard.current = t;
    click(0.8 + Math.random() * 0.7);
  };

  const roll = () => {
    for (const d of all()) {
      d.resting = false;
      d.pos.y = Math.max(d.pos.y, d.radius) + 0.012;
      // up and in towards the middle, each its own way, spinning hard
      d.vel.set((Math.random() - 0.5) * 0.7 - d.pos.x * 2.2, 1.3 + Math.random() * 0.8, (Math.random() - 0.5) * 0.6 - d.pos.z * 2.2);
      d.turn.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(14 + Math.random() * 16);
    }
    click(0.6);
  };

  useFrame((_, frame) => {
    // two short steps a frame, and never a long one after the tab has been away
    const dt = Math.min(frame, 1 / 30) / 2;
    const dice = all();
    for (let step = 0; step < 2; step++) {
      for (const d of dice) {
        if (d.resting) {
          const k = 1 - Math.exp(-dt * 16);
          d.quat.slerp(d.restQuat, k);
          d.pos.y += (d.restY - d.pos.y) * k;
          continue;
        }
        d.vel.y -= GRAVITY * dt;
        d.pos.addScaledVector(d.vel, dt);
        const spin = d.turn.length();
        if (spin > 1e-4) d.quat.premultiply(dq.setFromAxisAngle(n.copy(d.turn).divideScalar(spin), spin * dt)).normalize();
        // the desk
        if (d.pos.y < d.radius) {
          d.pos.y = d.radius;
          if (d.vel.y < 0) {
            knock(-d.vel.y);
            d.vel.y *= -0.4;
            d.vel.x *= 0.78;
            d.vel.z *= 0.78;
            // rolling: what it is doing along the desk turns it over
            d.turn.multiplyScalar(0.6).add(n.set(d.vel.z, 0, -d.vel.x).multiplyScalar(18));
          }
          if (d.vel.length() < 0.14 && d.turn.length() < 3.5) settle(d);
        }
        // the edges of its patch
        for (const [axis, range] of [
          ["x", TRAY.x],
          ["z", TRAY.z],
        ] as const) {
          if (d.pos[axis] < range[0] && d.vel[axis] < 0) d.vel[axis] *= -0.5;
          if (d.pos[axis] > range[1] && d.vel[axis] > 0) d.vel[axis] *= -0.5;
          d.pos[axis] = THREE.MathUtils.clamp(d.pos[axis], range[0], range[1]);
        }
      }
      // each other: balls that push apart and trade what speed they had towards one another
      for (let i = 0; i < dice.length; i++) {
        for (let j = i + 1; j < dice.length; j++) {
          const p = dice[i];
          const q = dice[j];
          if (p.resting && q.resting) continue;
          n.subVectors(q.pos, p.pos);
          const gap = n.length();
          const reach = p.radius + q.radius;
          if (gap >= reach || gap < 1e-6) continue;
          n.divideScalar(gap);
          const closing = p.vel.dot(n) - q.vel.dot(n);
          for (const [d, side] of [
            [p, -1],
            [q, 1],
          ] as const) {
            if (d.resting) {
              // knocked into: it goes skidding, and has to settle again
              d.resting = false;
              d.vel.set(0, 0.25, 0);
              d.turn.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(8);
            }
            d.pos.addScaledVector(n, (side * (reach - gap)) / 2);
            if (closing > 0) d.vel.addScaledVector(n, side * closing * 0.6);
          }
          knock(closing);
        }
      }
    }
    dice.forEach((d, i) => {
      const m = meshes.current[i];
      if (!m) return;
      m.position.copy(d.pos);
      m.quaternion.copy(d.quat);
    });
  });

  return (
    <Interactive target="dice" position={POS.dice}>
      <group
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          if (focus !== "dice") return;
          holdStart("dice-roll", "tip_dice", e.nativeEvent.clientX, e.nativeEvent.clientY);
        }}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => holdMove(e.nativeEvent.clientX, e.nativeEvent.clientY)}
        onPointerUp={holdCancel}
        onPointerCancel={holdCancel}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (focus !== "dice") return;
          e.stopPropagation();
          tap("dice-roll", "tip_dice", e.nativeEvent.clientX, e.nativeEvent.clientY, roll);
        }}
        onPointerOver={() => {
          if (live) hint("tip_dice");
        }}
        onPointerOut={() => {
          if (live) hint(null);
        }}
      >
        {shapes.map((d, i) => (
          <mesh
            key={i}
            ref={(m) => {
              meshes.current[i] = m;
            }}
            geometry={d.geometry}
            material={d.material}
            position={d.home}
            castShadow
            receiveShadow
          />
        ))}
        {/* the patch of desk they lie on takes the click too, so the throw does not need a die to be hit */}
        {live && (
          <mesh position={[0, 0.001, (TRAY.z[0] + TRAY.z[1]) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[TRAY.x[1] - TRAY.x[0] + 0.06, TRAY.z[1] - TRAY.z[0] + 0.06]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        )}
      </group>
    </Interactive>
  );
}

useGLTF.preload(MOUSE);
useGLTF.preload(DICE);
