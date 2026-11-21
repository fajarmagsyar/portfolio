import { photos } from "@/content/photos";

// How the photo album is laid out. A "leaf" is one sheet that turns; leaf 0 is the front cover.
// Photos go two to a page, on both sides of every inner leaf and on the inside of the back cover.
export const PER_PAGE = 2;
export const PAGES = Math.max(1, Math.ceil(photos.length / PER_PAGE));
/** inner leaves, not counting the covers */
export const LEAVES = Math.max(1, Math.ceil((PAGES - 1) / 2));
/** leaves turned over when the album is open at its last spread */
export const MAX_TURNED = LEAVES + 1;

const PALETTES = [
  { sky: ["#f3b56a", "#d9774a", "#5b3550"], sun: "#ffe9c2", hills: ["#6b3f4d", "#3f2a3c", "#1d1722"] },
  { sky: ["#9fd6d2", "#4f9aa6", "#1f4a5e"], sun: "#f4fbf2", hills: ["#2f6672", "#1c4352", "#0e2530"] },
  { sky: ["#f1d9b0", "#d9a57a", "#8a6a6a"], sun: "#fff6dc", hills: ["#8c6f62", "#5a4744", "#2c2424"] },
  { sky: ["#2c4a6e", "#6a5a86", "#e08a6a"], sun: "#ffd9a8", hills: ["#3a3558", "#231f3a", "#110f1e"] },
  { sky: ["#cfe3d6", "#86b3a0", "#3f6f66"], sun: "#fdfbe8", hills: ["#4f7f6a", "#2e5548", "#152d27"] },
];

/** Draws the stand-in for a photo that has not been added yet: a quiet landscape, different for each slot. */
export function drawPlaceholder(ctx: CanvasRenderingContext2D, w: number, h: number, index: number, label: string) {
  const pal = PALETTES[index % PALETTES.length];
  const seed = index * 7.31 + 1.7;
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.8);
  pal.sky.forEach((c, i) => sky.addColorStop(i / (pal.sky.length - 1), c));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  // the sun, with a wide soft glow
  const sx = w * (0.22 + 0.56 * ((Math.sin(seed * 3.1) + 1) / 2));
  const sy = h * (0.3 + 0.16 * ((Math.sin(seed * 1.3) + 1) / 2));
  const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, h * 0.55);
  glow.addColorStop(0, "rgba(255,244,220,0.55)");
  glow.addColorStop(1, "rgba(255,244,220,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = pal.sun;
  ctx.beginPath();
  ctx.arc(sx, sy, h * 0.065, 0, Math.PI * 2);
  ctx.fill();
  // three ranges of hills, each nearer and darker, with haze between them
  pal.hills.forEach((c, layer) => {
    const base = h * (0.58 + layer * 0.13);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i <= 48; i++) {
      const u = i / 48;
      const y = base - h * (0.07 - layer * 0.012) * (Math.sin(u * (3.1 + layer * 1.7) + seed * (layer + 1)) + 0.5 * Math.sin(u * (7.3 + layer * 2.9) + seed * 2.3 + layer));
      ctx.lineTo(u * w, y);
    }
    ctx.lineTo(w, h);
    ctx.fill();
    const haze = ctx.createLinearGradient(0, base - h * 0.1, 0, base + h * 0.14);
    haze.addColorStop(0, "rgba(255,240,220,0)");
    haze.addColorStop(1, `rgba(255,240,220,${0.14 - layer * 0.04})`);
    ctx.fillStyle = haze;
    ctx.fillRect(0, base - h * 0.1, w, h * 0.24);
  });
  // film grain and a soft vignette
  for (let i = 0; i < (w * h) / 90; i++) {
    const a = Math.sin(i * 12.9898 + seed) * 43758.5453;
    const b = Math.sin(i * 78.233 + seed) * 12543.531;
    ctx.fillStyle = `rgba(${i % 2 ? "255,255,255" : "0,0,0"},0.05)`;
    ctx.fillRect((a - Math.floor(a)) * w, (b - Math.floor(b)) * h, w / 420, w / 420);
  }
  const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.72);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.38)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,248,235,0.78)";
  ctx.font = `${Math.round(h * 0.04)}px monospace`;
  ctx.fillText(`${String(index + 1).padStart(2, "0")}  ${label.toUpperCase()}`, w * 0.045, h * 0.94);
}
