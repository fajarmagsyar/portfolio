"use client";

import { DESK, SILL, WALL_Z } from "../layout";
import { rng, useCanvasTexture, useFonts, type Fonts } from "../textures";

// Three favourite albums as old gig-style posters. These are original typographic
// designs: titles, artists, years and track names only. The real cover artwork is
// copyrighted and is deliberately not reproduced.

type Album = {
  title: string;
  artist: string;
  year: number;
  tracks: string[];
  paper: string;
  ink: string;
  accent: string;
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
  paper: "#dfe6e6",
  ink: "#1c2a3a",
  accent: "#c8402a",
};

const DAMN: Album = {
  title: "DAMN.",
  artist: "KENDRICK LAMAR",
  year: 2017,
  tracks: ["BLOOD.", "DNA.", "YAH.", "ELEMENT.", "FEEL.", "LOYALTY.", "PRIDE.", "HUMBLE.", "LUST.", "LOVE.", "XXX.", "FEAR.", "GOD.", "DUCKWORTH."],
  paper: "#8f1d17",
  ink: "#f3ead8",
  accent: "#f3ead8",
};

const DARK_SIDE: Album = {
  title: "THE DARK SIDE OF THE MOON",
  artist: "PINK FLOYD",
  year: 1973,
  tracks: ["Speak to Me", "Breathe", "On the Run", "Time", "The Great Gig in the Sky", "Money", "Us and Them", "Any Colour You Like", "Brain Damage", "Eclipse"],
  paper: "#15130f",
  ink: "#e9dfc6",
  accent: "#d9a441",
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

function drawOkComputer(ctx: CanvasRenderingContext2D, w: number, h: number, f: Fonts) {
  const a = OK_COMPUTER;
  const r = rng(1997);
  ctx.fillStyle = a.paper;
  ctx.fillRect(0, 0, w, h);
  // cold washes and nervous scribbled lines
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = `rgba(${90 + r() * 60},${130 + r() * 60},${170 + r() * 50},${0.05 + r() * 0.1})`;
    ctx.fillRect(r() * w - 60, r() * h, 120 + r() * 380, 6 + r() * 60);
  }
  ctx.strokeStyle = "rgba(28,42,58,0.45)";
  for (let i = 0; i < 16; i++) {
    ctx.lineWidth = 0.6 + r() * 1.4;
    ctx.beginPath();
    let x = r() * w;
    let y = h * 0.34 + r() * h * 0.3;
    ctx.moveTo(x, y);
    for (let k = 0; k < 9; k++) {
      x += (r() - 0.5) * 150;
      y += (r() - 0.5) * 70;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.fillStyle = a.ink;
  ctx.textAlign = "left";
  fit(ctx, a.title, 700, f.body, w - 90, 92);
  ctx.fillText(a.title, 44, 150);
  ctx.fillStyle = a.accent;
  ctx.fillRect(44, 170, w - 88, 5);
  ctx.fillStyle = a.ink;
  ctx.font = `30px ${f.screen}`;
  ctx.fillText(`${a.artist} / ${a.year}`, 44, 216);
  ctx.font = `500 21px ${f.body}`;
  a.tracks.forEach((t, i) => {
    const col = i < 6 ? 0 : 1;
    ctx.fillText(`${String(i + 1).padStart(2, "0")}  ${t}`, 44 + col * (w / 2 - 30), h - 240 + (i % 6) * 32);
  });
  ctx.font = `20px ${f.screen}`;
  ctx.fillStyle = a.accent;
  ctx.fillText("12 TRACKS  /  53 MIN", 44, h - 30);
}

function drawDamn(ctx: CanvasRenderingContext2D, w: number, h: number, f: Fonts) {
  const a = DAMN;
  ctx.fillStyle = a.paper;
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = a.ink;
  ctx.textAlign = "center";
  const size = fit(ctx, a.title, 700, f.body, w - 70, 220);
  ctx.fillText(a.title, w / 2, 120 + size * 0.8);
  ctx.font = `34px ${f.screen}`;
  ctx.fillText(a.artist, w / 2, 390);
  ctx.font = `24px ${f.screen}`;
  ctx.fillText(String(a.year), w / 2, 428);
  ctx.fillRect(w / 2 - 40, 452, 80, 4);
  // track names set as one block of capitals
  ctx.font = `700 27px ${f.body}`;
  const rows = [a.tracks.slice(0, 4), a.tracks.slice(4, 7), a.tracks.slice(7, 11), a.tracks.slice(11)];
  rows.forEach((row, i) => ctx.fillText(row.join("  "), w / 2, 530 + i * 46));
  ctx.font = `20px ${f.screen}`;
  ctx.globalAlpha = 0.75;
  ctx.fillText("14 TRACKS", w / 2, h - 44);
  ctx.globalAlpha = 1;
}

function drawDarkSide(ctx: CanvasRenderingContext2D, w: number, h: number, f: Fonts) {
  const a = DARK_SIDE;
  ctx.fillStyle = a.paper;
  ctx.fillRect(0, 0, w, h);
  // the phases of the moon, new to full to new
  const n = 7;
  for (let i = 0; i < n; i++) {
    const cx = w * 0.12 + (i * (w * 0.76)) / (n - 1);
    const cy = 250;
    const rad = 30;
    ctx.fillStyle = a.ink;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
    // shadow sliding across
    const phase = (i - (n - 1) / 2) / ((n - 1) / 2); // -1 .. 1
    ctx.fillStyle = a.paper;
    ctx.beginPath();
    ctx.arc(cx + phase * rad * 2.1, cy, rad * 1.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(233,223,198,0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.textAlign = "center";
  ctx.fillStyle = a.ink;
  ctx.font = `30px ${f.screen}`;
  ctx.fillText(a.artist, w / 2, 110);
  fit(ctx, "THE DARK SIDE", 700, f.body, w - 80, 76);
  ctx.fillText("THE DARK SIDE", w / 2, 400);
  ctx.fillText("OF THE MOON", w / 2, 476);
  ctx.fillStyle = a.accent;
  ctx.fillRect(w / 2 - 60, 508, 120, 4);
  ctx.font = `26px ${f.screen}`;
  ctx.fillText(String(a.year), w / 2, 552);
  ctx.fillStyle = a.ink;
  ctx.font = `500 22px ${f.body}`;
  a.tracks.forEach((t, i) => {
    ctx.textAlign = i % 2 ? "left" : "right";
    ctx.fillText(t, w / 2 + (i % 2 ? 22 : -22), 620 + Math.floor(i / 2) * 36);
  });
  ctx.fillStyle = a.accent;
  for (let i = 0; i < 5; i++) ctx.fillRect(w / 2 - 2, 604 + i * 36, 4, 20);
}

const PW = 0.44;
const PH = 0.62;

function Poster({
  draw,
  seed,
  position,
  tilt,
  fonts,
}: {
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, f: Fonts) => void;
  seed: number;
  position: [number, number];
  tilt: number;
  fonts: Fonts | null;
}) {
  const tex = useCanvasTexture(
    620,
    874,
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      if (!fonts) return;
      draw(ctx, w, h, fonts);
      age(ctx, w, h, seed);
    },
    [fonts, seed],
  );
  return (
    <mesh position={[position[0], position[1], WALL_Z + 0.004]} rotation={[0, 0, tilt]} receiveShadow>
      <planeGeometry args={[PW, PH]} />
      <meshStandardMaterial map={tex} transparent alphaTest={0.5} roughness={0.95} />
    </mesh>
  );
}

/**
 * A poster kept behind glass in a small standing frame, for the ones there is no wall
 * left for now that the view is close in. No tape, creases or torn edges on these.
 */
function FramedPoster({
  draw,
  position,
  rotation,
  fonts,
  wood = "#3a2a1c",
}: {
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, f: Fonts) => void;
  position: [number, number, number];
  rotation: [number, number, number];
  fonts: Fonts | null;
  wood?: string;
}) {
  const tex = useCanvasTexture(
    620,
    874,
    (ctx, w, h) => {
      ctx.fillStyle = "#e9dfc6";
      ctx.fillRect(0, 0, w, h);
      if (fonts) draw(ctx, w, h, fonts);
    },
    [fonts],
  );
  const w = 0.19; // the print
  const h = w * (PH / PW);
  const bar = 0.014;
  const mat = 0.012;
  const ow = w + (mat + bar) * 2;
  const oh = h + (mat + bar) * 2;
  // origin at the bottom edge, so the frame stands on whatever it is placed on
  return (
    <group position={position} rotation={rotation}>
      <group position={[0, oh / 2, 0]}>
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
          <meshStandardMaterial map={tex} color="#b8b2a8" roughness={0.55} />
        </mesh>
        {/* the strut it leans on */}
        <mesh position={[0, -oh * 0.12, -0.05]} rotation={[0.42, 0, 0]} castShadow>
          <boxGeometry args={[0.03, oh * 0.74, 0.004]} />
          <meshStandardMaterial color="#2a1f15" roughness={0.8} />
        </mesh>
      </group>
    </group>
  );
}

export function Posters() {
  const fonts = useFonts();
  return (
    <group>
      {/* the one strip of wall still in view, above the guitar */}
      <Poster draw={drawOkComputer} seed={1997} position={[-1.56, 1.56]} tilt={-0.025} fonts={fonts} />
      {/* on the sill, leaning against the window, left of the TV */}
      <FramedPoster draw={drawDamn} position={[-0.62, SILL.y, SILL.z + 0.07]} rotation={[-0.16, 0.22, 0]} fonts={fonts} wood="#1c1613" />
      {/* at the left-hand end of the desk, turned towards the chair */}
      <FramedPoster draw={drawDarkSide} position={[-1.12, DESK.y, -0.06]} rotation={[-0.2, 0.55, 0]} fonts={fonts} />
    </group>
  );
}
