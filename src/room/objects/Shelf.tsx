"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { DESK, SHELF } from "../layout";
import { rng } from "../textures";

// A small desktop tray for the cassettes and CDs, built here: a floor, a low back, two ends
// with their front corners rounded off, and a divider. Everything in it stands taller than
// its sides, spines out, like books in a trough.
//
// The wood is painted here too, at the scale of the tray: at this size a photographed floor
// plank is one blurred streak. Three sheets are drawn together from the same strokes, so
// they agree: the colour, how rough each spot is, and its relief. Long grain lines run the
// length of the board, a few broad bands of darker growth cross it, and the open pores are
// dark, dull and sunk in.

const T = SHELF.wall;
const SIDE = 0.07; // height of the ends and the back
const PX = 768;

function paintWood(seed: number) {
  const sheet = () => {
    const c = document.createElement("canvas");
    c.width = c.height = PX;
    return c;
  };
  const cc = sheet();
  const cr = sheet();
  const cb = sheet();
  const colour = cc.getContext("2d")!;
  const rough = cr.getContext("2d")!;
  const bump = cb.getContext("2d")!;
  colour.fillStyle = "#8f5c33";
  rough.fillStyle = "rgb(226,226,226)";
  bump.fillStyle = "rgb(128,128,128)";
  for (const ctx of [colour, rough, bump]) ctx.fillRect(0, 0, PX, PX);
  const r = rng(seed);

  // one stroke, drawn on all three sheets; it wanders a whole number of times across the
  // sheet so the pattern joins up with itself where it repeats
  const line = (y: number, wander: number, turns: number, phase: number, width: number, c: string, ro: string, b: string) => {
    for (const [ctx, style] of [
      [colour, c],
      [rough, ro],
      [bump, b],
    ] as const) {
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (let x = 0; x <= PX; x += 16) {
        const yy = y + Math.sin((x / PX) * Math.PI * 2 * turns + phase) * wander;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
  };

  // broad bands of growth: darker, a touch glossier, slightly proud
  for (let i = 0; i < 9; i++) {
    const a = 0.1 + r() * 0.16;
    line(r() * PX, 6 + r() * 14, 1, r() * 6, 14 + r() * 38, `rgba(58,30,12,${a})`, `rgba(196,196,196,${a})`, `rgba(165,165,165,${a})`);
  }
  // the grain itself: hundreds of fine lines, light and dark
  for (let i = 0; i < 620; i++) {
    const dark = r() > 0.42;
    const a = 0.07 + r() * 0.24;
    const turns = 1 + Math.floor(r() * 2);
    line(
      r() * PX,
      2 + r() * 7,
      turns,
      r() * 6,
      0.6 + r() * 2.2,
      dark ? `rgba(52,26,10,${a})` : `rgba(226,170,112,${a})`,
      dark ? `rgba(255,255,255,${a})` : `rgba(184,184,184,${a})`,
      dark ? `rgba(40,40,40,${a * 1.5})` : `rgba(215,215,215,${a})`,
    );
  }
  // open pores: short dashes along the grain, dark, matt and sunk in
  for (let i = 0; i < 5200; i++) {
    const x = r() * PX;
    const y = r() * PX;
    const len = 3 + r() * 12;
    const a = 0.25 + r() * 0.45;
    colour.fillStyle = `rgba(38,18,6,${a})`;
    rough.fillStyle = `rgba(255,255,255,${a})`;
    bump.fillStyle = `rgba(10,10,10,${a})`;
    for (const ctx of [colour, rough, bump]) ctx.fillRect(x, y, len, 1 + r() * 0.8);
  }

  // a knot or two: rings of tight dark grain
  for (let i = 0; i < 2; i++) {
    const kx = r() * PX;
    const ky = r() * PX;
    const size = 9 + r() * 9;
    for (let ring = 6; ring >= 0; ring--) {
      const a = 0.16 + (6 - ring) * 0.07;
      for (const [ctx, style] of [
        [colour, `rgba(44,22,9,${a})`],
        [rough, `rgba(255,255,255,${a})`],
        [bump, `rgba(30,30,30,${a * 0.8})`],
      ] as const) {
        ctx.strokeStyle = style;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(kx, ky, size * (0.5 + ring * 0.45), size * (0.22 + ring * 0.2), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  // scuffs from years of cases going in and out: short pale scratches across the grain, dry and shallow
  for (let i = 0; i < 70; i++) {
    const x = r() * PX;
    const y = r() * PX;
    const dx = (r() - 0.5) * 26;
    const dy = (r() - 0.5) * 90;
    const a = 0.05 + r() * 0.12;
    for (const [ctx, style] of [
      [colour, `rgba(214,178,138,${a})`],
      [rough, `rgba(255,255,255,${a * 2})`],
      [bump, `rgba(70,70,70,${a * 1.6})`],
    ] as const) {
      ctx.strokeStyle = style;
      ctx.lineWidth = 0.6 + r() * 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + dx, y + dy);
      ctx.stroke();
    }
  }
  // the fibre itself: fine streaks a few pixels long, so no patch of the board is perfectly even
  const fibre = (ctx: CanvasRenderingContext2D, amount: number) => {
    const img = ctx.getImageData(0, 0, PX, PX);
    const d = img.data;
    for (let y = 0; y < PX; y++) {
      let run = 0;
      let v = 0;
      for (let x = 0; x < PX; x++) {
        if (run-- <= 0) {
          run = 2 + Math.floor(r() * 7);
          v = (r() - 0.5) * 2 * amount;
        }
        const i = (y * PX + x) * 4;
        d[i] += v;
        d[i + 1] += v;
        d[i + 2] += v;
      }
    }
    ctx.putImageData(img, 0, 0);
  };
  fibre(colour, 9);
  fibre(rough, 20);
  fibre(bump, 16);

  const tex = (c: HTMLCanvasElement, isColour: boolean) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = isColour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
  };
  return { map: tex(cc, true), roughnessMap: tex(cr, false), bumpMap: tex(cb, false) };
}

export function Shelf() {
  const { wood, dark, end } = useMemo(() => {
    const maps = paintWood(41);
    // the roughness sheet carries the variation; bump height is in the model's metres.
    // Bare, unvarnished wood: it barely mirrors the room at all.
    const shared = { ...maps, roughness: 1, bumpScale: 2.6, envMapIntensity: 0.25 };
    const wood = new THREE.MeshStandardMaterial({ ...shared, color: "#ffe9d0" });
    const dark = new THREE.MeshStandardMaterial({ ...shared, color: "#c9a888" });
    // an end in profile, front to back: square at the back, the top front corner rounded off
    const depth = SHELF.front - SHELF.back;
    const r = 0.034;
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(depth, 0);
    s.lineTo(depth, SIDE);
    s.lineTo(r, SIDE);
    s.quadraticCurveTo(0, SIDE, 0, SIDE - r);
    s.closePath();
    const end = new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: true, bevelSize: 0.0012, bevelThickness: 0.0012, bevelSegments: 2 });
    // the extrusion's own UVs are in metres; one sheet of wood covers about 17 cm, as on the boards
    const uv = end.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, uv.getY(i) * 6);
    return { wood, dark, end };
  }, []);
  useEffect(
    () => () => {
      for (const t of [wood.map, wood.roughnessMap, wood.bumpMap]) t?.dispose();
      wood.dispose();
      dark.dispose();
      end.dispose();
    },
    [wood, dark, end],
  );

  const depth = SHELF.front - SHELF.back;
  const mid = (SHELF.front + SHELF.back) / 2;
  const half = SHELF.inner / 2;
  return (
    <group position={[SHELF.x, DESK.y, 0]}>
      {/* the ends: the profile is drawn front to back and stood on edge */}
      {[-1, 1].map((e) => (
        <mesh key={e} geometry={end} material={dark} position={[e < 0 ? -half - T : half, 0, SHELF.front]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow />
      ))}
      <mesh position={[0, T / 2, mid]} material={wood} castShadow receiveShadow>
        <boxGeometry args={[SHELF.inner, T, depth]} />
      </mesh>
      <mesh position={[0, SIDE / 2, SHELF.back + T / 2]} material={wood} castShadow receiveShadow>
        <boxGeometry args={[SHELF.inner, SIDE, T]} />
      </mesh>
      {/* the divider between the cassettes and the CDs */}
      <mesh position={[-half + SHELF.divider, T + (SIDE - T) / 2, mid]} material={dark} castShadow receiveShadow>
        <boxGeometry args={[0.005, SIDE - T, depth - T]} />
      </mesh>
    </group>
  );
}
