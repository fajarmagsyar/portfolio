"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { asset } from "@/asset";
import { hasDisc, next, pause, play, prev, stop, usePlayer } from "@/audio/player";
import { blip, click, whirr } from "@/audio/sfx";
import { projects, type Lang, type Project } from "@/content/data";
import { strings } from "@/content/strings";
import { useLang } from "@/state/lang";
import { Interactive } from "../Interactive";
import { POS, SHELF } from "../layout";
import { hint } from "../hint";
import { held as heldClick } from "../held";
import { useRoom } from "../store";
import { holdCancel, holdMove, holdStart, tap } from "../touch";
import { canvasTexture, paper, rng, useCanvasTexture, useFonts, wrap, type Fonts } from "../textures";
import { useClone } from "./Guitar";
import { HitBox } from "./Props";

// Model: "Sony Discman D-121 Final" by Jacques C. Valentin (CC BY 4.0). See CREDITS.md.
// Model: "CD with Jewel Case BULLY" by YE YE (CC BY 4.0). See CREDITS.md. Only the case is
// used: its two halves are taken apart so the lid can swing on its hinge, and shut it stands
// in a row like a book, spine out. The disc, the leaflet and what is printed on them are made here.
const DISCMAN = asset("/models/sk/discman.glb");
const CASE = asset("/models/sk/cd_case.glb");

// a jewel case, life size
const CW = 0.142;
const CH = 0.125;
const CT = 0.0104;

function drawCover(ctx: CanvasRenderingContext2D, w: number, h: number, p: Project, index: number, lang: Lang, fonts: Fonts | null) {
  const r = rng(index * 97 + 11);
  ctx.fillStyle = p.disc;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  for (let i = 0; i < 9; i++) {
    ctx.lineWidth = 2 + r() * 10;
    ctx.beginPath();
    ctx.arc(w * 0.72, h * 0.66, 40 + i * 46, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (!fonts) return;
  const t = strings[lang];
  ctx.fillStyle = "#f4ead6";
  ctx.font = `150px ${fonts.screen}`;
  ctx.fillText(String(index + 1).padStart(2, "0"), w * 0.08, h * 0.34);
  ctx.font = `700 42px ${fonts.body}`;
  wrap(ctx, p.name ?? t.empty_slot.toUpperCase(), w * 0.84).forEach((line, i) => ctx.fillText(line, w * 0.08, h * 0.5 + i * 48));
  ctx.font = `26px ${fonts.screen}`;
  ctx.fillStyle = "rgba(244,234,214,0.8)";
  ctx.fillText(p.name ? (p.year ?? "") : "PROTOTYPE", w * 0.08, h * 0.93);
}

function drawSpine(ctx: CanvasRenderingContext2D, w: number, h: number, p: Project, index: number, lang: Lang, fonts: Fonts | null) {
  ctx.fillStyle = p.disc;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fillRect(0, 0, w, 70);
  if (!fonts) return;
  // lettering runs down the spine, as on any CD
  ctx.translate(w / 2, 0);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = "#f4ead6";
  ctx.textBaseline = "middle";
  ctx.font = `34px ${fonts.screen}`;
  ctx.fillText(String(index + 1).padStart(2, "0"), 14, 2);
  ctx.font = `700 34px ${fonts.body}`;
  ctx.fillText(p.name ?? strings[lang].empty_slot.toUpperCase(), 92, 2, h - 110);
}

/** Loads an image for painting into a canvas; null until it has arrived. */
function useImage(src: string | undefined) {
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

// The leaflet that comes folded inside the lid, where an album keeps its lyrics. Here it
// carries the project: what it is on the left-hand page, screenshots on the right.
const LEAF = { w: 0.118, h: 0.119 }; // one page of the two: folded, it is the booklet behind the lid
/** how much larger it is held up to be read than it is in the case */
const HELD = 1.36;

function drawLeafLeft(ctx: CanvasRenderingContext2D, w: number, h: number, p: Project, index: number, lang: Lang, fonts: Fonts | null) {
  paper(ctx, w, h, "#efe7d4", index + 60);
  ctx.fillStyle = p.disc;
  ctx.fillRect(0, 0, w, 14);
  if (!fonts) return;
  const t = strings[lang];
  const m = 40;
  ctx.textAlign = "left";
  ctx.fillStyle = p.disc;
  ctx.font = `30px ${fonts.screen}`;
  ctx.fillText(`CD ${String(index + 1).padStart(2, "0")}${p.year ? `  /  ${p.year}` : ""}`, m, 78);
  ctx.fillStyle = "#1d1712";
  ctx.font = `700 46px ${fonts.body}`;
  let y = 140;
  for (const line of wrap(ctx, p.name ?? t.empty_slot, w - m * 2).slice(0, 2)) {
    ctx.fillText(line, m, y);
    y += 52;
  }
  ctx.fillStyle = "rgba(60,40,20,0.3)";
  ctx.fillRect(m, y - 22, w - m * 2, 2);
  y += 22;
  ctx.fillStyle = "#2a2018";
  ctx.font = `500 25px ${fonts.body}`;
  for (const line of wrap(ctx, p.body ? p.body[lang] : t.empty_slot_body, w - m * 2).slice(0, 9)) {
    ctx.fillText(line, m, y);
    y += 35;
  }
  // what it is built with, as a row of small labels
  y += 14;
  ctx.font = `19px ${fonts.screen}`;
  let x = m;
  for (const tech of p.tech) {
    const tw = ctx.measureText(tech).width + 20;
    if (x + tw > w - m) {
      x = m;
      y += 38;
    }
    ctx.strokeStyle = "rgba(60,40,20,0.5)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y - 22, tw, 30);
    ctx.fillStyle = "#4a3a22";
    ctx.fillText(tech, x + 10, y);
    x += tw + 8;
  }
  // the press that covered it, along the foot of the page (above the link when there is one)
  if (p.coverage?.length) {
    ctx.fillStyle = "#4a3a22";
    ctx.font = `19px ${fonts.screen}`;
    ctx.fillText(`${t.covered_by.toUpperCase()}:  ${p.coverage.map((c) => c.name).join("  /  ")}`, m, p.url ? h - 66 : h - 34, w - m * 2);
  }
  if (p.url) {
    ctx.fillStyle = p.disc;
    ctx.font = `21px ${fonts.screen}`;
    ctx.fillText(p.url.replace(/^https?:\/\//, ""), m, h - 34, w - m * 2);
  }
}

function drawLeafRight(ctx: CanvasRenderingContext2D, w: number, h: number, p: Project, index: number, lang: Lang, fonts: Fonts | null, shots: (HTMLImageElement | null)[]) {
  paper(ctx, w, h, "#efe7d4", index + 80);
  // the fold falls into shadow
  const g = ctx.createLinearGradient(0, 0, 60, 0);
  g.addColorStop(0, "rgba(40,24,8,0.28)");
  g.addColorStop(1, "rgba(40,24,8,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 60, h);
  const m = 36;
  const have = shots.filter((s): s is HTMLImageElement => !!s);
  const n = Math.max(1, Math.min(2, p.shots?.length ?? 0));
  const boxH = (h - m * 2 - (n - 1) * 22) / n;
  for (let i = 0; i < n; i++) {
    const bx = m;
    const by = m + i * (boxH + 22);
    const bw = w - m * 2;
    const img = have[i];
    if (img) {
      // the whole screenshot, as large as fits, on a dark mount
      ctx.fillStyle = "#15120f";
      ctx.fillRect(bx, by, bw, boxH);
      const k = Math.min((bw - 12) / img.width, (boxH - 12) / img.height);
      ctx.drawImage(img, bx + (bw - img.width * k) / 2, by + (boxH - img.height * k) / 2, img.width * k, img.height * k);
    } else {
      ctx.strokeStyle = "rgba(60,40,20,0.45)";
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      ctx.strokeRect(bx, by, bw, boxH);
      ctx.setLineDash([]);
      if (fonts) {
        ctx.fillStyle = "rgba(60,40,20,0.6)";
        ctx.textAlign = "center";
        ctx.font = `22px ${fonts.screen}`;
        ctx.fillText(strings[lang].shots_missing, w / 2, by + boxH / 2 + 8, bw - 20);
      }
    }
  }
}

/** A grey sheet made once and kept: read as data, not colour, and tiled. */
function dataTexture(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void) {
  const t = canvasTexture(size, size, (ctx) => draw(ctx, size));
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Polystyrene that has been in and out of a shelf for years: mostly glossy, crossed by fine
// scratches and a few scuffs that are duller than the rest. Light is rough, dark is smooth.
let scratched: THREE.Texture | null = null;
function scratches() {
  scratched ??= dataTexture(512, (ctx, s) => {
    ctx.fillStyle = "rgb(46,46,46)";
    ctx.fillRect(0, 0, s, s);
    const r = rng(77);
    for (let i = 0; i < 26; i++) {
      // scuffs: soft dull patches
      const g = ctx.createRadialGradient(r() * s, r() * s, 0, r() * s, r() * s, 30 + r() * 70);
      g.addColorStop(0, `rgba(170,170,170,${0.12 + r() * 0.2})`);
      g.addColorStop(1, "rgba(170,170,170,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }
    for (let i = 0; i < 900; i++) {
      // hairline scratches, mostly running one way, as from sliding in and out
      const x = r() * s;
      const y = r() * s;
      const a = (r() - 0.5) * 0.5 + (r() > 0.85 ? r() * 3 : 0);
      const len = 8 + r() * 90;
      ctx.strokeStyle = `rgba(255,255,255,${0.15 + r() * 0.55})`;
      ctx.lineWidth = 0.5 + r() * 0.9;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
  });
  return scratched;
}

// The tooth of uncoated paper: fibres, a little cockle, and the crease left by having
// been folded small. Used as relief and as roughness.
let tooth: THREE.Texture | null = null;
function paperTooth() {
  tooth ??= dataTexture(512, (ctx, s) => {
    ctx.fillStyle = "rgb(150,150,150)";
    ctx.fillRect(0, 0, s, s);
    const r = rng(31);
    for (let i = 0; i < 14; i++) {
      const g = ctx.createRadialGradient(r() * s, r() * s, 0, r() * s, r() * s, 60 + r() * 120);
      const v = r() > 0.5 ? 205 : 95;
      g.addColorStop(0, `rgba(${v},${v},${v},0.22)`);
      g.addColorStop(1, `rgba(${v},${v},${v},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }
    for (let i = 0; i < 5200; i++) {
      const v = r() > 0.5 ? 235 : 70;
      ctx.strokeStyle = `rgba(${v},${v},${v},${0.1 + r() * 0.25})`;
      ctx.lineWidth = 0.6 + r() * 0.6;
      const x = r() * s;
      const y = r() * s;
      const a = r() * Math.PI;
      const len = 3 + r() * 11;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
    // it was folded in half again to fit the case: a crease across the middle, sharp and raised
    for (const [y, w, v] of [
      [s / 2 - 3, 3, 60],
      [s / 2, 3, 245],
    ] as const) {
      ctx.fillStyle = `rgba(${v},${v},${v},0.55)`;
      ctx.fillRect(0, y, s, w);
    }
  });
  return tooth;
}

// The playing side of a compact disc. The pits are a spiral fine enough to split light
// like a prism: each lamp in the room shows as a pair of rainbow wedges that swing round
// the disc as it, or the eye, moves, with a white glint down the middle of each.
const discVert = /* glsl */ `
  varying vec2 vP;
  varying vec3 vWorld;
  varying vec3 vRadial;
  varying vec3 vNormalW;
  void main() {
    vP = position.xy;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vRadial = mat3(modelMatrix) * vec3(position.xy, 0.0);
    vNormalW = mat3(modelMatrix) * vec3(0.0, 0.0, 1.0);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const discFrag = /* glsl */ `
  uniform float uRadius;
  uniform vec3 uLights[3];
  uniform vec3 uTints[3];
  varying vec2 vP;
  varying vec3 vWorld;
  varying vec3 vRadial;
  varying vec3 vNormalW;

  vec3 spectrum(float h) {
    return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  }

  void main() {
    float r = length(vP) / uRadius;
    if (r < 0.125 || r > 1.0) discard;
    vec3 n = normalize(vNormalW);
    vec3 view = normalize(cameraPosition - vWorld);
    // the grooves run round the disc: across the radius
    vec3 groove = normalize(cross(n, normalize(vRadial)));
    vec3 rainbow = vec3(0.0);
    float glint = 0.0;
    for (int i = 0; i < 3; i++) {
      vec3 h = normalize(normalize(uLights[i] - vWorld) + view);
      float u = abs(dot(groove, h));     // how far round from where this lamp mirrors straight back
      float facing = max(dot(n, h), 0.0);
      // straight back the light is white. Either side of that it is spread once into its
      // colours, violet nearest and red furthest, the way a grating throws its first order;
      // then a second, fainter spread beyond.
      float t1 = (u - 0.05) / 0.42 + (r - 0.7) * 0.12;
      float t2 = (u - 0.56) / 0.4;
      vec3 first = spectrum(mix(0.74, 0.0, clamp(t1, 0.0, 1.0))) * smoothstep(0.0, 0.14, t1) * smoothstep(1.0, 0.78, t1);
      vec3 second = spectrum(mix(0.74, 0.0, clamp(t2, 0.0, 1.0))) * smoothstep(0.0, 0.2, t2) * smoothstep(1.0, 0.7, t2) * 0.3;
      rainbow += (first + second) * facing * uTints[i];
      glint += pow(max(1.0 - u * 16.0, 0.0), 2.0) * facing * dot(uTints[i], vec3(0.34));
    }
    // the parts of a disc, from the hole outwards: clear hub, mirror band, the recorded area, the rim
    float hub = 1.0 - smoothstep(0.26, 0.275, r);
    float band = smoothstep(0.275, 0.29, r) * (1.0 - smoothstep(0.375, 0.39, r));
    float data = smoothstep(0.39, 0.4, r) * (1.0 - smoothstep(0.965, 0.98, r));
    // away from the colours a disc is a dark mirror: it shows the dim room
    vec3 silver = vec3(0.13, 0.14, 0.16) * (0.5 + 0.5 * max(dot(n, view), 0.0));
    vec3 col = silver * (data + band * 1.3) + vec3(0.07, 0.075, 0.08) * hub;
    col += rainbow * (data * 0.95 + band * 0.12);
    col += vec3(glint) * (data * 0.9 + band * 1.2 + hub * 0.2);
    // the fine rings you can see on a pressed disc
    col *= 1.0 - 0.06 * data * step(0.5, fract(r * 46.0));
    gl_FragColor = vec4(col, hub > 0.5 ? 0.5 : 1.0);
  }
`;
// where the light comes from, and its colour: the desk lamp, the tube, the Saturn lamp
const discUniforms = {
  uRadius: { value: 0.06 },
  uLights: { value: [new THREE.Vector3(-0.32, 1.36, -0.28), new THREE.Vector3(-0.1, 1.02, 0.1), new THREE.Vector3(0.92, 0.9, -0.18)] },
  uTints: { value: [new THREE.Vector3(1.0, 0.9, 0.75), new THREE.Vector3(0.45, 0.6, 0.65), new THREE.Vector3(0.5, 0.36, 0.22)] },
};

const target = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
const inLid = new THREE.Vector3();
const held = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const tmp = new THREE.Quaternion();
const v = new THREE.Vector3();
// on the shelf the case is turned a quarter round, so its hinge edge is the spine facing the room
const SHELVED = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
const SHOWN = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.2, 0, 0));
const ease = (t: number) => t * t * (3 - 2 * t);

// The case in the file, in its own units: it stands on edge, 2.2 wide (along z, with the hinge
// at the +z end), 2 tall, and 0.103 thick (along x, the lid towards +x). Both halves fill the
// same thickness: the lid is a shell that closes over the tray. It is rather thinner than a
// real case, so it is scaled up through its thickness to the 10.4 mm the shelf is spaced for.
const FILE = { wide: 2.2, tall: 2, thick: 0.1029, midZ: 0.0053 };
const CASE_SCALE: [number, number, number] = [CT / FILE.thick, CH / FILE.tall, CW / FILE.wide];
/** turns the file's case to lie as the code expects: width across, cover to the front, hinge on the left */
const CASE_TURN: [number, number, number] = [0, -Math.PI / 2, 0];
/** how far in front of the middle of the case the top of the tray is, where the disc lies */
const DISC_Z = 0.0105 * CASE_SCALE[0] + 0.0005;
/** and the folded leaflet, just behind the front of the lid */
const LEAF_Z = 0.0031;

/** The two halves of the case, each a copy of the file's, the lid shut and hinged at its own origin. */
function useCase(clear: THREE.Material) {
  const { scene } = useGLTF(CASE);
  return useMemo(() => {
    const all: THREE.Object3D[] = [];
    scene.clone(true).traverse((o) => all.push(o));
    const tray = all.find((o) => /case.?back/i.test(o.name));
    const lid = all.find((o) => /case.?front/i.test(o.name));
    if (!tray || !lid) return null;
    lid.removeFromParent();
    for (const part of [tray, lid])
      part.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const name = (m.material as THREE.Material).name;
        if (name === "Cover") {
          // the file's own printed cover: here the leaflet behind the lid is the cover
          m.visible = false;
        } else if (name === "Translucent") {
          // the file has the clear plastic as a solid pale blue
          m.material = clear;
          m.renderOrder = 2;
        } else {
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
    tray.position.set(0, 0, -FILE.midZ);
    tray.rotation.set(0, 0, 0);
    tray.scale.setScalar(1);
    // in the file the lid stands part open; shut, it lies in the same plane as the tray
    lid.position.set(0, 0, 0);
    lid.rotation.set(0, 0, -Math.PI / 2);
    lid.scale.setScalar(1);
    return { tray, lid };
  }, [scene, clear]);
}

// A page of the leaflet is a sheet cut into a grid so it can bend both ways. Folded, the
// left-hand page lies over the right-hand one with the cover on its back; that is how it
// sits behind the lid. Opening, it peels over from its top corner: the free edge leads,
// the part by the fold lags, the bottom follows the top, and it shivers once as it lands.
// Paper keeps the memory of its fold, so neither page ever lies quite flat.
const COLS = 20;
const ROWS = 8;
function pageGeometry(dir: 1 | -1) {
  const g = new THREE.PlaneGeometry(LEAF.w, LEAF.h, COLS, ROWS);
  g.translate(LEAF.w / 2, 0, 0); // the fold is at x = 0
  if (dir < 0) {
    // the left-hand page runs the other way from the fold: its picture runs back towards
    // the fold, and its faces are wound the other way round
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
    const index = g.index!;
    for (let i = 0; i < index.count; i += 3) {
      const b = index.getX(i + 1);
      index.setX(i + 1, index.getX(i + 2));
      index.setX(i + 2, b);
    }
  }
  return g;
}
/**
 * Lays a page along a curve leaving the fold. `a` is 0 folded shut, 1 open. `dir` is which
 * way the page lies from the fold when open; the left-hand one (-1) is the one that turns.
 */
function curl(g: THREE.BufferGeometry, a: number, dir: 1 | -1) {
  const p = g.attributes.position as THREE.BufferAttribute;
  const turning = dir < 0;
  const ds = LEAF.w / COLS;
  for (let j = 0; j <= ROWS; j++) {
    const v = 1 - j / ROWS; // 0 at the foot of the page, 1 at the head
    // the head of the page comes over first and the foot is dragged after it
    const own = turning ? Math.min(1, Math.max(0, a * 1.35 - 0.35 * (1 - v))) : a;
    const open = own * own * (3 - 2 * own);
    // the angle at the fold: all the way over when shut; open, both pages stand a little proud of flat
    // the page that stays only lifts off flat once the other has gone over the top and is clear of it
    const settle = Math.min(1, Math.max(0, (a - 0.6) / 0.4));
    const fold = turning ? (1 - open) * Math.PI + open * 0.3 : 0.22 * settle;
    const bow = turning ? Math.sin(Math.PI * open) * 1.25 : 0;
    // a shiver as it comes to rest, dying away
    const shiver = turning ? Math.sin(a * 26) * 0.1 * a * (1 - a) * 4 * (0.4 + v) : 0;
    let x = 0;
    let z = 0;
    for (let i = 0; i <= COLS; i++) {
      const row = j * (COLS + 1) + i;
      // the crease from when it was folded in half again stands up across the middle
      const crease = 0.0012 * Math.exp(-Math.pow((v - 0.5) / 0.035, 2)) * (i / COLS);
      // shut, the two pages lie flat together with a hair between them, so neither shows through the other
      p.setXYZ(row, dir * x, p.getY(row), turning ? Math.max(z, 0) + 0.0005 + crease * a : z + crease * settle);
      const t = (i + 0.5) / COLS;
      // paper bends most where it is free: it relaxes away from the fold, the corners
      // lift and droop on their own, and a slow wave is left along it
      const relax = fold * (1 - 0.7 * t * open);
      const corner = (v - 0.5) * t * t * 0.5 * (turning ? Math.sin(Math.PI * open) + 0.25 * open : 0.2 * settle);
      const wave = Math.sin(t * 4.2 + v * 1.7) * 0.12 * (turning ? open : settle);
      // never bent back past flat against the other page
      const phi = Math.min(Math.PI, relax - bow * (t - 0.5) + corner + wave + shiver * t);
      x += Math.cos(phi) * ds;
      z += Math.sin(phi) * ds;
    }
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  g.computeBoundingSphere();
}

/**
 * A jewel case. Pulled out of the row it turns to face the chair and opens: the lid swings
 * back on its hinge, the disc sits in the tray, and the leaflet slides up out of the lid
 * and unfolds above.
 */
function JewelCase({ project, index }: { project: Project; index: number }) {
  const lang = useLang();
  const fonts = useFonts();
  const ref = useRef<THREE.Group>(null);
  const lid = useRef<THREE.Group>(null);
  const leaf = useRef<THREE.Group>(null);
  const pages = useMemo(() => ({ left: pageGeometry(-1), right: pageGeometry(1) }), []);
  const curled = useRef(-1);
  useEffect(
    () => () => {
      pages.left.dispose();
      pages.right.dispose();
    },
    [pages],
  );
  const focus = useRoom((s) => s.focus);
  const selected = useRoom((s) => s.selectedCd === project.id);
  const hovered = useRef(false);
  /** each 0 to 1: out of the shelf and facing the chair; lid open; leaflet up and unfolded */
  const at = useRef({ out: 0, lid: 0, leaf: 0 });
  const wasStanding = useRef(false);

  const cover = useCanvasTexture(512, 512, (ctx, w, h) => drawCover(ctx, w, h, project, index, lang, fonts), [project, index, lang, fonts]);
  // folded, the back of the left-hand page faces out with the cover on it; laid that way round it would read backwards
  const coverOut = useMemo(() => {
    const t = cover.clone();
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.x = -1;
    t.offset.x = 1;
    t.needsUpdate = true;
    return t;
  }, [cover]);
  useEffect(() => () => coverOut.dispose(), [coverOut]);
  const spine = useCanvasTexture(64, 768, (ctx, w, h) => drawSpine(ctx, w, h, project, index, lang, fonts), [project, index, lang, fonts]);
  const shotA = useImage(project.shots?.[0]);
  const shotB = useImage(project.shots?.[1]);
  const left = useCanvasTexture(600, 606, (ctx, w, h) => drawLeafLeft(ctx, w, h, project, index, lang, fonts), [project, index, lang, fonts]);
  const right = useCanvasTexture(600, 606, (ctx, w, h) => drawLeafRight(ctx, w, h, project, index, lang, fonts, [shotA, shotB]), [project, index, lang, fonts, shotA, shotB]);
  const mats = useMemo(() => {
    const rough = scratches();
    const fibre = paperTooth();
    // the lid is clear plastic: what shows is the booklet behind it, and the light off its scratches
    const clear = new THREE.MeshPhysicalMaterial({ color: "#f4f8ff", transparent: true, opacity: 0.2, depthWrite: false, roughness: 0.9, roughnessMap: rough, clearcoat: 1, clearcoatRoughness: 0.5, clearcoatRoughnessMap: rough, envMapIntensity: 2.2 });
    const coverBack = new THREE.MeshStandardMaterial({ map: coverOut, roughness: 1, roughnessMap: fibre, bumpMap: fibre, bumpScale: 0.25, side: THREE.BackSide });
    const sheet = new THREE.MeshStandardMaterial({ color: "#6f6a60", roughness: 1, roughnessMap: fibre, bumpMap: fibre, bumpScale: 0.3, side: THREE.BackSide });
    return { clear, coverBack, sheet, all: [clear, coverBack, sheet] };
  }, [coverOut]);
  useEffect(() => () => mats.all.forEach((m) => m.dispose()), [mats]);
  const parts = useCase(mats.clear);

  const x = SHELF.x - SHELF.inner / 2 + SHELF.cd.start + index * SHELF.cd.pitch;
  const rest = useMemo(() => new THREE.Vector3(x, POS.cdStack[1] + CH / 2 + 0.0005, POS.cdStack[2] - CW / 2), [x]);

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const a = at.current;
    // out, then open, then the leaflet; and back in the opposite order
    // Each step begins a little before the one ahead of it has quite finished, so the whole
    // runs together as one movement; going back is quicker than coming out.
    const step = (v: number, on: boolean, seconds: number, back = seconds) => Math.min(1, Math.max(0, v + (on ? dt / seconds : -dt / back)));
    a.out = step(a.out, selected || a.lid > 0, 0.62);
    a.lid = step(a.lid, (selected && a.out >= 0.86) || a.leaf > 0, 0.42);
    a.leaf = step(a.leaf, selected && a.lid >= 0.9, 1.15, 0.7);
    // tell the room while the case stands open, so the view waits for it to shut
    const standing = a.lid > 0 || a.leaf > 0;
    if (standing !== wasStanding.current) {
      wasStanding.current = standing;
      const s = useRoom.getState();
      if (standing) s.setCdOpen(project.id);
      else if (s.cdOpen === project.id) s.setCdOpen(null);
    }

    // first it is drawn straight out of the row, then it turns its cover to the chair as it comes up
    const draw = ease(Math.min(1, a.out / 0.45));
    const turn = ease(Math.max(0, (a.out - 0.45) / 0.55));
    const open = ease(a.lid);
    const nudge = hovered.current && focus === "cds" && !selected ? 0.016 : 0;
    target.pos.copy(rest);
    target.pos.z += nudge + draw * (CW + 0.03);
    tmp.copy(SHELVED);
    if (turn > 0) {
      // open, the two halves lie either side of the hinge: it moves across so they sit in the middle
      target.pos.lerp(v.set(POS.cdStack[0] + (CW / 2) * open, POS.cdStack[1] + 0.215, POS.cdStack[2] + 0.1), turn);
      tmp.slerp(SHOWN, turn);
    }
    const k = 1 - Math.exp(-dt * 14);
    g.position.lerp(target.pos, k);
    g.quaternion.slerp(tmp, k);
    if (lid.current) lid.current.rotation.y = -open * Math.PI * 0.955;
    if (leaf.current) {
      // The leaflet lives in the lid, folded, and goes wherever the lid goes. Once the lid is
      // open it is slid straight up out of it, along the lid, until it is clear of the case;
      // only then is it turned over towards the chair and brought forward; and only once it
      // is there is it opened. Nothing passes through anything else on the way.
      // It is flicked up out of the lid and turned over in one go, the turn starting while it
      // is still coming up; and it is already falling open as it arrives.
      const p = Math.min(1, a.leaf / 0.58);
      const up = 1 - Math.pow(1 - Math.min(1, p / 0.42), 3);
      const turn = ease(Math.max(0, (p - 0.3) / 0.7));
      const unfold = Math.max(0, (a.leaf - 0.5) / 0.5);
      const swing = -open * Math.PI * 0.955;
      // where it sits in the lid: its fold down the spine side, just behind the plastic
      // (the booklet lies in the space under the front of the lid, above the disc)
      inLid.set(CW / 2 + 0.003 - LEAF.w / 2, 0, LEAF_Z).applyAxisAngle(UP, swing);
      inLid.x += -CW / 2;
      inLid.y += up * (CH + 0.02);
      held.set(-CW / 2, CH / 2 + 0.014 + (LEAF.h * HELD) / 2, 0.014);
      leaf.current.position.lerpVectors(inLid, held, turn);
      // turning over, it swings out towards the eye and back
      leaf.current.position.z += Math.sin(Math.PI * turn) * 0.06;
      leaf.current.rotation.set(0, swing * (1 - turn), 0);
      leaf.current.scale.setScalar(1 + (HELD - 1) * turn);
      if (curled.current !== unfold) {
        curled.current = unfold;
        curl(pages.left, unfold, -1);
        curl(pages.right, unfold, 1);
      }
    }
  });

  const live = focus === "cds";
  return (
    <group
      ref={ref}
      position={rest}
      quaternion={SHELVED}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        if (selected) heldClick.hit = true; // a click on the held case (or its leaflet) is not an outside click
        if (!(focus === "tapes" || live)) return;
        holdStart(
          focus === "tapes" ? "rack-cds" : `cd-${project.id}`,
          focus === "tapes" ? "rack_cds_tip" : null,
          e.nativeEvent.clientX,
          e.nativeEvent.clientY,
        );
      }}
      onPointerMove={(e: ThreeEvent<PointerEvent>) => holdMove(e.nativeEvent.clientX, e.nativeEvent.clientY)}
      onPointerUp={holdCancel}
      onPointerCancel={holdCancel}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        // looking at the other half of the rack, a click here comes over to this half
        if (focus === "tapes") {
          e.stopPropagation();
          tap("rack-cds", "rack_cds_tip", e.nativeEvent.clientX, e.nativeEvent.clientY, () => {
            hint(null);
            // a cassette is held: this click is outside it, so it goes back and nothing else is picked
            if (useRoom.getState().selectedTape) return useRoom.getState().selectTape(null);
            useRoom.getState().setFocus("cds");
          });
          return;
        }
        if (!live) return;
        e.stopPropagation();
        tap(`cd-${project.id}`, null, e.nativeEvent.clientX, e.nativeEvent.clientY, () => {
          // one CD at a time: with one held, this click puts it back (or, on the held one itself, the same) and picks nothing
          useRoom.getState().selectCd(useRoom.getState().selectedCd ? null : project.id);
        });
      }}
      onPointerOver={(e) => {
        if (focus === "tapes") {
          e.stopPropagation();
          hint("rack_cds_tip");
          return;
        }
        if (!live) return;
        e.stopPropagation();
        hovered.current = true;
        hint(null);
      }}
      onPointerOut={() => {
        hovered.current = false;
        if (live || focus === "tapes") hint(null);
      }}
    >
      {/* the tray half, with the hub the disc clips on to */}
      {parts && (
        <group rotation={CASE_TURN} scale={CASE_SCALE}>
          <primitive object={parts.tray} />
        </group>
      )}
      {/* the disc, playing side up */}
      <mesh position={[0.006, 0, DISC_Z]}>
        <circleGeometry args={[0.06, 72]} />
        <shaderMaterial vertexShader={discVert} fragmentShader={discFrag} uniforms={discUniforms} transparent toneMapped={false} />
      </mesh>
      {/* the lid, hinged down the spine edge: clear plastic. The booklet behind it is the leaflet, below. */}
      <group ref={lid} position={[-CW / 2, 0, 0]}>
        {parts && (
          <group rotation={CASE_TURN} scale={CASE_SCALE}>
            <primitive object={parts.lid} />
          </group>
        )}
      </group>
      {/* the printed spine, on the hinge edge */}
      <mesh position={[-CW / 2 - 0.0003, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[CT * 0.86, CH * 0.95]} />
        <meshStandardMaterial map={spine} roughness={0.35} />
      </mesh>
      {/* the leaflet: two pages meeting at a fold, which is its origin. Each page is drawn twice: its print side, and its back. */}
      <group ref={leaf}>
        <mesh geometry={pages.left}>
          {/* partly self-lit and toned down, so the print reads as itself under the TV's cyan */}
          <meshStandardMaterial map={left} emissiveMap={left} emissive="#ffffff" emissiveIntensity={0.5} color="#77726a" roughness={1} roughnessMap={paperTooth()} bumpMap={paperTooth()} bumpScale={0.35} />
        </mesh>
        <mesh geometry={pages.left} material={mats.coverBack} />
        <mesh geometry={pages.right}>
          <meshStandardMaterial map={right} emissiveMap={right} emissive="#ffffff" emissiveIntensity={0.5} color="#77726a" roughness={1} roughnessMap={paperTooth()} bumpMap={paperTooth()} bumpScale={0.35} />
        </mesh>
        <mesh geometry={pages.right} material={mats.sheet} />
      </group>
    </group>
  );
}

/** Jewel cases standing in the shelf like books, spines out: one per project. */
export function CdStack() {
  return (
    <Interactive target="cds">
      {projects.map((p, i) => (
        <JewelCase key={p.id} project={p} index={i} />
      ))}
    </Interactive>
  );
}

/* ---------- the Discman ---------- */

// The keys are separate pieces in the file. Each is found by where it sits (the file's own
// units: x across, z towards the front) and given a job. The big oval on the right starts
// and pauses; the two round keys beside it are pause and stop; the two small bars are the
// track keys.
type Key = "play" | "pause" | "stop" | "prev" | "next";
const KEYS: { key: Key; x: number; z: number }[] = [
  { key: "play", x: 9.18, z: 10.45 },
  { key: "pause", x: 4.4, z: 10.73 },
  { key: "stop", x: 3.62, z: 12.55 },
  { key: "prev", x: 0.85, z: 11.35 },
  { key: "next", x: 0.83, z: 12.75 },
];

function press(key: Key) {
  click(key === "stop" ? 0.7 : 1.1);
  if (!hasDisc()) return blip(180, 0.09);
  const playing = usePlayer.getState().state === "playing";
  if (key === "play") {
    if (playing) pause();
    else {
      if (usePlayer.getState().state === "stopped") whirr();
      play();
    }
  } else if (key === "pause") pause();
  else if (key === "stop") stop();
  else if (key === "prev") prev();
  else next();
}

// The model's own printed display, measured from its texture: pale yellow glass with dark
// seven-segment figures and softly rounded corners. The live one is drawn to the same recipe.
const GLASS = "rgb(236,231,153)";
const INK = "rgba(40,30,4,0.94)";
const GHOST = "rgba(40,30,4,0.07)"; // segments that are off still show faintly, as on any LCD

//  -a-
// f   b
//  -g-
// e   c
//  -d-
const SEGMENTS: Record<string, string> = { "0": "abcdef", "1": "bc", "2": "abdeg", "3": "abcdg", "4": "bcfg", "5": "acdfg", "6": "acdefg", "7": "abc", "8": "abcdefg", "9": "abcdfg", "-": "g" };

/** One seven-segment figure in a box w x h with its top-left corner at x, y. */
function figure(ctx: CanvasRenderingContext2D, ch: string, x: number, y: number, w: number, h: number) {
  const t = h * 0.135; // thickness of a bar
  const gap = t * 0.16;
  const bar = (x0: number, y0: number, len: number, across: boolean) => {
    // a bar with pointed ends, lying along x or standing along y
    const k = t / 2;
    ctx.beginPath();
    if (across) {
      ctx.moveTo(x0 + gap, y0);
      ctx.lineTo(x0 + k + gap, y0 - k);
      ctx.lineTo(x0 + len - k - gap, y0 - k);
      ctx.lineTo(x0 + len - gap, y0);
      ctx.lineTo(x0 + len - k - gap, y0 + k);
      ctx.lineTo(x0 + k + gap, y0 + k);
    } else {
      ctx.moveTo(x0, y0 + gap);
      ctx.lineTo(x0 + k, y0 + k + gap);
      ctx.lineTo(x0 + k, y0 + len - k - gap);
      ctx.lineTo(x0, y0 + len - gap);
      ctx.lineTo(x0 - k, y0 + len - k - gap);
      ctx.lineTo(x0 - k, y0 + k + gap);
    }
    ctx.fill();
  };
  const l = x + t / 2;
  const r = x + w - t / 2;
  const top = y + t / 2;
  const mid = y + h / 2;
  const bot = y + h - t / 2;
  const on = SEGMENTS[ch] ?? "";
  const draw = (name: string, fn: () => void) => {
    ctx.fillStyle = on.includes(name) ? INK : GHOST;
    fn();
  };
  draw("a", () => bar(l, top, r - l, true));
  draw("g", () => bar(l, mid, r - l, true));
  draw("d", () => bar(l, bot, r - l, true));
  draw("f", () => bar(l, top, mid - top, false));
  draw("e", () => bar(l, mid, bot - mid, false));
  draw("b", () => bar(r, top, mid - top, false));
  draw("c", () => bar(r, mid, bot - mid, false));
}

/** A run of figures, with ":" allowed between them. Returns the x after the last one. */
function figures(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, h: number) {
  const w = h * 0.52;
  for (const ch of text) {
    if (ch === ":") {
      ctx.fillStyle = INK;
      const d = h * 0.11;
      ctx.fillRect(x + d * 0.4, y + h * 0.3 - d / 2, d, d);
      ctx.fillRect(x + d * 0.4, y + h * 0.7 - d / 2, d, d);
      x += d * 2.4;
    } else {
      figure(ctx, ch, x, y, w, h);
      x += w * 1.32;
    }
  }
  return x;
}

// The display's four corners on the model, in the file's own units. They were found by
// following the patch of the model's texture that the printed display occupies back to the
// surface it is painted on, so the live display covers the printed one exactly.
const LCD = {
  backLeft: [-6.549, 5.408, 10.917],
  backRight: [-0.863, 5.438, 10.733],
  frontLeft: [-6.46, 5.172, 12.534],
  frontRight: [-0.848, 5.202, 12.336],
};
const lcdGeo = (() => {
  const g = new THREE.BufferGeometry();
  const lift = 0.035; // clear of the lid, which it lies on
  const p = [LCD.frontLeft, LCD.frontRight, LCD.backLeft, LCD.backRight].flatMap(([x, y, z]) => [x, y + lift, z]);
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  // read from the front of the player: the back edge is the top of the picture
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
  g.setIndex([0, 1, 2, 2, 1, 3]);
  g.computeVertexNormals();
  return g;
})();

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * The liquid-crystal display, in the colours and figures of the one printed on the model:
 * track number on the left, minutes and seconds on the right, and between them a mark for
 * what the transport is doing. It is always backlit, and brighter while a disc is running.
 */
function Display() {
  const state = usePlayer((p) => p.state);
  const index = usePlayer((p) => p.index);
  const seconds = usePlayer((p) => Math.floor(p.seconds));
  const running = state !== "stopped";
  const tex = useCanvasTexture(
    512,
    148,
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      // the glass, with the printed display's rounded corners; outside them the model shows through
      ctx.fillStyle = GLASS;
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, h * 0.13);
      ctx.fill();
      const glow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.6);
      glow.addColorStop(0, "rgba(255,255,220,0.12)");
      glow.addColorStop(1, "rgba(120,110,30,0.16)");
      ctx.fillStyle = glow;
      ctx.fill();
      // lean the figures a little, as LCD figures do
      ctx.transform(1, 0, -0.07, 1, h * 0.05, 0);
      const disc = hasDisc();
      const big = h * 0.56;
      const end = figures(ctx, disc ? pad2(index + 1) : "--", w * 0.07, (h - big) / 2, big);
      // play, pause or stop
      const x = end + w * 0.035;
      const c = h / 2;
      const m = h * 0.11;
      ctx.fillStyle = INK;
      if (state === "playing") {
        ctx.beginPath();
        ctx.moveTo(x, c - m);
        ctx.lineTo(x + m * 1.6, c);
        ctx.lineTo(x, c + m);
        ctx.fill();
      } else if (state === "paused") {
        ctx.fillRect(x, c - m, m * 0.55, m * 2);
        ctx.fillRect(x + m, c - m, m * 0.55, m * 2);
      } else if (disc) ctx.fillRect(x, c - m * 0.8, m * 1.6, m * 1.6);
      const small = h * 0.42;
      const time = disc ? `${pad2(Math.floor(seconds / 60))}:${pad2(seconds % 60)}` : "--:--";
      // set from the right-hand edge: four figures and the colon
      const width = small * 0.52 * 1.32 * 4 + small * 0.11 * 2.4;
      figures(ctx, time, w * 0.95 - width, (h - small) / 2 + h * 0.03, small);
    },
    [state, index, seconds],
  );
  return (
    <>
      {/* not lit by the room: it shows its own colour, as a backlit display does, and while a
          disc runs it is brighter than white so the bloom pass makes it glow */}
      <mesh geometry={lcdGeo}>
        <meshBasicMaterial map={tex} transparent toneMapped={false} color={running ? [1.25, 1.27, 1.0] : [0.88, 0.9, 0.78]} />
      </mesh>
      {/* what the backlight throws on the lid and the keys around it */}
      <pointLight position={[-3.7, 7.4, 11.9]} color="#f0ec9a" intensity={running ? 0.018 : 0.009} distance={0.35} decay={2} />
    </>
  );
}

/** The Discman with its headphones, on the desk. Close up, its keys work: it plays the tracks in content/music.ts. */
export function CdPlayer() {
  const scene = useClone(DISCMAN);
  const live = useRoom((s) => s.focus === "cd");
  const setTip = useRoom((s) => s.setTip);
  // the player body is 24 units wide in the file; the real one is about 13 cm
  const s = 0.13 / 24;

  // pick the keys out of the model, and work out which way "pressed in" is for each
  const keys = useMemo(() => {
    scene.updateMatrixWorld(true);
    const out = new Map<THREE.Object3D, { key: Key; rest: THREE.Vector3; down: THREE.Vector3; at: number }>();
    const box = new THREE.Box3();
    const c = new THREE.Vector3();
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.parent) return;
      box.setFromObject(m).getCenter(c);
      const size = box.getSize(new THREE.Vector3());
      if (size.x > 4 || size.z > 4) return;
      const hit = KEYS.find((k) => Math.abs(k.x - c.x) < 0.6 && Math.abs(k.z - c.z) < 0.6);
      if (!hit) return;
      const down = m.parent.worldToLocal(new THREE.Vector3(0, -0.22, 0)).sub(m.parent.worldToLocal(new THREE.Vector3()));
      out.set(m, { key: hit.key, rest: m.position.clone(), down, at: -10 });
    });
    return out;
  }, [scene]);

  useFrame(() => {
    for (const [mesh, k] of keys) {
      // down fast, back up a little slower
      const t = performance.now() / 1000 - k.at;
      const depth = t < 0.06 ? t / 0.06 : Math.max(0, 1 - (t - 0.06) / 0.16);
      mesh.position.copy(k.rest).addScaledVector(k.down, depth);
    }
  });

  return (
    <Interactive target="cd">
      <group position={POS.cdPlayer} rotation={[0, -0.14, 0]} scale={s}>
        <primitive
          object={scene}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            const k = keys.get(e.object);
            if (!live || !k) return;
            e.stopPropagation();
            tap(`cdkey-${k.key}`, `key_${k.key}`, e.nativeEvent.clientX, e.nativeEvent.clientY, () => {
              k.at = performance.now() / 1000;
              press(k.key);
            });
          }}
          // hover is tracked for the model as a whole, so which key the cursor is on is read on every move:
          // the nearest piece of the player under it, key or not
          onPointerMove={(e: ThreeEvent<PointerEvent>) => {
            if (!live) return;
            const top = e.intersections.find((i) => i.eventObject === e.eventObject)?.object;
            // the pad over the round half of the big key counts as that key
            const key = e.intersections.some((i) => i.object.userData.pad) ? "play" : top && keys.get(top)?.key;
            document.body.style.cursor = key ? "pointer" : "";
            setTip(key ? `key_${key}` : null);
          }}
          onPointerOut={() => {
            if (!live) return;
            document.body.style.cursor = "";
            setTip(null);
          }}
        />
        <Display />
        {/* the round half of the big key is moulded into the body in the file, so it gets a pad of its own */}
        <mesh
          position={[6.95, 5.75, 10.55]}
          rotation={[-Math.PI / 2, 0, 0]}
          userData={{ pad: true }}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            if (!live) return;
            e.stopPropagation();
            tap("cdkey-play", "key_play", e.nativeEvent.clientX, e.nativeEvent.clientY, () => {
              for (const k of keys.values()) if (k.key === "play") k.at = performance.now() / 1000;
              press("play");
            });
          }}
        >
          <circleGeometry args={[1.15, 20]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
      <HitBox position={[POS.cdPlayer[0], POS.cdPlayer[1] + 0.04, POS.cdPlayer[2]]} size={[0.2, 0.08, 0.2]} />
    </Interactive>
  );
}

useGLTF.preload(DISCMAN);
useGLTF.preload(CASE);
