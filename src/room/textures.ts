"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { asset } from "@/asset";

export type Fonts = { hand: string; screen: string; body: string; display: string; script: string; marker: string; black: string; serif: string; poster: string };

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "sans-serif";
}

/** Resolves once the web fonts used for painted textures are loaded, so canvas text uses them. */
export function useFonts(): Fonts | null {
  const [fonts, setFonts] = useState<Fonts | null>(null);
  useEffect(() => {
    const f: Fonts = { hand: cssVar("--font-hand"), screen: cssVar("--font-screen"), body: cssVar("--font-body"), display: cssVar("--font-display"), script: cssVar("--font-script"), marker: cssVar("--font-marker"), black: cssVar("--font-black"), serif: cssVar("--font-serif"), poster: cssVar("--font-poster") };
    let alive = true;
    Promise.all([
      document.fonts.load(`700 32px ${f.hand}`),
      document.fonts.load(`32px ${f.screen}`),
      document.fonts.load(`700 32px ${f.body}`),
      document.fonts.load(`800 32px ${f.display}`),
      document.fonts.load(`400 32px ${f.script}`),
      document.fonts.load(`400 32px ${f.marker}`),
      document.fonts.load(`700 32px ${f.black}`),
      document.fonts.load(`500 32px ${f.serif}`),
      document.fonts.load(`700 32px ${f.serif}`),
      document.fonts.load(`900 32px ${f.poster}`),
      document.fonts.load(`500 32px ${f.poster}`),
    ])
      .catch(() => {})
      .then(() => alive && setFonts(f));
    return () => {
      alive = false;
    };
  }, []);
  return fonts;
}

export function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Memoised canvas texture that is disposed when its inputs change. */
export function useCanvasTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  deps: unknown[],
) {
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo -- callers pass the dependency list
  const tex = useMemo(() => canvasTexture(w, h, draw), deps);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

/** Loads an image for painting into a canvas; null until it has arrived (and always null with no src). */
export function useImage(src: string | undefined) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) return;
    const el = new Image();
    let alive = true;
    el.onload = () => alive && setImg(el);
    el.src = asset(src);
    return () => {
      alive = false;
    };
  }, [src]);
  return src ? img : null;
}

/** Deterministic pseudo-random, so painted wear looks the same on every load. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Wraps text into lines no wider than maxWidth. */
export function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        out.push(line);
        line = word;
      } else line = next;
    }
    out.push(line);
  }
  return out;
}

/** Slightly uneven paper fill with a soft edge shadow. */
export function paper(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, seed = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  const r = rng(seed);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(${r() > 0.5 ? "255,255,255" : "60,40,20"},${0.015 + r() * 0.03})`;
    ctx.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3);
  }
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgba(255,255,255,0.10)");
  g.addColorStop(1, "rgba(80,50,20,0.12)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
