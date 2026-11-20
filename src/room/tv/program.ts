import { blip } from "@/audio/sfx";
import { jobs, jobYears, profile, type Lang } from "@/content/data";
import { strings } from "@/content/strings";
import { useRoom, type TvScreen } from "../store";
import { wrap, type Fonts } from "../textures";

// Everything the TV shows is painted here, onto one 4:3 canvas that the tube's CRT
// shader then displays. Nothing is laid over the 3D view: the menu, the memory card,
// the about page and the game are all pictures on the glass.

export const TV_W = 800;
export const TV_H = 600;

/** What is on the tube: the idle title card while nobody is using it, otherwise a TV screen. */
export type TvMode = "enter" | "idle" | TvScreen;

const PAD = 52;
const C = {
  text: "#eaf6ee",
  dim: "#8fa3b8",
  crt: "#9ff5c9",
  lamp: "#f0a441",
  cream: "#f3e2b8",
  line: "#2c4468",
};

const MENU: { id: Exclude<TvScreen, "menu">; label: "menu_memory" | "menu_game" | "menu_about" }[] = [
  { id: "memory", label: "menu_memory" },
  { id: "game", label: "menu_game" },
  { id: "about", label: "menu_about" },
];
const MENU_X = 286;
const MENU_Y = 326;
const MENU_STEP = 56;

const BLOCKS = 15;
const COLS = 5;
const CELL = 62;
const GAP = 8;
const GRID_Y = 108;

/** Cursor positions. They live outside React because only the canvas needs them. */
const state = { menu: 0, block: 0 };

function backdrop(ctx: CanvasRenderingContext2D) {
  const g = ctx.createRadialGradient(TV_W / 2, TV_H * 0.45, 60, TV_W / 2, TV_H * 0.45, TV_W * 0.7);
  g.addColorStop(0, "#14313c");
  g.addColorStop(0.7, "#0b1d27");
  g.addColorStop(1, "#07131a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, TV_W, TV_H);
}

function fit(ctx: CanvasRenderingContext2D, text: string, family: string, max: number, start: number) {
  let size = start;
  ctx.font = `${size}px ${family}`;
  while (ctx.measureText(text).width > max && size > 14) {
    size -= 2;
    ctx.font = `${size}px ${family}`;
  }
}

function foot(ctx: CanvasRenderingContext2D, f: Fonts, text: string) {
  ctx.font = `17px ${f.screen}`;
  ctx.textAlign = "center";
  ctx.fillStyle = C.dim;
  ctx.fillText(text, TV_W / 2, TV_H - 34);
}

/** The picture while nobody is using the TV: a blue tape-deck title card with the name. */
function drawIdle(ctx: CanvasRenderingContext2D, f: Fonts, t: number) {
  ctx.fillStyle = "#2a41d6";
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
  ctx.fillStyle = "#2a41d6";
  ctx.fillRect(0, 0, TV_W, TV_H);
  ctx.font = `30px ${f.screen}`;
  ctx.textAlign = "right";
  ctx.fillStyle = "#f4f2ea";
  ctx.fillText("CH 00", TV_W - 74, 108);
  ctx.textAlign = "center";
  ctx.font = `58px ${f.screen}`;
  ctx.fillStyle = Math.floor(t * 1.6) % 2 ? "#f4f2ea" : "#9fb0ff";
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

function drawMenu(ctx: CanvasRenderingContext2D, lang: Lang, f: Fonts) {
  const t = strings[lang];
  backdrop(ctx);
  ctx.textAlign = "center";
  ctx.fillStyle = C.lamp;
  ctx.font = `24px ${f.screen}`;
  ctx.fillText(`>_ ${profile.role}`, TV_W / 2, 150);
  ctx.fillStyle = C.cream;
  fit(ctx, profile.name.toUpperCase(), f.screen, TV_W - PAD * 2, 70);
  ctx.fillText(profile.name.toUpperCase(), TV_W / 2, 232);
  ctx.textAlign = "left";
  ctx.font = `36px ${f.screen}`;
  MENU.forEach((m, i) => {
    const on = state.menu === i;
    ctx.fillStyle = on ? C.crt : "#cfe6da";
    if (on) ctx.fillText("▶", MENU_X - 44, MENU_Y + i * MENU_STEP);
    ctx.fillText(t[m.label], MENU_X, MENU_Y + i * MENU_STEP);
  });
  foot(ctx, f, "↑ ↓  Enter   ·   Esc");
}

/** A chunky two-tone square, like a 16 x 16 save icon. */
function saveIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, shell: string, ink: string, label: string, f: Fonts) {
  ctx.fillStyle = shell;
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.moveTo(x + size, y);
  ctx.lineTo(x + size, y + size);
  ctx.lineTo(x, y + size);
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.fillRect(x, y, size, size * 0.28);
  ctx.font = `20px ${f.screen}`;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillText(label, x + size / 2 + 1, y + size * 0.78 + 1);
  ctx.fillStyle = "#fff";
  ctx.fillText(label, x + size / 2, y + size * 0.78);
}

/** Work history browsed like save files on a console memory card. */
function drawMemory(ctx: CanvasRenderingContext2D, lang: Lang, f: Fonts, time: number) {
  const t = strings[lang];
  backdrop(ctx);
  ctx.font = `21px ${f.screen}`;
  ctx.textAlign = "left";
  ctx.fillStyle = C.crt;
  ctx.fillText(t.memory_title, PAD, 72);
  ctx.textAlign = "right";
  ctx.fillStyle = C.dim;
  ctx.fillText(`${jobs.length}/${BLOCKS} ${t.memory_blocks}`, TV_W - PAD, 72);
  ctx.fillStyle = C.line;
  ctx.fillRect(PAD, 86, TV_W - PAD * 2, 2);

  for (let i = 0; i < BLOCKS; i++) {
    const x = PAD + (i % COLS) * (CELL + GAP);
    const y = GRID_Y + Math.floor(i / COLS) * (CELL + GAP);
    const job = jobs[i];
    ctx.fillStyle = "#0e1b2c";
    ctx.fillRect(x, y, CELL, CELL);
    if (job) saveIcon(ctx, x + 8, y + 8, CELL - 16, job.tape.shell, job.tape.ink, String(job.from).slice(2), f);
    const on = state.block === i;
    ctx.strokeStyle = on ? (Math.floor(time * 3) % 2 ? C.crt : "#ffffff") : C.line;
    ctx.lineWidth = on ? 4 : 2;
    ctx.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2);
  }

  const job = jobs[state.block];
  const infoX = PAD + COLS * (CELL + GAP) + 22;
  const infoW = TV_W - PAD - infoX;
  if (!job) {
    ctx.font = `24px ${f.screen}`;
    ctx.textAlign = "center";
    ctx.fillStyle = C.dim;
    ctx.fillText(`— ${t.empty_slot} —`, infoX + infoW / 2, 220);
  } else {
    ctx.textAlign = "left";
    ctx.fillStyle = C.crt;
    ctx.font = `20px ${f.screen}`;
    ctx.fillText(`${jobYears(job, lang)} · ${job.place[lang]}`, infoX, 132);
    ctx.fillStyle = C.cream;
    fit(ctx, job.company, f.screen, infoW, 38);
    ctx.fillText(job.company, infoX, 180);
    ctx.fillStyle = C.lamp;
    ctx.font = `700 21px ${f.body}`;
    ctx.fillText(job.title, infoX, 216);
    ctx.fillStyle = C.crt;
    ctx.font = `18px ${f.screen}`;
    wrap(ctx, job.tech.join(" / "), infoW)
      .slice(0, 3)
      .forEach((line, i) => ctx.fillText(line, infoX, 254 + i * 25));
    // the save file's description runs the full width under the grid
    ctx.fillStyle = C.text;
    ctx.font = `500 21px ${f.body}`;
    wrap(ctx, job.body[lang], TV_W - PAD * 2)
      .slice(0, 7)
      .forEach((line, i) => ctx.fillText(line, PAD, 362 + i * 30));
  }
  foot(ctx, f, "← → ↑ ↓   ·   Esc");
}

function drawAbout(ctx: CanvasRenderingContext2D, lang: Lang, f: Fonts) {
  backdrop(ctx);
  ctx.textAlign = "left";
  ctx.fillStyle = C.cream;
  ctx.font = `42px ${f.screen}`;
  ctx.fillText(profile.hello[lang], PAD, 112);
  ctx.font = `500 21px ${f.body}`;
  let y = 168;
  for (const para of profile.about[lang]) {
    ctx.fillStyle = C.text;
    for (const line of wrap(ctx, para, TV_W - PAD * 2)) {
      ctx.fillText(line, PAD, y);
      y += 31;
    }
    y += 14;
  }
  ctx.fillStyle = C.crt;
  for (const line of wrap(ctx, profile.likes[lang], TV_W - PAD * 2)) {
    ctx.fillText(line, PAD, y + 8);
    y += 31;
  }
  foot(ctx, f, "Esc");
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
  if (!fonts) {
    ctx.fillStyle = mode === "idle" || mode === "enter" ? "#2a41d6" : "#0b1d27";
    ctx.fillRect(0, 0, TV_W, TV_H);
    return;
  }
  if (mode === "enter") drawEnter(ctx, lang, fonts, time);
  else if (mode === "idle") drawIdle(ctx, fonts, time);
  else if (mode === "menu") drawMenu(ctx, lang, fonts);
  else if (mode === "memory") drawMemory(ctx, lang, fonts, time);
  else drawAbout(ctx, lang, fonts);
}

function back() {
  const { tvScreen, setTvScreen, setFocus } = useRoom.getState();
  blip(330, 0.08);
  if (tvScreen === "menu") setFocus(null);
  else setTvScreen("menu");
}

/** Leaves the current TV screen: back to the menu, or from the menu back to the room. */
export const tvBack = back;

/** Keyboard for the TV's own screens. Returns true when the key was used. The game reads its keys itself. */
export function tvKey(e: KeyboardEvent): boolean {
  const { tvScreen, setTvScreen } = useRoom.getState();
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k === "Escape") {
    back();
    return true;
  }
  if (tvScreen === "menu") {
    if (k === "ArrowDown" || k === "s") state.menu = (state.menu + 1) % MENU.length;
    else if (k === "ArrowUp" || k === "w") state.menu = (state.menu + MENU.length - 1) % MENU.length;
    else if (k === "Enter" || k === "z" || k === " ") {
      blip(880, 0.1);
      setTvScreen(MENU[state.menu].id);
      return true;
    } else return false;
    blip(520);
    return true;
  }
  if (tvScreen === "memory") {
    let next = state.block;
    if (k === "ArrowRight" || k === "d") next = Math.min(BLOCKS - 1, next + 1);
    else if (k === "ArrowLeft" || k === "a") next = Math.max(0, next - 1);
    else if (k === "ArrowDown" || k === "s") next = Math.min(BLOCKS - 1, next + COLS);
    else if (k === "ArrowUp" || k === "w") next = Math.max(0, next - COLS);
    else return false;
    if (next !== state.block) {
      blip(520);
      state.block = next;
    }
    return true;
  }
  return false;
}

/**
 * Pointer on the glass. `u`, `v` run 0-1 across the picture, v upwards.
 * Returns true when the pointer is over something that can be clicked.
 */
export function tvPointer(u: number, v: number, click: boolean): boolean {
  const { tvScreen, setTvScreen } = useRoom.getState();
  const x = u * TV_W;
  const y = (1 - v) * TV_H;
  if (tvScreen === "menu") {
    const i = Math.floor((y - (MENU_Y - 40)) / MENU_STEP);
    if (i < 0 || i >= MENU.length || x < MENU_X - 60 || x > MENU_X + 300) return false;
    if (state.menu !== i) {
      state.menu = i;
      blip(520);
    }
    if (click) {
      blip(880, 0.1);
      setTvScreen(MENU[i].id);
    }
    return true;
  }
  if (tvScreen === "memory") {
    const col = Math.floor((x - PAD) / (CELL + GAP));
    const row = Math.floor((y - GRID_Y) / (CELL + GAP));
    if (col < 0 || col >= COLS || row < 0 || row >= BLOCKS / COLS) return false;
    const i = row * COLS + col;
    if (click && state.block !== i) {
      state.block = i;
      blip(520);
    }
    return true;
  }
  return false;
}

/** Plain-text version of what the tube shows, for screen readers. */
export function tvText(screen: TvScreen, lang: Lang): string {
  const t = strings[lang];
  if (screen === "menu") return `${profile.name}. ${MENU.map((m) => t[m.label]).join(", ")}.`;
  if (screen === "about") return [profile.hello[lang], ...profile.about[lang], profile.likes[lang]].join(" ");
  if (screen === "game") return `${t.game_title}. ${t.game_controls}`;
  return jobs.map((j) => `${jobYears(j, lang)}, ${j.company}, ${j.title}. ${j.body[lang]}`).join(" ");
}
