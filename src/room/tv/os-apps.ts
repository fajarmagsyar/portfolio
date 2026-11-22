import { hasDisc, next as nextTrack, pause, play, prev as prevTrack, stop, usePlayer } from "@/audio/player";
import { blip } from "@/audio/sfx";
import { jobs, jobYears, links, profile, projects, skills, type Lang } from "@/content/data";
import { tracks } from "@/content/music";
import { photos } from "@/content/photos";
import { useLangStore } from "@/state/lang";
import { wrap, type Fonts } from "../textures";
import { bevel, button, clamp, inside, K, type Program, type Rect } from "./os-kit";

// The small programs that come with KAMAR 3.1: three accessories (a notepad you can type in,
// a paintbrush, a clock) and three games (mines, a snake, noughts and crosses). Each keeps
// its own state here and paints itself into the window it is given.

export type ExtraId = "term" | "notes" | "paint" | "clock" | "mines" | "snake" | "galaga" | "ttt" | "typing";

type Names = { icon: Record<Lang, string>; title: Record<Lang, string>; menus: Record<Lang, string[]> };
export const EXTRA_NAMES: Record<ExtraId, Names> = {
  term: {
    icon: { id: "Prompt", en: "Prompt" },
    title: { id: "Command Prompt", en: "Command Prompt" },
    menus: { id: [], en: [] },
  },
  notes: {
    icon: { id: "Notepad", en: "Notepad" },
    title: { id: "Notepad - (TANPA JUDUL)", en: "Notepad - (UNTITLED)" },
    menus: { id: ["Berkas", "Sunting", "Bantuan"], en: ["File", "Edit", "Help"] },
  },
  paint: {
    icon: { id: "Paint", en: "Paint" },
    title: { id: "Paint - (TANPA JUDUL)", en: "Paint - (UNTITLED)" },
    menus: { id: ["Berkas", "Sunting", "Bantuan"], en: ["File", "Edit", "Help"] },
  },
  clock: {
    icon: { id: "Clock", en: "Clock" },
    title: { id: "Clock", en: "Clock" },
    menus: { id: ["Setelan"], en: ["Settings"] },
  },
  mines: {
    icon: { id: "Minesweeper", en: "Minesweeper" },
    title: { id: "Minesweeper", en: "Minesweeper" },
    menus: { id: ["Permainan", "Bantuan"], en: ["Game", "Help"] },
  },
  snake: {
    icon: { id: "Snake", en: "Snake" },
    title: { id: "Snake", en: "Snake" },
    menus: { id: ["Permainan", "Bantuan"], en: ["Game", "Help"] },
  },
  galaga: {
    icon: { id: "Galaga", en: "Galaga" },
    title: { id: "Galaga", en: "Galaga" },
    menus: { id: ["Permainan", "Bantuan"], en: ["Game", "Help"] },
  },
  ttt: {
    icon: { id: "Tic Tac Toe", en: "Tic Tac Toe" },
    title: { id: "Tic Tac Toe", en: "Tic Tac Toe" },
    menus: { id: ["Permainan", "Bantuan"], en: ["Game", "Help"] },
  },
  typing: {
    icon: { id: "Lomba Ketik", en: "Typing Race" },
    title: { id: "Lomba Ketik", en: "Typing Race" },
    menus: { id: [], en: [] },
  },
};

type Brush = (x: number, y: number, w: number, h: number, c: string) => void;
export const EXTRA_ICONS: Record<ExtraId, (p: Brush) => void> = {
  // a black screen with a prompt on it
  term: (p) => {
    p(1, 2, 14, 12, "#c3c7cb");
    p(2, 3, 12, 10, "#000");
    p(3, 5, 1, 1, "#fff");
    p(4, 6, 1, 1, "#fff");
    p(3, 7, 1, 1, "#fff");
    p(6, 7, 3, 1, "#fff");
  },
  // a spiral-bound pad with a pencil across it
  notes: (p) => {
    p(2, 2, 10, 13, "#000");
    p(3, 3, 8, 11, "#fff");
    for (let x = 3; x < 11; x += 2) p(x, 1, 1, 3, "#868a8e");
    p(4, 6, 6, 1, "#000a7b");
    p(4, 8, 6, 1, "#000a7b");
    p(10, 9, 4, 2, "#e3c558");
    p(9, 11, 2, 2, "#e3c558");
    p(8, 13, 1, 1, "#000");
  },
  // a palette with three dabs of colour, and a brush
  paint: (p) => {
    p(1, 5, 12, 9, "#000");
    p(2, 6, 10, 7, "#c9a06a");
    p(3, 7, 2, 2, "#d8362a");
    p(6, 7, 2, 2, "#2f8f4a");
    p(9, 8, 2, 2, "#000a7b");
    p(5, 10, 2, 2, "#e3c558");
    p(11, 1, 2, 6, "#000");
    p(12, 2, 1, 3, "#c3c7cb");
  },
  // a round clock face with its two hands
  clock: (p) => {
    p(4, 1, 8, 1, "#000");
    p(2, 3, 12, 10, "#000");
    p(4, 14, 8, 1, "#000");
    p(3, 2, 10, 12, "#000");
    p(4, 3, 8, 10, "#fff");
    p(3, 4, 10, 8, "#fff");
    p(8, 4, 1, 5, "#000");
    p(8, 8, 3, 1, "#000");
  },
  // a mine: a black ball with spikes and a glint
  mines: (p) => {
    p(7, 1, 2, 14, "#000");
    p(1, 7, 14, 2, "#000");
    p(4, 4, 8, 8, "#000");
    p(3, 5, 10, 6, "#000");
    p(5, 3, 6, 10, "#000");
    p(5, 5, 2, 2, "#fff");
  },
  // a snake in an S, with an apple
  snake: (p) => {
    p(2, 3, 9, 2, "#2f8f4a");
    p(2, 3, 2, 6, "#2f8f4a");
    p(2, 7, 9, 2, "#2f8f4a");
    p(9, 7, 2, 6, "#2f8f4a");
    p(4, 11, 7, 2, "#2f8f4a");
    p(10, 3, 1, 1, "#000");
    p(12, 11, 3, 3, "#d8362a");
    p(13, 10, 1, 1, "#2f8f4a");
  },
  galaga: (p) => {
    p(7, 2, 2, 2, "#f7efe0");
    p(6, 4, 4, 2, "#2f8f4a");
    p(5, 6, 6, 2, "#2f8f4a");
    p(7, 8, 2, 2, "#f0b45c");
    p(2, 10, 2, 2, "#d8362a");
    p(7, 11, 2, 2, "#d8362a");
    p(12, 10, 2, 2, "#d8362a");
    p(7, 13, 2, 2, "#8fe8f0");
  },
  // the grid, with a nought and a cross
  ttt: (p) => {
    p(5, 1, 1, 14, "#000");
    p(10, 1, 1, 14, "#000");
    p(1, 5, 14, 1, "#000");
    p(1, 10, 14, 1, "#000");
    p(1, 1, 1, 1, "#d8362a");
    p(2, 2, 1, 1, "#d8362a");
    p(3, 3, 1, 1, "#d8362a");
    p(3, 1, 1, 1, "#d8362a");
    p(1, 3, 1, 1, "#d8362a");
    p(11, 11, 4, 1, "#000a7b");
    p(11, 14, 4, 1, "#000a7b");
    p(11, 11, 1, 4, "#000a7b");
    p(14, 11, 1, 4, "#000a7b");
  },
  // a dark screen of text with a yellow caret
  typing: (p) => {
    p(1, 3, 14, 10, "#000");
    p(2, 4, 12, 8, "#2c2e31");
    p(3, 6, 3, 1, "#d1d0c5");
    p(7, 6, 4, 1, "#646669");
    p(3, 9, 5, 1, "#646669");
    p(9, 8, 1, 3, "#e2b714");
  },
};

const beep = (f: number) => blip(f, 0.04);
/** Text set in the middle of a button, in the system's bold face. */
function label(ctx: CanvasRenderingContext2D, f: Fonts, text: string, size = 16, colour = K.ink) {
  return (cx: number, cy: number) => {
    ctx.font = `700 ${size}px ${f.body}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = colour;
    ctx.fillText(text, cx, cy + 1);
    ctx.textBaseline = "alphabetic";
  };
}

/* ---------- Notepad: a page you can type on ---------- */

const pad = { text: "", limit: 900 };
const notes: Program = {
  size: [430, 330],
  draw(ctx, f, b, lang, front) {
    ctx.fillStyle = K.page;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.font = `700 18px ${f.body}`;
    ctx.textAlign = "left";
    const lines = pad.text ? wrap(ctx, pad.text, b.w - 28) : [""];
    const rows = Math.floor((b.h - 16) / 25);
    // the page follows the writing: the last lines are always the ones in view
    const shown = lines.slice(Math.max(0, lines.length - rows));
    if (!pad.text) {
      ctx.fillStyle = K.shade;
      ctx.fillText(lang === "id" ? "Ketik sesuatu..." : "Type something...", b.x + 14, b.y + 30);
    }
    ctx.fillStyle = K.ink;
    shown.forEach((line, i) => ctx.fillText(line, b.x + 14, b.y + 30 + i * 25));
    // the caret, blinking at the end of the text while this window has the keyboard
    if (front && Math.floor(performance.now() / 500) % 2 === 0) {
      const last = shown[shown.length - 1] ?? "";
      ctx.fillRect(b.x + 14 + ctx.measureText(last).width + 1, b.y + 13 + (shown.length - 1) * 25, 2, 22);
    }
  },
  key(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if (e.key === "Backspace") pad.text = pad.text.slice(0, -1);
    else if (e.key === "Enter") pad.text += "\n";
    else if (e.key.length === 1 && pad.text.length < pad.limit) pad.text += e.key;
    else return false;
    return true;
  },
};

/* ---------- Paintbrush: colours along the bottom, and a sheet to draw on ---------- */

const INKS = ["#000000", "#ffffff", "#868a8e", "#d8362a", "#e3c558", "#2f8f4a", "#0d8a8e", "#000a7b", "#a03aa0", "#8a5a2a"];
const SHEET = { w: 380, h: 250 };
const art = { sheet: null as HTMLCanvasElement | null, ink: 0, size: 3, last: null as null | [number, number] };
function sheet() {
  if (!art.sheet) {
    art.sheet = document.createElement("canvas");
    art.sheet.width = SHEET.w;
    art.sheet.height = SHEET.h;
    wipe();
  }
  return art.sheet;
}
function wipe() {
  const c = sheet().getContext("2d")!;
  c.fillStyle = "#e6e6e0";
  c.fillRect(0, 0, SHEET.w, SHEET.h);
}
const paintParts = (b: Rect) => {
  const area: Rect = { x: b.x + 6, y: b.y + 6, w: b.w - 12, h: b.h - 54 };
  const bar = b.y + b.h - 42;
  const inkAt = (i: number): Rect => ({ x: b.x + 8 + i * 26, y: bar + 6, w: 22, h: 26 });
  const sizeAt = (i: number): Rect => ({ x: b.x + b.w - 168 + i * 30, y: bar + 6, w: 26, h: 26 });
  const clear: Rect = { x: b.x + b.w - 72, y: bar + 6, w: 64, h: 26 };
  return { area, inkAt, sizeAt, clear };
};
const SIZES = [2, 4, 9];
function stroke(x: number, y: number, b: Rect) {
  const { area } = paintParts(b);
  const px = ((x - area.x) / area.w) * SHEET.w;
  const py = ((y - area.y) / area.h) * SHEET.h;
  const c = sheet().getContext("2d")!;
  c.strokeStyle = c.fillStyle = INKS[art.ink];
  c.lineWidth = art.size;
  c.lineCap = "round";
  c.beginPath();
  if (art.last) {
    c.moveTo(art.last[0], art.last[1]);
    c.lineTo(px, py);
    c.stroke();
  } else {
    c.arc(px, py, art.size / 2, 0, Math.PI * 2);
    c.fill();
  }
  art.last = [px, py];
}
const paint: Program = {
  size: [440, 380],
  draw(ctx, f, b, lang) {
    const { area, inkAt, sizeAt, clear } = paintParts(b);
    ctx.fillStyle = K.frame;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = K.dark;
    ctx.fillRect(area.x - 1, area.y - 1, area.w + 2, area.h + 2);
    ctx.drawImage(sheet(), area.x, area.y, area.w, area.h);
    INKS.forEach((ink, i) => {
      const r = inkAt(i);
      ctx.fillStyle = K.dark;
      ctx.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
      ctx.fillStyle = ink;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      // the colour in use is marked with a notch above it
      if (art.ink === i) {
        ctx.fillStyle = K.dark;
        ctx.fillRect(r.x + 5, r.y - 6, r.w - 10, 4);
      }
    });
    SIZES.forEach((size, i) =>
      button(
        ctx,
        sizeAt(i),
        (cx, cy) => {
          ctx.beginPath();
          ctx.arc(cx, cy, size / 2 + 1, 0, Math.PI * 2);
          ctx.fill();
        },
        art.size === size,
      ),
    );
    button(ctx, clear, label(ctx, f, lang === "id" ? "Hapus" : "Clear", 14));
  },
  down(x, y, b) {
    const { area, inkAt, sizeAt, clear } = paintParts(b);
    const ink = INKS.findIndex((_, i) => inside(inkAt(i), x, y));
    const size = SIZES.findIndex((_, i) => inside(sizeAt(i), x, y));
    if (ink >= 0) {
      art.ink = ink;
      beep(620);
    } else if (size >= 0) {
      art.size = SIZES[size];
      beep(620);
    } else if (inside(clear, x, y)) {
      wipe();
      beep(330);
    } else if (inside(area, x, y)) {
      art.last = null;
      stroke(x, y, b);
    }
  },
  move(x, y, b, held) {
    if (held && art.last && inside(paintParts(b).area, x, y)) stroke(x, y, b);
  },
  up() {
    art.last = null;
  },
};

/* ---------- Clock: a face with hands, and the date under it ---------- */

const clock: Program = {
  size: [250, 290],
  draw(ctx, f, b, lang) {
    ctx.fillStyle = K.frame;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    const cx = b.x + b.w / 2;
    const cy = b.y + (b.h - 30) / 2 + 4;
    const r = Math.min(b.w, b.h - 30) / 2 - 12;
    ctx.fillStyle = K.dark;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = K.page;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = K.ink;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const big = i % 3 === 0;
      const d = r - (big ? 10 : 7);
      const s = big ? 6 : 3;
      ctx.fillRect(cx + Math.sin(a) * d - s / 2, cy - Math.cos(a) * d - s / 2, s, s);
    }
    const now = new Date();
    const sec = now.getSeconds();
    const min = now.getMinutes() + sec / 60;
    const hour = (now.getHours() % 12) + min / 60;
    const hand = (turn: number, len: number, width: number, colour: string) => {
      const a = turn * Math.PI * 2;
      ctx.strokeStyle = colour;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx - Math.sin(a) * len * 0.12, cy + Math.cos(a) * len * 0.12);
      ctx.lineTo(cx + Math.sin(a) * len, cy - Math.cos(a) * len);
      ctx.stroke();
    };
    hand(hour / 12, r * 0.52, 6, K.ink);
    hand(min / 60, r * 0.8, 4, K.ink);
    hand(sec / 60, r * 0.86, 1.5, "#a01818");
    ctx.font = `700 15px ${f.body}`;
    ctx.textAlign = "center";
    ctx.fillStyle = K.ink;
    ctx.fillText(now.toLocaleDateString(lang === "id" ? "id-ID" : "en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }), cx, b.y + b.h - 10);
  },
};

/* ---------- Mines: clear the field without stepping on one ---------- */

const N = 9;
const MINES = 10;
type Cell = { mine: boolean; open: boolean; flag: boolean; near: number };
const field = { cells: [] as Cell[], laid: false, over: "" as "" | "won" | "lost", flagging: false, started: 0, ended: 0 };
function newField() {
  field.cells = Array.from({ length: N * N }, () => ({ mine: false, open: false, flag: false, near: 0 }));
  field.laid = false;
  field.over = "";
  field.started = 0;
  field.ended = 0;
}
newField();
const around = (i: number) => {
  const x = i % N;
  const y = Math.floor(i / N);
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && x + dx >= 0 && x + dx < N && y + dy >= 0 && y + dy < N) out.push((y + dy) * N + x + dx);
  return out;
};
/** The mines are laid after the first square is opened, and never on it or beside it. */
function lay(first: number) {
  const safe = new Set([first, ...around(first)]);
  let left = MINES;
  while (left > 0) {
    const i = Math.floor(Math.random() * N * N);
    if (safe.has(i) || field.cells[i].mine) continue;
    field.cells[i].mine = true;
    left--;
  }
  field.cells.forEach((c, i) => (c.near = around(i).filter((j) => field.cells[j].mine).length));
  field.laid = true;
  field.started = performance.now();
}
function open(i: number) {
  const c = field.cells[i];
  if (c.open || c.flag) return;
  c.open = true;
  if (c.mine) {
    field.over = "lost";
    field.ended = performance.now();
    blip(140, 0.3);
    return;
  }
  // an empty square opens everything around it, and so on outwards
  if (c.near === 0) around(i).forEach(open);
}
const mineParts = (b: Rect) => {
  const size = Math.floor(Math.min((b.w - 16) / N, (b.h - 62) / N));
  const grid: Rect = { x: b.x + (b.w - size * N) / 2, y: b.y + 52, w: size * N, h: size * N };
  const face: Rect = { x: b.x + b.w / 2 - 17, y: b.y + 9, w: 34, h: 34 };
  const flag: Rect = { x: b.x + b.w - 96, y: b.y + 11, w: 86, h: 30 };
  return { size, grid, face, flag };
};
const NEAR = ["", "#000a7b", "#2f8f4a", "#d8362a", "#4a2a8a", "#8a2a1a", "#0d8a8e", "#000", "#868a8e"];
const mines: Program = {
  size: [300, 372],
  draw(ctx, f, b, lang) {
    const { size, grid, face, flag } = mineParts(b);
    ctx.fillStyle = K.frame;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // mines left to mark, the face that starts a new field, and the switch between digging and flagging
    const left = MINES - field.cells.filter((c) => c.flag).length;
    const secs = field.started ? Math.min(999, Math.floor(((field.ended || performance.now()) - field.started) / 1000)) : 0;
    ctx.font = `700 22px ${f.body}`;
    ctx.textAlign = "left";
    ctx.fillStyle = "#a01818";
    ctx.fillText(String(Math.max(0, left)).padStart(2, "0"), b.x + 12, b.y + 34);
    ctx.fillStyle = K.ink;
    ctx.font = `700 15px ${f.body}`;
    ctx.fillText(`${secs}s`, b.x + 48, b.y + 33);
    button(ctx, face, (cx, cy) => {
      ctx.fillStyle = "#e3c558";
      ctx.beginPath();
      ctx.arc(cx, cy, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = K.dark;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = K.dark;
      ctx.fillRect(cx - 5, cy - 4, 3, 3);
      ctx.fillRect(cx + 2, cy - 4, 3, 3);
      ctx.beginPath();
      // it smiles, beams when the field is cleared, and is put out when a mine goes off
      if (field.over === "lost") ctx.arc(cx, cy + 8, 5, Math.PI * 1.15, Math.PI * 1.85);
      else ctx.arc(cx, cy + 1, field.over === "won" ? 7 : 5, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    });
    button(ctx, flag, label(ctx, f, lang === "id" ? "Bendera" : "Flag", 14, field.flagging ? "#a01818" : K.ink), field.flagging);
    field.cells.forEach((c, i) => {
      const r: Rect = { x: grid.x + (i % N) * size, y: grid.y + Math.floor(i / N) * size, w: size, h: size };
      const shown = c.open || (field.over === "lost" && c.mine && !c.flag);
      if (!shown) {
        ctx.fillStyle = K.frame;
        ctx.fillRect(r.x, r.y, r.w, r.h);
        bevel(ctx, r);
        if (c.flag) {
          ctx.fillStyle = K.dark;
          ctx.fillRect(r.x + r.w / 2, r.y + 6, 2, r.h - 12);
          ctx.fillStyle = "#d8362a";
          ctx.fillRect(r.x + r.w / 2 - 8, r.y + 6, 9, 7);
        }
        return;
      }
      ctx.fillStyle = c.mine && c.open ? "#d8362a" : "#b4b8bb";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = K.shade;
      ctx.fillRect(r.x, r.y, r.w, 1);
      ctx.fillRect(r.x, r.y, 1, r.h);
      if (c.mine) {
        ctx.fillStyle = K.dark;
        ctx.beginPath();
        ctx.arc(r.x + r.w / 2, r.y + r.h / 2, r.w * 0.26, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(r.x + r.w / 2 - 1, r.y + 4, 2, r.h - 8);
        ctx.fillRect(r.x + 4, r.y + r.h / 2 - 1, r.w - 8, 2);
      } else if (c.near) {
        ctx.font = `700 ${Math.round(size * 0.66)}px ${f.body}`;
        ctx.textAlign = "center";
        ctx.fillStyle = NEAR[c.near];
        ctx.fillText(String(c.near), r.x + r.w / 2, r.y + r.h * 0.76);
      }
    });
    ctx.fillStyle = K.dark;
    ctx.strokeStyle = K.dark;
    ctx.lineWidth = 1;
    ctx.strokeRect(grid.x - 0.5, grid.y - 0.5, grid.w + 1, grid.h + 1);
  },
  down(x, y, b) {
    const { size, grid, face, flag } = mineParts(b);
    if (inside(face, x, y)) {
      newField();
      return beep(620);
    }
    if (inside(flag, x, y)) {
      field.flagging = !field.flagging;
      return beep(520);
    }
    if (!inside(grid, x, y) || field.over) return;
    const i = Math.floor((y - grid.y) / size) * N + Math.floor((x - grid.x) / size);
    const c = field.cells[i];
    if (field.flagging) {
      if (!c.open) c.flag = !c.flag;
      return beep(420);
    }
    if (c.flag) return;
    if (!field.laid) lay(i);
    open(i);
    if (!field.over && field.cells.every((k) => k.open || k.mine)) {
      field.over = "won";
      field.ended = performance.now();
      blip(880, 0.2);
    } else if (!field.over) beep(700);
  },
  key(e) {
    if (e.key.toLowerCase() !== "f") return false;
    field.flagging = !field.flagging;
    return true;
  },
};

/* ---------- Snake ---------- */

const COLS = 22;
const ROWS = 15;
const run = { body: [] as [number, number][], dir: [1, 0] as [number, number], next: [1, 0] as [number, number], food: [0, 0] as [number, number], score: 0, best: 0, state: "ready" as "ready" | "on" | "over", at: 0 };
function feed() {
  do run.food = [Math.floor(Math.random() * COLS), Math.floor(Math.random() * ROWS)];
  while (run.body.some(([x, y]) => x === run.food[0] && y === run.food[1]));
}
function newRun() {
  run.body = [
    [6, 7],
    [5, 7],
    [4, 7],
  ];
  run.dir = run.next = [1, 0];
  run.score = 0;
  run.state = "on";
  run.at = performance.now();
  feed();
}
function step() {
  run.dir = run.next;
  const [hx, hy] = run.body[0];
  const head: [number, number] = [(hx + run.dir[0] + COLS) % COLS, (hy + run.dir[1] + ROWS) % ROWS];
  // only its own tail ends the run; borders wrap
  if (run.body.some(([x, y]) => x === head[0] && y === head[1])) {
    run.state = "over";
    run.best = Math.max(run.best, run.score);
    return blip(140, 0.25);
  }
  run.body.unshift(head);
  if (head[0] === run.food[0] && head[1] === run.food[1]) {
    run.score++;
    feed();
    beep(880);
  } else run.body.pop();
}
const snake: Program = {
  size: [420, 356],
  draw(ctx, f, b, lang, front) {
    ctx.fillStyle = K.frame;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    const cell = Math.floor(Math.min((b.w - 16) / COLS, (b.h - 44) / ROWS));
    const g: Rect = { x: b.x + (b.w - cell * COLS) / 2, y: b.y + 34, w: cell * COLS, h: cell * ROWS };
    // it only moves while its window is the front one: put the window behind another and it waits
    const pace = Math.max(70, 150 - run.score * 4);
    if (run.state === "on" && front) {
      const now = performance.now();
      if (now - run.at > 600) run.at = now - pace;
      while (run.state === "on" && now - run.at >= pace) {
        run.at += pace;
        step();
      }
    } else run.at = performance.now();
    ctx.font = `700 16px ${f.body}`;
    ctx.textAlign = "left";
    ctx.fillStyle = K.ink;
    ctx.fillText(`${lang === "id" ? "Skor" : "Score"} ${run.score}`, g.x, b.y + 23);
    ctx.textAlign = "right";
    ctx.fillText(`${lang === "id" ? "Terbaik" : "Best"} ${run.best}`, g.x + g.w, b.y + 23);
    ctx.fillStyle = "#16241a";
    ctx.fillRect(g.x, g.y, g.w, g.h);
    bevel(ctx, { x: g.x - 2, y: g.y - 2, w: g.w + 4, h: g.h + 4 }, false);
    ctx.fillStyle = "#d8362a";
    if (run.body.length) ctx.fillRect(g.x + run.food[0] * cell + 2, g.y + run.food[1] * cell + 2, cell - 4, cell - 4);
    run.body.forEach(([x, y], i) => {
      ctx.fillStyle = i === 0 ? "#b6f06a" : "#5fc24a";
      ctx.fillRect(g.x + x * cell + 1, g.y + y * cell + 1, cell - 2, cell - 2);
    });
    if (run.state !== "on") {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(g.x, g.y, g.w, g.h);
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.font = `700 22px ${f.body}`;
      ctx.fillText(run.state === "over" ? (lang === "id" ? "Selesai!" : "Game over!") : lang === "id" ? "Ular" : "Snake", g.x + g.w / 2, g.y + g.h / 2 - 8);
      ctx.font = `700 15px ${f.body}`;
      ctx.fillText(lang === "id" ? "Enter untuk mulai · panah untuk belok" : "Enter to start · arrows to steer", g.x + g.w / 2, g.y + g.h / 2 + 20);
    }
  },
  down() {
    if (run.state !== "on") newRun();
  },
  key(e) {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (run.state !== "on") {
      if (k !== "Enter" && k !== " ") return false;
      newRun();
      return true;
    }
    const turn: Record<string, [number, number]> = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };
    const d = turn[k];
    if (!d) return false;
    // it cannot double back on itself
    if (d[0] !== -run.dir[0] || d[1] !== -run.dir[1]) run.next = d;
    return true;
  },
};

/* ---------- Galaga ---------- */

type Alien = { x: number; y: number; alive: boolean; kind: number };
type Shot = { x: number; y: number; vy: number };
const G = { w: 320, h: 280, cols: 8, rows: 4 };
const ga = {
  state: "ready" as "ready" | "on" | "over" | "won",
  ship: G.w / 2,
  left: false,
  right: false,
  fire: false,
  shots: [] as Shot[],
  enemyShots: [] as Shot[],
  aliens: [] as Alien[],
  dir: 1,
  stepAt: 0,
  fireAt: 0,
  score: 0,
  best: 0,
  lives: 3,
};
function newGalaga() {
  ga.aliens = [];
  for (let r = 0; r < G.rows; r++) for (let c = 0; c < G.cols; c++) ga.aliens.push({ x: 34 + c * 32, y: 38 + r * 28, alive: true, kind: r < 1 ? 2 : r < 2 ? 1 : 0 });
  ga.ship = G.w / 2; ga.shots = []; ga.enemyShots = []; ga.dir = 1; ga.stepAt = performance.now(); ga.fireAt = 0; ga.score = 0; ga.lives = 3; ga.state = "on"; ga.left = ga.right = ga.fire = false;
}
function galagaStep() {
  const now = performance.now();
  const alive = ga.aliens.filter((a) => a.alive);
  if (!alive.length) { ga.state = "won"; ga.best = Math.max(ga.best, ga.score); return blip(880, 0.2); }
  const speed = 2.2 + (1 - alive.length / (G.cols * G.rows)) * 2.6;
  if (ga.left) ga.ship = clamp(ga.ship - speed * 2.2, 18, G.w - 18);
  if (ga.right) ga.ship = clamp(ga.ship + speed * 2.2, 18, G.w - 18);
  if (ga.fire && now - ga.fireAt > 260) { ga.shots.push({ x: ga.ship, y: G.h - 34, vy: -6.5 }); ga.fireAt = now; beep(900); }
  ga.shots.forEach((s) => (s.y += s.vy));
  ga.enemyShots.forEach((s) => (s.y += s.vy));
  ga.shots = ga.shots.filter((s) => s.y > -10);
  ga.enemyShots = ga.enemyShots.filter((s) => s.y < G.h + 10);
  if (now - ga.stepAt > Math.max(120, 520 - (G.cols * G.rows - alive.length) * 12)) {
    ga.stepAt = now;
    const edge = alive.some((a) => (ga.dir > 0 ? a.x > G.w - 24 : a.x < 24));
    if (edge) { ga.dir *= -1; ga.aliens.forEach((a) => { if (a.alive) a.y += 12; }); }
    else ga.aliens.forEach((a) => { if (a.alive) a.x += ga.dir * 10; });
    if (Math.random() < 0.45) {
      const shooter = alive[Math.floor(Math.random() * alive.length)];
      ga.enemyShots.push({ x: shooter.x, y: shooter.y + 10, vy: 3.2 + Math.random() * 1.5 });
    }
  }
  for (const s of ga.shots) for (const a of ga.aliens) {
    if (!a.alive || Math.abs(s.x - a.x) > 11 || Math.abs(s.y - a.y) > 9) continue;
    a.alive = false; s.y = -999; ga.score += a.kind === 2 ? 150 : a.kind === 1 ? 100 : 80; beep(520); break;
  }
  for (const s of ga.enemyShots) if (Math.abs(s.x - ga.ship) < 12 && Math.abs(s.y - (G.h - 20)) < 10) {
    s.y = 999; ga.lives--; blip(160, 0.18);
    if (ga.lives <= 0) { ga.state = "over"; ga.best = Math.max(ga.best, ga.score); }
  }
  if (alive.some((a) => a.y > G.h - 44)) { ga.state = "over"; ga.best = Math.max(ga.best, ga.score); blip(140, 0.25); }
}
const galaga: Program = {
  size: [420, 390],
  draw(ctx, f, b, lang, front) {
    ctx.fillStyle = K.frame; ctx.fillRect(b.x, b.y, b.w, b.h);
    const cellW = Math.floor((b.w - 20) / G.w * G.w);
    const scale = (b.w - 20) / G.w;
    const g: Rect = { x: b.x + 10, y: b.y + 34, w: G.w * scale, h: G.h * scale };
    ctx.font = `700 16px ${f.body}`; ctx.textAlign = "left"; ctx.fillStyle = K.ink;
    ctx.fillText(`${lang === "id" ? "Skor" : "Score"} ${ga.score}`, g.x, b.y + 23);
    ctx.textAlign = "right"; ctx.fillText(`${lang === "id" ? "Nyawa" : "Lives"} ${ga.lives}   Best ${ga.best}`, g.x + g.w, b.y + 23);
    if (ga.state === "on" && front) galagaStep(); else ga.stepAt = performance.now();
    ctx.fillStyle = "#050816"; ctx.fillRect(g.x, g.y, g.w, g.h);
    ctx.save(); ctx.translate(g.x, g.y); ctx.scale(scale, scale);
    ctx.fillStyle = "rgba(255,255,255,0.5)"; for (let i = 0; i < 40; i++) ctx.fillRect((i * 53) % G.w, (i * 97 + Math.floor(performance.now()/40)) % G.h, 2, 2);
    ga.aliens.forEach((a) => { if (!a.alive) return; ctx.fillStyle = a.kind === 2 ? "#8fe8f0" : a.kind === 1 ? "#f0b45c" : "#d8362a"; ctx.fillRect(a.x - 10, a.y - 7, 20, 14); ctx.fillStyle = "#fff"; ctx.fillRect(a.x - 4, a.y - 2, 2, 2); ctx.fillRect(a.x + 2, a.y - 2, 2, 2); });
    ctx.fillStyle = "#f7efe0"; ctx.fillRect(ga.ship - 12, G.h - 24, 24, 8); ctx.fillRect(ga.ship - 3, G.h - 32, 6, 8);
    ctx.fillStyle = "#8fe8f0"; ga.shots.forEach((s) => ctx.fillRect(s.x - 2, s.y - 8, 4, 10));
    ctx.fillStyle = "#ff8a7a"; ga.enemyShots.forEach((s) => ctx.fillRect(s.x - 2, s.y, 4, 10));
    ctx.restore();
    if (ga.state !== "on") {
      ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(g.x, g.y, g.w, g.h);
      ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.font = `700 22px ${f.body}`;
      const msg = ga.state === "won" ? (lang === "id" ? "Menang!" : "You win!") : ga.state === "over" ? (lang === "id" ? "Selesai!" : "Game over!") : "Galaga";
      ctx.fillText(msg, g.x + g.w / 2, g.y + g.h / 2 - 8);
      ctx.font = `700 15px ${f.body}`; ctx.fillText(lang === "id" ? "Enter mulai • panah gerak • Spasi tembak" : "Enter start • arrows move • Space fire", g.x + g.w / 2, g.y + g.h / 2 + 20);
    }
    void cellW;
  },
  down() { if (ga.state !== "on") newGalaga(); },
  key(e) {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (ga.state !== "on") { if (k === "Enter" || k === " ") { newGalaga(); return true; } return false; }
    if (k === "ArrowLeft" || k === "a") { ga.left = true; return true; }
    if (k === "ArrowRight" || k === "d") { ga.right = true; return true; }
    if (k === " " || k === "Spacebar") { ga.fire = true; return true; }
    return false;
  },
  up() { ga.left = ga.right = ga.fire = false; },
};
const galagaKeyUp = (e: KeyboardEvent) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k === "ArrowLeft" || k === "a") ga.left = false;
  if (k === "ArrowRight" || k === "d") ga.right = false;
  if (k === " " || k === "Spacebar") ga.fire = false;
};
if (typeof window !== "undefined") window.addEventListener("keyup", galagaKeyUp);

/* ---------- Noughts and crosses, against the machine ---------- */

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];
const board = { cells: Array<"" | "X" | "O">(9).fill(""), over: "" as "" | "X" | "O" | "draw", line: null as number[] | null, wins: 0, losses: 0 };
function judge() {
  for (const l of LINES) {
    const [a, b, c] = l;
    if (board.cells[a] && board.cells[a] === board.cells[b] && board.cells[a] === board.cells[c]) {
      board.over = board.cells[a] as "X" | "O";
      board.line = l;
      if (board.over === "X") board.wins++;
      else board.losses++;
      return;
    }
  }
  if (board.cells.every(Boolean)) board.over = "draw";
}
/** The machine's move: win if it can, block if it must, otherwise the middle, a corner, anything. */
function reply() {
  const free = board.cells.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0);
  const finishing = (who: "X" | "O") => {
    for (const l of LINES) {
      const mine = l.filter((i) => board.cells[i] === who).length;
      const gap = l.find((i) => !board.cells[i]);
      if (mine === 2 && gap !== undefined) return gap;
    }
    return -1;
  };
  let move = finishing("O");
  if (move < 0) move = finishing("X");
  // it is beatable: now and then it plays without thinking
  if (move < 0 && Math.random() < 0.25) move = free[Math.floor(Math.random() * free.length)];
  if (move < 0 && !board.cells[4]) move = 4;
  if (move < 0) {
    const corners = [0, 2, 6, 8].filter((i) => !board.cells[i]);
    move = corners.length ? corners[Math.floor(Math.random() * corners.length)] : free[Math.floor(Math.random() * free.length)];
  }
  board.cells[move] = "O";
  judge();
}
const tttParts = (b: Rect) => {
  const size = Math.floor(Math.min(b.w - 28, b.h - 86) / 3);
  const grid: Rect = { x: b.x + (b.w - size * 3) / 2, y: b.y + 38, w: size * 3, h: size * 3 };
  const again: Rect = { x: b.x + b.w / 2 - 62, y: b.y + b.h - 38, w: 124, h: 28 };
  return { size, grid, again };
};
const ttt: Program = {
  size: [290, 364],
  draw(ctx, f, b, lang) {
    const { size, grid, again } = tttParts(b);
    ctx.fillStyle = K.frame;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.font = `700 15px ${f.body}`;
    ctx.textAlign = "center";
    ctx.fillStyle = K.ink;
    const id = lang === "id";
    const status =
      board.over === "X" ? (id ? "Kamu menang!" : "You win!") : board.over === "O" ? (id ? "Komputer menang." : "The machine wins.") : board.over === "draw" ? (id ? "Seri." : "A draw.") : id ? "Giliranmu: X" : "Your move: X";
    ctx.fillText(`${status}   ${board.wins} : ${board.losses}`, b.x + b.w / 2, b.y + 24);
    ctx.fillStyle = K.page;
    ctx.fillRect(grid.x, grid.y, grid.w, grid.h);
    bevel(ctx, { x: grid.x - 2, y: grid.y - 2, w: grid.w + 4, h: grid.h + 4 }, false);
    ctx.fillStyle = K.dark;
    for (let i = 1; i < 3; i++) {
      ctx.fillRect(grid.x + i * size - 1, grid.y + 6, 3, grid.h - 12);
      ctx.fillRect(grid.x + 6, grid.y + i * size - 1, grid.w - 12, 3);
    }
    board.cells.forEach((c, i) => {
      if (!c) return;
      const cx = grid.x + (i % 3) * size + size / 2;
      const cy = grid.y + Math.floor(i / 3) * size + size / 2;
      const r = size * 0.28;
      const won = board.line?.includes(i);
      ctx.lineWidth = won ? 8 : 6;
      ctx.lineCap = "round";
      ctx.strokeStyle = c === "X" ? "#d8362a" : K.title;
      ctx.beginPath();
      if (c === "X") {
        ctx.moveTo(cx - r, cy - r);
        ctx.lineTo(cx + r, cy + r);
        ctx.moveTo(cx + r, cy - r);
        ctx.lineTo(cx - r, cy + r);
      } else ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    });
    button(ctx, again, label(ctx, f, id ? "Main lagi" : "New game", 15));
  },
  down(x, y, b) {
    const { size, grid, again } = tttParts(b);
    if (inside(again, x, y)) {
      board.cells.fill("");
      board.over = "";
      board.line = null;
      return beep(620);
    }
    if (board.over || !inside(grid, x, y)) return;
    const i = clamp(Math.floor((y - grid.y) / size), 0, 2) * 3 + clamp(Math.floor((x - grid.x) / size), 0, 2);
    if (board.cells[i]) return;
    board.cells[i] = "X";
    beep(700);
    judge();
    if (!board.over) reply();
    if (board.over) blip(board.over === "X" ? 880 : 200, 0.2);
  },
};

/* ---------- Command Prompt ---------- */

/** What the prompt can ask of the system around it. The window manager fills these in. */
export const host = {
  /** program names that `start` accepts, and how to start one */
  programs: [] as string[],
  launch: (name: string) => {
    void name;
  },
  leave: () => {},
};

const PROMPT = "C:\\KAMAR>";
const shell = { lines: [] as { text: string; colour?: string }[], input: "", history: [] as string[], at: -1, ink: "#c8f0c8", rain: false, booted: false };
const say = (text = "", colour?: string) => text.split("\n").forEach((line) => shell.lines.push({ text: line, colour }));

const FILES: Record<string, (lang: Lang) => string> = {
  "ABOUT.TXT": (lang) => [profile.hello[lang], "", ...profile.about[lang], "", profile.likes[lang]].join("\n"),
  "WORK.DOC": (lang) => jobs.map((j) => `${jobYears(j, lang)}  ${j.company}\n  ${j.title}, ${j.place[lang]}\n  ${j.body[lang]}`).join("\n\n"),
  "SKILLS.TXT": () => skills.join(", "),
  "CONTACT.TXT": () => `email     ${links.email}\ngithub    ${links.github.url}\nlinkedin  ${links.linkedin.url}`,
  "PROJECTS.LST": (lang) => projects.map((p, i) => `CD ${String(i + 1).padStart(2, "0")}  ${p.name ?? (lang === "id" ? "(slot kosong)" : "(empty slot)")}`).join("\n"),
};

const FORTUNES: Record<Lang, string[]> = {
  id: ["Kode yang jalan hari ini adalah bug yang belum ketemu.", "Simpan dulu. Lalu simpan lagi.", "Kaset yang kusut masih bisa diputar pakai pensil.", "Kopi dingin tetap kopi.", "Senar baru selalu fals di hari pertama."],
  en: ["Code that works today is a bug you have not met yet.", "Save. Then save again.", "A chewed tape can still be wound back with a pencil.", "Cold coffee is still coffee.", "New strings never hold their tuning on the first day."],
};

function runCommand(raw: string, lang: Lang) {
  const id = lang === "id";
  const [name = "", ...rest] = raw.trim().split(/\s+/);
  const arg = rest.join(" ");
  const cmd = name.toLowerCase();
  if (!cmd) return;
  if (cmd === "help" || cmd === "?") {
    say(
      id
        ? "DIR             daftar berkas\nTYPE <berkas>   tampilkan isi berkas\nWHOAMI          siapa pemilik kamar ini\nSKILLS          keahlian\nCONTACT         cara menghubungi\nSTART <program> buka program (START saja untuk daftarnya)\nMUSIC <aksi>    Discman: play, pause, stop, next, prev\nLANG <id|en>    ganti bahasa situs\nCOLOR <warna>   warna teks: green, amber, white, cyan\nMATRIX          hujan huruf (tekan tombol apa saja untuk berhenti)\nFORTUNE         petuah acak\nDATE, TIME, VER, ECHO, CLS, EXIT"
        : "DIR             list the files\nTYPE <file>     show what is in a file\nWHOAMI          whose room this is\nSKILLS          what I work with\nCONTACT         how to reach me\nSTART <program> open a program (START alone lists them)\nMUSIC <action>  the Discman: play, pause, stop, next, prev\nLANG <id|en>    switch the site's language\nCOLOR <colour>  text colour: green, amber, white, cyan\nMATRIX          falling letters (any key stops it)\nFORTUNE         a line of advice\nDATE, TIME, VER, ECHO, CLS, EXIT",
    );
  } else if (cmd === "dir" || cmd === "ls") {
    say(id ? " Isi C:\\KAMAR" : " Directory of C:\\KAMAR");
    say();
    for (const [file, read] of Object.entries(FILES)) say(`${file.padEnd(14)}${String(read(lang).length).padStart(7)}`);
    say(`${"PHOTOS".padEnd(14)}  <DIR>  ${photos.length} ${id ? "foto" : "photos"}`);
    say(`${"MUSIC".padEnd(14)}  <DIR>  ${tracks.length} ${id ? "lagu" : "tracks"}`);
    say(`     ${Object.keys(FILES).length} ${id ? "berkas" : "file(s)"}`);
  } else if (cmd === "type" || cmd === "cat") {
    const file = Object.keys(FILES).find((f) => f === arg.toUpperCase() || f.split(".")[0] === arg.toUpperCase());
    if (file) say(FILES[file](lang));
    else say(id ? `Berkas tidak ditemukan - ${arg || "?"}` : `File not found - ${arg || "?"}`, "#ff8a7a");
  } else if (cmd === "whoami") {
    say(`${profile.name}\n${profile.role}, Surabaya\n${profile.intro[lang]}`);
  } else if (cmd === "skills") say(FILES["SKILLS.TXT"](lang));
  else if (cmd === "contact") say(FILES["CONTACT.TXT"](lang));
  else if (cmd === "start" || cmd === "open" || cmd === "run") {
    const want = arg.toLowerCase();
    if (!want) say(host.programs.join("  "));
    else if (host.programs.includes(want)) {
      say(id ? `Membuka ${want}...` : `Starting ${want}...`);
      host.launch(want);
    } else say(id ? `Program tidak dikenal - ${arg}` : `No such program - ${arg}`, "#ff8a7a");
  } else if (cmd === "music" || cmd === "cd") {
    if (!hasDisc()) return say(id ? "Tidak ada cakram di Discman." : "There is no disc in the Discman.", "#ff8a7a");
    const act = arg.toLowerCase();
    if (act === "play") play();
    else if (act === "pause") pause();
    else if (act === "stop") stop();
    else if (act === "next") nextTrack();
    else if (act === "prev") prevTrack();
    else if (act) return say("MUSIC play | pause | stop | next | prev", "#ff8a7a");
    const now = usePlayer.getState();
    say(`${id ? "Lagu" : "Track"} ${now.index + 1}/${tracks.length}  ${tracks[now.index]?.title ?? ""}  [${now.state}]`);
  } else if (cmd === "lang") {
    const to = arg.toLowerCase();
    if (to !== "id" && to !== "en") return say("LANG id | en", "#ff8a7a");
    useLangStore.getState().setLang(to);
    say(to === "id" ? "Bahasa: Indonesia." : "Language: English.");
  } else if (cmd === "color" || cmd === "colour") {
    const inks: Record<string, string> = { green: "#c8f0c8", amber: "#ffc66a", white: "#e8e8e8", cyan: "#8fe8f0" };
    if (inks[arg.toLowerCase()]) shell.ink = inks[arg.toLowerCase()];
    else say(`COLOR ${Object.keys(inks).join(" | ")}`, "#ff8a7a");
  } else if (cmd === "matrix") shell.rain = true;
  else if (cmd === "fortune") say(FORTUNES[lang][Math.floor(Math.random() * FORTUNES[lang].length)]);
  else if (cmd === "date") say(new Date().toLocaleDateString(id ? "id-ID" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
  else if (cmd === "time") say(new Date().toLocaleTimeString(id ? "id-ID" : "en-GB"));
  else if (cmd === "ver") say("KAMAR 3.1  (c) Fajar Magsyar\n640K OK");
  else if (cmd === "echo") say(arg);
  else if (cmd === "cls" || cmd === "clear") shell.lines = [];
  else if (cmd === "exit" || cmd === "quit") host.leave();
  else say(id ? `Perintah atau nama berkas salah - ${name}. Ketik HELP.` : `Bad command or file name - ${name}. Type HELP.`, "#ff8a7a");
}

const term: Program = {
  size: [560, 400],
  draw(ctx, f, b, lang, front) {
    if (!shell.booted) {
      shell.booted = true;
      say("KAMAR 3.1");
      say(lang === "id" ? "Ketik HELP untuk daftar perintah." : "Type HELP for a list of commands.");
      say();
    }
    ctx.fillStyle = "#06090a";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    const size = 17;
    const lh = 21;
    ctx.font = `${size}px ${f.screen}`;
    ctx.textAlign = "left";
    const cw = ctx.measureText("M").width;
    if (shell.rain) {
      // columns of letters falling at their own speeds, the head of each one bright
      const cols = Math.floor(b.w / cw);
      const rows = Math.ceil(b.h / lh) + 1;
      const t = performance.now() / 1000;
      for (let c = 0; c < cols; c++) {
        const speed = 5 + ((c * 7919) % 11);
        const head = Math.floor(t * speed + ((c * 104729) % 37)) % (rows + 12);
        for (let r = 0; r < rows; r++) {
          const d = head - r;
          if (d < 0 || d > 11) continue;
          ctx.fillStyle = d === 0 ? "#e8ffe8" : `rgba(90,230,120,${1 - d / 12})`;
          ctx.fillText(String.fromCharCode(0x30a0 + ((c * 31 + r * 17 + Math.floor(t * 6)) % 90)), b.x + c * cw, b.y + (r + 1) * lh - 4);
        }
      }
      return;
    }
    // long lines are wrapped to the window; the newest lines are the ones in view
    const width = b.w - 20;
    const rows = Math.floor((b.h - 12) / lh);
    const out: { text: string; colour?: string }[] = [];
    const push = (text: string, colour?: string) => (text ? wrap(ctx, text, width) : [""]).forEach((part) => out.push({ text: part, colour }));
    shell.lines.slice(-120).forEach((l) => push(l.text, l.colour));
    push(`${PROMPT}${shell.input}`);
    const shown = out.slice(-rows);
    shown.forEach((l, i) => {
      ctx.fillStyle = l.colour ?? shell.ink;
      ctx.fillText(l.text, b.x + 10, b.y + 24 + i * lh);
    });
    if (front && Math.floor(performance.now() / 450) % 2 === 0) {
      const last = shown[shown.length - 1];
      ctx.fillStyle = shell.ink;
      ctx.fillRect(b.x + 10 + ctx.measureText(last.text).width + 2, b.y + 24 + (shown.length - 1) * lh + 2, cw, 3);
    }
  },
  key(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if (shell.rain) {
      shell.rain = false;
      return true;
    }
    if (e.key === "Enter") {
      const line = shell.input;
      say(`${PROMPT}${line}`);
      shell.input = "";
      shell.at = -1;
      if (line.trim()) shell.history.unshift(line);
      runCommand(line, useLangStore.getState().lang);
      if (shell.lines.length > 400) shell.lines.splice(0, shell.lines.length - 400);
    } else if (e.key === "Backspace") shell.input = shell.input.slice(0, -1);
    else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      // earlier commands come back with the up arrow
      shell.at = clamp(shell.at + (e.key === "ArrowUp" ? 1 : -1), -1, shell.history.length - 1);
      shell.input = shell.at < 0 ? "" : shell.history[shell.at];
    } else if (e.key.length === 1 && shell.input.length < 120) shell.input += e.key;
    else return false;
    return true;
  },
};

/* ---------- Typing speed: a small cousin of Monkeytype ---------- */

const WORDS: Record<Lang, string[]> = {
  en: "the be of and a to in he have it that for they with as not on she at by this we you do but from or which one would all will there say who make when can more if no man out other so what time up go about than into could state only new year some take come these know see use get like then first any work now may such give over think most even find day also after way many must look before great back through long where much should well people down own just because good each those feel seem how high too place little world very still nation hand old life tell write become here show house both between need mean call develop under last right move thing general school never same another begin while number part turn real leave might want point form off child few small since against ask late home interest large person end open public follow during present without again hold govern around possible head consider word program problem however lead system set order eye plan run keep face fact group play stand increase early course change help line".split(" "),
  id: "yang dan di ini itu dengan untuk tidak dari dalam akan pada juga saya ke karena ada mereka lebih bisa sudah atau oleh kita itu seperti sebagai kami dia hanya satu saat banyak waktu orang hari tahun baru kerja rumah buat kata lagi bukan masih antara belum hidup kamar gitar kaset musik malam pagi kopi mulai besar kecil sangat semua tetap dunia tangan mata jalan cerita bawah atas depan belakang pergi datang pulang main belajar tulis baca dengar lihat ingin harus boleh mungkin sekarang nanti kemarin selalu jarang kadang sendiri bersama bagus indah lama cepat pelan terang gelap dingin panas".split(" "),
};

const TYPE = {
  limit: 30,
  state: "idle" as "idle" | "run" | "done",
  words: [] as string[],
  typed: [] as string[],
  input: "",
  startAt: 0,
  hits: 0,
  misses: 0,
  /** characters of correct words (and the spaces after them), plus the right letters of the word in progress */
  good: 0,
  result: { wpm: 0, acc: 100, hits: 0, misses: 0 },
  best: 0,
  lang: "" as Lang | "",
};
const TYPE_LIMITS = [15, 30, 60];

function typeReset(lang: Lang) {
  const pool = WORDS[lang];
  TYPE.words = Array.from({ length: 120 }, () => pool[Math.floor(Math.random() * pool.length)]);
  TYPE.typed = [];
  TYPE.input = "";
  TYPE.state = "idle";
  TYPE.hits = 0;
  TYPE.misses = 0;
  TYPE.good = 0;
  TYPE.lang = lang;
}
function typeWpm(secs: number) {
  const cur = TYPE.words[TYPE.typed.length] ?? "";
  let live = TYPE.good;
  for (let i = 0; i < TYPE.input.length && i < cur.length && TYPE.input[i] === cur[i]; i++) live++;
  return secs > 0 ? Math.round(live / 5 / (secs / 60)) : 0;
}
function typeFinish() {
  const secs = TYPE.limit;
  const total = TYPE.hits + TYPE.misses;
  TYPE.result = { wpm: typeWpm(secs), acc: total ? Math.round((TYPE.hits / total) * 100) : 100, hits: TYPE.hits, misses: TYPE.misses };
  TYPE.best = Math.max(TYPE.best, TYPE.result.wpm);
  TYPE.state = "done";
  blip(880, 0.12);
}
const typeLimitRects = (b: Rect) => TYPE_LIMITS.map((_, i): Rect => ({ x: b.x + b.w - 20 - (TYPE_LIMITS.length - i) * 52, y: b.y + 14, w: 46, h: 26 }));

const T = { bg: "#2c2e31", dim: "#646669", ink: "#d1d0c5", accent: "#e2b714", bad: "#ca4754" };

const typing: Program = {
  size: [640, 340],
  draw(ctx, f, b, lang, front) {
    if (TYPE.lang !== lang) typeReset(lang);
    ctx.fillStyle = T.bg;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.textAlign = "left";
    const id = lang === "id";
    if (TYPE.state === "run") {
      const secs = (performance.now() - TYPE.startAt) / 1000;
      if (secs >= TYPE.limit) typeFinish();
    }
    // the time to run for, and the clock
    ctx.font = `18px ${f.screen}`;
    typeLimitRects(b).forEach((r, i) => {
      const on = TYPE_LIMITS[i] === TYPE.limit;
      ctx.fillStyle = on ? T.accent : T.dim;
      ctx.textAlign = "center";
      ctx.fillText(String(TYPE_LIMITS[i]), r.x + r.w / 2, r.y + 19);
      if (on) ctx.fillRect(r.x + 10, r.y + r.h - 1, r.w - 20, 2);
    });
    ctx.textAlign = "left";
    ctx.fillStyle = T.dim;
    ctx.fillText(id ? "detik" : "seconds", b.x + 24, b.y + 33);

    if (TYPE.state === "done") {
      const r = TYPE.result;
      ctx.fillStyle = T.dim;
      ctx.font = `20px ${f.screen}`;
      ctx.fillText("wpm", b.x + 40, b.y + 100);
      ctx.fillText(id ? "akurasi" : "acc", b.x + 40, b.y + 200);
      ctx.fillStyle = T.accent;
      ctx.font = `700 72px ${f.screen}`;
      ctx.fillText(String(r.wpm), b.x + 40, b.y + 168);
      ctx.font = `700 48px ${f.screen}`;
      ctx.fillText(`${r.acc}%`, b.x + 40, b.y + 246);
      ctx.font = `20px ${f.screen}`;
      ctx.fillStyle = T.dim;
      ctx.fillText(id ? "huruf benar / salah" : "characters right / wrong", b.x + 280, b.y + 100);
      ctx.fillStyle = T.ink;
      ctx.fillText(`${r.hits} / ${r.misses}`, b.x + 280, b.y + 130);
      ctx.fillStyle = T.dim;
      ctx.fillText(id ? "terbaik sesi ini" : "best this session", b.x + 280, b.y + 180);
      ctx.fillStyle = T.ink;
      ctx.fillText(`${TYPE.best} wpm`, b.x + 280, b.y + 210);
      ctx.fillStyle = T.dim;
      ctx.fillText(id ? "Tab atau Enter: ulangi" : "Tab or Enter: again", b.x + 24, b.y + b.h - 20);
      return;
    }

    // the clock, or the speed so far
    const secs = TYPE.state === "run" ? (performance.now() - TYPE.startAt) / 1000 : 0;
    ctx.fillStyle = T.accent;
    ctx.font = `700 34px ${f.screen}`;
    ctx.fillText(TYPE.state === "run" ? String(Math.max(0, Math.ceil(TYPE.limit - secs))) : String(TYPE.limit), b.x + 24, b.y + 88);
    if (TYPE.state === "run" && secs > 3) {
      ctx.font = `20px ${f.screen}`;
      ctx.fillStyle = T.dim;
      ctx.fillText(`${typeWpm(secs)} wpm`, b.x + 110, b.y + 86);
    }

    // the words, set in lines as wide as the window
    const fs = 26;
    const lh = 44;
    ctx.font = `${fs}px ${f.screen}`;
    const width = b.w - 56;
    const at = TYPE.typed.length;
    const shown = (i: number) => (i < at ? TYPE.typed[i] : i === at ? TYPE.input : "");
    const lines: { i: number; x: number }[][] = [[]];
    let x = 0;
    TYPE.words.forEach((w, i) => {
      const len = Math.max(w.length, shown(i).length);
      const adv = ctx.measureText(w.padEnd(len, "m") + " ").width;
      if (x + adv > width && lines[lines.length - 1].length) {
        lines.push([]);
        x = 0;
      }
      lines[lines.length - 1].push({ i, x });
      x += adv;
    });
    const row = lines.findIndex((l) => l.some((p) => p.i === at));
    const first = Math.max(0, row - 1);
    for (let r = 0; r < 3; r++) {
      const line = lines[first + r];
      if (!line) break;
      const y = b.y + 150 + r * lh;
      for (const { i, x: wx } of line) {
        const w = TYPE.words[i];
        const t = shown(i);
        let cx = b.x + 28 + wx;
        const text = t.length > w.length ? w + t.slice(w.length) : w;
        for (let c = 0; c < text.length; c++) {
          const ch = text[c];
          const typed = t[c];
          if (i === at && c === t.length) {
            ctx.fillStyle = T.accent;
            ctx.fillRect(cx - 1, y - fs + 2, 2, fs + 4);
          }
          ctx.fillStyle = typed === undefined ? T.dim : typed === ch && c < w.length ? T.ink : T.bad;
          ctx.fillText(ch, cx, y);
          cx += ctx.measureText(ch).width;
        }
        if (i === at && t.length >= text.length) {
          ctx.fillStyle = T.accent;
          ctx.fillRect(cx - 1, y - fs + 2, 2, fs + 4);
        }
        // a word that was left wrong is underlined
        if (i < at && t !== w) {
          ctx.fillStyle = T.bad;
          ctx.fillRect(b.x + 28 + wx, y + 5, cx - (b.x + 28 + wx), 2);
        }
      }
    }
    if (TYPE.state === "idle" && front) {
      ctx.font = `18px ${f.screen}`;
      ctx.fillStyle = T.dim;
      ctx.textAlign = "center";
      ctx.fillText(id ? "mulai mengetik untuk memulai" : "start typing to begin", b.x + b.w / 2, b.y + b.h - 22);
    }
  },
  down(x, y, b) {
    typeLimitRects(b).forEach((r, i) => {
      if (!inside(r, x, y)) return;
      TYPE.limit = TYPE_LIMITS[i];
      typeReset(useLangStore.getState().lang);
      blip(660, 0.04);
    });
  },
  key(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    const lang = useLangStore.getState().lang;
    if (e.key === "Tab" || (e.key === "Enter" && TYPE.state === "done")) {
      typeReset(lang);
      return true;
    }
    if (TYPE.state === "done") return false;
    if (e.key === "Backspace") {
      TYPE.input = TYPE.input.slice(0, -1);
      return true;
    }
    if (e.key === " ") {
      if (!TYPE.input) return true;
      const w = TYPE.words[TYPE.typed.length];
      if (TYPE.input === w) TYPE.good += w.length + 1;
      TYPE.typed.push(TYPE.input);
      TYPE.input = "";
      if (TYPE.typed.length > TYPE.words.length - 30) TYPE.words.push(...Array.from({ length: 60 }, () => WORDS[lang][Math.floor(Math.random() * WORDS[lang].length)]));
      return true;
    }
    if (e.key.length !== 1) return false;
    const w = TYPE.words[TYPE.typed.length];
    if (TYPE.input.length >= w.length + 4) return true;
    if (TYPE.state === "idle") {
      TYPE.state = "run";
      TYPE.startAt = performance.now();
    }
    if (e.key === w[TYPE.input.length]) TYPE.hits++;
    else TYPE.misses++;
    TYPE.input += e.key;
    return true;
  },
};

export const EXTRA: Record<ExtraId, Program> = { term, notes, paint, clock, mines, snake, galaga, ttt, typing };
