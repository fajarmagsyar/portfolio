import type { Lang } from "@/content/data";
import type { Fonts } from "../textures";

// The pieces every part of KAMAR 3.1 is built from: the screen's size, the palette, and the
// handful of shapes (bevels, buttons, arrows) that everything on it is drawn with.

export const TV_W = 800;
export const TV_H = 600;

export const K = {
  desk: "#0d8a8e",
  frame: "#c3c7cb",
  light: "#ffffff",
  shade: "#868a8e",
  dark: "#000000",
  title: "#000a7b",
  titleText: "#ffffff",
  // not quite white: the tube brightens whatever it shows, and a pure white page bleeds over the type on it
  page: "#d2d4cf",
  ink: "#000000",
  dim: "#3e4246",
  pick: "#000a7b",
};

export type Rect = { x: number; y: number; w: number; h: number };
export const inside = (r: Rect, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A raised or sunken edge, one line of light and one of shade, the way buttons were drawn. */
export function bevel(ctx: CanvasRenderingContext2D, r: Rect, raised = true, depth = 2) {
  for (let i = 0; i < depth; i++) {
    ctx.fillStyle = raised ? K.light : K.shade;
    ctx.fillRect(r.x + i, r.y + i, r.w - i * 2, 1);
    ctx.fillRect(r.x + i, r.y + i, 1, r.h - i * 2);
    ctx.fillStyle = raised ? K.shade : K.light;
    ctx.fillRect(r.x + i, r.y + r.h - 1 - i, r.w - i * 2, 1);
    ctx.fillRect(r.x + r.w - 1 - i, r.y + i, 1, r.h - i * 2);
  }
}

export function button(ctx: CanvasRenderingContext2D, r: Rect, draw: (cx: number, cy: number) => void, pressed = false) {
  ctx.fillStyle = K.dark;
  ctx.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
  ctx.fillStyle = K.frame;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  bevel(ctx, r, !pressed);
  ctx.fillStyle = K.ink;
  draw(r.x + r.w / 2 + (pressed ? 1 : 0), r.y + r.h / 2 + (pressed ? 1 : 0));
}

export function arrow(ctx: CanvasRenderingContext2D, cx: number, cy: number, up: boolean, size = 6) {
  ctx.beginPath();
  ctx.moveTo(cx - size, cy + (up ? size / 2 : -size / 2));
  ctx.lineTo(cx + size, cy + (up ? size / 2 : -size / 2));
  ctx.lineTo(cx, cy + (up ? -size / 2 : size / 2));
  ctx.fill();
}


/**
 * A program that runs in a window. It is handed the inside of its window (`b`, in picture
 * pixels) and paints itself there; the window manager owns the frame around it.
 */
export type Program = {
  /** the size its window opens at, frame included */
  size: [number, number];
  draw: (ctx: CanvasRenderingContext2D, f: Fonts, b: Rect, lang: Lang, front: boolean) => void;
  /** the pointer went down inside the window */
  down?: (x: number, y: number, b: Rect) => void;
  /** the pointer moved; `held` while the button that went down here is still down */
  move?: (x: number, y: number, b: Rect, held: boolean) => void;
  up?: () => void;
  /** a key, while this is the front window. True if it was used. */
  key?: (e: KeyboardEvent) => boolean;
};

// The owner's own mark, the logo of the system: /logo.png, black on clear, painted in whatever colour is asked for.
let markImg: HTMLImageElement | null = null;
const marks = new Map<string, HTMLCanvasElement>();
/** Draws the mark `h` tall with its top left at `x`, `y` in `colour`. False while the file has not loaded, so the caller can draw something else. */
export function drawMark(ctx: CanvasRenderingContext2D, colour: string, x: number, y: number, h: number): boolean {
  if (typeof Image === "undefined") return false;
  if (!markImg) {
    markImg = new Image();
    markImg.src = "/logo.png";
  }
  if (!markImg.complete || !markImg.naturalWidth) return false;
  let tint = marks.get(colour);
  if (!tint) {
    tint = document.createElement("canvas");
    tint.width = markImg.naturalWidth;
    tint.height = markImg.naturalHeight;
    const t = tint.getContext("2d")!;
    t.drawImage(markImg, 0, 0);
    t.globalCompositeOperation = "source-in";
    t.fillStyle = colour;
    t.fillRect(0, 0, tint.width, tint.height);
    marks.set(colour, tint);
  }
  ctx.drawImage(tint, x, y, (h * tint.width) / tint.height, h);
  return true;
}
