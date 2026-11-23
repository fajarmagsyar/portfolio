import { jobs, jobYears, profile, type Lang } from "@/content/data";
import { strings } from "@/content/strings";
import { useRoom, type TvScreen } from "../store";
import type { Fonts } from "../textures";
import { drawMark } from "./os-kit";
import { drawOs, launch, osBack, osKey, osPointer, osPointerOut, osText, osWheel, TV_H, TV_W } from "./os";

export { TV_H, TV_W };

// Everything the TV shows is painted here, onto one 4:3 canvas that the tube's CRT
// shader then displays. Nothing is laid over the 3D view: the title cards here, the
// desktop and its windows (os.ts), and the game are all pictures on the glass.

/** What is on the tube: the idle title card while nobody is using it, otherwise a TV screen. */
export type TvMode = "enter" | "idle" | "boot" | TvScreen;

/** How long the machine takes to start, in seconds. */
export const BOOT_TIME = 4.4;

/** Switching on: the firmware counting memory and listing drives, then the splash with its loading bar. `t` is seconds since power-on. */
function drawBoot(ctx: CanvasRenderingContext2D, f: Fonts | null, t: number) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, TV_W, TV_H);
  if (!f) return;
  const BIOS = 1.7;
  if (t < BIOS) {
    ctx.textAlign = "left";
    ctx.font = `22px ${f.screen}`;
    ctx.fillStyle = "#c8c8c8";
    const mem = Math.min(640, Math.floor((t / 0.7) * 640));
    const lines: [number, string][] = [
      [0.0, "DAWN BIOS v1.0   (C) 1999 FAJAR MAGSYAR"],
      [0.1, "CPU: PIXEL-86 @ 33MHz"],
      [0.25, `MEMORY TEST: ${mem}K${mem >= 640 ? " OK" : ""}`],
      [0.8, "DETECTING DRIVE C: ....... OK"],
      [1.0, "DETECTING CD-ROM  ....... OK"],
      [1.25, "STARTING DAWNOS..."],
    ];
    let y = 60;
    for (const [at, text] of lines) {
      if (t >= at) ctx.fillText(text, 48, y);
      y += 34;
    }
    if (Math.floor(t * 4) % 2 === 0) ctx.fillRect(48, y - 22, 12, 4);
    return;
  }
  // the splash
  const k = (t - BIOS) / (BOOT_TIME - BIOS);
  ctx.fillStyle = "#0a93ad";
  ctx.fillRect(0, 0, TV_W, TV_H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#f4f2ea";
  ctx.font = `700 96px ${f.body}`;
  drawMark(ctx, "#f4f2ea", TV_W / 2 - 79, TV_H * 0.1, 150);
  ctx.fillText("DawnOS", TV_W / 2, TV_H * 0.46);
  ctx.font = `26px ${f.screen}`;
  ctx.fillText(profile.name.toUpperCase(), TV_W / 2, TV_H * 0.46 + 44);
  // a bar of blocks that fills in jerks, as loading did
  const bw = 420;
  const x0 = (TV_W - bw) / 2;
  const y0 = TV_H * 0.66;
  ctx.strokeStyle = "#f4f2ea";
  ctx.lineWidth = 3;
  ctx.strokeRect(x0, y0, bw, 26);
  const blocks = 20;
  const filled = Math.floor(Math.min(1, k * k * (3 - 2 * k) * 1.05) * blocks);
  for (let i = 0; i < filled; i++) ctx.fillRect(x0 + 5 + i * ((bw - 10) / blocks), y0 + 5, (bw - 10) / blocks - 3, 16);
  ctx.font = `22px ${f.screen}`;
  ctx.fillText("LOADING...", TV_W / 2, y0 + 62);
}

/** The picture while nobody is using the TV: a blue tape-deck title card with the name. */
// The idle card: the name, the job, and since when, set low on the left, and one ornament,
// a dial of tick marks with a bright sweep going round it and fading behind. On the tube's own cyan.
function drawIdle(ctx: CanvasRenderingContext2D, f: Fonts, t: number) {
  const ink = "#f4f2ea";
  const M = 80; // the margin all round
  ctx.fillStyle = "#0a93ad";
  ctx.fillRect(0, 0, TV_W, TV_H);

  // the dial, in the top right corner
  const R = 112;
  const cx = TV_W - M - R - 14;
  const cy = M + R + 10;
  const TICKS = 72;
  const head = (t * 0.28) % 1;
  ctx.lineCap = "butt";
  for (let i = 0; i < TICKS; i++) {
    const u = i / TICKS;
    const behind = (head - u + 1) % 1; // how far the sweep has gone past this tick
    const lit = Math.exp(-behind * 7);
    const long = i % 6 === 0;
    const len = (long ? 24 : 13) + lit * 8;
    const ang = u * Math.PI * 2 - Math.PI / 2;
    ctx.strokeStyle = `rgba(244,242,234,${(0.42 + 0.58 * lit).toFixed(3)})`;
    ctx.lineWidth = long ? 4 : 3;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * (R - len), cy + Math.sin(ang) * (R - len));
    ctx.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R);
    ctx.stroke();
  }

  // the channel, top left, level with the dial's middle
  ctx.fillStyle = "rgba(244,242,234,0.8)";
  ctx.textAlign = "left";
  ctx.font = `28px ${f.screen}`;
  ctx.fillText("CH 04", M, cy + 9);

  // the name, over two lines, low on the left
  ctx.fillStyle = ink;
  ctx.textAlign = "left";
  ctx.font = `700 110px ${f.body}`;
  ctx.fillText(profile.firstName.toUpperCase(), M, 340);
  ctx.fillText(profile.name.split(" ").slice(1).join(" ").toUpperCase(), M, 444);

  // a rule, then the job on the left and since when on the right
  ctx.fillStyle = "rgba(244,242,234,0.4)";
  ctx.fillRect(M, 500, TV_W - M * 2, 2);
  ctx.fillStyle = ink;
  ctx.font = `34px ${f.screen}`;
  ctx.fillText(profile.role.toUpperCase(), M, 544);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(244,242,234,0.8)";
  ctx.font = `30px ${f.screen}`;
  ctx.fillText(`SINCE ${profile.since}`, TV_W - M, 544);
}

// Before anyone has come in, the tube asks one thing: sound, or no sound. The two answers
// are the way in. Their places on the picture, as shares of its width and height:
const ANSWERS = {
  on: { x: 0.1, y: 0.4, w: 0.37, h: 0.3 },
  off: { x: 0.53, y: 0.4, w: 0.37, h: 0.3 },
} as const;
export type Answer = keyof typeof ANSWERS;
let pointed: Answer | null = null;

/** Which answer a point on the glass is on. `u`, `v` run 0-1 across the picture, v upwards. */
export function enterAnswer(u: number, v: number): Answer | null {
  const y = 1 - v;
  for (const name of ["on", "off"] as const) {
    const a = ANSWERS[name];
    if (u >= a.x && u <= a.x + a.w && y >= a.y && y <= a.y + a.h) return name;
  }
  return null;
}
/** Tells the picture which answer the pointer is over, so it can be shown lit. */
export function enterPoint(answer: Answer | null) {
  pointed = answer;
}

function drawEnter(ctx: CanvasRenderingContext2D, lang: Lang, f: Fonts, t: number) {
  const s = strings[lang];
  ctx.fillStyle = "#0a93ad";
  ctx.fillRect(0, 0, TV_W, TV_H);
  ctx.font = `30px ${f.screen}`;
  ctx.textAlign = "right";
  ctx.fillStyle = "#f4f2ea";
  ctx.fillText("CH 00", TV_W - 74, 108);
  ctx.textAlign = "left";
  ctx.fillText(profile.name.toUpperCase(), 74, 108);
  ctx.textAlign = "center";
  ctx.font = `54px ${f.screen}`;
  ctx.fillStyle = Math.floor(t * 1.6) % 2 ? "#f4f2ea" : "#9ff0ff";
  ctx.fillText(s.sound_ask, TV_W / 2, 200);
  for (const name of ["on", "off"] as const) {
    const a = ANSWERS[name];
    const x = a.x * TV_W;
    const y = a.y * TV_H;
    const w = a.w * TV_W;
    const h = a.h * TV_H;
    const lit = pointed === name;
    ctx.fillStyle = lit ? "#f4f2ea" : "rgba(4,60,72,0.55)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#f4f2ea";
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = lit ? "#0a6e83" : "#f4f2ea";
    // a loudspeaker, with waves coming off it or a line through it
    const cx = x + w / 2;
    const cy = y + h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1.5, 1.5);
    ctx.translate(-cx - 2, -cy);
    ctx.beginPath();
    ctx.moveTo(cx - 44, cy - 13);
    ctx.lineTo(cx - 24, cy - 13);
    ctx.lineTo(cx, cy - 34);
    ctx.lineTo(cx, cy + 34);
    ctx.lineTo(cx - 24, cy + 13);
    ctx.lineTo(cx - 44, cy + 13);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    if (name === "on") {
      ctx.arc(cx + 4, cy, 20, -0.9, 0.9);
      ctx.moveTo(cx + 4 + 38 * Math.cos(-0.9), cy + 38 * Math.sin(-0.9));
      ctx.arc(cx + 4, cy, 38, -0.9, 0.9);
    } else {
      ctx.moveTo(cx + 16, cy - 16);
      ctx.lineTo(cx + 48, cy + 16);
      ctx.moveTo(cx + 48, cy - 16);
      ctx.lineTo(cx + 16, cy + 16);
    }
    ctx.stroke();
    ctx.lineCap = "butt";
    ctx.restore();
  }
  ctx.fillStyle = "#f4f2ea";
  ctx.font = `24px ${f.screen}`;
  ctx.fillText(s.sound_hint, TV_W / 2, TV_H * 0.84);
}

export function drawTv(ctx: CanvasRenderingContext2D, mode: TvMode, lang: Lang, fonts: Fonts | null, time: number, game: HTMLCanvasElement | null) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.textBaseline = "alphabetic";
  void game;
  if (mode === "boot") return drawBoot(ctx, fonts, time);
  if (mode !== "enter" && mode !== "idle") return drawOs(ctx, lang, fonts);
  if (!fonts) {
    ctx.fillStyle = "#0a93ad";
    ctx.fillRect(0, 0, TV_W, TV_H);
    return;
  }
  if (mode === "enter") drawEnter(ctx, lang, fonts, time);
  else drawIdle(ctx, fonts, time);
}

/**
 * The room asking for one of the TV's screens by name (the navigation does: "About" opens
 * the TV on the about page). On the desktop that means starting the matching program.
 */
export function tvShow(screen: TvScreen) {
  if (screen === "about") launch("about");
  else if (screen === "memory") launch("work");
}

/** Steps back: the front window shuts, and from the bare desktop back to the room. */
export function tvBack() {
  osBack();
}

/** Keyboard for the TV. Returns true when the key was used. */
export function tvKey(e: KeyboardEvent, lang: Lang): boolean {
  return osKey(e, lang);
}

/**
 * Pointer on the glass. `u`, `v` run 0-1 across the picture, v upwards.
 * Returns true when the pointer is over something that can be pressed.
 */
export function tvPointer(u: number, v: number, kind: "move" | "down" | "up", lang: Lang): boolean {
  return osPointer(u * TV_W, (1 - v) * TV_H, kind, lang);
}

export const tvPointerOut = osPointerOut;
export const tvWheel = osWheel;

/** Plain-text version of what the tube shows, for screen readers. */
export function tvText(screen: TvScreen, lang: Lang): string {
  void screen;
  const about = [profile.hello[lang], ...profile.about[lang], profile.likes[lang]].join(" ");
  const work = jobs.map((j) => `${jobYears(j, lang)}, ${j.company}, ${j.title}. ${j.body[lang]}`).join(" ");
  return `${osText(lang)} ${about} ${work}`;
}
