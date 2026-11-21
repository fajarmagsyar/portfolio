import { blip } from "@/audio/sfx";
import { jobs, jobYears, profile, type Lang } from "@/content/data";
import { useRoom } from "../store";
import { wrap, type Fonts } from "../textures";
import { EXTRA, EXTRA_ICONS, EXTRA_NAMES, host, type ExtraId } from "./os-apps";
import { arrow, bevel, button, clamp, inside, K, TV_H, TV_W, type Rect } from "./os-kit";

export { TV_H, TV_W };

// ---------------------------------------------------------------------------------------
// KAMAR 3.1: the TV's own little operating system, in the manner of the 16-bit desktops of
// the early nineties, with the Start button and taskbar that came a few years after.
//
// It is a real, if small, window manager: programs open in windows that can be dragged by
// their title bars, brought to the front, minimised to the taskbar, maximised and closed;
// the icons on the desktop can be picked up and put down anywhere; the Start menu lists
// the programs. All of it is painted onto one canvas (there is no DOM on the glass) from
// the state kept in this file, and worked by the pointer on the glass and the keyboard.
// ---------------------------------------------------------------------------------------

/* ---------- the programs ---------- */

type Built = "about" | "work" | "calc";
export type App = Built | ExtraId | "game";
// the order they stand in on the desktop (down the columns) and in the Start menu
const APPS: App[] = ["about", "work", "term", "notes", "paint", "calc", "clock", "mines", "snake", "ttt", "game"];
/** where the Start menu draws a line: after the documents, and after the accessories */
const GROUP_ENDS: App[] = ["work", "clock"];

const NAMES: Record<App, { icon: Record<Lang, string>; title: Record<Lang, string>; menus: Record<Lang, string[]> }> = {
  ...EXTRA_NAMES,
  about: {
    icon: { id: "TENTANG.TXT", en: "ABOUT.TXT" },
    title: { id: "Catatan - TENTANG.TXT", en: "Notepad - ABOUT.TXT" },
    menus: { id: ["Berkas", "Sunting", "Cari", "Bantuan"], en: ["File", "Edit", "Search", "Help"] },
  },
  work: {
    icon: { id: "KERJA.DOC", en: "WORK.DOC" },
    title: { id: "Tulis - KERJA.DOC", en: "Write - WORK.DOC" },
    menus: { id: ["Berkas", "Sunting", "Huruf", "Paragraf", "Bantuan"], en: ["File", "Edit", "Character", "Paragraph", "Help"] },
  },
  calc: {
    icon: { id: "Kalkulator", en: "Calculator" },
    title: { id: "Kalkulator", en: "Calculator" },
    menus: { id: ["Sunting", "Lihat", "Bantuan"], en: ["Edit", "View", "Help"] },
  },
  game: {
    icon: { id: "Main Game", en: "Play Game" },
    title: { id: "Game", en: "Game" },
    menus: { id: [], en: [] },
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
};
const isExtra = (app: App): app is ExtraId => app in EXTRA;
/** Where a program's window first opens: the built-in ones have their places, the rest open about the middle. */
function home(app: Win["app"]): Rect {
  if (!isExtra(app)) return HOME[app];
  const [w, h] = EXTRA[app].size;
  return { x: Math.round((TV_W - w) / 2 + 70), y: Math.round((TV_H - BAR - h) / 2), w, h };
}

const os = {
  /** open windows, back to front */
  wins: [] as Win[],
  // five to a column, down the left of the desktop
  icons: APPS.map((app, i) => ({ app, x: 26 + Math.floor(i / 5) * 104, y: 16 + (i % 5) * 104 })),
  picked: 0 as number | null,
  menu: false,
  menuAt: -1,
  mx: -1,
  my: -1,
  drag: null as null | { kind: "win"; win: Win; dx: number; dy: number } | { kind: "app"; win: Win } | { kind: "icon"; i: number; dx: number; dy: number; moved: boolean; fromX: number; fromY: number },
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
  if (app === "game") return useRoom.getState().setTvScreen("game");
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
    add(lang === "id" ? "PENGALAMAN KERJA" : "WORK EXPERIENCE", `700 27px ${f.body}`, K.ink, 40);
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
  // a joystick on its base
  game: (p) => {
    p(2, 11, 12, 4, "#000");
    p(3, 12, 10, 2, "#868a8e");
    p(7, 4, 2, 8, "#000");
    p(6, 1, 4, 4, "#000");
    p(7, 2, 2, 2, "#d8362a");
    p(11, 12, 2, 1, "#d8362a");
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

function icon(ctx: CanvasRenderingContext2D, id: keyof typeof ICONS, x: number, y: number, size: number) {
  const u = size / 16;
  ICONS[id]((px, py, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x + px * u), Math.round(y + py * u), Math.ceil(w * u), Math.ceil(h * u));
  });
}

const ICON = 56;
const iconRect = (i: { x: number; y: number }): Rect => ({ x: i.x - 26, y: i.y - 4, w: ICON + 52, h: ICON + 44 });

/* ---------- the Start menu and the taskbar ---------- */

type Entry = { label: Record<Lang, string>; icon: keyof typeof ICONS; run: () => void } | null;
const MENU: Entry[] = [
  ...APPS.flatMap((app): Entry[] => {
    const entry: Entry = { label: NAMES[app].icon, icon: app, run: () => launch(app) };
    return GROUP_ENDS.includes(app) ? [entry, null] : [entry];
  }),
  null,
  {
    label: { id: "Kembali ke kamar", en: "Back to the room" },
    icon: "exit",
    run: () => {
      os.menu = false;
      blip(330, 0.08);
      useRoom.getState().setFocus(null);
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
const tasks = () => APPS.map((app) => os.wins.find((w) => w.app === app)).filter((w): w is Win => !!w);

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
      icon(ctx, "logo", START.x + 8 + (os.menu ? 1 : 0), cy - 11, 22);
      ctx.font = `700 18px ${f.body}`;
      ctx.textAlign = "left";
      ctx.fillStyle = K.ink;
      ctx.fillText(lang === "id" ? "Mulai" : "Start", cx - 12, cy + 1);
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
  ctx.fillText("KAMAR 3.1", 0, 0);
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

export function drawOs(ctx: CanvasRenderingContext2D, lang: Lang, f: Fonts | null) {
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
    const ly = it.y + ICON + 6;
    if (os.picked === i) {
      ctx.fillStyle = K.pick;
      ctx.fillRect(cx - w / 2, ly, w, 22);
    }
    ctx.fillStyle = K.titleText;
    ctx.fillText(label, cx, ly + 17);
  });
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
      // a second press soon after the first opens it; a single press picks it up
      if (os.lastDown.i === i && now - os.lastDown.at < 480) {
        os.lastDown.i = -1;
        return launch(it.app);
      }
      os.lastDown = { i, at: now };
      os.picked = i;
      os.drag = { kind: "icon", i, dx: x - it.x, dy: y - it.y, moved: false, fromX: x, fromY: y };
      blip(520, 0.04);
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
    if (os.drag?.kind === "app" && isExtra(os.drag.win.app)) EXTRA[os.drag.win.app].up?.();
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
    } else {
      if (!d.moved && Math.hypot(x - d.fromX, y - d.fromY) < 6) return true;
      d.moved = true;
      const it = os.icons[d.i];
      it.x = clamp(x - d.dx, 4, TV_W - ICON - 4);
      it.y = clamp(y - d.dy, 4, TV_H - BAR - ICON - 30);
    }
    return true;
  }
  const act = target(x, y, lang);
  if (os.menu) os.menuAt = menuEntryAt(x, y);
  if (kind === "down") {
    if (act) act();
    else {
      // a press on the bare desktop lets go of whatever was picked
      os.picked = null;
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
  if (w?.app === "calc") {
    const key = /^[0-9.+\-*/=]$/.test(k) ? k : k === "Enter" ? "=" : k === "Backspace" ? "←" : k === "Delete" || k.toLowerCase() === "c" ? "C" : k === "," ? "." : "";
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
  const at = os.picked ?? -1;
  if (k === "ArrowDown" || k === "ArrowRight" || k === "Tab") os.picked = (at + 1) % n;
  else if (k === "ArrowUp" || k === "ArrowLeft") os.picked = (at + n - 1 + (at < 0 ? 1 : 0)) % n;
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
  return `KAMAR 3.1. ${programs}.${open.length ? ` ${open.join(", ")}.` : ""}`;
}
