"use client";

/* eslint-disable react-hooks/immutability -- three.js objects are mutable by design */

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { jobs, jobYears, type Job, type Lang } from "@/content/data";
import { useLang } from "@/state/lang";
import { tapeHeld } from "../layout";
import { useRoom } from "../store";
import { canvasTexture, paper, rng, useFonts, useImage, type Fonts } from "../textures";

// What opens when a cassette is picked: its inlay, the long fold-out insert of a tape, folded
// into a piece small enough to hide completely behind the cassette. It slides out, grows and
// unfolds in front of the camera: on the right of a wide screen, along the bottom of an
// upright one. Only part of it fits in view; scroll or drag to read the rest. Its head is the
// workplace's logo (the `logo` of the job in content/data.ts, or its initials without one).

// The visible window is PAGE_W wide and 1 tall in the pamphlet's own units (its scale makes it
// as big as it needs to be); PX is pixels of the strip per unit of height.
const PAGE_W = 0.6;
const PX = 1000;
const DIST = 0.3; // how far in front of the camera it is read
const FOLDS = 7; // the number of leaves it folds into

// quick off the mark and settling gently; and the same with a little spring past the end, as paper has
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const springOut = (t: number) => 1 + 2.1 * (t - 1) ** 3 + 1.1 * (t - 1) ** 2;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** The workplace's logo fitted into a box, or its initials in a stamp when it has none. */
function mark(ctx: CanvasRenderingContext2D, job: Job, logo: HTMLImageElement | null, x: number, y: number, w: number, h: number, fonts: Fonts) {
  if (logo) {
    const k = Math.min(w / logo.width, h / logo.height);
    ctx.drawImage(logo, x + (w - logo.width * k) / 2, y + (h - logo.height * k) / 2, logo.width * k, logo.height * k);
    return;
  }
  const r = Math.min(w, h) / 2;
  const initials = job.company
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  ctx.save();
  ctx.strokeStyle = "#2a2622";
  ctx.fillStyle = "#2a2622";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, r - 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.font = `700 ${r * 0.9}px ${fonts.body}`;
  ctx.fillText(initials, x + w / 2, y + h / 2 + r * 0.3);
  ctx.restore();
}

/** Whether a colour is light enough to want dark writing on it. */
function light(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 150;
}

/**
 * Sets the whole inlay down the strip, top to bottom, and returns where it ends: the cover in
 * the cassette's own colours, the spine, then the liner notes, as a tape's fold-out insert has
 * them. Run once on a scratch canvas to learn how long the strip has to be, and again to paint it.
 */
function setInlay(ctx: CanvasRenderingContext2D, w: number, job: Job, lang: Lang, fonts: Fonts | null, logo: HTMLImageElement | null): number {
  const id = lang === "id";
  const m = 48;
  const inner = w - m * 2;
  const cx = w / 2;
  const dark = "#1d1712";
  const { shell, label, ink } = job.tape;
  const body = fonts?.body ?? "sans-serif";
  const serif = fonts?.serif ?? "serif";
  const small = fonts?.screen ?? "monospace";
  const years = jobYears(job, lang);

  // the cover: the logo on a plate, the name under it, three stripes along the foot
  const COVER = 572;
  ctx.fillStyle = shell;
  ctx.fillRect(0, 0, w, COVER);
  const onShell = light(shell) ? dark : label;
  ctx.strokeStyle = onShell;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, w - 40, COVER - 40);
  ctx.globalAlpha = 1;
  ctx.fillStyle = label;
  ctx.fillRect((w - 330) / 2, 62, 330, 236);
  if (fonts) mark(ctx, job, logo, (w - 290) / 2, 78, 290, 204, fonts);
  ctx.textAlign = "center";
  ctx.fillStyle = onShell;
  ctx.font = `700 52px ${body}`;
  let y = 372;
  for (const line of wrap(ctx, job.company, inner).slice(0, 2)) {
    ctx.fillText(line, cx, y);
    y += 58;
  }
  ctx.font = `24px ${small}`;
  ctx.fillText(job.place[lang].toUpperCase(), cx, y - 8);
  for (let k = 0; k < 3; k++) {
    ctx.fillStyle = k === 1 ? label : ink;
    ctx.fillRect(m, COVER - 62 + k * 11, inner, 6);
  }

  // the spine
  ctx.fillStyle = ink;
  ctx.fillRect(0, COVER, w, 64);
  ctx.fillStyle = label;
  ctx.font = `24px ${small}`;
  ctx.textAlign = "left";
  ctx.fillText(job.company.toUpperCase(), m, COVER + 41, inner - 190);
  ctx.textAlign = "right";
  ctx.fillText(years, w - m, COVER + 41);
  y = COVER + 64;

  const side = (name: string, what: string) => {
    y += 62;
    ctx.textAlign = "left";
    ctx.font = `22px ${small}`;
    const tw = ctx.measureText(name).width + 22;
    ctx.fillStyle = ink;
    ctx.fillRect(m, y - 25, tw, 34);
    ctx.fillStyle = label;
    ctx.fillText(name, m + 11, y);
    ctx.fillStyle = ink;
    ctx.fillText(what, m + tw + 14, y);
    ctx.fillRect(m, y + 16, inner, 2);
    y += 28;
  };

  // side A: what the job was
  side("SIDE A", id ? "PERAN" : "ROLE");
  ctx.fillStyle = dark;
  ctx.font = `700 40px ${body}`;
  for (const line of wrap(ctx, job.title, inner)) {
    y += 48;
    ctx.fillText(line, m, y);
  }
  ctx.fillStyle = "#4a3a22";
  ctx.font = `italic 500 29px ${serif}`;
  y += 42;
  ctx.fillText(`${job.place[lang]}, ${years}`, m, y, inner);
  ctx.fillStyle = "#2a2018";
  ctx.font = `500 31px ${serif}`;
  y += 20;
  for (const line of wrap(ctx, job.body[lang], inner)) {
    y += 43;
    ctx.fillText(line, m, y);
  }

  // side B: what it was done with, as a track list
  y += 16;
  side("SIDE B", id ? "TEKNOLOGI" : "STACK");
  job.tech.forEach((tech, i) => {
    y += 50;
    ctx.fillStyle = ink;
    ctx.font = `24px ${small}`;
    ctx.fillText(`B${i + 1}`, m, y);
    ctx.fillStyle = dark;
    ctx.font = `500 31px ${body}`;
    ctx.fillText(tech, m + 62, y, inner - 62);
    ctx.fillStyle = "rgba(60,40,20,0.22)";
    ctx.fillRect(m, y + 15, inner, 1.5);
  });

  // the small print: a number for the shelf, and a barcode that is different for every workplace
  y += 70;
  ctx.fillStyle = "#4a3a22";
  ctx.font = `21px ${small}`;
  ctx.fillText(`KRD-${job.from}`, m, y);
  ctx.fillText("STEREO", m, y + 30);
  ctx.fillText(years, m, y + 60);
  const r = rng(job.from * 31 + job.company.length);
  ctx.fillStyle = dark;
  let x = w - m - 210;
  while (x < w - m) {
    const bw = 2 + Math.floor(r() * 4);
    if (r() > 0.42 && x + bw <= w - m) ctx.fillRect(x, y - 22, bw, 84);
    x += bw + 2 + Math.floor(r() * 3);
  }
  return y + 120;
}

/** The strip's finished length in pixels, at least tall enough to fill the window. */
function stripLength(job: Job, lang: Lang, fonts: Fonts | null, logo: HTMLImageElement | null) {
  const c = document.createElement("canvas");
  c.width = PAGE_W * PX;
  c.height = 8;
  return Math.max(PX + 60, Math.ceil(setInlay(c.getContext("2d")!, c.width, job, lang, fonts, logo)));
}

function paintStrip(ctx: CanvasRenderingContext2D, w: number, h: number, job: Job, lang: Lang, fonts: Fonts | null, logo: HTMLImageElement | null) {
  paper(ctx, w, h, "#f1e9d6", job.from);
  setInlay(ctx, w, job, lang, fonts, logo);
  wear(ctx, w, h, job.from);
}

/** Years in a pocket and a drawer: stains, rubbed ink, creases worn white, grubby edges, torn nicks. */
function wear(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  const r = rng(seed * 7 + 3);
  ctx.save();

  // dirt and age: blotches of tea-brown and grey
  ctx.globalCompositeOperation = "multiply";
  for (let i = 0; i < Math.round(h / 55); i++) {
    const x = r() * w;
    const y = r() * h;
    const rad = 25 + r() * 130;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const brown = r() > 0.4;
    g.addColorStop(0, brown ? `rgba(150,105,50,${0.1 + r() * 0.2})` : `rgba(90,85,80,${0.06 + r() * 0.12})`);
    g.addColorStop(0.7, brown ? `rgba(150,105,50,${0.03 + r() * 0.05})` : "rgba(90,85,80,0.02)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // the ring of a cup that stood on it
  ctx.strokeStyle = "rgba(120,80,35,0.22)";
  ctx.lineWidth = 3 + r() * 3;
  ctx.beginPath();
  ctx.ellipse(w * (0.3 + r() * 0.4), h * (0.35 + r() * 0.5), 70 + r() * 20, 66 + r() * 20, r(), 0.2, Math.PI * 1.8);
  ctx.stroke();
  // grubby along both edges, where it was held
  for (const left of [true, false]) {
    const g = ctx.createLinearGradient(left ? 0 : w, 0, left ? 70 : w - 70, 0);
    g.addColorStop(0, "rgba(120,85,45,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(left ? 0 : w - 70, 0, 70, h);
  }
  ctx.globalCompositeOperation = "source-over";

  // paper fibres and fine grit
  for (let i = 0; i < Math.round(h * 2.2); i++) {
    ctx.strokeStyle = r() > 0.5 ? `rgba(255,252,240,${0.1 + r() * 0.25})` : `rgba(70,50,25,${0.05 + r() * 0.12})`;
    ctx.lineWidth = 0.6 + r() * 0.8;
    const x = r() * w;
    const y = r() * h;
    const a = r() * Math.PI;
    const len = 4 + r() * 14;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }

  // rubbed through: the print has worn thin in patches, so the paper shows
  for (let i = 0; i < Math.round(h / 22); i++) {
    ctx.fillStyle = `rgba(241,233,214,${0.25 + r() * 0.4})`;
    ctx.beginPath();
    ctx.ellipse(r() * w, r() * h, 3 + r() * 14, 2 + r() * 5, r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // scuffs and scratches
  for (let i = 0; i < Math.round(h / 90); i++) {
    ctx.strokeStyle = r() > 0.5 ? "rgba(255,255,255,0.35)" : "rgba(60,40,20,0.22)";
    ctx.lineWidth = 0.8 + r();
    const x = r() * w;
    const y = r() * h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + (r() - 0.5) * 60, y + (r() - 0.5) * 30, x + (r() - 0.5) * 120, y + (r() - 0.5) * 50);
    ctx.stroke();
  }

  // the folds: a crease at every leaf and one lengthwise, ragged, worn white in places
  const crease = (x0: number, y0: number, x1: number, y1: number) => {
    const n = 60;
    for (let i = 0; i < n; i++) {
      const x = x0 + ((x1 - x0) * i) / n + (r() - 0.5) * 2.5;
      const y = y0 + ((y1 - y0) * i) / n + (r() - 0.5) * 2.5;
      const sx = Math.max(2, (x1 - x0) / n + 2);
      const sy = Math.max(2, (y1 - y0) / n + 2);
      const thin = x1 === x0;
      ctx.fillStyle = r() < 0.18 ? "rgba(250,244,228,0.8)" : "rgba(40,28,14,0.16)";
      ctx.fillRect(x - (thin ? 1 : 0), y - (thin ? 0 : 1), thin ? 2.2 : sx, thin ? sy : 2.2);
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillRect(x + (thin ? 1.5 : 0), y + (thin ? 0 : 1.5), thin ? 1.6 : sx, thin ? sy : 1.6);
    }
  };
  for (let i = 1; i < FOLDS; i++) {
    const y = (h / FOLDS) * i;
    const g = ctx.createLinearGradient(0, y - 22, 0, y + 22);
    g.addColorStop(0, "rgba(60,40,20,0)");
    g.addColorStop(0.5, "rgba(60,40,20,0.1)");
    g.addColorStop(1, "rgba(60,40,20,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 22, w, 44);
    crease(0, y, w, y);
  }
  crease(w / 2, 0, w / 2, h);

  // torn nicks along the edges and worn corners
  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < Math.round(h / 70); i++) {
    ctx.beginPath();
    ctx.ellipse(r() > 0.5 ? 0 : w, r() * h, 2 + r() * 5, 3 + r() * 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h]]) {
    ctx.beginPath();
    ctx.arc(x, y, 9 + r() * 14, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * How far each job's receipt is open, 0 to 1. Its cassette reads this: it is not put back in the
 * rack until the receipt has folded up and slid back behind it.
 */
export const receiptOpen: Record<string, number> = {};

const start = new THREE.Vector3();
const end = new THREE.Vector3();
// held flat behind the cassette, tilted the way the cassette is
const tiltQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.28, 0, 0));
const q = new THREE.Quaternion();
const _up = new THREE.Vector3();

type Hinges = (THREE.Group | null)[];
type Shade = (THREE.MeshBasicMaterial | null)[];

/** One leaf of the strip, and below it (hinged to its lower edge) the rest. */
function Leaf({ i, leaf, geos, tex, hinges, shades }: { i: number; leaf: number; geos: THREE.BufferGeometry[]; tex: THREE.Texture; hinges: Hinges; shades: Shade }) {
  return (
    <group
      ref={(g) => {
        hinges[i] = g;
      }}
      position={[0, i === 0 ? 0 : -leaf, 0]}
    >
      <mesh geometry={geos[i]} position={[0, -leaf / 2, 0]}>
        <meshBasicMaterial
          ref={(m) => {
            shades[i] = m;
          }}
          map={tex}
          alphaTest={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>
      {i < FOLDS - 1 && <Leaf i={i + 1} leaf={leaf} geos={geos} tex={tex} hinges={hinges} shades={shades} />}
    </group>
  );
}

function Sheet({ job, selected }: { job: Job; selected: boolean }) {
  const lang = useLang();
  const fonts = useFonts();
  const logo = useImage(job.logo);
  const texH = useMemo(() => stripLength(job, lang, fonts, logo), [job, lang, fonts, logo]);
  const tex = useMemo(() => {
    // painted at up to twice the layout size so it stays sharp on a phone's dense screen, within the GPU's texture limit
    const k = Math.min(2, 4096 / texH);
    const w = PAGE_W * PX;
    return canvasTexture(Math.round(w * k), Math.round(texH * k), (c) => {
      c.scale(k, k);
      paintStrip(c, w, texH, job, lang, fonts, logo);
    });
  }, [job, lang, fonts, logo, texH]);
  useEffect(() => () => tex.dispose(), [tex]);

  // the whole inlay at full size, each leaf a slice of it; what does not fit in view runs off the screen
  const total = texH / PX;
  const leaf = total / FOLDS;
  const geos = useMemo(() => {
    const out: THREE.BufferGeometry[] = [];
    for (let i = 0; i < FOLDS; i++) {
      const g = new THREE.PlaneGeometry(PAGE_W, leaf);
      const uv = g.attributes.uv as THREE.BufferAttribute;
      for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - (i + 1) / FOLDS + uv.getY(k) / FOLDS);
      out.push(g);
    }
    return out;
  }, [leaf]);
  useEffect(() => () => geos.forEach((g) => g.dispose()), [geos]);

  const rig = useRef<THREE.Group>(null);
  const hinges = useMemo<Hinges>(() => [], []);
  const shades = useMemo<Shade>(() => [], []);
  const t = useRef(0);
  const waited = useRef(0);
  const live = useRef(false);
  /** how far down the strip it is read, in pixels of the strip; the target is where it is heading */
  const scroll = useRef({ cur: 0, to: 0 });
  /** pixels of the strip for each pixel of the screen, as it is laid out now */
  const perPx = useRef(1);
  const drag = useRef<number | null>(null);

  // gone, it no longer holds its cassette out
  useEffect(() => () => void delete receiptOpen[job.id], [job.id]);

  const maxScroll = texH - PX;
  const scrollBy = (d: number) => {
    scroll.current.to = Math.min(maxScroll, Math.max(0, scroll.current.to + d));
  };

  useEffect(() => {
    if (!selected) return;
    const onWheel = (e: WheelEvent) => {
      if (live.current) scrollBy(e.deltaY * perPx.current);
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scrollBy only reads refs and texH
  }, [selected, texH]);

  useFrame((state, dt) => {
    const g = rig.current;
    if (!g) return;
    // it waits until the cassette has been drawn out and turned to face the chair
    waited.current = selected ? waited.current + dt : 0;
    t.current = clamp01(t.current + (selected && waited.current > 0.4 ? dt / 0.95 : -dt / 0.6));
    receiptOpen[job.id] = t.current;
    g.visible = t.current > 0.001;
    live.current = selected && t.current > 0.95;
    if (!g.visible) return;

    const cam = state.camera as THREE.PerspectiveCamera;
    const aspect = state.size.width / state.size.height;
    const visH = 2 * DIST * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const visW = visH * aspect;
    const wide = aspect > 1.05;
    // as big as the side it opens on allows
    const s = wide ? Math.min(0.84 * visH, (0.36 * visW) / PAGE_W) : Math.min(0.5 * visH, (0.9 * visW) / PAGE_W);
    // where the picture has been slid sideways (see the camera rig), the right-hand edge of the screen has moved with it
    const slid = cam.view?.enabled ? cam.view.offsetX / cam.view.fullWidth : 0;
    const cx = wide ? (0.47 + slid) * visW - (PAGE_W * s) / 2 : slid * visW;
    const cy = wide ? 0 : -0.48 * visH + 0.5 * s;
    end.set(cx, cy + s / 2, -DIST).applyQuaternion(cam.quaternion).add(cam.position); // its top edge
    const h = tapeHeld(aspect);
    const small = 0.13 / total; // folded, no bigger than a cassette-sized wad however long the inlay
    start.set(h[0], h[1] + (leaf / 2) * small, h[2] - 0.02); // folded, just behind the cassette

    const out = easeOut(clamp01(t.current / 0.42)); // slides out and grows, still folded
    const open = clamp01((t.current - 0.22) / 0.78); // then unfolds
    g.position.lerpVectors(start, end, out);
    q.copy(tiltQ).slerp(cam.quaternion, out);
    g.quaternion.copy(q);
    g.scale.setScalar(THREE.MathUtils.lerp(small, s, out));

    // the leaves fold one way then the other, down to a stack of one
    // each a beat after the one above, falling open and springing a touch past flat before it settles
    const LAG = 0.42;
    for (let i = 1; i < FOLDS; i++) {
      const own = springOut(clamp01((open - (LAG * (i - 1)) / (FOLDS - 2)) / (1 - LAG)));
      const hinge = hinges[i];
      if (hinge) hinge.rotation.x = (i % 2 ? 1 : -1) * Math.PI * (1 - own);
      const m = shades[i];
      if (m) m.color.setScalar(i % 2 ? 0.7 + 0.3 * clamp01(own) : 1);
    }

    // reading position, eased
    perPx.current = PX / ((s / visH) * state.size.height);
    const sc = scroll.current;
    sc.cur += (sc.to - sc.cur) * (1 - Math.exp(-dt * 12));
    // reading it moves the paper itself up the screen
    g.position.addScaledVector(_up.set(0, 1, 0).applyQuaternion(cam.quaternion), (sc.cur / PX) * s * out);
  });

  const grab = (on: boolean) => {
    document.body.style.cursor = on ? (drag.current === null ? "grab" : "grabbing") : "";
  };
  return (
    <group
      ref={rig}
      visible={false}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        if (!live.current) return;
        e.stopPropagation();
        grab(true);
      }}
      onPointerOut={() => grab(false)}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        if (!live.current) return;
        e.stopPropagation();
        (e.target as unknown as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(e.pointerId);
        drag.current = e.clientY;
        grab(true);
      }}
      onPointerMove={(e: ThreeEvent<PointerEvent>) => {
        if (drag.current === null) return;
        e.stopPropagation();
        scrollBy(-(e.clientY - drag.current) * perPx.current);
        drag.current = e.clientY;
      }}
      onPointerUp={() => {
        drag.current = null;
        grab(true);
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (live.current) e.stopPropagation();
      }}
    >
      <Leaf i={0} leaf={leaf} geos={geos} tex={tex} hinges={hinges} shades={shades} />
    </group>
  );
}

/** The receipt of whichever cassette is picked. It stays mounted after it is put back, to fold away. */
export function Pamphlet() {
  const selected = useRoom((s) => s.selectedTape);
  const [shown, setShown] = useState<string | null>(null);
  if (selected && selected !== shown) setShown(selected);
  const job = jobs.find((j) => j.id === shown);
  if (!job) return null;
  return <Sheet key={job.id} job={job} selected={selected === job.id} />;
}
