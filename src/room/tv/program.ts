import { jobs, jobYears, profile, type Lang } from "@/content/data";
import { strings } from "@/content/strings";
import { useRoom, type TvScreen } from "../store";
import type { Fonts } from "../textures";
import { drawOs, launch, osBack, osKey, osPointer, osPointerOut, osText, osWheel, TV_H, TV_W } from "./os";

export { TV_H, TV_W };

// Everything the TV shows is painted here, onto one 4:3 canvas that the tube's CRT
// shader then displays. Nothing is laid over the 3D view: the title cards here, the
// desktop and its windows (os.ts), and the game are all pictures on the glass.

/** What is on the tube: the idle title card while nobody is using it, otherwise a TV screen. */
export type TvMode = "enter" | "idle" | TvScreen;

/** The picture while nobody is using the TV: a blue tape-deck title card with the name. */
function drawIdle(ctx: CanvasRenderingContext2D, f: Fonts, t: number) {
  ctx.fillStyle = "#0a93ad";
  ctx.fillRect(0, 0, TV_W, TV_H);
  ctx.textAlign = "left";
  ctx.fillStyle = "#f4f2ea";
  ctx.font = `36px ${f.screen}`;
  if (Math.floor(t * 1.2) % 2 === 0) ctx.fillText("▶ PLAY", 74, 108);
  ctx.textAlign = "right";
  ctx.fillText("CH 03", TV_W - 74, 108);
  ctx.textAlign = "left";
  ctx.font = `700 102px ${f.body}`;
  ctx.fillText(profile.firstName.toUpperCase(), 74, 284);
  ctx.fillText("MAGSYAR", 74, 390);
  ctx.font = `31px ${f.screen}`;
  ctx.fillStyle = "rgba(244,242,234,0.85)";
  ctx.fillText(`${profile.role.toUpperCase()}  ·  SBY`, 74, 450);
  // a dotted orbit drawn across the lower half, with a four-point star riding it
  const cx = TV_W * 0.6;
  const cy = TV_H * 0.76;
  ctx.strokeStyle = "rgba(244,242,234,0.75)";
  ctx.lineWidth = 3;
  ctx.setLineDash([3, 10]);
  ctx.beginPath();
  ctx.ellipse(cx, cy, 250, 56, -0.2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  const a = t * 0.5;
  const sx = cx + Math.cos(a) * 250 * Math.cos(-0.2) - Math.sin(a) * 56 * Math.sin(-0.2);
  const sy = cy + Math.cos(a) * 250 * Math.sin(-0.2) + Math.sin(a) * 56 * Math.cos(-0.2);
  ctx.fillStyle = "#f4f2ea";
  ctx.fillRect(sx - 2, sy - 15, 4, 30);
  ctx.fillRect(sx - 15, sy - 2, 30, 4);
}

/** Before anyone has come in: the prompt to enter, on the same blue as the idle card. */
function drawEnter(ctx: CanvasRenderingContext2D, lang: Lang, f: Fonts, t: number) {
  ctx.fillStyle = "#0a93ad";
  ctx.fillRect(0, 0, TV_W, TV_H);
  ctx.font = `30px ${f.screen}`;
  ctx.textAlign = "right";
  ctx.fillStyle = "#f4f2ea";
  ctx.fillText("CH 00", TV_W - 74, 108);
  ctx.textAlign = "center";
  ctx.font = `58px ${f.screen}`;
  ctx.fillStyle = Math.floor(t * 1.6) % 2 ? "#f4f2ea" : "#9ff0ff";
  ctx.fillText(strings[lang].enter, TV_W / 2, 280);
  // a full loading bar: by the time the tube is on, the room has loaded
  ctx.fillStyle = "#f4f2ea";
  const n = 22;
  const x0 = TV_W / 2 - 250;
  for (let i = 0; i < n; i++) ctx.fillRect(x0 + i * 20, 330, 14, 16);
  ctx.font = `26px ${f.screen}`;
  ctx.textAlign = "left";
  ctx.fillText("100%", x0 + n * 20 + 12, 346);
  ctx.textAlign = "center";
  ctx.strokeStyle = "#f4f2ea";
  ctx.lineWidth = 3;
  ctx.strokeRect(TV_W / 2 - 250, 400, 500, 70);
  ctx.font = `32px ${f.screen}`;
  ctx.fillText(profile.name.toUpperCase(), TV_W / 2, 446);
}

export function drawTv(ctx: CanvasRenderingContext2D, mode: TvMode, lang: Lang, fonts: Fonts | null, time: number, game: HTMLCanvasElement | null) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.textBaseline = "alphabetic";
  if (mode === "game") {
    ctx.fillStyle = "#0b0a12";
    ctx.fillRect(0, 0, TV_W, TV_H);
    // a console picture is stretched to fill a 4:3 tube
    if (game) ctx.drawImage(game, 0, 0, TV_W, TV_H);
    return;
  }
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

/** Steps back: out of the game to the desktop, otherwise the front window shuts, and from the bare desktop back to the room. */
export function tvBack() {
  const { tvScreen, setTvScreen } = useRoom.getState();
  if (tvScreen === "game") return setTvScreen("menu");
  osBack();
}

/** Keyboard for the TV. Returns true when the key was used. The game reads its own keys, except Escape. */
export function tvKey(e: KeyboardEvent, lang: Lang): boolean {
  if (useRoom.getState().tvScreen === "game") {
    if (e.key !== "Escape") return false;
    tvBack();
    return true;
  }
  return osKey(e, lang);
}

/**
 * Pointer on the glass. `u`, `v` run 0-1 across the picture, v upwards.
 * Returns true when the pointer is over something that can be pressed.
 */
export function tvPointer(u: number, v: number, kind: "move" | "down" | "up", lang: Lang): boolean {
  if (useRoom.getState().tvScreen === "game") return false;
  return osPointer(u * TV_W, (1 - v) * TV_H, kind, lang);
}

export const tvPointerOut = osPointerOut;
export const tvWheel = osWheel;

/** Plain-text version of what the tube shows, for screen readers. */
export function tvText(screen: TvScreen, lang: Lang): string {
  const t = strings[lang];
  if (screen === "game") return `${t.game_title}. ${t.game_controls}`;
  const about = [profile.hello[lang], ...profile.about[lang], profile.likes[lang]].join(" ");
  const work = jobs.map((j) => `${jobYears(j, lang)}, ${j.company}, ${j.title}. ${j.body[lang]}`).join(" ");
  return `${osText(lang)} ${about} ${work}`;
}
