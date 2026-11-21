"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { click } from "@/audio/sfx";
import { credits } from "@/content/credits";
import type { Lang } from "@/content/data";
import { useLang } from "@/state/lang";
import { hint } from "../hint";
import { Interactive } from "../Interactive";
import { POS, RECEIPT_HELD } from "../layout";
import { orbit } from "../orbit";
import { RECEIPT_SLIDE, receiptRange } from "../receipt";
import { useRoom } from "../store";
import { canvasTexture, rng, useFonts, wrap, type Fonts } from "../textures";

// The credits, as a till receipt from the "Credit Market": every borrowed thing an item,
// its licence in the price column. It lies on the desk folded small. Looked at, it is picked
// up and falls open, and a drag slides it up and down to read. It is made here: a strip of
// thermal paper, thin, a little glossy, creased where it was folded, crumpled here and
// there, and printed by a till whose ribbon was nearly done.

/** the roll is 80 mm wide; the picture is 8 px to the millimetre */
const WIDE = 0.08;
const PX = 640;
const PER_M = PX / WIDE;
/** how many times it is folded over, concertina fashion */
const PANELS = 6;
const INK = "#2b2836";

const WORDS = {
  id: {
    slogan: "TOKO SERBA ADA ASET",
    address: "Jl. Sumber Terbuka No. 4.0, Internet",
    till: "KASIR: FAJAR      STRUK #0001",
    by: "oleh",
    items: "JUMLAH ITEM",
    total: "TOTAL",
    free: "GRATIS*",
    paid: "DIBAYAR DENGAN",
    credit: "KREDIT",
    change: "KEMBALIAN",
    thanks: "TERIMA KASIH",
    note: "*dengan menyebut nama pembuatnya",
    keep: "TERIMA KASIH KEPADA SEMUA PEMBUAT",
    again: "BARANG YANG SUDAH DIPAKAI TIDAK DAPAT DIKEMBALIKAN",
  },
  en: {
    slogan: "EVERYTHING AN ASSET NEEDS",
    address: "4.0 Open Source Road, The Internet",
    till: "CASHIER: FAJAR    RECEIPT #0001",
    by: "by",
    items: "ITEMS",
    total: "TOTAL",
    free: "FREE*",
    paid: "PAID WITH",
    credit: "CREDIT",
    change: "CHANGE",
    thanks: "THANK YOU",
    note: "*with the maker's name on it",
    keep: "THANK YOU TO EVERYONE WHO MADE THESE",
    again: "GOODS ONCE USED CANNOT BE RETURNED",
  },
} as const;

type Line = { y: number; draw: (ctx: CanvasRenderingContext2D, y: number) => void };

/** Sets the receipt out: every line and where it goes, and so how long the paper is. */
function layout(measure: CanvasRenderingContext2D, lang: Lang, f: Fonts) {
  const w = WORDS[lang];
  const lines: Line[] = [];
  const left = 34;
  const right = PX - 34;
  let y = 70;
  const add = (advance: number, draw: Line["draw"]) => {
    lines.push({ y, draw });
    y += advance;
  };
  const centred = (text: string, font: string, advance: number) =>
    add(advance, (ctx, at) => {
      ctx.font = font;
      ctx.textAlign = "center";
      ctx.fillText(text, PX / 2, at, right - left);
    });
  const rule = () =>
    add(34, (ctx, at) => {
      ctx.font = `22px ${f.screen}`;
      ctx.textAlign = "center";
      ctx.fillText("- ".repeat(24), PX / 2, at - 8, right - left);
    });
  const pair = (a: string, b: string, font: string, advance: number) =>
    add(advance, (ctx, at) => {
      ctx.font = font;
      ctx.textAlign = "left";
      ctx.fillText(a, left, at);
      ctx.textAlign = "right";
      ctx.fillText(b, right, at);
    });

  centred("CREDIT MARKET", `800 60px ${f.display}`, 44);
  centred(w.slogan, `24px ${f.screen}`, 30);
  centred(w.address, `20px ${f.screen}`, 44);
  rule();
  centred(w.till, `21px ${f.screen}`, 28);
  centred("21/11/2026  21:47:03", `21px ${f.screen}`, 40);
  rule();

  for (const item of credits) {
    // the name, wrapped short of the price column; the licence stands where a price would
    measure.font = `25px ${f.screen}`;
    const price = item.licence.toUpperCase();
    const room = right - left - measure.measureText(price).width - 26;
    wrap(measure, item.title.toUpperCase(), room).forEach((text, i) =>
      add(30, (ctx, at) => {
        ctx.font = `25px ${f.screen}`;
        ctx.textAlign = "left";
        ctx.fillText(text, left, at);
        if (i > 0) return;
        ctx.textAlign = "right";
        ctx.fillText(price, right, at);
      }),
    );
    add(40, (ctx, at) => {
      ctx.font = `20px ${f.screen}`;
      ctx.textAlign = "left";
      ctx.globalAlpha *= 0.8;
      ctx.fillText(`  1 x  ${w.by} ${item.author}`, left, at - 2, right - left);
      ctx.globalAlpha /= 0.8;
    });
  }

  rule();
  pair(w.items, String(credits.length), `24px ${f.screen}`, 36);
  pair(w.total, w.free, `800 40px ${f.display}`, 46);
  pair(w.paid, w.credit, `22px ${f.screen}`, 30);
  pair(w.change, w.thanks, `22px ${f.screen}`, 34);
  centred(w.note, `19px ${f.screen}`, 46);
  rule();
  // a bar code that reads nothing
  add(118, (ctx, at) => {
    const r = rng(404);
    let x = PX / 2 - 170;
    while (x < PX / 2 + 170) {
      const bar = 2 + Math.floor(r() * 4) * 2;
      ctx.fillRect(x, at - 18, bar, 78);
      x += bar + 2 + Math.floor(r() * 3) * 2;
    }
    ctx.font = `18px ${f.screen}`;
    ctx.textAlign = "center";
    ctx.fillText("4 0 0 4 2 0 2 6 1 1 2 1", PX / 2, at + 84);
  });
  centred(w.keep, `21px ${f.screen}`, 30);
  centred(w.again, `17px ${f.screen}`, 30);
  centred("* * *", `24px ${f.screen}`, 60);
  return { lines, height: Math.ceil(y) };
}

function paint(ctx: CanvasRenderingContext2D, h: number, lines: Line[]) {
  // The printing is done on a sheet of its own, so that it can be worn away afterwards
  // without touching the paper under it.
  const sheet = document.createElement("canvas");
  sheet.width = PX;
  sheet.height = h;
  const ink = sheet.getContext("2d")!;
  ink.fillStyle = INK;
  ink.textBaseline = "alphabetic";
  for (const line of lines) line.draw(ink, line.y);
  // a till at the end of its ribbon: whole bands print faint, worse towards the end; a few
  // dots of the head are dead and leave white lines the length of the paper; and it speckles
  const r = rng(77);
  ink.globalCompositeOperation = "destination-out";
  for (let y = 0; y < h; ) {
    const band = 90 + r() * 420;
    const fade = Math.min(0.72, r() * 0.38 + (y / h) * 0.34);
    const g = ink.createLinearGradient(0, y, 0, y + band);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.2, `rgba(0,0,0,${fade})`);
    g.addColorStop(0.8, `rgba(0,0,0,${fade})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ink.fillStyle = g;
    ink.fillRect(0, y, PX, band);
    y += band * 0.8;
  }
  // it also prints fainter towards one side
  const side = ink.createLinearGradient(0, 0, PX, 0);
  side.addColorStop(0, "rgba(0,0,0,0)");
  side.addColorStop(0.6, "rgba(0,0,0,0.04)");
  side.addColorStop(1, "rgba(0,0,0,0.42)");
  ink.fillStyle = side;
  ink.fillRect(0, 0, PX, h);
  for (let i = 0; i < 5; i++) {
    ink.fillStyle = `rgba(0,0,0,${0.55 + r() * 0.4})`;
    ink.fillRect(60 + r() * (PX - 120), 0, 2 + r() * 5, h);
  }
  for (let i = 0; i < h * 14; i++) {
    ink.fillStyle = `rgba(0,0,0,${0.3 + r() * 0.6})`;
    ink.fillRect(r() * PX, r() * h, 1 + r() * 2, 1 + r() * 1.5);
  }

  // the paper: off-white, faintly mottled, with the pink stripes that warn the roll is nearly out
  ctx.fillStyle = "#f3f0e8";
  ctx.fillRect(0, 0, PX, h);
  for (let i = 0; i < h * 3; i++) {
    ctx.fillStyle = `rgba(${r() > 0.5 ? "255,255,255" : "150,140,120"},${0.03 + r() * 0.05})`;
    ctx.fillRect(r() * PX, r() * h, 2 + r() * 6, 2 + r() * 6);
  }
  ctx.fillStyle = "rgba(214,84,110,0.34)";
  for (const x of [5, PX - 15]) ctx.fillRect(x, h * 0.42, 10, h * 0.58);
  ctx.drawImage(sheet, 0, 0);
}

// Where it has been screwed up and smoothed out again: a web of sharp little ridges.
let crush: THREE.Texture | null = null;
function crumple() {
  crush ??= (() => {
    const t = canvasTexture(512, 512, (ctx, w, h) => {
      ctx.fillStyle = "rgb(128,128,128)";
      ctx.fillRect(0, 0, w, h);
      const r = rng(9);
      for (let i = 0; i < 90; i++) {
        let x = r() * w;
        let y = r() * h;
        let a = r() * Math.PI * 2;
        const v = r() > 0.5 ? 235 : 30;
        ctx.strokeStyle = `rgba(${v},${v},${v},${0.18 + r() * 0.3})`;
        ctx.lineWidth = 1 + r() * 2.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 0; k < 4; k++) {
          a += (r() - 0.5) * 1.6;
          x += Math.cos(a) * (20 + r() * 60);
          y += Math.sin(a) * (20 + r() * 60);
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    });
    t.colorSpace = THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  })();
  return crush;
}

const HELD_AT = new THREE.Vector3(...RECEIPT_HELD);
// held up it faces the eye, which looks a little down on it
const HELD_TURN = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.19, 0, 0));
const DESK_AT = new THREE.Vector3(POS.receipt[0], POS.receipt[1] + 0.0055, POS.receipt[2]);
// on the desk the folded stack stands on its folds, turned a little
const DESK_TURN = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.5, 0));
const COLS = 8;
const PER_PANEL = 10;

/**
 * Lays the strip out: `open` 0 is folded shut, 1 is pulled out flat. Folded, each panel lies
 * back on the one before it; open, it keeps a kink at every fold, a slow curl along its
 * length, and its crumples.
 */
function fold(g: THREE.BufferGeometry, long: number, open: number) {
  const p = g.attributes.position as THREE.BufferAttribute;
  const rows = PANELS * PER_PANEL;
  const ds = long / rows;
  const e = open * open * (3 - 2 * open);
  // the angle each panel makes with the way the strip runs: nearly square to it when shut
  const lean = (1 - e) * 1.553 + e * 0.07;
  let y = 0;
  let z = 0;
  for (let j = 0; j <= rows; j++) {
    const s = j / rows;
    const panel = Math.min(PANELS - 1, Math.floor(j / PER_PANEL));
    for (let i = 0; i <= COLS; i++) {
      const x = (i / COLS - 0.5) * WIDE;
      // crumples: shallow dents, there whether it is folded or not, and deeper once it is let out
      const dent = (Math.sin(x * 260 + s * 71) * Math.sin(s * 133 - x * 90 + 1.7) + 0.6 * Math.sin(x * 410 - s * 57)) * 0.0009 * (0.35 + 0.65 * e);
      const curl = e * 0.03 * (s - 0.5) * (s - 0.5);
      p.setXYZ(j * (COLS + 1) + i, x, y, z + dent + curl + panel * 0.00035 * (1 - e));
    }
    const dir = panel % 2 ? -1 : 1;
    y -= Math.cos(lean) * ds;
    z += Math.sin(lean) * dir * ds;
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  g.computeBoundingSphere();
}

export function Receipt() {
  const lang = useLang();
  const fonts = useFonts();
  const live = useRoom((s) => s.focus === "receipt");

  const made = useMemo(() => {
    if (!fonts) return null;
    const probe = document.createElement("canvas").getContext("2d")!;
    const { lines, height } = layout(probe, lang, fonts);
    const map = canvasTexture(PX, height, (ctx) => paint(ctx, height, lines));
    const long = height / PER_M;
    const geometry = new THREE.PlaneGeometry(WIDE, long, COLS, PANELS * PER_PANEL);
    fold(geometry, long, 0);
    return { map, long, geometry };
  }, [fonts, lang]);
  useEffect(
    () => () => {
      made?.map.dispose();
      made?.geometry.dispose();
    },
    [made],
  );
  // how far it can be slid: until its foot is in view
  useEffect(() => {
    if (made) receiptRange.max = Math.max(0, made.long - 0.15) / RECEIPT_SLIDE;
  }, [made]);

  const root = useRef<THREE.Group>(null);
  const state = useRef({ open: 0, drawn: -1, slide: 0, heard: 0 });

  useFrame((_, dt) => {
    const g = root.current;
    const st = state.current;
    if (!g || !made) return;
    const k = 1 - Math.exp(-dt * 6);
    st.open = THREE.MathUtils.clamp(st.open + (live ? dt : -dt) / 0.9, 0, 1);
    if (Math.abs(st.open - st.drawn) > 0.002) {
      st.drawn = st.open;
      fold(made.geometry, made.long, st.open);
      // it rustles as it goes
      if (Math.abs(st.open - st.heard) > 0.16) {
        st.heard = st.open;
        click(0.35 + Math.random() * 0.3);
      }
    }
    // in the hand a drag slides it: up to read on, down to go back
    st.slide += ((live ? -orbit.pitch * RECEIPT_SLIDE : 0) - st.slide) * (1 - Math.exp(-dt * 14));
    g.position.lerp(live ? HELD_AT : DESK_AT, k);
    g.quaternion.slerp(live ? HELD_TURN : DESK_TURN, k);
    g.children[0].position.y = live ? 0.07 + st.slide : g.children[0].position.y * (1 - k);
  });

  if (!made) return null;
  return (
    <Interactive target="receipt">
      <group
        ref={root}
        position={DESK_AT}
        quaternion={DESK_TURN}
        onPointerOver={() => {
          if (live) hint("tip_receipt", "grab");
        }}
        onPointerOut={() => {
          if (live) hint(null);
        }}
      >
        <group>
          {/* the printed side: thermal paper has a coat on it, and catches the light a little */}
          <mesh geometry={made.geometry} castShadow receiveShadow>
            <meshPhysicalMaterial map={made.map} emissiveMap={made.map} emissive="#ffffff" emissiveIntensity={0.38} color="#8f8f8f" roughness={0.42} clearcoat={0.35} clearcoatRoughness={0.3} bumpMap={crumple()} bumpScale={0.5} envMapIntensity={1.2} />
          </mesh>
          {/* the back: bare paper, a hair behind the front so the strip has a thickness */}
          <mesh geometry={made.geometry} position={[0, 0, -0.00012]}>
            <meshStandardMaterial color="#d9d5cb" emissive="#d9d5cb" emissiveIntensity={0.18} roughness={0.8} bumpMap={crumple()} bumpScale={0.5} side={THREE.BackSide} />
          </mesh>
        </group>
      </group>
    </Interactive>
  );
}
