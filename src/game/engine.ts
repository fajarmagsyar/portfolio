import { asset } from "@/asset";
import { blip } from "@/audio/sfx";
import { jobs, jobYears, profile, type Lang } from "@/content/data";
import { strings } from "@/content/strings";

// A one-room top-down RPG. Five objects hold five memories, oldest first; inspecting
// them in order tells the career story from the CV. Logical screen: 256 x 224 (16 x 14 tiles).
//
// Art: Kenney's Roguelike/RPG, Roguelike Indoor and Roguelike Characters packs (CC0).
// Sheets are 16 px tiles with a 1 px gap. See CREDITS.md.
const W = 256;
const H = 224;
const SCALE = 3;
const TILE = 16;
const WALL_ROWS = 3;
const WALL = WALL_ROWS * TILE;

type Sheet = "world" | "indoor" | "chars";
/** one tile: which sheet, its column and row there, and where it goes on the map (in tiles) */
type Cell = [sheet: Sheet, col: number, row: number, tx: number, ty: number];
type Rect = { x: number; y: number; w: number; h: number };
type Kind = "box" | "shelf" | "desk" | "board" | "door" | "bed" | "piano" | "plant" | "speaker" | "chair" | "fire";
type Thing = {
  kind: Kind;
  /** index into the story (oldest job first), or -1 for scenery */
  memory: number;
  cells: Cell[];
  /** on the wall: drawn with the wall, never in front of the player */
  wall?: boolean;
};

// oldest first
const story = [...jobs].sort((a, b) => a.from - b.from);

const THINGS: Thing[] = [
  { kind: "bed", memory: -1, cells: [["indoor", 14, 6, 1, 3], ["indoor", 15, 6, 2, 3]] },
  { kind: "shelf", memory: 1, cells: [["world", 44, 12, 4, 1], ["world", 45, 12, 5, 1], ["world", 44, 14, 4, 2], ["world", 45, 14, 5, 2]], wall: true },
  { kind: "desk", memory: 2, cells: [["indoor", 0, 0, 7, 3], ["indoor", 1, 0, 8, 3], ["indoor", 2, 0, 9, 3], ["indoor", 0, 1, 7, 4], ["indoor", 1, 1, 8, 4], ["indoor", 2, 1, 9, 4]] },
  { kind: "board", memory: 3, cells: [["indoor", 20, 12, 10, 1], ["indoor", 21, 12, 11, 1]], wall: true },
  { kind: "door", memory: 4, cells: [["world", 33, 1, 14, 2]], wall: true },
  { kind: "box", memory: 0, cells: [["world", 37, 9, 3, 9]] },
  { kind: "piano", memory: -1, cells: [["indoor", 23, 8, 12, 8], ["indoor", 24, 8, 13, 8], ["indoor", 23, 9, 12, 9], ["indoor", 24, 9, 13, 9]] },
  { kind: "speaker", memory: -1, cells: [["indoor", 14, 16, 14, 9]] },
  { kind: "speaker", memory: -1, cells: [["indoor", 12, 17, 11, 9]] },
  { kind: "chair", memory: -1, cells: [["world", 49, 19, 5, 11]] },
  { kind: "plant", memory: -1, cells: [["indoor", 16, 0, 15, 3]] },
  { kind: "plant", memory: -1, cells: [["indoor", 17, 0, 0, 12]] },
  { kind: "plant", memory: -1, cells: [["world", 29, 9, 3, 3]] },
  { kind: "fire", memory: -1, cells: [["world", 54, 8, 1, 2]], wall: true },
];

/** scenery with no collision: windows and pictures on the wall, things on the desk, a chair */
const DECOR: Cell[] = [
  ["world", 42, 4, 2, 1],
  ["world", 42, 4, 13, 1],
  ["indoor", 19, 12, 7, 1],
  ["world", 30, 10, 8, 1],
  ["indoor", 19, 14, 15, 1],
  ["indoor", 0, 2, 8, 5],
];
/** drawn on top of the desk */
const ON_DESK: Cell[] = [
  ["world", 50, 15, 8, 3],
  ["world", 41, 15, 7, 3],
  ["world", 44, 15, 9, 3],
];
const RUG: Cell[] = [];
for (let y = 0; y < 3; y++) for (let x = 0; x < 5; x++) RUG.push(["world", 10 + (x === 0 ? 0 : x === 4 ? 2 : 1), 19 + y, 6 + x, 8 + y]);

function rectOf(th: Thing): Rect {
  const xs = th.cells.map((c) => c[3]);
  const ys = th.cells.map((c) => c[4]);
  const x = Math.min(...xs) * TILE;
  const y = Math.min(...ys) * TILE;
  return { x, y, w: (Math.max(...xs) + 1) * TILE - x, h: (Math.max(...ys) + 1) * TILE - y };
}
const RECTS = THINGS.map(rectOf);

const FLAVOR: Record<Kind, Record<Lang, string>> = {
  box: { id: "Peti berisi game lama. Di sinilah semuanya mulai.", en: "A chest of old games. This is where it all started." },
  shelf: { id: "Rak penuh manga.", en: "A shelf full of manga." },
  desk: { id: "Meja kerja kantor. Penuh berkas.", en: "An office desk, covered in paperwork." },
  board: { id: "Kertas penuh wireframe, ditempel di dinding.", en: "Sheets of wireframes pinned to the wall." },
  door: { id: "Pintu keluar. Di baliknya, pekerjaan yang sekarang.", en: "The way out. Behind it, the job I have now." },
  bed: { id: "Kasur. Belum waktunya tidur.", en: "The bed. Not bedtime yet." },
  piano: { id: profile.likes.id, en: profile.likes.en },
  plant: { id: "Tanaman. Masih hidup, entah bagaimana.", en: "A plant. Still alive, somehow." },
  speaker: { id: "Speaker. Volumenya jangan ditanya.", en: "A speaker. Do not ask about the volume." },
  chair: { id: "Kursi paling nyaman di kamar ini.", en: "The comfiest chair in the room." },
  fire: { id: "Hangat.", en: "Warm." },
};
const LATER: Record<Lang, string> = { id: "Belum waktunya. ", en: "Not yet. " };

type Mode = "title" | "play" | "dialog";

function hit(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function load(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = asset(src);
  });
}

/** Logical picture size of the game, before the TV stretches it to 4:3. */
export const GAME_SIZE = { w: W * SCALE, h: H * SCALE };

/** On-screen pads send their keys here; the game treats them just like the keyboard. */
const touchListeners = new Set<(key: string, down: boolean) => void>();
export function gameTouchKey(key: string, down: boolean) {
  for (const listener of touchListeners) listener(key, down);
}

/**
 * Runs the game on the given canvas until the returned function is called.
 * It listens to the keyboard on `window` and draws every animation frame.
 */
export function startGame(canvas: HTMLCanvasElement, getLang: () => Lang): () => void {
  const ctx = canvas.getContext("2d")!;
  const font = getComputedStyle(document.documentElement).getPropertyValue("--font-screen").trim() || "monospace";
  const keys = new Set<string>();
  const sheets = {} as Record<Sheet, HTMLImageElement>;
  let background: HTMLCanvasElement | null = null;
  const state = {
    mode: "title" as Mode,
    x: 136,
    y: 120,
    dir: 0 as 0 | 1 | 2 | 3, // down, left, right, up
    step: 0,
    progress: 0,
    pages: [] as string[][],
    page: 0,
    shown: 0, // characters revealed on this page
    t: 0,
  };

  const T = () => strings[getLang()];
  const setFont = (px: number) => {
    ctx.font = `${px}px ${font}`;
  };
  const tile = (c: CanvasRenderingContext2D, [sheet, col, row, tx, ty]: Cell, dx = 0, dy = 0) =>
    c.drawImage(sheets[sheet], col * 17, row * 17, TILE, TILE, tx * TILE + dx, ty * TILE + dy, TILE, TILE);

  /** Floor, walls, rug and everything fixed to the wall are painted once. */
  const paintBackground = () => {
    const bg = document.createElement("canvas");
    bg.width = W;
    bg.height = H;
    const c = bg.getContext("2d")!;
    c.imageSmoothingEnabled = false;
    for (let ty = 0; ty < H / TILE; ty++)
      for (let tx = 0; tx < W / TILE; tx++) {
        if (ty < WALL_ROWS) tile(c, ["world", 13, ty === WALL_ROWS - 1 ? 17 : 16, tx, ty]);
        else tile(c, ["world", 34 + ((tx + ty) % 2), 16, tx, ty]);
      }
    // shadow where the wall meets the floor
    const g = c.createLinearGradient(0, WALL, 0, WALL + 10);
    g.addColorStop(0, "rgba(40,20,10,0.35)");
    g.addColorStop(1, "rgba(40,20,10,0)");
    c.fillStyle = g;
    c.fillRect(0, WALL, W, 10);
    RUG.forEach((cell) => tile(c, cell));
    DECOR.forEach((cell) => tile(c, cell));
    THINGS.filter((th) => th.wall).forEach((th) => th.cells.forEach((cell) => tile(c, cell)));
    // warm light pooling in the middle of the room, dark corners
    const v = c.createRadialGradient(W / 2, H / 2 + 10, 40, W / 2, H / 2 + 10, 190);
    v.addColorStop(0, "rgba(255,190,110,0.10)");
    v.addColorStop(1, "rgba(20,10,30,0.42)");
    c.fillStyle = v;
    c.fillRect(0, 0, W, H);
    background = bg;
  };

  const wrapText = (text: string, max: number) => {
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
  };

  /** Splits text into dialogue pages of three lines, with an optional heading page first. */
  const say = (text: string, heading?: string) => {
    setFont(10);
    const lines = wrapText(text, W - 36);
    const pages: string[][] = [];
    for (let i = 0; i < lines.length; i += 3) pages.push(lines.slice(i, i + 3));
    if (heading) pages.unshift([`#${heading}`]);
    state.pages = pages;
    state.page = 0;
    state.shown = 0;
    state.mode = "dialog";
  };

  const inspect = () => {
    // probe a little ahead of the feet, in the direction faced
    const d = [
      [0, 10],
      [-10, 0],
      [10, 0],
      [0, -12],
    ][state.dir];
    const probe = { x: state.x - 5 + d[0], y: state.y - 6 + d[1], w: 10, h: 8 };
    const index = RECTS.findIndex((r, i) => hit(probe, THINGS[i].wall ? { ...r, h: r.h + 8 } : r));
    if (index < 0) return;
    const thing = THINGS[index];
    const l = getLang();
    blip(660);
    if (thing.memory < 0) return say(FLAVOR[thing.kind][l]);
    if (thing.memory > state.progress) return say(LATER[l] + T().game_next_hint);
    const job = story[thing.memory];
    if (thing.memory === state.progress) state.progress++;
    const done = state.progress === story.length && thing.memory === story.length - 1;
    say(
      `${FLAVOR[thing.kind][l]} ${job.title}, ${job.place[l]}. ${job.body[l]}${done ? ` ${T().game_done}` : ""}`,
      `${jobYears(job, l)} · ${job.company}`,
    );
  };

  const press = (k: string, repeat: boolean) => {
    if (repeat) return;
    keys.add(k);
    if (!(k === "Enter" || k === "z" || k === " ")) return;
    if (state.mode === "title") {
      state.mode = "play";
      blip(880, 0.12);
    } else if (state.mode === "dialog") {
      const full = state.pages[state.page].join("\n").length;
      if (state.shown < full) state.shown = full;
      else if (state.page < state.pages.length - 1) {
        state.page++;
        state.shown = 0;
        blip(520);
      } else state.mode = "play";
    } else inspect();
  };
  const onDown = (e: KeyboardEvent) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(k)) e.preventDefault();
    press(k, e.repeat);
  };
  const onUp = (e: KeyboardEvent) => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  const onTouch = (key: string, down: boolean) => (down ? press(key, false) : keys.delete(key));
  touchListeners.add(onTouch);
  window.addEventListener("keydown", onDown);
  window.addEventListener("keyup", onUp);

  const blocked = (x: number, y: number) => {
    const feet = { x: x - 5, y: y - 6, w: 10, h: 6 };
    if (feet.x < 2 || feet.x + feet.w > W - 2 || feet.y < WALL || feet.y + feet.h > H - 2) return true;
    return RECTS.some((r, i) => !THINGS[i].wall && hit(feet, { x: r.x + 1, y: r.y + 4, w: r.w - 2, h: r.h - 5 }));
  };

  const update = (dt: number) => {
    state.t += dt;
    if (state.mode === "dialog") {
      state.shown += dt * 48;
      return;
    }
    if (state.mode !== "play") return;
    let dx = 0;
    let dy = 0;
    if (keys.has("ArrowLeft") || keys.has("a")) dx -= 1;
    if (keys.has("ArrowRight") || keys.has("d")) dx += 1;
    if (keys.has("ArrowUp") || keys.has("w")) dy -= 1;
    if (keys.has("ArrowDown") || keys.has("s")) dy += 1;
    if (dx || dy) {
      state.dir = dy > 0 ? 0 : dy < 0 ? 3 : dx < 0 ? 1 : 2;
      const speed = 62 * dt;
      if (!blocked(state.x + dx * speed, state.y)) state.x += dx * speed;
      if (!blocked(state.x, state.y + dy * speed)) state.y += dy * speed;
      state.step += dt * 8;
    } else state.step = 0;
  };

  const px = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  };

  // the hero is layered from the character sheet: body, trousers, shirt, hair
  const HERO: [number, number][] = [
    [0, 0],
    [3, 0],
    [6, 0],
    [19, 0],
  ];
  const drawPlayer = () => {
    const bob = state.step ? Math.floor(state.step) % 2 : 0;
    const x = Math.round(state.x) - 8;
    const y = Math.round(state.y) - 15 - bob;
    ctx.fillStyle = "rgba(30,15,10,0.3)";
    ctx.beginPath();
    ctx.ellipse(x + 8, Math.round(state.y), 6, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    if (state.dir === 1) {
      // facing left: mirror the sprite
      ctx.translate(x + 16, y);
      ctx.scale(-1, 1);
    } else ctx.translate(x, y);
    for (const [col, row] of HERO) ctx.drawImage(sheets.chars, col * 17, row * 17, TILE, TILE, 0, 0, TILE, TILE);
    ctx.restore();
  };

  const drawText = (text: string, x: number, y: number, color: string, size = 10, align: CanvasTextAlign = "left") => {
    setFont(size);
    ctx.textAlign = align;
    ctx.fillStyle = "#05071c";
    ctx.fillText(text, x + 1, y + 1);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  };

  /** The same blue window the rest of the interface uses. */
  const windowBox = (x: number, y: number, w: number, h: number) => {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "#18246a");
    g.addColorStop(1, "#0c1340");
    px(x - 1, y - 1, w + 2, h + 2, "#05071c");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    px(x, y, w, 1, "#f4f4f8");
    px(x, y + h - 1, w, 1, "#f4f4f8");
    px(x, y, 1, h, "#f4f4f8");
    px(x + w - 1, y, 1, h, "#f4f4f8");
  };

  const draw = () => {
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const t = T();

    if (state.mode === "title") {
      px(0, 0, W, H, "#0b0a12");
      for (let i = 0; i < 40; i++) px((i * 53) % W, (i * 97 + Math.floor(state.t * 6) * (1 + (i % 3))) % H, 1, 1, i % 4 ? "#3b4d78" : "#f7cf8a");
      drawText(t.game_title, W / 2, 92, "#f3e2b8", 22, "center");
      drawText(`${story[0].from} - ${story[story.length - 1].from}`, W / 2, 110, "#ffd75e", 10, "center");
      if (Math.floor(state.t * 2) % 2) drawText(t.game_start, W / 2, 150, "#9ff5c9", 10, "center");
      setFont(8);
      wrapText(t.game_controls, W - 24).forEach((l, i) => drawText(l, W / 2, 196 + i * 10, "#8f8a7c", 8, "center"));
      return;
    }

    if (background) ctx.drawImage(background, 0, 0);
    // free-standing things and the player, back to front
    const order = THINGS.map((th, i) => ({ th, r: RECTS[i] }))
      .filter((o) => !o.th.wall)
      .sort((a, b) => a.r.y + a.r.h - (b.r.y + b.r.h));
    let drawn = false;
    for (const o of order) {
      if (!drawn && o.r.y + o.r.h > state.y) {
        drawPlayer();
        drawn = true;
      }
      px(o.r.x + 1, o.r.y + o.r.h - 2, o.r.w - 2, 3, "rgba(30,15,10,0.25)");
      o.th.cells.forEach((cell) => tile(ctx, cell));
      if (o.th.kind === "desk") ON_DESK.forEach((cell) => tile(ctx, cell, 0, -3));
    }
    if (!drawn) drawPlayer();

    // firelight flickering on the floor in front of the hearth
    const glow = 0.1 + 0.05 * Math.sin(state.t * 9) + 0.03 * Math.sin(state.t * 23);
    const fg = ctx.createRadialGradient(24, WALL + 2, 2, 24, WALL + 2, 46);
    fg.addColorStop(0, `rgba(255,150,60,${glow + 0.12})`);
    fg.addColorStop(1, "rgba(255,150,60,0)");
    ctx.fillStyle = fg;
    ctx.fillRect(0, WALL - 16, 80, 70);

    // sparkle over the next memory
    const next = THINGS.findIndex((th) => th.memory === state.progress);
    if (next >= 0 && Math.floor(state.t * 3) % 2) {
      const r = RECTS[next];
      const sx = r.x + r.w / 2;
      const sy = r.y - 6;
      px(sx - 1, sy - 4, 2, 8, "#fff3c4");
      px(sx - 4, sy - 1, 8, 2, "#fff3c4");
      px(sx - 2, sy - 2, 4, 4, "#ffffff");
    }

    windowBox(W - 88, 3, 85, 14);
    drawText(`${t.game_progress} ${state.progress}/${story.length}`, W - 8, 13, "#f4f4f8", 9, "right");

    if (state.mode === "dialog") {
      const boxY = H - 66;
      windowBox(6, boxY, W - 12, 60);
      const lines = state.pages[state.page];
      let budget = Math.floor(state.shown);
      lines.forEach((raw, i) => {
        const heading = raw.startsWith("#");
        const line = heading ? raw.slice(1) : raw;
        const visible = line.slice(0, Math.max(0, budget));
        budget -= line.length + 1;
        drawText(visible, 16, boxY + 18 + i * 14 + (heading ? 12 : 0), heading ? "#ffd75e" : "#f4f4f8", heading ? 12 : 10);
      });
      if (Math.floor(state.t * 3) % 2) drawText("▼", W - 18, boxY + 52, "#ffd75e", 8);
    }
  };

  let raf = 0;
  let alive = true;
  let last = performance.now();
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    raf = requestAnimationFrame(loop);
  };
  Promise.all([load("/game/world.png"), load("/game/indoor.png"), load("/game/chars.png"), document.fonts.load(`10px ${font}`).catch(() => null)])
    .then(([world, indoor, chars]) => {
      if (!alive) return;
      sheets.world = world;
      sheets.indoor = indoor;
      sheets.chars = chars;
      paintBackground();
      raf = requestAnimationFrame(loop);
    })
    .catch(() => {});

  // development helper: /?...&tv=game&play=1 skips the title screen
  if (new URLSearchParams(location.search).get("play") === "1") state.mode = "play";

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    touchListeners.delete(onTouch);
    window.removeEventListener("keydown", onDown);
    window.removeEventListener("keyup", onUp);
  };
}
