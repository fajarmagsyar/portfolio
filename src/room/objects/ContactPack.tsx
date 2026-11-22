"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { asset } from "@/asset";
import { blip, click } from "@/audio/sfx";
import { links, profile, type Lang } from "@/content/data";
import { strings, type StringKey } from "@/content/strings";
import { useLang } from "@/state/lang";
import { hint, SCISSORS } from "../hint";
import { Interactive } from "../Interactive";
import { CARDS_HELD, POS } from "../layout";
import { orbit, resetOrbit } from "../orbit";
import { useRoom } from "../store";
import { holdCancel, holdMove, tap } from "../touch";
import { canvasTexture, paper, rng, useCanvasTexture, useFonts, type Fonts } from "../textures";

// Contact, as a pack of trading cards. It lies sealed on the desk. Looked at, it is held up:
// drag across the top to cut it open (light spills out of the cut as it goes), and the cards
// rise out of it as a stack, backs showing. Clicking the stack takes the top card and turns
// it over; a drag turns the card in the hand about, a click on it opens what it points to,
// and the cards already taken wait to one side. Put down, the cards go back into the opened
// pack, and next time they are simply drawn out of it again.
//
// Model: "Trading Card Pack" by goonmize1 (CC BY 4.0). See CREDITS.md. Its shape and the
// crinkle of its foil are used; what is printed on it is painted here. The cards are made
// here too; the picture on each is one of the files in public/art/cards/.
const PACK = asset("/models/sk/card_pack.glb");

const CARDS = [
  { key: "email", title: "Email", art: "/art/cards/email.jpg", glyph: "@", value: links.email, href: `mailto:${links.email}`, ink: "#b3341f", glow: "#ffb38a", kind: "card_kind_mail", holo: false },
  { key: "github", title: "GitHub", art: "/art/cards/github.jpg", glyph: "</>", value: links.github.label, href: links.github.url, ink: "#2b2a33", glow: "#b9a8ff", kind: "card_kind_code", holo: false },
  { key: "linkedin", title: "LinkedIn", art: "/art/cards/linkedin.jpg", glyph: "in/", value: links.linkedin.label, href: links.linkedin.url, ink: "#1f5f8f", glow: "#8fd0ff", kind: "card_kind_work", holo: false },
  // the rare one of the set: a foil card
  { key: "steam", title: "Steam", art: "/art/cards/steam.jpg", glyph: "GG", value: links.steam.label, href: links.steam.url, ink: "#1f6f66", glow: "#8ff0d0", kind: "card_kind_play", holo: true },
] as const satisfies readonly { key: string; title: string; art: string; glyph: string; value: string; href: string; ink: string; glow: string; kind: StringKey; holo: boolean }[];
type CardInfo = (typeof CARDS)[number];

// a card and the pack it comes in, life size (the card is drawn twice its real thickness, so its edge can be seen)
const CW = 0.063;
const CH = 0.088;
const CT = 0.0007;
const CORNER = 0.0032;
const PW = 0.072;
const PH = 0.137;
const PT = 0.0088;
/** how far up the pack the cut goes, as a share of its height */
const CUT = 0.86;
const CUT_Y = PH * (CUT - 0.5);
/** where the middle of a card is when it is right inside the pack */
const INSIDE_Y = -0.005;
// A pack is a pillow: full between the seams, flat at them. A card as wide as the pack's own
// face would come through the foil near its edges, so inside the pack the cards are drawn a
// little small, and come up to size once they are clear of its mouth.
const SNUG = 0.84;
/** how far up out of the pack the cards are: at rest in the opened pack, with their tops showing; and held clear above it */
const HOME = 0.014;
const ABOVE = 0.128;
/** seconds: coming together over the pack, sliding into it, and rising out of it */
const GATHER = 0.55;
const SLIDE = 0.6;
const RISE = 1.0;

/* ---------- the pictures ---------- */

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Bands of light across a surface, as foil catches it. */
function sheen(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, strength: number) {
  const r = rng(seed);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 9; i++) {
    const x = r() * (w + h) - h;
    const band = 14 + r() * 70;
    ctx.fillStyle = `rgba(255,255,255,${(0.03 + r() * 0.07) * strength})`;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + band, 0);
    ctx.lineTo(x + band + h * 0.6, h);
    ctx.lineTo(x + h * 0.6, h);
    ctx.fill();
  }
  ctx.restore();
}

/** Loads an image for painting into a canvas; null until it has arrived. */
function useImage(src: string) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const el = new Image();
    let alive = true;
    el.onload = () => alive && setImg(el);
    el.src = asset(src);
    return () => {
      alive = false;
    };
  }, [src]);
  return img;
}

/** The owner's logo (black on clear) painted in one colour, `h` tall and centred on `cx`, `cy`. */
function logoMark(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, colour: string, cx: number, cy: number, h: number) {
  if (!logo) return;
  const k = h / logo.height;
  const tint = document.createElement("canvas");
  tint.width = logo.width;
  tint.height = logo.height;
  const t = tint.getContext("2d")!;
  t.drawImage(logo, 0, 0);
  t.globalCompositeOperation = "source-in";
  t.fillStyle = colour;
  t.fillRect(0, 0, tint.width, tint.height);
  ctx.drawImage(tint, cx - (logo.width * k) / 2, cy - h / 2, logo.width * k, h);
}

/** A strip of saw-tooth roofs, as along the foot of the reference card. */
function teeth(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, n: number) {
  const step = w / n;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  for (let i = 0; i < n; i++) {
    ctx.lineTo(x + i * step, y);
    ctx.lineTo(x + (i + 1) * step, y + h);
  }
  ctx.closePath();
  ctx.fill();
}

// The faces are after a trading art card: a black card with a thin rim, a white sheet inside
// it. The name of the card is set small at the top, the picture sits in a ruled box under it,
// then the address in bold, and the small print along the foot.
/** The card's corner, as a share of its width: the rim and the sheet inside it are cut to it, one inside the other. */
const RIM = 11;
const CORNER_PX = (CORNER / CW) * 512;

function drawFace(ctx: CanvasRenderingContext2D, w: number, h: number, card: CardInfo, index: number, lang: Lang, fonts: Fonts | null, art: HTMLImageElement | null, logo: HTMLImageElement | null) {
  const t = strings[lang];
  const ink = "#111112";
  const m = 36; // side margin of everything on the sheet

  // the rim, and the sheet inside it, its corners following the card's own
  ctx.fillStyle = ink;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  rounded(ctx, RIM, RIM, w - RIM * 2, h - RIM * 2, Math.max(2, CORNER_PX - RIM));
  ctx.clip();
  paper(ctx, w, h, "#f6f4ee", index + 3);
  ctx.restore();

  // the picture, in a ruled box
  const ax = m;
  const ay = 80;
  const aw = w - m * 2;
  const ah = 372;
  ctx.save();
  ctx.beginPath();
  ctx.rect(ax, ay, aw, ah);
  ctx.clip();
  const g = ctx.createRadialGradient(w / 2, ay + ah * 0.45, 10, w / 2, ay + ah * 0.45, aw * 0.75);
  g.addColorStop(0, card.glow);
  g.addColorStop(0.55, card.ink);
  g.addColorStop(1, "#0d0d12");
  ctx.fillStyle = g;
  ctx.fillRect(ax, ay, aw, ah);
  if (art) {
    // as much of it as fills the box; a cut-out one (with a clear background) is shown whole, on the glow
    const cutOut = card.art.endsWith(".png");
    const k = cutOut ? Math.min(aw / art.width, ah / art.height) * 0.94 : Math.max(aw / art.width, ah / art.height);
    ctx.drawImage(art, ax + (aw - art.width * k) / 2, ay + (ah - art.height * k) / 2, art.width * k, art.height * k);
  }
  ctx.restore();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 4;
  ctx.strokeRect(ax - 2, ay - 2, aw + 4, ah + 4);

  // the foot: whose cards these are
  const fy = h - 96;
  ctx.fillStyle = ink;
  ctx.fillRect(m, fy - 24, w - m * 2, 2);
  rounded(ctx, m, fy, 44, 44, 6);
  ctx.fill();
  logoMark(ctx, logo, "#f6f4ee", m + 22, fy + 22, 30);
  teeth(ctx, w - m - 118, fy + 28, 118, 16, 8);
  if (!fonts) return;

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = ink;
  ctx.letterSpacing = "1px";
  ctx.font = `800 27px ${fonts.display}`;
  ctx.fillText(card.title.toUpperCase(), m, 56, w - m * 2);

  // the address, as large as the width allows
  ctx.letterSpacing = "0px";
  let size = 40;
  ctx.font = `800 ${size}px ${fonts.display}`;
  while (ctx.measureText(card.value).width > w - m * 2 && size > 18) {
    size -= 2;
    ctx.font = `800 ${size}px ${fonts.display}`;
  }
  ctx.fillText(card.value, m, ay + ah + 54);
  ctx.fillStyle = "#3b3a3d";
  ctx.font = `20px ${fonts.screen}`;
  ctx.letterSpacing = "1px";
  ctx.fillText(t.card_open.toUpperCase(), m, ay + ah + 90);

  ctx.fillStyle = ink;
  ctx.font = `800 14px ${fonts.display}`;
  ctx.letterSpacing = "2px";
  ctx.fillText(profile.name.toUpperCase(), m + 58, fy + 19);
  ctx.font = `14px ${fonts.screen}`;
  ctx.fillStyle = "#3b3a3d";
  ctx.fillText(`${t.contact.toUpperCase()} ${t.pack_cards.toUpperCase()}`, m + 58, fy + 40);
  ctx.letterSpacing = "0px";
}

/**
 * The figure on the back of the card and on the pack: a large diamond, a triangle rising out of
 * it, a circle with its rings and dial ticks, two squares laid across each other, and the owner's
 * mark where the reference has its eye. `k` scales it about `cx`, `cy`; it is drawn in `colour` over `ground`.
 */
function emblem(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, cx: number, cy: number, k: number, colour: string, ground: string) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(k, k);
  ctx.strokeStyle = colour;
  ctx.lineJoin = "miter";
  // the large diamond, and the triangle rising out of it
  const d = 188;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, -d);
  ctx.lineTo(d, 0);
  ctx.lineTo(0, d);
  ctx.lineTo(-d, 0);
  ctx.closePath();
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -214);
  ctx.lineTo(196, 120);
  ctx.lineTo(-196, 120);
  ctx.closePath();
  ctx.stroke();
  // the circle and its rings
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, 126, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 112, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([3, 7]);
  ctx.beginPath();
  ctx.arc(0, 0, 98, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  // two squares across each other: an eight-pointed star
  ctx.lineWidth = 2.5;
  for (const turn of [0, Math.PI / 4]) {
    ctx.save();
    ctx.rotate(turn);
    ctx.strokeRect(-84, -84, 168, 168);
    ctx.restore();
  }
  // ticks round the ring, like the marks of a dial
  ctx.lineWidth = 2;
  for (let i = 0; i < 48; i++) {
    const an = (i / 48) * Math.PI * 2;
    const r1 = i % 4 ? 134 : 144;
    ctx.beginPath();
    ctx.moveTo(Math.cos(an) * 126, Math.sin(an) * 126);
    ctx.lineTo(Math.cos(an) * r1, Math.sin(an) * r1);
    ctx.stroke();
  }
  // the owner's mark, on a ground of its own so the lines stop short of it
  ctx.fillStyle = ground;
  ctx.beginPath();
  ctx.arc(0, 0, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();
  logoMark(ctx, logo, colour, cx, cy, 86 * k);
}

/** The mark in a white square and the name of the set beside it: the head of the back, and of the pack. */
function badge(ctx: CanvasRenderingContext2D, x: number, y: number, lang: Lang, fonts: Fonts | null, logo: HTMLImageElement | null, ground: string) {
  const t = strings[lang];
  ctx.fillStyle = "#f4f2ea";
  ctx.fillRect(x, y, 52, 52);
  logoMark(ctx, logo, ground, x + 26, y + 26, 38);
  if (!fonts) return;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = `800 21px ${fonts.display}`;
  ctx.letterSpacing = "1.5px";
  ctx.fillText(t.contact.toUpperCase(), x + 70, y + 14);
  ctx.fillText(t.pack_cards.toUpperCase(), x + 70, y + 40);
  ctx.letterSpacing = "0px";
}

/** The roofs, three rings and the name along the foot of the back, and of the pack. */
function footer(ctx: CanvasRenderingContext2D, cx: number, y: number, fonts: Fonts | null) {
  ctx.fillStyle = "#f4f2ea";
  ctx.strokeStyle = "#f4f2ea";
  teeth(ctx, cx - 130, y, 150, 24, 7);
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(cx + 58 + i * 20, y + 14, 11, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (!fonts) return;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.font = `800 25px ${fonts.display}`;
  ctx.letterSpacing = "5px";
  ctx.fillText(profile.name.toUpperCase(), cx + 2, y + 68, 440);
  ctx.letterSpacing = "0px";
}

// The back is the reference card's: black, the mark and the name of the set at the top, the
// figure in the middle, and a row of roofs and rings above the name along the foot.
function drawBack(ctx: CanvasRenderingContext2D, w: number, h: number, lang: Lang, fonts: Fonts | null, logo: HTMLImageElement | null) {
  ctx.fillStyle = "#0b0b0c";
  ctx.fillRect(0, 0, w, h);
  badge(ctx, w / 2 - 128, 62, lang, fonts, logo, "#0b0b0c");
  emblem(ctx, logo, w / 2, 350, 1, "#f4f2ea", "#0b0b0c");
  footer(ctx, w / 2, 590, fonts);
}

// The wrapper is the back of the card made large: black, the same head, figure and foot, with
// the crimped foil seals at both ends and the line to cut along under the top one.
function drawPack(ctx: CanvasRenderingContext2D, w: number, h: number, lang: Lang, fonts: Fonts | null, logo: HTMLImageElement | null) {
  ctx.fillStyle = "#0b0b0c";
  ctx.fillRect(0, 0, w, h);
  badge(ctx, w / 2 - 128, h * 0.2, lang, fonts, logo, "#0b0b0c");
  emblem(ctx, logo, w / 2, h * 0.52, 1.06, "#f4f2ea", "#0b0b0c");
  footer(ctx, w / 2, h * 0.8, fonts);
  sheen(ctx, w, h, 11, 1.4);
  // the crimped seals, top and bottom: bare foil
  const seal = h * 0.082;
  for (const y of [0, h - seal]) {
    const g = ctx.createLinearGradient(0, y, 0, y + seal);
    g.addColorStop(0, "#d9d9de");
    g.addColorStop(0.5, "#8d8d96");
    g.addColorStop(1, "#c9c9d0");
    ctx.fillStyle = g;
    ctx.fillRect(0, y, w, seal);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    for (let x = 6; x < w; x += 14) ctx.fillRect(x, y + 6, 4, seal - 12);
  }
  // where to cut
  const cut = h * (1 - CUT);
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 10]);
  ctx.beginPath();
  ctx.moveTo(56, cut);
  ctx.lineTo(w, cut);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = "34px sans-serif";
  ctx.fillText("✂", 10, cut + 2);
}

// Uncoated board, as on the back of a card: a fine even grain, read as relief and as roughness.
let grain: THREE.Texture | null = null;
function board() {
  grain ??= (() => {
    const t = canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = "rgb(200,200,200)";
      ctx.fillRect(0, 0, w, h);
      const r = rng(19);
      for (let i = 0; i < 9000; i++) {
        const v = r() > 0.5 ? 255 : 110;
        ctx.fillStyle = `rgba(${v},${v},${v},${0.08 + r() * 0.2})`;
        ctx.fillRect(r() * w, r() * h, 1 + r() * 2.5, 1);
      }
    });
    t.colorSpace = THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 4);
    return t;
  })();
  return grain;
}

/* ---------- shapes ---------- */

// A card: board with rounded corners. Its two faces are sheets of that outline, laid a hair
// off the board so each can have its own finish, and the board between them shows as the edge.
const cardShape = (() => {
  const s = new THREE.Shape();
  const x = CW / 2;
  const y = CH / 2;
  s.moveTo(-x + CORNER, -y);
  s.lineTo(x - CORNER, -y);
  s.quadraticCurveTo(x, -y, x, -y + CORNER);
  s.lineTo(x, y - CORNER);
  s.quadraticCurveTo(x, y, x - CORNER, y);
  s.lineTo(-x + CORNER, y);
  s.quadraticCurveTo(-x, y, -x, y - CORNER);
  s.lineTo(-x, -y + CORNER);
  s.quadraticCurveTo(-x, -y, -x + CORNER, -y);
  return s;
})();
const cardFace = (() => {
  const g = new THREE.ShapeGeometry(cardShape, 6);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / CW + 0.5, uv.getY(i) / CH + 0.5);
  return g;
})();
const cardBoard = new THREE.ExtrudeGeometry(cardShape, { depth: CT, bevelEnabled: false, curveSegments: 6 }).translate(0, 0, -CT / 2);

/**
 * The pack, from the file: turned to stand upright facing the room, brought to size, and cut
 * in two along the line it is opened at. Its faces are given new places on the picture
 * painted here; where the file had them is kept as a second set, for the crinkle of the foil.
 */
function usePack() {
  const { scene } = useGLTF(PACK);
  return useMemo(() => {
    let found: THREE.Mesh | null = null;
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) found = o as THREE.Mesh;
    });
    const mesh = found as THREE.Mesh | null;
    if (!mesh || !mesh.geometry.index) return null;
    const g = mesh.geometry.clone();
    g.computeBoundingBox();
    const box = g.boundingBox!;
    const size = box.getSize(new THREE.Vector3());
    const mid = box.getCenter(new THREE.Vector3());
    // in the file it lies along x, top towards -x, its width along y
    g.applyMatrix4(
      new THREE.Matrix4()
        .makeScale(PW / size.y, PH / size.x, PT / size.z)
        .multiply(new THREE.Matrix4().makeRotationZ(-Math.PI / 2))
        .multiply(new THREE.Matrix4().makeTranslation(-mid.x, -mid.y, -mid.z)),
    );
    const uv = g.attributes.uv as THREE.BufferAttribute;
    g.setAttribute("uv1", uv.clone());
    const pos = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / PW + 0.5, pos.getY(i) / PH + 0.5);
    const index = g.index!;
    const body: number[] = [];
    const top: number[] = [];
    for (let t = 0; t < index.count; t += 3) {
      const tri = [index.getX(t), index.getX(t + 1), index.getX(t + 2)];
      (tri.reduce((sum, i) => sum + pos.getY(i), 0) / 3 > CUT_Y ? top : body).push(...tri);
    }
    const lower = g.clone();
    lower.setIndex(body);
    const upper = g;
    upper.setIndex(top);
    upper.translate(0, -CUT_Y, 0);
    const file = mesh.material as THREE.MeshStandardMaterial;
    const crinkle = file.normalMap?.clone() ?? null;
    if (crinkle) crinkle.channel = 1;
    return { lower, upper, crinkle };
  }, [scene]);
}

/* ---------- light ---------- */

const flatVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalMatrix * normal;
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

// What comes out of the cut: shafts of warm light standing up from the slit, shifting.
const raysFrag = /* glsl */ `
  uniform float uTime;
  uniform float uPower;
  varying vec2 vUv;
  void main() {
    float shafts = 0.5 + 0.5 * sin(vUv.x * 41.0 + uTime * 3.1) * sin(vUv.x * 17.0 - uTime * 2.3);
    shafts = mix(0.45, 1.0, shafts);
    float rise = pow(1.0 - vUv.y, 2.4);
    float ends = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
    gl_FragColor = vec4(vec3(1.0, 0.84, 0.5) * 3.2 * rise * shafts * ends * uPower, 1.0);
  }
`;

// A foil card: bands of the spectrum that run across the picture as the card is turned.
const holoFrag = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  vec3 spectrum(float h) {
    return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  }
  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(vView);
    // which way the card is tipped decides which colour each part of it throws back
    float tip = n.x * 3.2 + n.y * 2.1;
    float band = vUv.x * 1.1 + vUv.y * 0.8 + tip;
    // two sets of soft bands, one broad and one finer, sliding over each other
    vec3 col = mix(spectrum(fract(band * 1.2)), spectrum(fract(band * 2.6 - vUv.y * 1.4)), 0.3);
    float facing = pow(max(dot(n, v), 0.0), 1.5);
    float wash = 0.6 + 0.4 * sin((vUv.x + vUv.y) * 9.0 + tip * 5.0);
    // kept faint: it is a sheen over the picture, and the picture has to stay readable under it
    gl_FragColor = vec4(col * wash * 0.24 * facing, 1.0);
  }
`;

// there is one pack: what the light from it is told each frame
const LIGHT = { uTime: { value: 0 }, uPower: { value: 0 } };

/* ---------- where things are ---------- */

const HELD_AT = new THREE.Vector3(...CARDS_HELD);
// held up, things face the eye: tipped back a little, as the view looks down on them
const HELD_TURN = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.2, 0, 0));
const DESK_AT = new THREE.Vector3(...POS.cards);
const FLAT = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
const OVER = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0));
const UP = new THREE.Vector3(0, 1, 0);

type Pose = { pos: THREE.Vector3; quat: THREE.Quaternion; scale: number };
const goal: Pose = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), scale: 1 };
const euler = new THREE.Euler();
const spin = new THREE.Quaternion();
const local = new THREE.Vector3();

/** In the hand: x to the right, y up, z towards the eye, about the point things are held at. */
function inHand(x: number, y: number, z: number, rx: number, ry: number, rz: number, scale = 1) {
  goal.pos.set(x, y, z).applyQuaternion(HELD_TURN).add(HELD_AT);
  goal.quat.copy(HELD_TURN).multiply(spin.setFromEuler(euler.set(rx, ry, rz)));
  goal.scale = scale;
}
/** Lying on the desk, turned by `twist`. */
function onDesk(x: number, y: number, z: number, twist: number) {
  goal.pos.set(x, y, z).add(DESK_AT);
  goal.quat.setFromAxisAngle(UP, twist).multiply(FLAT);
  goal.scale = 1;
}
/** In the pack wherever the pack is, its back to the front, `out` of the way up out of its mouth. */
function inPack(pack: THREE.Object3D, out: number, layer: number) {
  goal.pos
    .set(0, INSIDE_Y + out, (layer - 1.5) * 0.0011)
    .multiplyScalar(pack.scale.x)
    .applyQuaternion(pack.quaternion)
    .add(pack.position);
  goal.quat.copy(pack.quaternion).multiply(OVER);
  // full size only once its foot is out of the mouth
  const clear = THREE.MathUtils.clamp((out - 0.094) / 0.03, 0, 1);
  goal.scale = pack.scale.x * (SNUG + (1 - SNUG) * clear * clear * (3 - 2 * clear));
}
function ease(g: THREE.Object3D | null, k: number) {
  if (!g) return;
  g.position.lerp(goal.pos, k);
  g.quaternion.slerp(goal.quat, k);
  g.scale.setScalar(g.scale.x + (goal.scale - g.scale.x) * k);
}
const smooth = (t: number) => t * t * (3 - 2 * t);
const now = () => performance.now() / 1000;

/* ---------- a card ---------- */

function Card({ card, index, fonts, back, bind }: { card: CardInfo; index: number; fonts: Fonts | null; back: THREE.Texture; bind: (g: THREE.Group | null) => void }) {
  const lang = useLang();
  const art = useImage(card.art);
  const logo = useImage("/logo.png");
  const face = useCanvasTexture(512, 716, (ctx, w, h) => drawFace(ctx, w, h, card, index, lang, fonts, art, logo), [card, index, lang, fonts, art, logo]);

  /** in the hand, on the stack, or among those already taken */
  const place = () => {
    const s = useRoom.getState();
    return s.cardHeld === index ? "held" : s.cardsTaken.includes(index) ? "taken" : "stack";
  };
  const ready = () => {
    const s = useRoom.getState();
    return s.focus === "cards" && s.packOpen;
  };

  return (
    <group
      ref={bind}
      visible={false}
      onPointerMove={(e: ThreeEvent<PointerEvent>) => holdMove(e.nativeEvent.clientX, e.nativeEvent.clientY)}
      onPointerUp={holdCancel}
      onPointerCancel={holdCancel}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (!ready()) return;
        e.stopPropagation();
        const held = place() === "held";
        tap(`card-${index}`, null, e.nativeEvent.clientX, e.nativeEvent.clientY, () => {
          const s = useRoom.getState();
          if (held) {
            // mail opens the visitor's own mail program; everything else, a new tab
            window.open(card.href, card.key === "email" ? "_self" : "_blank", "noopener");
            return;
          }
          // a click anywhere on the stack takes the card on top of it
          const next = place() === "stack" ? CARDS.findIndex((_, i) => i !== s.cardHeld && !s.cardsTaken.includes(i)) : index;
          resetOrbit();
          click(1.25);
          s.holdCard(next);
          hint(null);
        });
      }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        if (!ready()) return;
        e.stopPropagation();
        hint(null);
      }}
      onPointerOut={() => {
        if (ready()) hint(null);
      }}
    >
      {/* the board itself: what shows of it is its white edge */}
      <mesh geometry={cardBoard} castShadow>
        <meshStandardMaterial color="#d8d2c4" roughness={0.85} />
      </mesh>
      {/* the front: printed and varnished, so it flashes as it is turned. Partly self-lit, to read in the dark of the room. */}
      <mesh geometry={cardFace} position={[0, 0, CT / 2 + 0.00004]}>
        <meshPhysicalMaterial
          map={face}
          emissiveMap={face}
          emissive="#ffffff"
          emissiveIntensity={0.4}
          color="#8a8a8a"
          roughness={card.holo ? 0.14 : 0.22}
          metalness={card.holo ? 0.45 : 0}
          clearcoat={1}
          clearcoatRoughness={0.08}
          envMapIntensity={card.holo ? 3 : 2}
        />
      </mesh>
      {card.holo && (
        <mesh geometry={cardFace} position={[0, 0, CT / 2 + 0.00008]}>
          <shaderMaterial vertexShader={flatVert} fragmentShader={holoFrag} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {/* the back: plain uncoated board, matt, with the tooth of the paper in it */}
      <mesh geometry={cardFace} position={[0, 0, -CT / 2 - 0.00004]} rotation={[0, Math.PI, 0]}>
        <meshStandardMaterial map={back} emissiveMap={back} emissive="#ffffff" emissiveIntensity={0.5} color="#8a8a8a" roughness={1} roughnessMap={board()} bumpMap={board()} bumpScale={0.6} envMapIntensity={0.25} />
      </mesh>
    </group>
  );
}

/* ---------- the pack, and the whole of it together ---------- */

export function ContactPack() {
  const lang = useLang();
  const fonts = useFonts();
  const logo = useImage("/logo.png");
  const wrap = useCanvasTexture(512, 976, (ctx, w, h) => drawPack(ctx, w, h, lang, fonts, logo), [lang, fonts, logo]);
  const back = useCanvasTexture(512, 716, (ctx, w, h) => drawBack(ctx, w, h, lang, fonts, logo), [lang, fonts, logo]);
  const parts = usePack();

  const pack = useRef<THREE.Group>(null);
  const top = useRef<THREE.Group>(null);
  const slit = useRef<THREE.Mesh>(null);
  const rays = useRef<THREE.Mesh>(null);
  const lamp = useRef<THREE.PointLight>(null);
  const cards = useRef<(THREE.Group | null)[]>([]);
  const state = useRef({
    /** the cut so far: the stretch of the pack's width the blade has been drawn over */
    cut: null as { from: number; to: number } | null,
    /** how far the cut-off top has come away, 0 to 1 */
    torn: 0,
    /** when the cards last began to come out of the pack; before that they are in it */
    out: -1,
    /** how brightly the pack is lit from inside */
    glow: 0,
    wasLive: false,
    wasOpen: false,
    /** when the cards were last put away, the pack being open; before that nothing is being put away */
    away: -1,
    /** where the pack [0] and each card were when they began to be put away */
    from: Array.from({ length: CARDS.length + 1 }, () => ({ pos: new THREE.Vector3(), quat: new THREE.Quaternion(), scale: 1 })),
    /** how the pack was turned when the cut began: it is held still while it is cut */
    turn: { yaw: 0, pitch: 0 },
    /** how far along the cut the last tearing sound was made */
    heard: 0,
  });

  const sealed = () => {
    const s = useRoom.getState();
    return s.focus === "cards" && !s.packOpen;
  };
  /** where the pointer is across the pack, if it is up by the cut line */
  const blade = (e: ThreeEvent<PointerEvent>) => {
    if (!pack.current) return null;
    pack.current.worldToLocal(local.copy(e.point));
    return Math.abs(local.y - CUT_Y) < 0.03 ? THREE.MathUtils.clamp(local.x, -PW / 2, PW / 2) : null;
  };

  useFrame(({ clock }, dt) => {
    const s = useRoom.getState();
    const st = state.current;
    const p = pack.current;
    if (!p) return;
    const live = s.focus === "cards";
    const t = now();
    const k = 1 - Math.exp(-dt * 7);
    LIGHT.uTime.value = clock.elapsedTime;

    // Taken up with the pack already open, or the moment it is cut through, the cards start
    // to come out. One taken up from the desk has to reach the hand first.
    if ((live && !st.wasLive && s.packOpen) || (s.packOpen && !st.wasOpen)) {
      st.out = t + (st.wasOpen ? 0.6 : 0.12);
      st.glow = st.wasOpen ? 0.5 : 1.7;
    }
    // Put down, they all go back in. Where everything is at that moment is where it sets out from.
    if (!live && st.wasLive) {
      st.away = s.packOpen ? t : -1;
      st.from[0].pos.copy(p.position);
      st.from[0].quat.copy(p.quaternion);
      st.from[0].scale = p.scale.x;
      cards.current.forEach((g, i) => {
        if (!g) return;
        st.from[i + 1].pos.copy(g.position);
        st.from[i + 1].quat.copy(g.quaternion);
        st.from[i + 1].scale = g.scale.x;
      });
      if (s.cardHeld !== null || s.cardsTaken.length) s.returnCards();
    }
    if (live) st.away = -1;
    if (!live) st.out = -1;
    st.wasLive = live;
    st.wasOpen = s.packOpen;

    // Putting away, in three steps that each finish before the next begins: the pack comes
    // back up while the cards come together over its mouth as one stack; the stack slides
    // down into it; and then the pack, cards and all, is laid back on the desk.
    const gone = st.away < 0 ? -1 : t - st.away;
    const gathering = gone >= 0 && gone < GATHER;
    const sliding = gone >= GATHER && gone < GATHER + SLIDE;
    // Coming out: straight up out of the mouth together, and only then spreading out.
    const since = st.out < 0 ? -1 : t - st.out;
    const waiting = live && s.packOpen && since < 0;
    const rising = since >= 0 && since < RISE;

    // ----- the pack
    const cutting = st.cut ? (st.cut.to - st.cut.from) / (PW * 0.74) : 0;
    if (st.cut) {
      orbit.yaw = st.turn.yaw;
      orbit.pitch = st.turn.pitch;
    }
    if (gathering || sliding) {
      // exactly, not by easing: the cards are placed against it
      inHand(0, -0.004, 0, 0, 0, 0, 1.08);
      const e = smooth(Math.min(1, gone / (GATHER * 0.8)));
      p.position.lerpVectors(st.from[0].pos, goal.pos, e);
      p.quaternion.slerpQuaternions(st.from[0].quat, goal.quat, e);
      p.scale.setScalar(st.from[0].scale + (goal.scale - st.from[0].scale) * e);
    } else {
      if (!live) onDesk(0, PT / 2 + 0.0005, 0, 0.22);
      // sealed, it can be turned over in the hand like anything else picked up
      else if (!s.packOpen) inHand(Math.sin(t * 47) * 0.0009 * cutting, -0.004, 0, orbit.pitch, -orbit.yaw, Math.sin(t * 39) * 0.012 * cutting, 1.08);
      else if (waiting || rising) inHand(0, -0.004, 0, 0, 0, 0, 1.08);
      // empty, it is held down out of the way
      else inHand(0.02, -0.21, -0.05, 0.5, 0, 0.2, 1.05);
      ease(p, waiting ? 1 - Math.exp(-dt * 11) : k);
    }

    // its top: lifting as the cut runs along under it, then thrown off, tumbling
    st.torn = s.packOpen ? Math.min(1, st.torn + dt / 0.85) : 0;
    if (top.current) {
      const f = st.torn;
      top.current.visible = f < 1;
      top.current.position.set(f * 0.07, CUT_Y + cutting * 0.003 + f * 0.09 - f * f * 0.16, f * 0.05);
      top.current.rotation.set(-f * 2.6, f * 0.8, -cutting * 0.05 - f * 2.2);
      top.current.scale.setScalar(f < 0.7 ? 1 : 1 - (f - 0.7) / 0.3);
    }

    // the light inside: it shows through the cut as far as the cut has got, floods out when the top goes, and dies down
    st.glow = Math.max(0, st.glow - dt * (st.glow > 1 ? 1.6 : 0.75));
    const power = s.packOpen ? (waiting ? 0 : st.glow) : live ? cutting * 0.9 + (st.cut ? 0.25 : 0) : 0;
    const from = s.packOpen || !st.cut ? -PW / 2 : st.cut.from;
    const to = s.packOpen || !st.cut ? PW / 2 : st.cut.to;
    LIGHT.uPower.value += (power - LIGHT.uPower.value) * (1 - Math.exp(-dt * 12));
    const lit = LIGHT.uPower.value;
    if (slit.current) {
      slit.current.visible = !s.packOpen && !!st.cut;
      slit.current.position.x = (from + to) / 2;
      slit.current.scale.x = Math.max(0.0005, to - from);
    }
    if (rays.current) {
      rays.current.visible = lit > 0.01;
      rays.current.position.x = (from + to) / 2;
      rays.current.scale.set(Math.max(0.004, (to - from) * 1.35), 0.05 + lit * 0.09, 1);
    }
    if (lamp.current) lamp.current.intensity = lit * 0.9;

    // ----- the cards
    const left = CARDS.map((_, i) => i).filter((i) => i !== s.cardHeld && !s.cardsTaken.includes(i));
    CARDS.forEach((_, i) => {
      const g = cards.current[i];
      if (!g) return;
      g.visible = s.packOpen;
      /** fixed to the pack, this far up out of it: they move as part of it, so nothing can lag or pass through it */
      const fixed = (out: number) => {
        inPack(p, out, i);
        g.position.copy(goal.pos);
        g.quaternion.copy(goal.quat);
        g.scale.setScalar(goal.scale);
      };
      if (!s.packOpen) return fixed(0);
      if (gathering) {
        inPack(p, ABOVE, i);
        const e = smooth(gone / GATHER);
        g.position.lerpVectors(st.from[i + 1].pos, goal.pos, e);
        g.quaternion.slerpQuaternions(st.from[i + 1].quat, goal.quat, e);
        g.scale.setScalar(st.from[i + 1].scale + (goal.scale - st.from[i + 1].scale) * e);
        return;
      }
      if (sliding) return fixed(ABOVE + (HOME - ABOVE) * smooth((gone - GATHER) / SLIDE));
      if (!live || waiting) return fixed(HOME);
      if (rising) return fixed(HOME + (ABOVE - HOME) * smooth(since / (RISE - 0.1)));

      const held = s.cardHeld === i;
      const taken = s.cardsTaken.indexOf(i);
      const depth = left.indexOf(i);
      // in the hand: the drag turns it about, right round to its back if wanted
      if (held) inHand(-0.012, 0.002, 0.07, orbit.pitch, -orbit.yaw, 0, 1.3);
      else if (taken >= 0) inHand(-0.118 + taken * 0.016, -0.03 - taken * 0.006, -0.02 + taken * 0.003, 0, 0.25, 0.16 - taken * 0.1, 0.6);
      // the stack, backs showing, each card a hair askew
      else inHand(0.098 + depth * 0.0012, 0.004 - depth * 0.001, -depth * 0.0022, 0, Math.PI - 0.22, ((i * 37) % 7) * 0.012 - 0.03, 1);
      ease(g, held ? 1 - Math.exp(-dt * 11) : k);
    });
  });

  const foil = (
    <meshStandardMaterial
      map={wrap}
      emissiveMap={wrap}
      emissive="#ffffff"
      emissiveIntensity={0.3}
      color="#9a9a9a"
      metalness={0.8}
      roughness={0.22}
      normalMap={parts?.crinkle ?? null}
      normalScale={new THREE.Vector2(0.5, 0.5)}
      envMapIntensity={2.2}
      side={THREE.DoubleSide}
    />
  );

  return (
    <Interactive target="cards">
      <group
        ref={pack}
        position={DESK_AT}
        quaternion={FLAT}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          if (!sealed()) return;
          e.stopPropagation();
          if (!tap("pack-cut", null, e.nativeEvent.clientX, e.nativeEvent.clientY, () => {})) return;
          (e.target as Element).setPointerCapture(e.pointerId);
          const x = blade(e);
          state.current.cut = x === null ? null : { from: x, to: x };
          state.current.heard = 0;
          state.current.turn = { yaw: orbit.yaw, pitch: orbit.pitch };
        }}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          holdMove(e.nativeEvent.clientX, e.nativeEvent.clientY);
          if (!sealed()) return;
          e.stopPropagation();
          const x = blade(e);
          document.body.style.cursor = x !== null || state.current.cut ? SCISSORS : "grab";
          // the cut only counts while the button is down and the blade is on the line
          if (!(e.buttons & 1) || x === null) return;
          const st = state.current;
          if (!st.cut) return;
          const c = st.cut;
          c.from = Math.min(c.from, x);
          c.to = Math.max(c.to, x);
          // the foil gives with a run of small tearing sounds
          if (c.to - c.from > st.heard + PW * 0.07) {
            st.heard = c.to - c.from;
            click(0.5 + Math.random() * 0.5);
          }
          if (c.to - c.from > PW * 0.74) {
            st.cut = null;
            click(0.45);
            blip(392, 0.12);
            setTimeout(() => blip(784, 0.2), 90);
            resetOrbit();
            hint(null);
            useRoom.getState().openPack();
          }
        }}
        onPointerUp={(e: ThreeEvent<PointerEvent>) => {
          holdCancel();
          (e.target as Element).releasePointerCapture?.(e.pointerId);
          state.current.cut = null;
        }}
        onPointerCancel={() => {
          holdCancel();
          state.current.cut = null;
        }}
        onPointerOut={() => {
          if (sealed()) hint(null);
        }}
      >
        {parts && (
          <>
            <mesh geometry={parts.lower} castShadow receiveShadow>
              {foil}
            </mesh>
            <group ref={top} position={[0, CUT_Y, 0]}>
              <mesh geometry={parts.upper} castShadow>
                {foil}
              </mesh>
            </group>
          </>
        )}
        {/* the cut as far as it has got: a line of the light inside */}
        <mesh ref={slit} position={[0, CUT_Y, PT / 2 + 0.0006]} visible={false}>
          <planeGeometry args={[1, 0.0014]} />
          <meshBasicMaterial color={[6, 5, 3.4]} toneMapped={false} />
        </mesh>
        {/* and what comes out of it */}
        <mesh ref={rays} position={[0, CUT_Y, PT / 2 + 0.001]} visible={false}>
          <planeGeometry args={[1, 1]} onUpdate={(g) => g.translate(0, 0.5, 0)} />
          <shaderMaterial vertexShader={flatVert} fragmentShader={raysFrag} uniforms={LIGHT} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
        <pointLight ref={lamp} position={[0, CUT_Y + 0.01, 0.03]} color="#ffcf8a" intensity={0} distance={1.1} decay={1.6} />
      </group>
      {CARDS.map((c, i) => (
        <Card
          key={c.key}
          card={c}
          index={i}
          fonts={fonts}
          back={back}
          bind={(g) => {
            cards.current[i] = g;
          }}
        />
      ))}
    </Interactive>
  );
}

useGLTF.preload(PACK);
