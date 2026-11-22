import { asset } from "@/asset";
import { blip } from "@/audio/sfx";
import { jobs, jobYears, profile, type Lang } from "@/content/data";
import { useRoom } from "../store";
import { wrap, type Fonts } from "../textures";
import { EXTRA, EXTRA_ICONS, EXTRA_NAMES, host, type ExtraId } from "./os-apps";
import { arrow, bevel, button, clamp, drawMark, inside, K, TV_H, TV_W, type Rect } from "./os-kit";

export { TV_H, TV_W };

// ---------------------------------------------------------------------------------------
// DawnOS 3.1: the TV's own little operating system, in the manner of the 16-bit desktops of
// the early nineties, with the Start button and taskbar that came a few years after.
//
// It is a real, if small, window manager: programs open in windows that can be dragged by
// their title bars, brought to the front, minimised to the taskbar, maximised and closed;
// the icons on the desktop can be picked up and put down anywhere; the Start menu lists
// the programs. All of it is painted onto one canvas (there is no DOM on the glass) from
// the state kept in this file, and worked by the pointer on the glass and the keyboard.
// ---------------------------------------------------------------------------------------

/* ---------- the programs ---------- */

type Built = "about" | "work" | "calc" | "recycle";
export type App = Built | ExtraId;
// the order they stand in on the desktop (down the columns) and in the Start menu
const APPS: App[] = ["term", "notes", "paint", "calc", "clock", "mines", "snake", "galaga", "ttt", "typing", "about", "work"];
/** where the Start menu draws a line: after apps and after games */
const GROUP_ENDS: App[] = ["clock", "typing"];

const NAMES: Record<App, { icon: Record<Lang, string>; title: Record<Lang, string>; menus: Record<Lang, string[]> }> = {
  ...EXTRA_NAMES,
  about: {
    icon: { id: "TENTANG.TXT", en: "ABOUT.TXT" },
    title: { id: "Notepad - TENTANG.TXT", en: "Notepad - ABOUT.TXT" },
    menus: { id: ["Berkas", "Sunting", "Cari", "Bantuan"], en: ["File", "Edit", "Search", "Help"] },
  },
  work: {
    icon: { id: "KERJA.DOC", en: "WORK.DOC" },
    title: { id: "Write - KERJA.DOC", en: "Write - WORK.DOC" },
    menus: { id: ["Berkas", "Sunting", "Huruf", "Paragraf", "Bantuan"], en: ["File", "Edit", "Character", "Paragraph", "Help"] },
  },
  calc: {
    icon: { id: "Calculator", en: "Calculator" },
    title: { id: "Calculator", en: "Calculator" },
    menus: { id: ["Sunting", "Lihat", "Bantuan"], en: ["Edit", "View", "Help"] },
  },
  recycle: {
    icon: { id: "Recycle Bin", en: "Recycle Bin" },
    title: { id: "Recycle Bin", en: "Recycle Bin" },
    menus: { id: ["File"], en: ["File"] },
  },
};

/* ---------- state ---------- */

type Win = { app: Exclude<App, "game">; x: number; y: number; w: number; h: number; min: boolean; max: boolean; scroll: number; maxScroll: number };

const BAR = 38; // the taskbar
const WORK: Rect = { x: 0, y: 0, w: TV_W, h: TV_H - BAR };
const START: Rect = { x: 3, y: TV_H - BAR + 4, w: 98, h: BAR - 7 };
const TITLE = 28;
const EDGE = 5;

const HOME: Record<Built, Rect> = {
  about: { x: 150, y: 46, w: 540, h: 400 },
  work: { x: 96, y: 18, w: 640, h: 500 },
  calc: { x: 470, y: 120, w: 268, h: 356 },
  recycle: { x: 180, y: 70, w: 520, h: 420 },
};
const isExtra = (app: App): app is ExtraId => app in EXTRA;
/** Where a program's window first opens: the built-in ones have their places, the rest open about the middle. */
function home(app: Win["app"]): Rect {
  if (!isExtra(app)) return HOME[app];
  const [w, h] = EXTRA[app].size;
  return { x: Math.round((TV_W - w) / 2 + 70), y: Math.round((TV_H - BAR - h) / 2), w, h };
}

const DESKTOP_ICONS: { app: App; x: number; y: number }[] = [
  { app: "term", x: 28, y: 18 },
  { app: "notes", x: 28, y: 128 },
  { app: "paint", x: 28, y: 238 },
  { app: "calc", x: 28, y: 348 },
  { app: "clock", x: 28, y: 458 },
  { app: "mines", x: 148, y: 18 },
  { app: "snake", x: 148, y: 128 },
  { app: "galaga", x: 148, y: 238 },
  { app: "ttt", x: 148, y: 348 },
  { app: "typing", x: 148, y: 458 },
  { app: "about", x: 682, y: 56 },
  { app: "work", x: 596, y: 196 },
  { app: "recycle", x: 704, y: 430 },
];

type TrashItem = { id: number; app: App; label: Record<Lang, string>; x: number; y: number };

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
function makeEquation() {
  const pick = rand(0, 3);
  if (pick === 0) {
    const sq = rand(13, 47) ** 2, cb = rand(4, 18) ** 3, p10 = 10 ** rand(3, 6);
    const a = rand(7, 29), b = rand(11, 39), c = rand(13, 57);
    const ans = Math.round(Math.sqrt(sq)) * a + Math.round(Math.log10(p10)) * b + Math.round(Math.cbrt(cb)) - c;
    return { q: `√(${sq})×${a} + log₁₀(${p10})×${b} + ∛(${cb}) - ${c} = ?`, a: ans };
  }
  if (pick === 1) {
    const sq = rand(11, 39) ** 2, cb = rand(5, 16) ** 3, p2 = 2 ** rand(5, 11);
    const a = rand(3, 13), b = rand(5, 23);
    const ans = Math.round(Math.log2(p2)) * Math.round(Math.sqrt(sq)) + a * Math.round(Math.cbrt(cb)) - b * b;
    return { q: `log₂(${p2})×√(${sq}) + ${a}×∛(${cb}) - ${b}² = ?`, a: ans };
  }
  if (pick === 2) {
    const sq = rand(12, 35) ** 2, cb = rand(4, 15) ** 3, p10 = 10 ** rand(2, 5);
    const a = rand(6, 19), b = rand(7, 23), c = rand(11, 44);
    const ans = (Math.round(Math.sqrt(sq)) + Math.round(Math.cbrt(cb))) * Math.round(Math.log10(p10)) - a * b + c;
    return { q: `(√(${sq})+∛(${cb}))×log₁₀(${p10}) - ${a}×${b} + ${c} = ?`, a: ans };
  }
  const sq = rand(14, 41) ** 2, p2 = 2 ** rand(6, 12), p10 = 10 ** rand(3, 5);
  const a = rand(5, 17), b = rand(3, 11), c = rand(17, 53);
  const ans = Math.round(Math.sqrt(sq)) * Math.round(Math.log2(p2)) - Math.round(Math.log10(p10)) * a + b * b * b - c;
  return { q: `√(${sq})×log₂(${p2}) - log₁₀(${p10})×${a} + ${b}³ - ${c} = ?`, a: ans };
}

const os = {
  /** open windows, back to front */
  wins: [] as Win[],
  icons: DESKTOP_ICONS.map((it) => ({ ...it })),
  picked: new Set<number>(),
  marquee: null as null | { x: number; y: number },
  trash: [] as TrashItem[],
  trashSel: -1,
  trashPrompt: null as null | { q: string; a: number; input: string; err: boolean },
  deleting: null as null | { start: number; until: number },
  crash: null as null | { until: number },
  nextTrash: 1,
  menu: false,
  menuAt: -1,
  mx: -1,
  my: -1,
  drag: null as null | { kind: "win"; win: Win; dx: number; dy: number } | { kind: "app"; win: Win } | { kind: "icon"; i: number; dx: number; dy: number; moved: boolean; fromX: number; fromY: number } | { kind: "marquee"; fromX: number; fromY: number; base: Set<number> },
  lastDown: { i: -1, at: 0 },
  calc: { shown: "0", acc: null as number | null, op: null as string | null, fresh: true },
};

const top = () => {
  for (let i = os.wins.length - 1; i >= 0; i--) if (!os.wins[i].min) return os.wins[i];
  return null;
};
const rectOf = (w: Win): Rect => (w.max ? WORK : w);

function focus(w: Win) {
  os.wins = [...os.wins.filter((x) => x !== w), w];
  w.min = false;
}

/** Starts a program, or brings it forward if it is already running. */
export function launch(app: App) {
  os.menu = false;
  blip(880, 0.08);
  const running = os.wins.find((w) => w.app === app);
  if (running) return focus(running);
  // each new window opens a little down and across from the last, as they used to
  const n = os.wins.length % 5;
  const at = home(app);
  os.wins.push({ app, ...at, x: at.x - n * 16, y: Math.max(0, at.y + n * 14 - 20), min: false, max: false, scroll: 0, maxScroll: 0 });
}

function close(w: Win) {
  os.wins = os.wins.filter((x) => x !== w);
  blip(330, 0.07);
}

// the command prompt can start programs by name and shut itself
host.programs = APPS.map((a) => a as string);
host.launch = (name) => launch(name as App);
host.leave = () => {
  const w = os.wins.find((x) => x.app === "term");
  if (w) close(w);
};

/** Closes the front window; with none open, leaves the TV for the room. */
export function osBack() {
  if (os.menu) {
    os.menu = false;
    return;
  }
  const w = top();
  if (w) return close(w);
  blip(330, 0.08);
  useRoom.getState().setFocus(null);
}

/* ---------- painting: the parts every window shares ---------- */

// the parts of a window's frame, for painting and for the pointer alike
const barOf = (r: Rect): Rect => ({ x: r.x + EDGE, y: r.y + EDGE, w: r.w - EDGE * 2, h: TITLE });
const closeOf = (r: Rect): Rect => ({ x: r.x + EDGE, y: r.y + EDGE, w: TITLE, h: TITLE });
const minOf = (r: Rect): Rect => ({ x: r.x + r.w - EDGE - TITLE * 2, y: r.y + EDGE, w: TITLE, h: TITLE });
const maxOf = (r: Rect): Rect => ({ x: r.x + r.w - EDGE - TITLE, y: r.y + EDGE, w: TITLE, h: TITLE });
const bodyOf = (r: Rect, menus: boolean): Rect => {
  const y = r.y + EDGE + TITLE + 1 + (menus ? 27 : 0);
  return { x: r.x + EDGE, y, w: r.w - EDGE * 2, h: r.y + r.h - EDGE - y };
};

/** A window's frame: sizing border, title bar with its control box and arrows, and a menu bar. */
function frame(ctx: CanvasRenderingContext2D, f: Fonts, r: Rect, title: string, menus: string[], active: boolean, maxed: boolean) {
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  if (!maxed) ctx.fillRect(r.x + 6, r.y + 6, r.w, r.h);
  ctx.fillStyle = K.dark;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = K.frame;
  ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  ctx.fillStyle = K.dark;
  // the notches that mark off the corners of the sizing border
  for (const [x, y, w, h] of [
    [r.x + 32, r.y, 1, EDGE],
    [r.x + r.w - 33, r.y, 1, EDGE],
    [r.x + 32, r.y + r.h - EDGE, 1, EDGE],
    [r.x + r.w - 33, r.y + r.h - EDGE, 1, EDGE],
    [r.x, r.y + 32, EDGE, 1],
    [r.x + r.w - EDGE, r.y + 32, EDGE, 1],
    [r.x, r.y + r.h - 33, EDGE, 1],
    [r.x + r.w - EDGE, r.y + r.h - 33, EDGE, 1],
  ])
    ctx.fillRect(x, y, w, h);
  ctx.fillRect(r.x + EDGE - 1, r.y + EDGE - 1, r.w - EDGE * 2 + 2, r.h - EDGE * 2 + 2);

  const bar = barOf(r);
  ctx.fillStyle = active ? K.title : K.light;
  ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
  ctx.fillStyle = active ? K.titleText : K.ink;
  ctx.font = `700 19px ${f.body}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(title, bar.x + bar.w / 2, bar.y + bar.h / 2 + 1, bar.w - TITLE * 3 - 16);
  // the control box at the left: a grey square with a slot in it. It closes the window.
  button(ctx, closeOf(r), (cx, cy) => {
    ctx.fillStyle = K.shade;
    ctx.fillRect(cx - 7, cy, 17, 4);
    ctx.fillStyle = K.dark;
    ctx.fillRect(cx - 9, cy - 3, 18, 5);
    ctx.fillStyle = K.light;
    ctx.fillRect(cx - 8, cy - 2, 16, 3);
  });
  button(ctx, minOf(r), (cx, cy) => arrow(ctx, cx, cy, false));
  button(ctx, maxOf(r), (cx, cy) => {
    if (!maxed) return arrow(ctx, cx, cy, true);
    // maximised, the button shows both arrows: press it to restore
    arrow(ctx, cx, cy - 5, true, 5);
    arrow(ctx, cx, cy + 5, false, 5);
  });
  ctx.fillStyle = K.dark;
  ctx.fillRect(bar.x, bar.y + bar.h, bar.w, 1);

  if (menus.length) {
    const my = bar.y + bar.h + 1;
    ctx.fillStyle = K.page;
    ctx.fillRect(bar.x, my, bar.w, 26);
    ctx.fillStyle = K.dark;
    ctx.fillRect(bar.x, my + 26, bar.w, 1);
    ctx.textAlign = "left";
    ctx.font = `700 17px ${f.body}`;
    let x = bar.x + 12;
    for (const name of menus) {
      ctx.fillText(name, x, my + 14);
      // the first letter underlined, as a keyboard shortcut would be
      ctx.fillRect(x, my + 23, ctx.measureText(name[0]).width, 1);
      x += ctx.measureText(name).width + 20;
    }
  }
  ctx.textBaseline = "alphabetic";
}

/* ---------- documents: text laid out once, then scrolled ---------- */

type Line = { text: string; font: string; colour: string; h: number; rule?: boolean };
const laid = new Map<string, Line[]>();

function layout(ctx: CanvasRenderingContext2D, key: string, width: number, build: (add: (text: string, font: string, colour: string, h: number, rule?: boolean) => void) => void) {
  const k = `${key}|${Math.round(width)}`;
  let lines = laid.get(k);
  if (!lines) {
    lines = [];
    build((text, font, colour, h, rule) => {
      ctx.font = font;
      const parts = text ? wrap(ctx, text, width) : [""];
      parts.forEach((part) => lines!.push({ text: part, font, colour, h, rule }));
    });
    laid.set(k, lines);
  }
  return lines;
}

const SB = 26; // scroll bar width
const scrollUp = (b: Rect): Rect => ({ x: b.x + b.w - SB, y: b.y, w: SB, h: SB });
const scrollDown = (b: Rect): Rect => ({ x: b.x + b.w - SB, y: b.y + b.h - SB, w: SB, h: SB });

/** A scrolling page of text with a working scroll bar down its right-hand side. */
function page(ctx: CanvasRenderingContext2D, w: Win, b: Rect, lines: Line[], pad: number, paper: string) {
  ctx.fillStyle = paper;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  const total = lines.reduce((sum, l) => sum + l.h, 0) + pad * 2;
  w.maxScroll = Math.max(0, total - b.h);
  w.scroll = clamp(w.scroll, 0, w.maxScroll);
  ctx.save();
  ctx.beginPath();
  ctx.rect(b.x, b.y, b.w - SB - 1, b.h);
  ctx.clip();
  ctx.textAlign = "left";
  let y = b.y + pad - w.scroll;
  for (const l of lines) {
    if (y + l.h > b.y && y < b.y + b.h) {
      if (l.rule) {
        ctx.fillStyle = K.shade;
        ctx.fillRect(b.x + pad, y + l.h / 2, b.w - SB - pad * 2, 1);
      } else {
        ctx.font = l.font;
        ctx.fillStyle = l.colour;
        ctx.fillText(l.text, b.x + pad, y + l.h * 0.76);
      }
    }
    y += l.h;
  }
  ctx.restore();
  // the bar: a track, an arrow at each end, and a thumb showing where in the file this is
  const x = b.x + b.w - SB;
  ctx.fillStyle = K.dark;
  ctx.fillRect(x - 1, b.y, 1, b.h);
  ctx.fillStyle = "#b9bcbf";
  ctx.fillRect(x, b.y, SB, b.h);
  button(ctx, scrollUp(b), (cx, cy) => arrow(ctx, cx, cy, true, 5));
  button(ctx, scrollDown(b), (cx, cy) => arrow(ctx, cx, cy, false, 5));
  const run = b.h - SB * 3 - 4;
  const at = w.maxScroll ? w.scroll / w.maxScroll : 0;
  if (run > 0) button(ctx, { x, y: b.y + SB + 2 + run * at, w: SB, h: SB }, () => {});
}

function aboutLines(ctx: CanvasRenderingContext2D, lang: Lang, f: Fonts, width: number) {
  return layout(ctx, `about|${lang}`, width, (add) => {
    add(profile.hello[lang], `700 26px ${f.body}`, K.ink, 40);
    add("", "", "", 10);
    for (const para of [...profile.about[lang], profile.likes[lang]]) {
      add(para, `700 18px ${f.body}`, K.ink, 27);
      add("", "", "", 14);
    }
  });
}

/** The work history, set out as a word-processor document: a heading, then an entry per workplace. */
function workLines(ctx: CanvasRenderingContext2D, lang: Lang, f: Fonts, width: number) {
  return layout(ctx, `work|${lang}`, width, (add) => {
    add("WORK EXPERIENCE", `700 27px ${f.body}`, K.ink, 40);
    add(`${profile.name}  ·  ${profile.role}`, `700 17px ${f.body}`, K.dim, 26);
    add("", "", "", 16, true);
    for (const job of jobs) {
      add(job.company, `700 22px ${f.body}`, K.title, 34);
      add(`${job.title}  ·  ${jobYears(job, lang)}  ·  ${job.place[lang]}`, `700 16px ${f.body}`, K.dim, 25);
      add("", "", "", 6);
      add(job.body[lang], `700 17px ${f.body}`, K.ink, 26);
      add("", "", "", 6);
      add(job.tech.join("  ·  "), `700 15px ${f.body}`, K.dim, 23);
      add("", "", "", 22, true);
    }
  });
}

/* ---------- the calculator ---------- */

const CALC_KEYS = ["C", "←", "±", "/", "7", "8", "9", "*", "4", "5", "6", "-", "1", "2", "3", "+", "0", ".", "=", ""];
const SHOWN: Record<string, string> = { "/": "÷", "*": "×", "-": "−" };

function calcKeyRect(b: Rect, i: number): Rect {
  const pad = 12;
  const top = b.y + 70;
  const gap = 8;
  const kw = (b.w - pad * 2 - gap * 3) / 4;
  const kh = (b.y + b.h - pad - top - gap * 4) / 5;
  const col = i % 4;
  const row = Math.floor(i / 4);
  // "=" takes the last two places of the bottom row
  const wide = CALC_KEYS[i] === "=";
  return { x: b.x + pad + col * (kw + gap), y: top + row * (kh + gap), w: wide ? kw * 2 + gap : kw, h: kh };
}

function calcPress(key: string) {
  const c = os.calc;
  blip(key === "=" ? 880 : 620, 0.03);
  const value = parseFloat(c.shown);
  const apply = () => {
    if (c.op === null || c.acc === null) return value;
    const r = c.op === "+" ? c.acc + value : c.op === "-" ? c.acc - value : c.op === "*" ? c.acc * value : value === 0 ? NaN : c.acc / value;
    return r;
  };
  const show = (n: number) => {
    // twelve figures is what the display holds; past that it reads as an error
    if (!Number.isFinite(n)) return "Error";
    const s = String(parseFloat(n.toPrecision(11)));
    return s.length > 13 ? n.toExponential(6) : s;
  };
  if (c.shown === "Error" && key !== "C") return;
  if (/^[0-9]$/.test(key)) {
    c.shown = c.fresh || c.shown === "0" ? key : c.shown.length < 12 ? c.shown + key : c.shown;
    c.fresh = false;
  } else if (key === ".") {
    if (c.fresh) c.shown = "0.";
    else if (!c.shown.includes(".")) c.shown += ".";
    c.fresh = false;
  } else if (key === "C") {
    os.calc = { shown: "0", acc: null, op: null, fresh: true };
  } else if (key === "←") {
    if (!c.fresh) c.shown = c.shown.length > 1 && c.shown !== "-0" ? c.shown.slice(0, -1) : "0";
    if (c.shown === "-") c.shown = "0";
  } else if (key === "±") {
    if (c.shown !== "0") c.shown = c.shown.startsWith("-") ? c.shown.slice(1) : `-${c.shown}`;
  } else if (key === "=") {
    c.shown = show(apply());
    c.acc = null;
    c.op = null;
    c.fresh = true;
  } else if ("+-*/".includes(key) && key) {
    // a second operator in a row only changes the operation; otherwise the sum so far is worked out
    if (!c.fresh || c.acc === null) {
      const r = apply();
      c.shown = show(r);
      c.acc = Number.isFinite(r) ? r : null;
    }
    c.op = c.shown === "Error" ? null : key;
    c.fresh = true;
  }
}

function drawCalc(ctx: CanvasRenderingContext2D, f: Fonts, b: Rect) {
  ctx.fillStyle = K.frame;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  // the display: sunk in, figures set to the right
  const d: Rect = { x: b.x + 12, y: b.y + 14, w: b.w - 24, h: 44 };
  ctx.fillStyle = K.page;
  ctx.fillRect(d.x, d.y, d.w, d.h);
  bevel(ctx, d, false);
  ctx.fillStyle = K.ink;
  ctx.font = `700 28px ${f.body}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(os.calc.shown, d.x + d.w - 10, d.y + d.h / 2 + 2, d.w - 20);
  if (os.calc.op) {
    ctx.font = `700 15px ${f.body}`;
    ctx.textAlign = "left";
    ctx.fillStyle = K.dim;
    ctx.fillText(SHOWN[os.calc.op] ?? os.calc.op, d.x + 8, d.y + 13);
  }
  ctx.textAlign = "center";
  CALC_KEYS.forEach((key, i) => {
    if (!key) return;
    const r = calcKeyRect(b, i);
    const down = os.drag === null && os.mx >= 0 && pressedKey === i;
    button(
      ctx,
      r,
      (cx, cy) => {
        ctx.font = `700 22px ${f.body}`;
        ctx.fillStyle = "+-*/=".includes(key) ? "#a01818" : key === "C" || key === "←" || key === "±" ? K.title : K.ink;
        ctx.fillText(SHOWN[key] ?? key, cx, cy + 1);
      },
      down,
    );
  });
  ctx.textBaseline = "alphabetic";
}
/** the calculator key being held under the pointer, so it draws pressed in */
let pressedKey = -1;

/* ---------- icons, drawn as chunky pixel art on a 16 x 16 grid ---------- */

type Brush = (x: number, y: number, w: number, h: number, c: string) => void;
const ICONS: Record<App | "exit" | "logo", (p: Brush) => void> = {
  ...EXTRA_ICONS,
  // a sheet of paper with a folded corner and lines of writing
  about: (p) => {
    p(3, 1, 9, 14, "#000");
    p(4, 2, 7, 12, "#fff");
    p(9, 1, 3, 3, "#000");
    p(9, 2, 2, 2, "#c3c7cb");
    for (let y = 5; y < 13; y += 2) p(5, y, 5, 1, "#000a7b");
  },
  // a document with a nib across it: something written, with care
  work: (p) => {
    p(2, 1, 10, 14, "#000");
    p(3, 2, 8, 12, "#fff");
    p(4, 4, 6, 1, "#868a8e");
    p(4, 6, 6, 1, "#868a8e");
    p(4, 8, 4, 1, "#868a8e");
    p(9, 8, 5, 2, "#000a7b");
    p(8, 10, 5, 2, "#000a7b");
    p(7, 12, 2, 2, "#e3c558");
    p(6, 14, 1, 1, "#000");
  },
  // a pocket calculator: a window and three rows of keys
  calc: (p) => {
    p(3, 1, 10, 14, "#000");
    p(4, 2, 8, 12, "#c3c7cb");
    p(5, 3, 6, 3, "#9fd0a0");
    for (let y = 7; y < 13; y += 2) for (let x = 5; x < 11; x += 2) p(x, y, 1, 1, x === 9 ? "#a01818" : "#000");
  },
  // a bin with crumpled paper
  recycle: (p) => {
    p(3, 2, 10, 1, "#000");
    p(2, 3, 12, 1, "#000");
    p(3, 4, 10, 11, "#000");
    p(4, 5, 8, 9, "#dfe3e7");
    p(5, 6, 1, 7, "#9aa0a6");
    p(8, 6, 1, 7, "#9aa0a6");
    p(11, 6, 1, 7, "#9aa0a6");
    p(6, 1, 4, 1, "#000");
  },
  // a door standing open, with an arrow out of it
  exit: (p) => {
    p(2, 1, 8, 14, "#000");
    p(3, 2, 6, 12, "#8a5a2a");
    p(7, 8, 1, 1, "#e3c558");
    p(10, 7, 4, 2, "#000");
    p(12, 5, 1, 6, "#000");
    p(13, 6, 1, 4, "#000");
    p(14, 7, 1, 2, "#000");
  },
  // the system's own mark: a little cassette
  logo: (p) => {
    p(1, 3, 14, 10, "#000");
    p(2, 4, 12, 8, "#e3c558");
    p(3, 5, 10, 3, "#fff");
    p(4, 9, 2, 2, "#000");
    p(10, 9, 2, 2, "#000");
    p(7, 10, 2, 1, "#000");
  },
};

type ImgId = App | "exit" | "logo";
const IMG_SRC: Partial<Record<ImgId, string>> = {
  about: "/icons/text.png",
  work: "/icons/word.png",
  term: "/icons/prompt.png",
  notes: "/icons/notepad.png",
  paint: "/icons/paint.png",
  calc: "/icons/calculator.png",
  clock: "/icons/clock.png",
  mines: "/icons/minesweeper.png",
  snake: "/icons/snake.png",
  galaga: "/icons/galaga.png",
  ttt: "/icons/tictactoe.png",
  typing: "/icons/lomba-ketik.png",
  recycle: "/icons/recycle-bin-empty.png",
  exit: "/icons/shutdown.png",
};
const IMG_CACHE: Record<string, HTMLImageElement> = {};
function getImg(id: ImgId) {
  let src = IMG_SRC[id];
  if (id === "recycle") src = os.trash.length ? "/icons/recycle-bin-filled.png" : "/icons/recycle-bin-empty.png";
  if (!src || typeof Image === "undefined") return null;
  let img = IMG_CACHE[src];
  if (!img) { img = new Image(); img.src = asset(src) ?? ""; IMG_CACHE[src] = img; }
  return img.complete && img.naturalWidth ? img : null;
}

function icon(ctx: CanvasRenderingContext2D, id: keyof typeof ICONS, x: number, y: number, size: number) {
  const img = getImg(id as ImgId);
  if (img) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, Math.round(x), Math.round(y), Math.round(size), Math.round(size));
    ctx.imageSmoothingEnabled = true;
    return;
  }
  const u = size / 16;
  ICONS[id]((px, py, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x + px * u), Math.round(y + py * u), Math.ceil(w * u), Math.ceil(h * u));
  });
}

const ICON = 72;
const iconRect = (i: { x: number; y: number }): Rect => ({ x: i.x - 24, y: i.y - 4, w: ICON + 48, h: ICON + 48 });

/* ---------- the Start menu and the taskbar ---------- */

type Entry = { label: Record<Lang, string>; icon: keyof typeof ICONS; run: () => void } | null;
const MENU: Entry[] = [
  ...APPS.flatMap((app): Entry[] => {
    const entry: Entry = { label: NAMES[app].icon, icon: app, run: () => launch(app) };
    return GROUP_ENDS.includes(app) ? [entry, null] : [entry];
  }),
  null,
  {
    label: { id: "Shut down", en: "Shut down" },
    icon: "exit",
    run: () => {
      os.menu = false;
      blip(330, 0.08);
      useRoom.getState().shutdown();
    },
  },
];
const MENU_ROW = 31;
const MENU_W = 256;
const menuRect = (): Rect => {
  const h = MENU.reduce((sum, e) => sum + (e ? MENU_ROW : 10), 0) + 8;
  return { x: 2, y: TV_H - BAR - h, w: MENU_W, h };
};
function menuEntryAt(x: number, y: number) {
  const r = menuRect();
  if (!inside(r, x, y)) return -1;
  let top = r.y + 4;
  for (let i = 0; i < MENU.length; i++) {
    const h = MENU[i] ? MENU_ROW : 10;
    if (y >= top && y < top + h) return MENU[i] ? i : -1;
    top += h;
  }
  return -1;
}

/** Taskbar buttons share the room between Start and the clock, and narrow as more windows open. */
const taskRect = (i: number): Rect => {
  const x0 = START.x + START.w + 10;
  const each = Math.min(156, (TV_W - 100 - x0) / Math.max(1, os.wins.length));
  return { x: x0 + i * each, y: START.y, w: each - 6, h: START.h };
};
/** windows in the order they were opened, which is the order of their buttons on the taskbar */
const tasks = () => os.wins;

function drawBar(ctx: CanvasRenderingContext2D, lang: Lang, f: Fonts) {
  const y = TV_H - BAR;
  ctx.fillStyle = K.frame;
  ctx.fillRect(0, y, TV_W, BAR);
  ctx.fillStyle = K.light;
  ctx.fillRect(0, y, TV_W, 2);
  ctx.textBaseline = "middle";
  button(
    ctx,
    START,
    (cx, cy) => {
      if (!drawMark(ctx, "#000", START.x + 9 + (os.menu ? 1 : 0), cy - 11, 22)) icon(ctx, "logo", START.x + 8 + (os.menu ? 1 : 0), cy - 11, 22);
      ctx.font = `700 18px ${f.body}`;
      ctx.textAlign = "left";
      ctx.fillStyle = K.ink;
      ctx.fillText("Start", cx - 12, cy + 1);
    },
    os.menu,
  );
  const front = top();
  tasks().forEach((w, i) => {
    const r = taskRect(i);
    const on = w === front;
    button(
      ctx,
      r,
      (cx, cy) => {
        icon(ctx, w.app, r.x + 6 + (on ? 1 : 0), cy - 10, 20);
        ctx.font = `700 15px ${f.body}`;
        ctx.textAlign = "left";
        ctx.fillStyle = K.ink;
        if (r.w > 70) ctx.fillText(NAMES[w.app].icon[lang], r.x + 32 + (on ? 1 : 0), cy + 1, r.w - 38);
      },
      on,
    );
  });
  // the clock, sunk into the right-hand end
  const c: Rect = { x: TV_W - 92, y: START.y, w: 88, h: START.h };
  bevel(ctx, c, false, 1);
  const now = new Date();
  ctx.font = `700 17px ${f.body}`;
  ctx.textAlign = "center";
  ctx.fillStyle = K.ink;
  ctx.fillText(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`, c.x + c.w / 2, c.y + c.h / 2 + 1);
  ctx.textBaseline = "alphabetic";
}

function drawMenu(ctx: CanvasRenderingContext2D, lang: Lang, f: Fonts) {
  const r = menuRect();
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(r.x + 5, r.y + 5, r.w, r.h);
  ctx.fillStyle = K.dark;
  ctx.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
  ctx.fillStyle = K.frame;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  bevel(ctx, r);
  // the band down the side with the system's name, read bottom to top
  ctx.fillStyle = K.title;
  ctx.fillRect(r.x + 3, r.y + 3, 30, r.h - 6);
  ctx.save();
  ctx.translate(r.x + 25, r.y + r.h - 12);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = K.titleText;
  ctx.font = `700 19px ${f.body}`;
  ctx.textAlign = "left";
  ctx.fillText("DawnOS 3.1", 0, 0);
  ctx.restore();
  let y = r.y + 4;
  ctx.textBaseline = "middle";
  MENU.forEach((e, i) => {
    if (!e) {
      ctx.fillStyle = K.shade;
      ctx.fillRect(r.x + 38, y + 4, r.w - 44, 1);
      ctx.fillStyle = K.light;
      ctx.fillRect(r.x + 38, y + 5, r.w - 44, 1);
      y += 10;
      return;
    }
    const on = os.menuAt === i;
    if (on) {
      ctx.fillStyle = K.pick;
      ctx.fillRect(r.x + 35, y, r.w - 38, MENU_ROW);
    }
    icon(ctx, e.icon, r.x + 42, y + 4, 23);
    ctx.font = `700 17px ${f.body}`;
    ctx.textAlign = "left";
    ctx.fillStyle = on ? K.titleText : K.ink;
    ctx.fillText(e.label[lang], r.x + 76, y + MENU_ROW / 2 + 1);
    y += MENU_ROW;
  });
  ctx.textBaseline = "alphabetic";
}

/* ---------- the whole picture ---------- */

function recycleRows(b: Rect) {
  const top = b.y + 74;
  return { top, rowH: 30, list: { x: b.x + 12, y: top, w: b.w - 24, h: b.h - 86 } as Rect };
}
function recycleActionAt(x: number, y: number, b: Rect) {
  const restore: Rect = { x: b.x + 12, y: b.y + 10, w: 110, h: 28 };
  const empty: Rect = { x: b.x + 130, y: b.y + 10, w: 150, h: 28 };
  if (inside(restore, x, y)) return "restore";
  if (inside(empty, x, y)) return "empty";
  return null;
}
function recycleRowAt(x: number, y: number, b: Rect) {
  const { top, rowH, list } = recycleRows(b);
  if (!inside(list, x, y) || y < top) return -1;
  const i = Math.floor((y - top) / rowH);
  return i >= 0 && i < os.trash.length ? i : -1;
}
function restoreTrash(i = os.trashSel) {
  const item = os.trash[i];
  if (!item) return;
  os.trash.splice(i, 1);
  os.icons.push({ app: item.app, x: clamp(item.x, 4, TV_W - ICON - 4), y: clamp(item.y, 4, TV_H - BAR - ICON - 30) });
  os.trashSel = Math.min(os.trashSel, os.trash.length - 1);
  blip(660, 0.06);
}
function drawRecycle(ctx: CanvasRenderingContext2D, lang: Lang, f: Fonts, b: Rect) {
  ctx.fillStyle = K.page;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  const restore: Rect = { x: b.x + 12, y: b.y + 10, w: 110, h: 28 };
  const empty: Rect = { x: b.x + 130, y: b.y + 10, w: 150, h: 28 };
  void lang;
  button(ctx, restore, (cx, cy) => { ctx.font = `700 15px ${f.body}`; ctx.textAlign = "center"; ctx.fillStyle = os.trashSel >= 0 ? K.ink : K.dim; ctx.fillText("Restore", cx, cy + 1); });
  button(ctx, empty, (cx, cy) => { ctx.font = `700 15px ${f.body}`; ctx.textAlign = "center"; ctx.fillStyle = os.trash.length ? "#a01818" : K.dim; ctx.fillText("Empty Bin", cx, cy + 1); });
  const { top, rowH, list } = recycleRows(b);
  ctx.fillStyle = "#fff";
  ctx.fillRect(list.x, list.y, list.w, list.h);
  bevel(ctx, list, false, 1);
  ctx.fillStyle = K.frame;
  ctx.fillRect(list.x + 1, top - 24, list.w - 2, 23);
  ctx.fillStyle = K.ink; ctx.textAlign = "left"; ctx.font = `700 14px ${f.body}`;
  ctx.fillText("Name", list.x + 10, top - 8);
  ctx.fillText("Original", list.x + list.w - 170, top - 8);
  if (!os.trash.length) {
    ctx.fillStyle = K.dim; ctx.textAlign = "center"; ctx.font = `700 16px ${f.body}`;
    ctx.fillText("Recycle Bin is empty.", list.x + list.w / 2, top + 40);
  }
  os.trash.forEach((it, i) => {
    const y = top + i * rowH;
    if (y + rowH > list.y + list.h - 2) return;
    if (os.trashSel === i) { ctx.fillStyle = K.pick; ctx.fillRect(list.x + 2, y, list.w - 4, rowH - 1); }
    icon(ctx, it.app, list.x + 8, y + 3, 22);
    ctx.fillStyle = os.trashSel === i ? K.titleText : K.ink;
    ctx.textAlign = "left"; ctx.font = `700 15px ${f.body}`;
    ctx.fillText(it.label[lang], list.x + 38, y + 20, list.w - 220);
    ctx.fillStyle = os.trashSel === i ? "#d6def8" : K.dim;
    ctx.fillText("Desktop", list.x + list.w - 170, y + 20);
  });
  if (os.trashPrompt) {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    const p: Rect = { x: b.x + 20, y: b.y + 60, w: b.w - 40, h: 230 };
    ctx.fillStyle = K.frame; ctx.fillRect(p.x, p.y, p.w, p.h); bevel(ctx, p);
    ctx.fillStyle = K.title; ctx.fillRect(p.x + 3, p.y + 3, p.w - 6, 28);
    ctx.fillStyle = K.titleText; ctx.textAlign = "left"; ctx.font = `700 16px ${f.body}`;
    ctx.fillText("Confirm Empty", p.x + 10, p.y + 22);
    ctx.fillStyle = K.ink; ctx.font = `700 14px ${f.body}`;
    ctx.fillText("Solve this to permanently delete:", p.x + 16, p.y + 56, p.w - 32);
    ctx.font = `700 18px ${f.body}`;
    const q = os.trashPrompt.q;
    ctx.fillText(q.length > 48 ? q.slice(0, 48) : q, p.x + 16, p.y + 88, p.w - 32);
    if (q.length > 48) ctx.fillText(q.slice(48), p.x + 16, p.y + 112, p.w - 32);
    const inp: Rect = { x: p.x + 16, y: p.y + 128, w: p.w - 32, h: 34 };
    ctx.fillStyle = "#fff"; ctx.fillRect(inp.x, inp.y, inp.w, inp.h); bevel(ctx, inp, false, 1);
    ctx.fillStyle = K.ink; ctx.font = `700 20px ${f.body}`; ctx.fillText(os.trashPrompt.input + "_", inp.x + 10, inp.y + 23);
    if (os.trashPrompt.err) { ctx.fillStyle = "#a01818"; ctx.font = `700 14px ${f.body}`; ctx.fillText("Wrong. Try again.", p.x + 16, p.y + 180); }
    const ok: Rect = { x: p.x + p.w - 210, y: p.y + p.h - 40, w: 90, h: 28 };
    const cancel: Rect = { x: p.x + p.w - 110, y: p.y + p.h - 40, w: 90, h: 28 };
    button(ctx, ok, (cx, cy) => { ctx.font = `700 15px ${f.body}`; ctx.textAlign = "center"; ctx.fillStyle = K.ink; ctx.fillText("OK", cx, cy + 1); });
    button(ctx, cancel, (cx, cy) => { ctx.font = `700 15px ${f.body}`; ctx.textAlign = "center"; ctx.fillStyle = K.ink; ctx.fillText("Cancel", cx, cy + 1); });
  }
  if (os.deleting) {
    const now = performance.now();
    const t = Math.min(1, (now - os.deleting.start) / Math.max(1, os.deleting.until - os.deleting.start));
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(b.x, b.y, b.w, b.h);
    const p: Rect = { x: b.x + 60, y: b.y + 140, w: b.w - 120, h: 96 };
    ctx.fillStyle = K.frame; ctx.fillRect(p.x, p.y, p.w, p.h); bevel(ctx, p);
    ctx.fillStyle = K.ink; ctx.textAlign = "left"; ctx.font = `700 16px ${f.body}`;
    ctx.fillText("Deleting files...", p.x + 16, p.y + 32);
    const bar: Rect = { x: p.x + 16, y: p.y + 52, w: p.w - 32, h: 22 };
    ctx.fillStyle = "#fff"; ctx.fillRect(bar.x, bar.y, bar.w, bar.h); bevel(ctx, bar, false, 1);
    ctx.fillStyle = K.title; ctx.fillRect(bar.x + 2, bar.y + 2, (bar.w - 4) * t, bar.h - 4);
  }
  ctx.textBaseline = "alphabetic";
}

function drawWin(ctx: CanvasRenderingContext2D, lang: Lang, f: Fonts, w: Win, active: boolean) {
  const r = rectOf(w);
  const names = NAMES[w.app];
  frame(ctx, f, r, names.title[lang], names.menus[lang], active, w.max);
  const b = bodyOf(r, names.menus[lang].length > 0);
  ctx.save();
  ctx.beginPath();
  ctx.rect(b.x, b.y, b.w, b.h);
  ctx.clip();
  if (isExtra(w.app)) EXTRA[w.app].draw(ctx, f, b, lang, active);
  else if (w.app === "calc") drawCalc(ctx, f, b);
  else if (w.app === "recycle") drawRecycle(ctx, lang, f, b);
  else if (w.app === "about") page(ctx, w, b, aboutLines(ctx, lang, f, b.w - SB - 40), 20, K.page);
  else {
    // the word processor shows its ruler, then the page
    ctx.fillStyle = K.frame;
    ctx.fillRect(b.x, b.y, b.w, 20);
    ctx.fillStyle = K.dark;
    ctx.fillRect(b.x, b.y + 20, b.w, 1);
    for (let x = b.x + 26, n = 0; x < b.x + b.w - SB; x += 12, n++) ctx.fillRect(x, b.y + (n % 5 ? 14 : 8), 1, n % 5 ? 6 : 12);
    const p: Rect = { x: b.x, y: b.y + 21, w: b.w, h: b.h - 21 };
    page(ctx, w, p, workLines(ctx, lang, f, p.w - SB - 52), 26, K.page);
  }
  ctx.restore();
}

function drawPointer(ctx: CanvasRenderingContext2D) {
  if (os.mx < 0) return;
  const { mx: x, my: y } = os;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + 24);
  ctx.lineTo(x + 6, y + 19);
  ctx.lineTo(x + 10, y + 28);
  ctx.lineTo(x + 14, y + 26);
  ctx.lineTo(x + 10, y + 17);
  ctx.lineTo(x + 17, y + 17);
  ctx.closePath();
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1.6;
  ctx.stroke();
}

function crashAndRestart() {
  os.crash = { until: performance.now() + 2600 };
  os.deleting = null;
  os.trash = [];
  os.trashSel = -1;
  os.trashPrompt = null;
  os.wins = [];
  os.menu = false;
  os.picked.clear();
  os.drag = null;
  os.icons = DESKTOP_ICONS.map((it) => ({ ...it }));
  blip(90, 0.2);
}

export function drawOs(ctx: CanvasRenderingContext2D, lang: Lang, f: Fonts | null) {
  if (os.deleting && performance.now() >= os.deleting.until) crashAndRestart();
  if (os.crash) {
    ctx.fillStyle = "#000082";
    ctx.fillRect(0, 0, TV_W, TV_H);
    ctx.fillStyle = "#fff";
    ctx.font = "700 28px monospace";
    ctx.textAlign = "left";
    ctx.fillText("A fatal exception 0E has occurred at 0028:C0011E36", 48, 110);
    ctx.fillText("in VXD VMM(01) + 00010E36.", 48, 150);
    ctx.fillText("The current application will be terminated.", 48, 210);
    ctx.fillText("*  Press any key to restart the current application.", 48, 270);
    ctx.fillText("*  Press CTRL+ALT+DEL to restart your computer.", 48, 310);
    ctx.fillText("You will lose any unsaved information in all applications.", 48, 370);
    ctx.textAlign = "center";
    ctx.fillText("Press any key to continue _", TV_W / 2, 470);
    if (performance.now() >= os.crash.until) os.crash = null;
    return;
  }
  ctx.fillStyle = K.desk;
  ctx.fillRect(0, 0, TV_W, TV_H);
  if (!f) return;
  // desktop icons: the picked one has its name in reverse
  os.icons.forEach((it, i) => {
    icon(ctx, it.app, it.x, it.y, ICON);
    const label = NAMES[it.app].icon[lang];
    ctx.font = `700 15px ${f.body}`;
    ctx.textAlign = "center";
    const w = ctx.measureText(label).width + 10;
    const cx = it.x + ICON / 2;
    const ly = it.y + ICON - 8;
    if (os.picked.has(i)) {
      ctx.fillStyle = K.pick;
      ctx.fillRect(cx - w / 2, ly, w, 22);
    }
    ctx.fillStyle = K.titleText;
    ctx.fillText(label, cx, ly + 17);
  });
  if (os.drag?.kind === "marquee" && os.marquee) {
    const x = Math.min(os.drag.fromX, os.mx), y = Math.min(os.drag.fromY, os.my);
    const w = Math.abs(os.mx - os.drag.fromX), h = Math.abs(os.my - os.drag.fromY);
    ctx.fillStyle = "rgba(0,10,123,0.18)"; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  }
  const front = top();
  for (const w of os.wins) if (!w.min) drawWin(ctx, lang, f, w, w === front);
  drawBar(ctx, lang, f);
  if (os.menu) drawMenu(ctx, lang, f);
  drawPointer(ctx);
}

/* ---------- the pointer ---------- */

function scrollBy(w: Win, px: number) {
  const next = clamp(w.scroll + px, 0, w.maxScroll);
  if (next === w.scroll) return;
  w.scroll = next;
}

/** Wheel over the glass: the front window scrolls. */
export function osWheel(dy: number) {
  const w = top();
  if (w && (w.app === "about" || w.app === "work")) scrollBy(w, dy * 0.6);
}

/** What the pointer is over, and what pressing there would do. Null where nothing would happen. */
function target(x: number, y: number, lang: Lang): null | (() => void) {
  if (os.menu) {
    const i = menuEntryAt(x, y);
    if (i >= 0) return () => MENU[i]!.run();
    if (inside(menuRect(), x, y)) return () => {};
  }
  if (inside(START, x, y))
    return () => {
      os.menu = !os.menu;
      blip(520, 0.05);
    };
  if (y >= TV_H - BAR) {
    const list = tasks();
    const i = list.findIndex((_, n) => inside(taskRect(n), x, y));
    if (i < 0) return null;
    const w = list[i];
    // the front window's button puts it away; any other brings its window forward
    return () => {
      if (w === top()) w.min = true;
      else focus(w);
      blip(520, 0.05);
    };
  }
  for (let n = os.wins.length - 1; n >= 0; n--) {
    const w = os.wins[n];
    if (w.min) continue;
    const r = rectOf(w);
    if (!inside(r, x, y)) continue;
    if (inside(closeOf(r), x, y)) return () => close(w);
    if (inside(minOf(r), x, y))
      return () => {
        w.min = true;
        blip(420, 0.05);
      };
    if (inside(maxOf(r), x, y))
      return () => {
        focus(w);
        w.max = !w.max;
        blip(620, 0.05);
      };
    if (inside(barOf(r), x, y))
      return () => {
        focus(w);
        // a maximised window fills the screen and stays put; otherwise the title bar is its handle
        if (!w.max) os.drag = { kind: "win", win: w, dx: x - w.x, dy: y - w.y };
      };
    const b = bodyOf(r, NAMES[w.app].menus[lang].length > 0);
    if (isExtra(w.app)) {
      const prog = EXTRA[w.app];
      if (!inside(b, x, y)) return w === top() ? null : () => focus(w);
      // a press inside one of these goes to the program itself, which then follows the pointer until it lifts
      return () => {
        focus(w);
        os.drag = { kind: "app", win: w };
        prog.down?.(x, y, b);
      };
    }
    if (w.app === "recycle") {
      if (!inside(b, x, y)) return w === top() ? null : () => focus(w);
      return () => {
        focus(w);
        if (os.trashPrompt) {
          const p: Rect = { x: b.x + 40, y: b.y + 90, w: b.w - 80, h: 190 };
          const ok: Rect = { x: p.x + p.w - 210, y: p.y + p.h - 40, w: 90, h: 28 };
          const cancel: Rect = { x: p.x + p.w - 110, y: p.y + p.h - 40, w: 90, h: 28 };
          if (inside(ok, x, y)) {
            const val = Number(os.trashPrompt.input.trim());
            if (val === os.trashPrompt.a) { os.trashPrompt = null; os.deleting = { start: performance.now(), until: performance.now() + 2400 }; blip(520, 0.06); }
            else { os.trashPrompt.err = true; os.trashPrompt.input = ""; blip(120, 0.1); }
          } else if (inside(cancel, x, y)) os.trashPrompt = null;
          return;
        }
        const act = recycleActionAt(x, y, b);
        if (act === "restore") return restoreTrash();
        if (act === "empty") {
          if (os.trash.length) os.trashPrompt = { ...makeEquation(), input: "", err: false };
          return;
        }
        const row = recycleRowAt(x, y, b);
        os.trashSel = row;
        if (row >= 0 && os.lastDown.i === row + 10000 && performance.now() - os.lastDown.at < 480) { os.lastDown.i = -1; restoreTrash(row); }
        else if (row >= 0) os.lastDown = { i: row + 10000, at: performance.now() };
      };
    }
    if (w.app === "calc") {
      const i = CALC_KEYS.findIndex((key, k) => key && inside(calcKeyRect(b, k), x, y));
      if (i >= 0)
        return () => {
          focus(w);
          pressedKey = i;
          calcPress(CALC_KEYS[i]);
        };
    } else {
      const p = w.app === "work" ? { x: b.x, y: b.y + 21, w: b.w, h: b.h - 21 } : b;
      if (inside(scrollUp(p), x, y) || inside(scrollDown(p), x, y)) {
        const dir = inside(scrollUp(p), x, y) ? -1 : 1;
        return () => {
          focus(w);
          scrollBy(w, dir * 80);
          blip(520, 0.03);
        };
      }
    }
    // anywhere else on a window brings it to the front, and nothing behind it is reached
    return w === top() ? null : () => focus(w);
  }
  const i = os.icons.findIndex((it) => inside(iconRect(it), x, y));
  if (i >= 0)
    return () => {
      const it = os.icons[i];
      const now = performance.now();
      if (useRoom.getState().input === "touch") {
        os.lastDown.i = -1;
        return launch(it.app);
      }
      if (os.lastDown.i === i && now - os.lastDown.at < 480) {
        os.lastDown.i = -1;
        return launch(it.app);
      }
      os.lastDown = { i, at: now };
      if (!os.picked.has(i)) { os.picked.clear(); os.picked.add(i); }
      os.drag = { kind: "icon", i, dx: x - it.x, dy: y - it.y, moved: false, fromX: x, fromY: y };
      blip(520, 0.04);
    };
  if (y < TV_H - BAR) return () => {
    os.picked.clear();
    os.drag = { kind: "marquee", fromX: x, fromY: y, base: new Set() };
  };
  return null;
}

/**
 * The pointer on the glass, in picture pixels. Returns true where pressing would do something.
 * `kind` is what the pointer just did.
 */
export function osPointer(x: number, y: number, kind: "move" | "down" | "up", lang: Lang): boolean {
  os.mx = x;
  os.my = y;
  if (kind === "up") {
    const d = os.drag;
    if (d?.kind === "app" && isExtra(d.win.app)) EXTRA[d.win.app].up?.();
    if (d?.kind === "icon" && d.moved) {
      const cx = os.icons[d.i].x + ICON / 2, cy = os.icons[d.i].y + ICON / 2;
      const bin = os.icons.find((it) => it.app === "recycle");
      if (bin && inside(iconRect(bin), cx, cy)) {
        const moving = [...os.picked].sort((a, b) => b - a);
        for (const idx of moving) {
          const it = os.icons[idx];
          if (it.app === "recycle") continue;
          os.trash.push({ id: os.nextTrash++, app: it.app, label: NAMES[it.app].icon, x: it.x, y: it.y });
          os.icons.splice(idx, 1);
        }
        os.picked.clear();
        blip(220, 0.08);
      }
    }
    if (d?.kind === "marquee") os.marquee = null;
    os.drag = null;
    pressedKey = -1;
    return target(x, y, lang) !== null;
  }
  const d = os.drag;
  if (d && kind === "move") {
    if (d.kind === "app") {
      const w = d.win;
      if (isExtra(w.app)) EXTRA[w.app].move?.(x, y, bodyOf(rectOf(w), NAMES[w.app].menus[lang].length > 0), true);
    } else if (d.kind === "win") {
      // it can be pushed part way off the screen, but its title bar stays within reach
      d.win.x = clamp(x - d.dx, 60 - d.win.w, TV_W - 60);
      d.win.y = clamp(y - d.dy, 0, TV_H - BAR - TITLE - EDGE);
    } else if (d.kind === "marquee") {
      os.marquee = { x, y };
      const r: Rect = { x: Math.min(d.fromX, x), y: Math.min(d.fromY, y), w: Math.abs(x - d.fromX), h: Math.abs(y - d.fromY) };
      os.picked = new Set(os.icons.flatMap((it, i) => (inside(r, it.x + ICON / 2, it.y + ICON / 2) ? [i] : [])));
      return true;
    } else {
      if (!d.moved && Math.hypot(x - d.fromX, y - d.fromY) < 6) return true;
      const first = !d.moved;
      d.moved = true;
      const it = os.icons[d.i];
      const nx = clamp(x - d.dx, 4, TV_W - ICON - 4);
      const ny = clamp(y - d.dy, 4, TV_H - BAR - ICON - 30);
      const dx = nx - it.x, dy = ny - it.y;
      if (first && !os.picked.has(d.i)) { os.picked.clear(); os.picked.add(d.i); }
      for (const idx of os.picked) {
        const ic = os.icons[idx];
        ic.x = clamp(ic.x + dx, 4, TV_W - ICON - 4);
        ic.y = clamp(ic.y + dy, 4, TV_H - BAR - ICON - 30);
      }
    }
    return true;
  }
  const act = target(x, y, lang);
  if (os.menu) os.menuAt = menuEntryAt(x, y);
  if (kind === "down") {
    if (act) act();
    else {
      // a press on the bare desktop lets go of whatever was picked
      os.picked.clear();
    }
    // a press anywhere but the menu and its button puts the menu away
    if (os.menu && !inside(menuRect(), x, y) && !inside(START, x, y)) os.menu = false;
  }
  return act !== null;
}

/** The pointer has left the glass: stop drawing it, and let go of anything held. */
export function osPointerOut() {
  os.mx = -1;
  if (os.drag?.kind === "app" && isExtra(os.drag.win.app)) EXTRA[os.drag.win.app].up?.();
  os.drag = null;
  pressedKey = -1;
}

/* ---------- the keyboard ---------- */

/** Returns true when the key was used. */
export function osKey(e: KeyboardEvent, lang: Lang): boolean {
  const k = e.key;
  void lang;
  if (os.crash) { os.crash = null; return true; }
  if (os.deleting) return true;
  if (os.trashPrompt) {
    if (k === "Escape") { os.trashPrompt = null; return true; }
    if (k === "Enter" || e.code === "NumpadEnter") {
      const val = Number(os.trashPrompt.input.trim());
      if (val === os.trashPrompt.a) { os.trashPrompt = null; os.deleting = { start: performance.now(), until: performance.now() + 2400 }; blip(520, 0.06); }
      else { os.trashPrompt.err = true; os.trashPrompt.input = ""; blip(120, 0.1); }
      return true;
    }
    if (k === "Backspace") { os.trashPrompt.input = os.trashPrompt.input.slice(0, -1); return true; }
    const digit = /^[0-9]$/.test(k) ? k : /^Numpad[0-9]$/.test(e.code) ? e.code.slice(6) : /^Digit[0-9]$/.test(e.code) ? e.code.slice(5) : "";
    if (digit && os.trashPrompt.input.length < 12) { os.trashPrompt.input += digit; return true; }
    if ((k === "-" || k === "Subtract" || e.code === "Minus" || e.code === "NumpadSubtract") && os.trashPrompt.input.length < 12 && !os.trashPrompt.input.startsWith("-")) { os.trashPrompt.input = "-" + os.trashPrompt.input; return true; }
    return true;
  }
  if (k === "Escape") {
    osBack();
    return true;
  }
  if (os.menu) {
    const rows = MENU.map((entry, i) => (entry ? i : -1)).filter((i) => i >= 0);
    const at = rows.indexOf(os.menuAt);
    if (k === "ArrowDown") os.menuAt = rows[(at + 1) % rows.length];
    else if (k === "ArrowUp") os.menuAt = rows[(at + rows.length - 1 + (at < 0 ? 1 : 0)) % rows.length];
    else if (k === "Enter" && at >= 0) MENU[os.menuAt]!.run();
    else return false;
    blip(520, 0.03);
    return true;
  }
  const w = top();
  if (w && isExtra(w.app)) return EXTRA[w.app].key?.(e) ?? false;
  if (w?.app === "recycle") {
    if (k === "Delete" && os.trash.length) { os.trashPrompt = { ...makeEquation(), input: "", err: false }; return true; }
    if ((k === "Enter" || k === "r") && os.trashSel >= 0) { restoreTrash(); return true; }
    if (k === "ArrowDown") { os.trashSel = Math.min(os.trash.length - 1, os.trashSel + 1); return true; }
    if (k === "ArrowUp") { os.trashSel = Math.max(0, os.trashSel - 1); return true; }
    return false;
  }
  if (w?.app === "calc") {
    const key = /^[0-9.+\-*/=]$/.test(k) ? k : k === "Enter" ? "=" : k === "Backspace" ? "⌫" : k === "Delete" || k.toLowerCase() === "c" ? "C" : k === "," ? "." : "";
    if (!key) return false;
    calcPress(key);
    return true;
  }
  if (w) {
    if (k === "ArrowDown") scrollBy(w, 40);
    else if (k === "ArrowUp") scrollBy(w, -40);
    else if (k === "PageDown" || k === " ") scrollBy(w, 280);
    else if (k === "PageUp") scrollBy(w, -280);
    else if (k === "Home") scrollBy(w, -1e6);
    else if (k === "End") scrollBy(w, 1e6);
    else return false;
    return true;
  }
  // nothing open: the keys walk the icons on the desktop
  const n = os.icons.length;
  const at = os.picked.size === 1 ? [...os.picked][0] : -1;
  if (k === "ArrowDown" || k === "ArrowRight" || k === "Tab") { os.picked.clear(); os.picked.add((at + 1) % n); }
  else if (k === "ArrowUp" || k === "ArrowLeft") { os.picked.clear(); os.picked.add((at + n - 1 + (at < 0 ? 1 : 0)) % n); }
  else if (k === "Enter" && at >= 0) {
    launch(os.icons[at].app);
    return true;
  } else return false;
  blip(520, 0.03);
  return true;
}

/** What is on the desktop, in words, for screen readers. */
export function osText(lang: Lang): string {
  const open = os.wins.map((w) => NAMES[w.app].title[lang]);
  const programs = APPS.map((a) => NAMES[a].icon[lang]).join(", ");
  return `DawnOS 3.1. ${programs}.${open.length ? ` ${open.join(", ")}.` : ""}`;
}

/** Whether the typing test is the front window: the camera draws back to show the keyboard. */
export const typingFront = () => top()?.app === "typing";
