"use client";

import { asset } from "@/asset";
import { useEffect, useState } from "react";
import { Interactive } from "../Interactive";
import { POS, WALL_Z } from "../layout";
import { rng, useCanvasTexture, useFonts, type Fonts } from "../textures";
import { Glass } from "./Glass";
import { Model } from "./Props";

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
    el.src = asset(src);
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
      {/* the one strip of wall still in view, above the guitar */}
      <Poster album={OK_COMPUTER} seed={1997} position={POS.wallPoster} tilt={-0.025} fonts={fonts} />
      {/* at the left-hand end of the desk, turned towards the chair */}
      <Portrait />
    </group>
  );
}
