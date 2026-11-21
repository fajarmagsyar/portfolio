"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Interactive } from "../Interactive";
import { useRoom } from "../store";
import { POS, WALL_Z } from "../layout";
import { rng, useCanvasTexture, useFonts, type Fonts } from "../textures";

// Two favourite albums as posters (and a framed family photo, below): the cover at the top, and under it the title, the
// artist, the year and the track list. The covers are the files in public/art/; the
// artwork belongs to the artists and their labels (see CREDITS.md).

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

const DAMN: Album = {
  title: "DAMN.",
  artist: "KENDRICK LAMAR",
  year: 2017,
  tracks: ["BLOOD.", "DNA.", "YAH.", "ELEMENT.", "FEEL.", "LOYALTY.", "PRIDE.", "HUMBLE.", "LUST.", "LOVE.", "XXX.", "FEAR.", "GOD.", "DUCKWORTH."],
  paper: "#141010",
  ink: "#f3ead8",
  accent: "#e0241b",
  art: "/art/damn.jpg",
};

function fit(ctx: CanvasRenderingContext2D, text: string, weight: number, family: string, max: number, start: number) {
  let size = start;
  ctx.font = `${weight} ${size}px ${family}`;
  while (ctx.measureText(text).width > max && size > 12) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

/** Decades on a bedroom wall: yellowing, fold creases, stains, scuffed edges, tape. */
function age(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  const r = rng(seed);
  // yellowing, strongest towards the edges
  ctx.globalCompositeOperation = "multiply";
  const y = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, h * 0.75);
  y.addColorStop(0, "rgba(236,214,160,0.35)");
  y.addColorStop(1, "rgba(150,105,50,0.75)");
  ctx.fillStyle = y;
  ctx.fillRect(0, 0, w, h);
  // water stains
  for (let i = 0; i < 5; i++) {
    const cx = r() * w;
    const cy = r() * h;
    const rad = 30 + r() * 90;
    const g = ctx.createRadialGradient(cx, cy, rad * 0.6, cx, cy, rad);
    g.addColorStop(0, "rgba(120,85,40,0)");
    g.addColorStop(0.85, "rgba(120,85,40,0.22)");
    g.addColorStop(1, "rgba(120,85,40,0)");
    ctx.fillStyle = g;
    ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  }
  ctx.globalCompositeOperation = "source-over";
  // it was folded in four once
  for (const [x0, y0, x1, y1] of [
    [0, h / 2, w, h / 2],
    [w / 2, 0, w / 2, h],
  ]) {
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x0 + 2, y0 + 2);
    ctx.lineTo(x1 + 2, y1 + 2);
    ctx.stroke();
  }
  // ink rubbed off in specks, more along the creases
  for (let i = 0; i < 1400; i++) {
    const onCrease = r() < 0.35;
    const x = onCrease && r() < 0.5 ? w / 2 + (r() - 0.5) * 14 : r() * w;
    const yy = onCrease && x !== w / 2 ? (r() < 0.5 ? h / 2 + (r() - 0.5) * 14 : r() * h) : r() * h;
    ctx.fillStyle = `rgba(235,220,185,${0.15 + r() * 0.35})`;
    ctx.fillRect(x, yy, 1 + r() * 3, 1 + r() * 2);
  }
  // scuffed, torn edges and dog-eared corners are cut away
  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 90; i++) {
    const side = Math.floor(r() * 4);
    const t = r();
    const d = 2 + r() * 7;
    const [x, yy] = side === 0 ? [t * w, 0] : side === 1 ? [t * w, h] : side === 2 ? [0, t * h] : [w, t * h];
    ctx.beginPath();
    ctx.arc(x, yy, d, 0, Math.PI * 2);
    ctx.fill();
  }
  const cornerX = r() < 0.5 ? 0 : w;
  ctx.beginPath();
  ctx.moveTo(cornerX, h);
  ctx.lineTo(cornerX === 0 ? 46 : w - 46, h);
  ctx.lineTo(cornerX, h - 38);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  // yellowed tape on the top corners
  for (const x of [w * 0.12, w * 0.88]) {
    ctx.save();
    ctx.translate(x, 16);
    ctx.rotate((r() - 0.5) * 0.5);
    ctx.fillStyle = "rgba(226,205,150,0.85)";
    ctx.fillRect(-34, -13, 68, 26);
    ctx.restore();
  }
}

/** Loads an image for painting into a canvas; null until it has arrived. */
function useImage(src: string) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const el = new Image();
    let alive = true;
    el.onload = () => alive && setImg(el);
    el.src = src;
    return () => {
      alive = false;
    };
  }, [src]);
  return img;
}

/** The cover fills the top of the sheet; the words sit in the band beneath it. */
function drawAlbum(ctx: CanvasRenderingContext2D, w: number, h: number, f: Fonts, a: Album, art: HTMLImageElement | null) {
  ctx.fillStyle = a.paper;
  ctx.fillRect(0, 0, w, h);
  const m = 34;
  const side = w - m * 2;
  if (art) {
    ctx.drawImage(art, m, m, side, side);
    ctx.strokeStyle = "rgba(128,128,128,0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(m + 0.5, m + 0.5, side - 1, side - 1);
  }
  let y = m + side + 54;
  ctx.fillStyle = a.ink;
  ctx.textAlign = "left";
  fit(ctx, a.title, 700, f.body, w - m * 2, 46);
  ctx.fillText(a.title, m, y);
  y += 30;
  ctx.font = `21px ${f.screen}`;
  ctx.fillText(a.artist, m, y);
  ctx.textAlign = "right";
  ctx.fillStyle = a.accent;
  ctx.fillText(String(a.year), w - m, y);
  y += 14;
  ctx.fillRect(m, y, side, 3);
  y += 30;
  // the tracks, down two columns
  ctx.fillStyle = a.ink;
  ctx.textAlign = "left";
  const rows = Math.ceil(a.tracks.length / 2);
  const line = Math.min(24, (h - y - 6) / rows);
  ctx.font = `500 ${Math.round(line * 0.72)}px ${f.body}`;
  ctx.globalAlpha = 0.86;
  a.tracks.forEach((t, i) => {
    const col = i < rows ? 0 : 1;
    ctx.fillText(`${String(i + 1).padStart(2, "0")}  ${t}`, m + col * (side / 2 + 8), y + (i % rows) * line, side / 2 - 12);
  });
  ctx.globalAlpha = 1;
}

const PW = 0.44;
const PH = 0.62;

function Poster({
  album,
  seed,
  position,
  tilt,
  fonts,
}: {
  album: Album;
  seed: number;
  position: [number, number];
  tilt: number;
  fonts: Fonts | null;
}) {
  const art = useImage(album.art);
  const tex = useCanvasTexture(
    620,
    874,
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      if (!fonts) return;
      drawAlbum(ctx, w, h, fonts, album, art);
      age(ctx, w, h, seed);
    },
    [fonts, seed, album, art],
  );
  return (
    <mesh position={[position[0], position[1], WALL_Z + 0.004]} rotation={[0, 0, tilt]} receiveShadow>
      <planeGeometry args={[PW, PH]} />
      <meshStandardMaterial map={tex} transparent alphaTest={0.5} roughness={0.95} />
    </mesh>
  );
}

// the standing frame: the print, its mount and the wooden bars round them
const FRAME = (() => {
  const w = 0.19;
  const h = w * (PH / PW);
  const bar = 0.014;
  const mat = 0.012;
  return { w, h, bar, ow: w + (mat + bar) * 2, oh: h + (mat + bar) * 2 };
})();

/**
 * A poster kept behind glass in a small standing frame, for the ones there is no wall
 * left for now that the view is close in. No tape, creases or torn edges on these.
 */
function FramedPoster({
  album,
  photo,
  position,
  rotation,
  fonts,
  wood = "#3a2a1c",
  lit = false,
}: {
  album?: Album;
  /** a photograph under /public to show instead of an album's poster */
  photo?: string;
  position: [number, number, number];
  rotation: [number, number, number];
  fonts: Fonts | null;
  wood?: string;
  /** a photograph is lit up while it is looked at */
  lit?: boolean;
}) {
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((_, dt) => {
    const m = glow.current;
    if (m) m.emissiveIntensity += ((lit ? 0.85 : 0.1) - m.emissiveIntensity) * (1 - Math.exp(-dt * 5));
  });
  const art = useImage(photo ?? album?.art ?? "");
  const tex = useCanvasTexture(
    620,
    874,
    (ctx, w, h) => {
      if (photo) {
        // the photograph fills the print, cropped to its shape
        ctx.fillStyle = "#1a1512";
        ctx.fillRect(0, 0, w, h);
        if (art) {
          const k = Math.max(w / art.width, h / art.height);
          ctx.drawImage(art, (w - art.width * k) / 2, (h - art.height * k) / 2, art.width * k, art.height * k);
        }
        return;
      }
      if (!album) return;
      ctx.fillStyle = album.paper;
      ctx.fillRect(0, 0, w, h);
      if (fonts) drawAlbum(ctx, w, h, fonts, album, art);
    },
    [fonts, album, photo, art],
  );
  const { w, h, bar, ow, oh } = FRAME;
  // origin at the bottom edge, so the frame stands on whatever it is placed on
  return (
    // turned to face where it is looked at from, then tipped back about its own bottom edge:
    // done the other way round, the tip happens across the room's axis and one bottom corner
    // sinks into whatever the frame stands on
    <group position={position} rotation={[0, rotation[1], 0]}>
      <group position={[0, (oh / 2) * Math.cos(rotation[0]), (oh / 2) * Math.sin(rotation[0])]} rotation={[rotation[0], 0, 0]}>
        {(
          [
            [0, oh / 2 - bar / 2, ow, bar],
            [0, -oh / 2 + bar / 2, ow, bar],
            [-ow / 2 + bar / 2, 0, bar, oh - bar * 2],
            [ow / 2 - bar / 2, 0, bar, oh - bar * 2],
          ] as const
        ).map(([x, y, bw, bh], i) => (
          <mesh key={i} position={[x, y, 0]} castShadow>
            <boxGeometry args={[bw, bh, 0.018]} />
            <meshStandardMaterial color={wood} roughness={0.55} />
          </mesh>
        ))}
        {/* backing board, mount and print */}
        <mesh position={[0, 0, -0.006]} castShadow>
          <boxGeometry args={[ow - 0.004, oh - 0.004, 0.006]} />
          <meshStandardMaterial color="#8f8676" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0, -0.0025]}>
          <planeGeometry args={[w, h]} />
          {photo ? (
            <meshStandardMaterial ref={glow} map={tex} color="#d6d0c6" emissive="#ffffff" emissiveMap={tex} emissiveIntensity={0.1} roughness={0.55} />
          ) : (
            <meshStandardMaterial map={tex} color="#b8b2a8" roughness={0.55} />
          )}
        </mesh>
        {/* the strut it leans on */}
        <mesh position={[0, -oh * 0.1, -0.06]} rotation={[0.42, 0, 0]} castShadow>
          <boxGeometry args={[0.03, oh * 0.66, 0.004]} />
          <meshStandardMaterial color="#2a1f15" roughness={0.8} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * The photo of me and my family, in a standing frame at the left end of the desk. Focused, the
 * eye comes to it (see the camera rig) and the photograph is lit up a little, as the corner it
 * stands in is dark.
 */
function Portrait({ fonts }: { fonts: Fonts | null }) {
  const lit = useRoom((s) => s.focus === "portrait");
  return (
    <Interactive target="portrait">
      <FramedPoster photo="/photos/portrait.jpg" position={POS.deskPoster} rotation={[-0.2, 0.5, 0]} fonts={fonts} lit={lit} />
    </Interactive>
  );
}

export function Posters() {
  const fonts = useFonts();
  return (
    <group>
      {/* the one strip of wall still in view, above the guitar */}
      <Poster album={OK_COMPUTER} seed={1997} position={POS.wallPoster} tilt={-0.025} fonts={fonts} />
      {/* on the sill, leaning against the window, left of the TV */}
      <FramedPoster album={DAMN} position={POS.sillPoster} rotation={[-0.16, 0.2, 0]} fonts={fonts} wood="#1c1613" />
      {/* at the left-hand end of the desk, turned towards the chair */}
      <Portrait fonts={fonts} />
    </group>
  );
}
