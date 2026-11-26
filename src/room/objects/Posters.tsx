"use client";

import { asset } from "@/asset";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import { Interactive } from "../Interactive";
import { POS, WALL_Z } from "../layout";
import { useRoom } from "../store";
import { useLang } from "@/state/lang";
import type { Lang } from "@/content/data";
import { rng, useCanvasTexture, useFonts, type Fonts } from "../textures";
import { Glass } from "./Glass";
import { Model } from "./Props";

// On the wall: a favourite record hung on a nail, and a Bauhaus print of the lo-fi site that opens
// it; on the sill, a framed family photo. The cover is the file in public/art/; the artwork belongs
// to the artist and their label (see CREDITS.md).

type Album = {
  title: string;
  artist: string;
  year: number;
  tracks: string[];
  paper: string;
  ink: string;
  accent: string;
  /** the cover, a square image under /public */
  art: string;
};

const OK_COMPUTER: Album = {
  title: "OK COMPUTER",
  artist: "RADIOHEAD",
  year: 1997,
  tracks: [
    "Airbag",
    "Paranoid Android",
    "Subterranean Homesick Alien",
    "Exit Music (For a Film)",
    "Let Down",
    "Karma Police",
    "Fitter Happier",
    "Electioneering",
    "Climbing Up the Walls",
    "No Surprises",
    "Lucky",
    "The Tourist",
  ],
  paper: "#e9eeee",
  ink: "#1c2a3a",
  accent: "#c8402a",
  art: "/art/ok-computer.jpg",
};

/** Loads an image for painting into a canvas; null until it has arrived. */
function useImage(src: string) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const el = new Image();
    let alive = true;
    el.onload = () => alive && setImg(el);
    el.src = asset(src);
    return () => {
      alive = false;
    };
  }, [src]);
  return img;
}

// ── The record, hung on the wall ───────────────────────────────────────────────────────────

/** A 12-inch sleeve is 31 cm square. */
const SLEEVE = 0.31;

/** The sleeve: the cover, worn at the edges and with the ring the record pressed into it. */
function drawSleeve(ctx: CanvasRenderingContext2D, w: number, h: number, a: Album, art: HTMLImageElement | null) {
  ctx.fillStyle = a.paper;
  ctx.fillRect(0, 0, w, h);
  if (art) ctx.drawImage(art, 0, 0, w, h);
  const r = rng(1997);
  // ring wear: the disc inside has rubbed a pale circle through the print
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.strokeStyle = "rgba(255,255,255,0.09)";
  for (let i = 0; i < 26; i++) {
    ctx.lineWidth = 2 + r() * 3;
    ctx.beginPath();
    const from = r() * Math.PI * 2;
    ctx.arc(w / 2, h / 2, w * 0.47 - i * 0.6, from, from + 2 + r() * 3);
    ctx.stroke();
  }
  ctx.restore();
  // scuffed corners and edges
  ctx.fillStyle = "rgba(240,236,226,0.5)";
  for (let i = 0; i < 260; i++) {
    const side = Math.floor(r() * 4);
    const t = r();
    const d = r() * 6;
    const [x, y] = side === 0 ? [t * w, d] : side === 1 ? [t * w, h - d] : side === 2 ? [d, t * h] : [w - d, t * h];
    ctx.fillRect(x, y, 1 + r() * 3, 1 + r() * 2);
  }
}

/** How the record swings on its nail: a pendulum about a quarter metre long, gently damped. */
const SWING = { stiffness: 38, damping: 1.3, push: 0.55 };

/**
 * The record hangs on a nail by a cord tied round its sleeve, the way a fan would put it up.
 * Clicking it gives it a nudge: it swings a little on the nail and settles back.
 */
function VinylOnWall({ album, position }: { album: Album; position: [number, number] }) {
  const art = useImage(album.art);
  const pivot = useRef<THREE.Group>(null);
  const swing = useRef({ angle: 0, speed: 0 });
  useFrame((_, dt) => {
    const s = swing.current;
    if (!pivot.current || (Math.abs(s.angle) < 1e-4 && Math.abs(s.speed) < 1e-4)) return;
    // small steps keep the spring steady when a frame runs long
    const steps = Math.ceil(Math.min(dt, 0.1) / (1 / 120));
    const h = Math.min(dt, 0.1) / steps;
    for (let i = 0; i < steps; i++) {
      s.speed += (-SWING.stiffness * s.angle - SWING.damping * s.speed) * h;
      s.angle += s.speed * h;
    }
    pivot.current.rotation.z = s.angle;
  });
  const nudge = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    // pushed on its right-hand side it swings left, and the other way round
    swing.current.speed += e.point.x > position[0] ? SWING.push : -SWING.push;
  };
  const sleeve = useCanvasTexture(1024, 1024, (ctx, w, h) => drawSleeve(ctx, w, h, album, art), [album, art]);
  const half = SLEEVE / 2;
  const nailY = half + 0.09;
  // the two runs of cord, from the nail down to the sleeve's top corners
  const cords = [-1, 1].map((side) => {
    const dx = side * (half - 0.015);
    const dy = half - nailY;
    return { x: dx / 2, y: (nailY + half) / 2, len: Math.hypot(dx, dy), angle: Math.atan2(dy, dx) };
  });
  return (
    <group position={[position[0], position[1], WALL_Z]} rotation={[0, 0, -0.03]}>
      {/* everything that swings turns about the nail */}
      <group ref={pivot} position={[0, nailY, 0]}>
      <group position={[0, -nailY, 0]}>
      {/* the sleeve: printed card on the front, plain board round the edges */}
      <mesh position={[0, 0, 0.011]} castShadow receiveShadow onClick={nudge}>
        <boxGeometry args={[SLEEVE, SLEEVE, 0.004]} />
        <meshStandardMaterial attach="material-0" color="#d9d6cf" roughness={0.9} />
        <meshStandardMaterial attach="material-1" color="#d9d6cf" roughness={0.9} />
        <meshStandardMaterial attach="material-2" color="#d9d6cf" roughness={0.9} />
        <meshStandardMaterial attach="material-3" color="#d9d6cf" roughness={0.9} />
        <meshStandardMaterial attach="material-4" map={sleeve} roughness={0.75} />
        <meshStandardMaterial attach="material-5" color="#cfcac0" roughness={0.9} />
      </mesh>
      {/* the cord and the nail it hangs from */}
      {cords.map((cord, i) => (
        <mesh key={i} position={[cord.x, cord.y, 0.014]} rotation={[0, 0, cord.angle]} castShadow>
          <boxGeometry args={[cord.len, 0.0022, 0.0022]} />
          <meshStandardMaterial color="#2b2520" roughness={0.8} />
        </mesh>
      ))}
      </group>
      </group>
      <mesh position={[0, nailY, 0.008]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.006, 0.006, 0.016, 16]} />
        <meshStandardMaterial color="#8a7a5c" roughness={0.35} metalness={0.8} />
      </mesh>
    </group>
  );
}

// ── The Bauhaus poster: the lo-fi site, as a print on the wall ───────────────────────────────

/** The lo-fi site's hero artwork (see src/lite/LiteView.tsx), in its 400 x 500 box. */
const BAUHAUS_ART: Array<[string, string]> = [
  ["M100,0 A100,100 0 0 0 100,200 Z", "#3b3b3b"],
  ["M100,0 A100,100 0 0 1 100,200 Z", "#f15a24"],
  ["M200,0 A100,100 0 0 0 400,0 Z", "#f15a24"],
  ["M200,200 A100,100 0 0 1 400,200 Z", "#3b3b3b"],
  ["M0,200 H200 V400 H0 Z", "#3b3b3b"],
  ["M200,200 H400 V400 H200 Z", "#008787"],
  ["M300,300 A100,100 0 0 1 400,200 L400,300 Z", "#f15a24"],
  ["M300,400 A100,100 0 0 1 400,300 L400,400 Z", "#fbb03b"],
  ["M200,200 A100,100 0 0 0 200,400 Z", "#fbb03b"],
  ["M200,200 A100,100 0 0 1 200,400 Z", "#e5dccf"],
  ["M0,500 A100,100 0 0 1 200,500 Z", "#3b3b3b"],
  ["M200,400 A100,100 0 0 1 300,500 L200,500 Z", "#fbb03b"],
  ["M300,500 A100,100 0 0 1 400,400 L400,500 Z", "#008787"],
];

/** Which shapes are screened with stripes or a halftone, as on the site. */
const BAUHAUS_SCREEN: Record<number, "stripes" | "dots"> = { 1: "stripes", 3: "stripes", 5: "dots", 7: "stripes", 9: "dots", 12: "stripes" };

/** What the Bauhaus was, in a few lines under the title. */
const BAUHAUS_NOTE: Record<Lang, string> = {
  id: "Sekolah seni dan desain Jerman di Weimar, Dessau, dan Berlin. Menyatukan seni, kerajinan, dan industri: bentuk mengikuti fungsi, warna primer, lingkaran, persegi, segitiga.",
  en: "The German art and design school of Weimar, Dessau and Berlin. It joined art, craft and industry: form follows function, primary colours, circle, square, triangle.",
};

/**
 * "bauhaus", lettered the way the school set it: Herbert Bayer's universal alphabet, lowercase
 * only, every letter built from a circle and straight strokes of one weight. Drawn as strokes in
 * units of the x-height, from the baseline at (x, y), `size` pixels to the unit.
 */
function letterBauhaus(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const w = 0.22; // the stroke, as a share of the x-height
  const r = 0.5 - w / 2; // a bowl's radius to the middle of its stroke
  const glyphs: Record<string, { advance: number; draw: (c: CanvasRenderingContext2D) => void }> = {
    b: {
      advance: 1,
      draw: (c) => {
        c.moveTo(w / 2, -1.62);
        c.lineTo(w / 2, 0);
        c.moveTo(0.5 + r, -0.5);
        c.arc(0.5, -0.5, r, 0, Math.PI * 2);
      },
    },
    a: {
      advance: 1,
      draw: (c) => {
        c.moveTo(0.5 + r, -0.5);
        c.arc(0.5, -0.5, r, 0, Math.PI * 2);
        c.moveTo(1 - w / 2, -1);
        c.lineTo(1 - w / 2, 0);
      },
    },
    u: {
      advance: 1,
      draw: (c) => {
        c.moveTo(w / 2, -1);
        c.lineTo(w / 2, -0.5);
        c.arc(0.5, -0.5, r, Math.PI, 0, true);
        c.moveTo(1 - w / 2, -1);
        c.lineTo(1 - w / 2, 0);
      },
    },
    h: {
      advance: 1,
      draw: (c) => {
        c.moveTo(w / 2, -1.62);
        c.lineTo(w / 2, 0);
        c.moveTo(w / 2, -0.5);
        c.arc(0.5, -0.5, r, Math.PI, 0);
        c.lineTo(1 - w / 2, 0);
      },
    },
    s: {
      advance: 0.72,
      draw: (c) => {
        // two stacked bowls, the upper opening to the right and the lower to the left; they
        // meet in the middle and together fill the x-height
        const sr = (1 - w) / 4;
        const upper = -1 + w / 2 + sr;
        const lower = -w / 2 - sr;
        c.moveTo(0.36 + sr * Math.cos(-0.2 * Math.PI), upper + sr * Math.sin(-0.2 * Math.PI));
        c.arc(0.36, upper, sr, -0.2 * Math.PI, 0.5 * Math.PI, true);
        c.arc(0.36, lower, sr, -0.5 * Math.PI, 0.8 * Math.PI);
      },
    },
  };
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  ctx.lineWidth = w;
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  let pen = 0;
  for (const ch of "bauhaus") {
    const g = glyphs[ch];
    ctx.save();
    ctx.translate(pen, 0);
    ctx.beginPath();
    g.draw(ctx);
    ctx.stroke();
    ctx.restore();
    pen += g.advance + 0.16;
  }
  ctx.restore();
  return pen - 0.16;
}

/** Breaks text into lines no wider than `max` in the current font. */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > max && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function drawBauhaus(ctx: CanvasRenderingContext2D, w: number, h: number, f: Fonts, lang: Lang) {
  ctx.fillStyle = "#e5dccf";
  ctx.fillRect(0, 0, w, h);
  const m = 44;
  // the artwork, with the misregistered ink shadow of a screen print
  const scale = 0.86;
  const artX = (w - 400 * scale) / 2;
  const art = (offset: number, colour: string | null) => {
    ctx.save();
    ctx.translate(artX + offset, m + offset);
    ctx.scale(scale, scale);
    BAUHAUS_ART.forEach(([d, fill], i) => {
      const path = new Path2D(d);
      ctx.fillStyle = colour ?? fill;
      ctx.fill(path);
      const screen = colour ? undefined : BAUHAUS_SCREEN[i];
      if (!screen) return;
      ctx.save();
      ctx.clip(path);
      ctx.fillStyle = fill === "#3b3b3b" || fill === "#008787" ? "#e5dccf" : "#1d1d1d";
      if (screen === "stripes") for (let y = 0; y < 500; y += 14) ctx.fillRect(0, y, 400, 5);
      else for (let y = 5; y < 500; y += 11) for (let x = 5; x < 400; x += 11) ctx.fillRect(x - 2, y - 2, 4, 4);
      ctx.restore();
    });
    ctx.restore();
  };
  art(7, "#1d1d1d");
  art(0, null);
  // the title in Bauhaus lettering, as wide as the type area, over a thick rule
  const unit = (w - m * 2) / 7.7; // the word is 7.7 x-heights wide (see letterBauhaus)
  let y = m + 500 * scale + 22 + 1.62 * unit;
  ctx.strokeStyle = "#1d1d1d";
  letterBauhaus(ctx, m, y, unit);
  ctx.fillStyle = "#1d1d1d";
  y += 22;
  ctx.fillRect(m, y, w - m * 2, 6);
  // the note
  y += 34;
  ctx.textAlign = "left";
  ctx.font = `500 19px ${f.poster}`;
  for (const line of wrap(ctx, BAUHAUS_NOTE[lang], w - m * 2)) {
    ctx.fillText(line, m, y);
    y += 26;
  }
  // signed along the foot
  ctx.font = `700 15px ${f.poster}`;
  ctx.fillStyle = "#3b3b3b";
  ctx.fillText("FAJAR MAGSYAR", m, h - 30);
  ctx.textAlign = "right";
  ctx.fillStyle = "#f15a24";
  ctx.fillText("LO-FI ↗", w - m, h - 30);
  // paper grain and a little sun on it
  const r = rng(1919);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(${r() < 0.5 ? "255,250,240" : "60,45,30"},${0.04 + r() * 0.06})`;
    ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
  }
  ctx.globalCompositeOperation = "multiply";
  const sun = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, h * 0.8);
  sun.addColorStop(0, "rgba(255,240,210,0)");
  sun.addColorStop(1, "rgba(190,150,100,0.35)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";
  // tape across the top corners
  for (const x of [w * 0.1, w * 0.9]) {
    ctx.save();
    ctx.translate(x, 14);
    ctx.rotate(x < w / 2 ? -0.35 : 0.35);
    ctx.fillStyle = "rgba(235,222,190,0.85)";
    ctx.fillRect(-36, -12, 72, 24);
    ctx.restore();
  }
}

const BW = 0.4;
const BH = 0.56;

/**
 * A Bauhaus print, taped up left of the record. The first click brings the camera to it; a click
 * on it from there asks whether to open the Lite page, whose artwork it shares.
 */
function BauhausPoster({ position, fonts }: { position: [number, number]; fonts: Fonts | null }) {
  const lang = useLang();
  const focused = useRoom((r) => r.focus === "bauhaus");
  const tex = useCanvasTexture(
    620,
    868,
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      if (fonts) drawBauhaus(ctx, w, h, fonts, lang);
    },
    [fonts, lang],
  );
  return (
    <Interactive target="bauhaus">
      <mesh
        position={[position[0], position[1], WALL_Z + 0.004]}
        rotation={[0, 0, 0.02]}
        receiveShadow
        onClick={(e) => {
          if (!focused) return;
          e.stopPropagation();
          useRoom.getState().setConfirmLite(true);
        }}
        onPointerOver={() => focused && useRoom.getState().setTip("bauhaus_open_tip")}
        onPointerOut={() => useRoom.getState().tip === "bauhaus_open_tip" && useRoom.getState().setTip(null)}
      >
        <planeGeometry args={[BW, BH]} />
        <meshStandardMaterial map={tex} roughness={0.92} />
      </mesh>
    </Interactive>
  );
}

/**
 * The photo of me and my family, in a small standing certificate-style frame.
 */
function Portrait() {
  const photo = useImage("/photos/portrait.jpg");
  const tex = useCanvasTexture(680, 840, (ctx, w, h) => {
    ctx.fillStyle = "#1a1512";
    ctx.fillRect(0, 0, w, h);
    if (photo) {
      const k = Math.max(w / photo.width, h / photo.height);
      ctx.drawImage(photo, (w - photo.width * k) / 2, (h - photo.height * k) / 2, photo.width * k, photo.height * k);
    }
  }, [photo]);
  return (
    <Interactive target="portrait">
      <group position={POS.sillPhoto} rotation={[0, 0.5, 0]}>
        <group rotation={[-0.2, 0, 0]}>
          <group position={[0, 0.2355 * 0.3, 0]} scale={0.3}>
            <Model asset="hanging_picture_frame_01" scale={0.56} />
            <mesh position={[0, 0, 0.0105]} castShadow>
              <planeGeometry args={[0.268, 0.378]} />
              <meshStandardMaterial map={tex} color="#ffffff" roughness={0.82} />
            </mesh>
            <Glass w={0.268} h={0.378} z={0.0112} opacity={0.012} glare={0} shade={0} />
          </group>
        </group>
      </group>
    </Interactive>
  );
}

export function Posters() {
  const fonts = useFonts();
  return (
    <group>
      {/* the one strip of wall still in view, above the guitar: the record, hung on a nail */}
      <VinylOnWall album={OK_COMPUTER} position={POS.wallPoster} />
      {/* further left, above the amp: a Bauhaus print that leads to the Lite page */}
      <BauhausPoster position={POS.bauhausPoster} fonts={fonts} />
      {/* at the left-hand end of the desk, turned towards the chair */}
      <Portrait />
    </group>
  );
}
