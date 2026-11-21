"use client";

/* eslint-disable react-hooks/refs -- the press handlers read the leaf ref when the pointer goes down, not while rendering */

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { click } from "@/audio/sfx";
import { profile } from "@/content/data";
import { photos, type Photo } from "@/content/photos";
import { strings } from "@/content/strings";
import { useLang } from "@/state/lang";
import { drawPlaceholder, LEAVES, MAX_TURNED, PER_PAGE } from "../album";
import { Interactive } from "../Interactive";
import { ALBUM_HELD, POS } from "../layout";
import { orbit } from "../orbit";
import { useRoom } from "../store";
import { canvasTexture, paper, rng, useCanvasTexture, useFonts, type Fonts } from "../textures";

// A photo album, built here. Shut, it lies on the desk: tan leather, a print set into the
// cover, brass corners. Focused, it is lifted towards the chair and the cover swings open
// on thick cream pages; each print is held by four black corners and has its caption
// written under it. The pages are card that bends as it turns: click a page to turn it, or
// take hold of it and drag it over. Click a print and the camera moves in on it.
// The photos are listed in content/photos.ts.
//
// The album's own space is that of a book held upright: x to the right from the spine,
// y up the page, z out of the cover.

const W = 0.2;
const H = 0.262;
const COVER_T = 0.0034;
const LEAF_T = 0.001;
const STEP = 0.0018; // from one leaf to the next in the stack
const OPEN = Math.PI - 0.03;
const PAGE = { w: W - 0.006, h: H - 0.008 };

const REST_POS = new THREE.Vector3(POS.album[0] - W / 2, POS.album[1], POS.album[2]);
const REST_ROT = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, -0.16));
const HELD_POS = new THREE.Vector3(...ALBUM_HELD);
const HELD_ROT = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.42, 0, 0));

/** Moves the album on by a number of leaves, within what there is to turn. */
export function turnAlbum(by: number) {
  const s = useRoom.getState();
  const next = Math.min(MAX_TURNED, Math.max(1, s.albumTurned + by));
  if (next === s.albumTurned) return;
  click(1.5);
  s.setAlbumTurned(next);
}

/* ---------- where things sit on a page ---------- */

// Two prints to a page, one above the other.
const SLOT = { w: 0.156, h: 0.108, y: [0.061, -0.061] };
const BORDER = 0.003;

/* ---------- painted surfaces ---------- */

const LEATHER = "#8a4a26";

function leather(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  ctx.fillStyle = LEATHER;
  ctx.fillRect(0, 0, w, h);
  const r = rng(seed);
  // pebbled grain, then the wear a handled book picks up towards its edges
  for (let i = 0; i < 5200; i++) {
    ctx.fillStyle = `rgba(${r() > 0.55 ? "255,200,150" : "30,10,0"},${0.03 + r() * 0.06})`;
    ctx.beginPath();
    ctx.arc(r() * w, r() * h, 0.6 + r() * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  const wear = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.75);
  wear.addColorStop(0, "rgba(255,190,130,0.10)");
  wear.addColorStop(1, "rgba(20,6,0,0.42)");
  ctx.fillStyle = wear;
  ctx.fillRect(0, 0, w, h);
}

/** A line pressed into the leather: dark on one side, catching light on the other. */
function deboss(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, colour: string, width: number) {
  ctx.lineWidth = width;
  ctx.strokeStyle = "rgba(20,6,0,0.55)";
  ctx.strokeRect(x - 1.5, y - 1.5, w, h);
  ctx.strokeStyle = colour;
  ctx.strokeRect(x, y, w, h);
}

// the window on the cover that a print sits in, in the album's metres from the cover's middle
const INSET = { w: 0.104, h: 0.07, y: 0.04 };

function drawCover(ctx: CanvasRenderingContext2D, w: number, h: number, fonts: Fonts | null) {
  leather(ctx, w, h, 5);
  const px = w / W;
  // the spine: a darker band, and the stitching beside it
  const spine = w * 0.105;
  ctx.fillStyle = "rgba(30,10,2,0.45)";
  ctx.fillRect(0, 0, spine, h);
  ctx.strokeStyle = "rgba(245,215,160,0.55)";
  ctx.lineWidth = 2.2;
  ctx.setLineDash([9, 7]);
  ctx.beginPath();
  ctx.moveTo(spine + 13, 20);
  ctx.lineTo(spine + 13, h - 20);
  ctx.stroke();
  ctx.setLineDash([]);
  // one blind-stamped line round the board, and the well the cover print is mounted in
  deboss(ctx, spine + 38, 40, w - spine - 78, h - 80, "rgba(40,16,4,0.5)", 2);
  const cx = w / 2 + spine / 2;
  const iw = INSET.w * px + 18;
  const ih = INSET.h * px + 18;
  const iy = h / 2 - INSET.y * px;
  ctx.fillStyle = "rgba(20,6,0,0.6)";
  ctx.fillRect(cx - iw / 2, iy - ih / 2, iw, ih);
  if (!fonts) return;
  // the title, stamped in dulled gold
  ctx.fillStyle = "rgba(214,170,98,0.85)";
  ctx.textAlign = "center";
  ctx.font = `700 54px ${fonts.hand}`;
  ctx.fillText(profile.name, cx, h * 0.74);
  ctx.font = `19px ${fonts.screen}`;
  ctx.fillText("P H O T O G R A P H S", cx, h * 0.8);
}

/** The cover's surface in grey: the grain of the hide and everything pressed into it. Light is raised and matt, dark is sunk and smooth. */
function drawCoverRelief(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "rgb(168,168,168)";
  ctx.fillRect(0, 0, w, h);
  const r = rng(5);
  for (let i = 0; i < 9000; i++) {
    const v = r() > 0.5 ? 255 : 60;
    ctx.fillStyle = `rgba(${v},${v},${v},${0.1 + r() * 0.22})`;
    ctx.beginPath();
    ctx.arc(r() * w, r() * h, 0.8 + r() * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // creases where it has been bent, and the polish of handling towards the middle
  ctx.strokeStyle = "rgba(40,40,40,0.35)";
  for (let i = 0; i < 14; i++) {
    ctx.lineWidth = 0.8 + r() * 1.4;
    ctx.beginPath();
    const x = r() * w;
    const y = r() * h;
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + (r() - 0.5) * 160, y + (r() - 0.5) * 160, x + (r() - 0.5) * 240, y + (r() - 0.5) * 240);
    ctx.stroke();
  }
  const worn = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, h * 0.6);
  worn.addColorStop(0, "rgba(70,70,70,0.3)");
  worn.addColorStop(1, "rgba(70,70,70,0)");
  ctx.fillStyle = worn;
  ctx.fillRect(0, 0, w, h);
  const px = w / W;
  const spine = w * 0.105;
  ctx.fillStyle = "rgba(60,60,60,0.5)";
  ctx.fillRect(spine - 4, 0, 6, h);
  ctx.strokeStyle = "rgb(50,50,50)";
  ctx.lineWidth = 3;
  ctx.strokeRect(spine + 38, 40, w - spine - 78, h - 80);
  const cx = w / 2 + spine / 2;
  ctx.fillStyle = "rgb(40,40,40)";
  ctx.fillRect(cx - (INSET.w * px + 18) / 2, h / 2 - INSET.y * px - (INSET.h * px + 18) / 2, INSET.w * px + 18, INSET.h * px + 18);
}

const PAPER = "#ebe2ce";

/** Card stock: warm, slightly mottled, falling into shadow at the gutter and worn at the edges. */
function cardStock(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, gutter: "left" | "right") {
  paper(ctx, w, h, PAPER, seed);
  const r = rng(seed + 100);
  for (let i = 0; i < 160; i++) {
    // long faint fibres
    ctx.strokeStyle = `rgba(120,90,50,${0.03 + r() * 0.04})`;
    ctx.lineWidth = 0.7;
    const x = r() * w;
    const y = r() * h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (r() - 0.5) * 30, y + (r() - 0.5) * 30);
    ctx.stroke();
  }
  const g = ctx.createLinearGradient(gutter === "left" ? 0 : w, 0, gutter === "left" ? w * 0.2 : w * 0.8, 0);
  g.addColorStop(0, "rgba(40,24,8,0.5)");
  g.addColorStop(0.35, "rgba(40,24,8,0.12)");
  g.addColorStop(1, "rgba(40,24,8,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const edge = ctx.createRadialGradient(w / 2, h / 2, h * 0.42, w / 2, h / 2, h * 0.72);
  edge.addColorStop(0, "rgba(90,60,25,0)");
  edge.addColorStop(1, "rgba(90,60,25,0.2)");
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, w, h);
}

function drawPage(ctx: CanvasRenderingContext2D, w: number, h: number, page: number, gutter: "left" | "right") {
  cardStock(ctx, w, h, page * 3 + 11, gutter);
}

function drawEndpaper(ctx: CanvasRenderingContext2D, w: number, h: number, fonts: Fonts | null) {
  // patterned endpaper: gilt lozenges on ochre, the way bound albums are lined
  ctx.fillStyle = "#b9853f";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255,226,160,0.5)";
  ctx.lineWidth = 1.4;
  const d = 30;
  for (let y = 0; y < h + d; y += d) {
    for (let x = (y / d) % 2 ? d / 2 : 0; x < w + d; x += d) {
      ctx.beginPath();
      ctx.moveTo(x, y - 9);
      ctx.lineTo(x + 6, y);
      ctx.lineTo(x, y + 9);
      ctx.lineTo(x - 6, y);
      ctx.closePath();
      ctx.stroke();
    }
  }
  const g = ctx.createLinearGradient(w, 0, w * 0.78, 0);
  g.addColorStop(0, "rgba(0,0,0,0.5)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // the bookplate
  const bw = w * 0.56;
  const bh = h * 0.27;
  const bx = (w - bw) / 2 - 8;
  const by = h * 0.36;
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(bx + 4, by + 5, bw, bh);
  ctx.save();
  ctx.translate(bx, by);
  paper(ctx, bw, bh, PAPER, 9);
  ctx.strokeStyle = "#8a6a2f";
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, bw - 20, bh - 20);
  ctx.lineWidth = 0.8;
  ctx.strokeRect(15, 15, bw - 30, bh - 30);
  if (fonts) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#8a6a2f";
    ctx.font = `16px ${fonts.screen}`;
    ctx.fillText("E X   L I B R I S", bw / 2, bh * 0.3);
    ctx.fillStyle = "#1d1712";
    ctx.font = `700 46px ${fonts.hand}`;
    ctx.fillText(profile.name, bw / 2, bh * 0.58);
    ctx.fillStyle = "#4a3a22";
    ctx.font = `13px ${fonts.screen}`;
    ctx.fillText(`${photos.length} PHOTOGRAPHS`, bw / 2, bh * 0.8);
  }
  ctx.restore();
}

/* ---------- prints ---------- */

/**
 * The picture for one slot, and its proportions: the file once it has loaded, a stand-in
 * until then. Nothing is fetched until `wanted`, so only the pages near the open one cost
 * anything; once fetched, a photo is kept.
 */
function usePhoto(photo: Photo, index: number, label: string, wanted: boolean) {
  const empty = photo.src === null;
  // an empty slot gets a painted landscape; a real photo waits as blank photographic paper
  const stand = useMemo(
    () =>
      empty
        ? canvasTexture(600, 400, (c, w, h) => drawPlaceholder(c, w, h, index, label))
        : canvasTexture(8, 8, (c, w, h) => {
            c.fillStyle = "#cfc7b6";
            c.fillRect(0, 0, w, h);
          }),
    [empty, index, label],
  );
  useEffect(() => () => stand.dispose(), [stand]);
  const [loaded, setLoaded] = useState<{ src: string; tex: THREE.Texture; aspect: number } | null>(null);
  const [asked, setAsked] = useState(false);
  if (wanted && !asked) setAsked(true);
  useEffect(() => {
    const src = photo.src;
    if (!src || !asked) return;
    let alive = true;
    let mine: THREE.Texture | null = null;
    new THREE.TextureLoader().load(src, (tex) => {
      mine = tex;
      if (!alive) return tex.dispose();
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      const img = tex.image as { width: number; height: number };
      setLoaded({ src, tex, aspect: img.width / img.height });
    });
    return () => {
      alive = false;
      mine?.dispose();
    };
  }, [photo.src, asked]);
  return loaded && loaded.src === photo.src ? loaded : { tex: stand, aspect: 1.5 };
}

// shared by every print: the soft shadow it lays on the page, and a mounting corner
let shadowTex: THREE.Texture | null = null;
function printShadow() {
  shadowTex ??= canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.filter = "blur(7px)";
    ctx.fillStyle = "rgba(30,18,6,0.85)";
    ctx.fillRect(16, 16, w - 32, h - 32);
  });
  return shadowTex;
}
const CORNER = 0.0125;
const cornerShape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(CORNER, 0), new THREE.Vector2(0, CORNER)]);
const cornerMat = new THREE.MeshStandardMaterial({ color: "#14110e", roughness: 0.75 });
const printMat = new THREE.MeshStandardMaterial({ color: "#f6f1e6", roughness: 0.55 });

/** A print with its white border, sized to fit a box whichever way up the photo is. */
function Picture({ index, maxW, maxH, corners, wanted, glow = 0.42, onPress }: { index: number; maxW: number; maxH: number; corners?: boolean; wanted: boolean; glow?: number; onPress?: (e: ThreeEvent<PointerEvent>) => void }) {
  const lang = useLang();
  const { tex, aspect } = usePhoto(photos[index], index, strings[lang].photo_slot, wanted);
  const w = Math.min(maxW - BORDER * 2, (maxH - BORDER * 2) * aspect);
  const h = w / aspect;
  const ow = w + BORDER * 2;
  const oh = h + BORDER * 2;
  // every sheet is cut into strips across its width, so it can follow the page as the page bends
  return (
    <group>
      <mesh position={[0.0012, -0.0018, 0.00005]} renderOrder={1}>
        <planeGeometry args={[ow + 0.016, oh + 0.016, 14, 1]} />
        <meshBasicMaterial map={printShadow()} transparent opacity={0.55} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh
        position={[0, 0, 0.00018]}
        material={printMat}
        onPointerDown={onPress}
        onPointerOver={() => {
          if (onPress) document.body.style.cursor = "zoom-in";
        }}
        onPointerOut={() => {
          if (onPress) document.body.style.cursor = "";
        }}
      >
        <planeGeometry args={[ow, oh, 14, 1]} />
      </mesh>
      <mesh position={[0, 0, 0.0003]}>
        <planeGeometry args={[w, h, 14, 1]} />
        {/* partly self-lit, so a photograph keeps its own colours in a room lit amber and cyan */}
        <meshStandardMaterial map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={glow} roughness={0.45} />
      </mesh>
      {corners &&
        [0, 1, 2, 3].map((c) => {
          const sx = c === 0 || c === 3 ? -1 : 1;
          const sy = c < 2 ? -1 : 1;
          return (
            <mesh key={c} material={cornerMat} position={[sx * (ow / 2 + 0.0009), sy * (oh / 2 + 0.0009), 0.00045]} rotation={[0, 0, (c * Math.PI) / 2]}>
              <shapeGeometry args={[cornerShape]} />
            </mesh>
          );
        })}
    </group>
  );
}

/* ---------- handling the pages ---------- */

// What the pointer went down on, until it comes up again. A press that does not move is a
// click: on a print it moves the camera in, on bare page it turns the page. A press that
// moves drags the page over by hand; let go past half way and it falls on over.
type Press = { photo: number | null; leaf: number; from: number; x: number; span: number; moved: boolean };
let press: Press | null = null;
/** the leaf being dragged, and how far over it is held (0 lying right, 1 lying left) */
const pull = { leaf: -1, a: 0 };

function startPress(e: ThreeEvent<PointerEvent>, photo: number | null, leaf: number, from: number, span: number) {
  e.stopPropagation();
  press = { photo, leaf, from, x: e.nativeEvent.clientX, span, moved: false };
  // close in on a photo there is nothing to turn, so a drag there looks around instead
  orbit.locked = leaf > 0 && useRoom.getState().zoomed === null;
}

function usePressHandling() {
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!press || !orbit.locked) return;
      const dx = e.clientX - press.x;
      if (!press.moved && Math.abs(dx) < 5) return;
      press.moved = true;
      pull.leaf = press.leaf;
      // the page's edge crosses two page-widths of screen on its way over
      pull.a = Math.min(1, Math.max(0, press.from - dx / (press.span * 2)));
    };
    const up = () => {
      const p = press;
      press = null;
      orbit.locked = false;
      if (!p) return;
      const s = useRoom.getState();
      if (p.moved) {
        if (pull.leaf < 0) return;
        const over = pull.a > 0.5;
        pull.leaf = -1;
        const turned = over ? p.leaf + 1 : p.leaf;
        if (turned !== s.albumTurned) {
          click(1.5);
          s.setAlbumTurned(turned);
        }
      } else if (s.zoomed !== null) {
        // close in: another print moves across to it, anything else steps back
        s.setZoomed(p.photo !== null && p.photo !== s.zoomed ? p.photo : null);
      } else if (p.photo !== null) {
        click(1.2);
        s.setZoomed(p.photo);
      } else if (p.leaf > 0) {
        turnAlbum(p.from === 0 ? 1 : -1);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);
}

/** One side of a page: the prints mounted on it, laid out about the page's middle, facing +z. */
function Face({ page, near, onPress }: { page: number; near: boolean; onPress?: (e: ThreeEvent<PointerEvent>, photo: number | null) => void }) {
  const first = page * PER_PAGE;
  return (
    <>
      {Array.from({ length: PER_PAGE }, (_, slot) => first + slot)
        .filter((i) => i < photos.length)
        .map((i) => (
          <group key={i} position={[0, SLOT.y[i - first], 0]}>
            <Picture index={i} maxW={SLOT.w} maxH={SLOT.h} corners wanted={near} onPress={onPress && ((e) => onPress(e, i))} />
          </group>
        ))}
    </>
  );
}

/** Where the camera goes to look closely at one photo in the held-open album. */
const photoViews = new Map<number, { pos: [number, number, number]; look: [number, number, number] }>();
export function albumPhotoView(index: number) {
  let view = photoViews.get(index);
  if (!view) {
    const page = Math.floor(index / PER_PAGE);
    // even pages are fronts of leaves and lie on the right; odd pages are backs and lie on the left
    const side = page % 2 === 0 ? 1 : -1;
    const at = new THREE.Vector3((side * W) / 2, SLOT.y[index % PER_PAGE], 0.008).applyQuaternion(HELD_ROT).add(HELD_POS);
    const out = new THREE.Vector3(0, 0, 1).applyQuaternion(HELD_ROT);
    view = { look: at.toArray(), pos: at.clone().addScaledVector(out, 0.27).toArray() };
    photoViews.set(index, view);
  }
  return view;
}

/* ---------- the book ---------- */

const boardMat = new THREE.MeshStandardMaterial({ color: "#5a2f18", roughness: 0.6 });
const brassMat = new THREE.MeshStandardMaterial({ color: "#a88748", metalness: 1, roughness: 0.55 });
const BRASS = 0.024;
const brassGeo = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(BRASS, 0), new THREE.Vector2(0, BRASS)]), { depth: COVER_T + 0.0008, bevelEnabled: false });

/** A page's painted surface, as a material. */
function usePageMat(page: number, gutter: "left" | "right") {
  const tex = useCanvasTexture(512, 670, (c, w, h) => drawPage(c, w, h, page, gutter), [page, gutter]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 }), [tex]);
  useEffect(() => () => mat.dispose(), [mat]);
  return mat;
}

// How a page lies while it is part way over. Seen from the foot of the book it is a curve
// leaving the spine: its outer edge, where the hand has it, runs ahead and the part by the
// spine hangs back, so the card bows. Flat at either end of the turn.
const SEG = 32;
const BOW = 1.0;
const curve = new Float32Array((SEG + 1) * 4); // per sample: x, z, and the surface normal's x, z
function shapeCurve(a: number) {
  const theta = OPEN * a;
  const bow = BOW * Math.sin(Math.PI * a);
  const ds = W / SEG;
  let x = 0;
  let z = 0;
  for (let i = 0; i <= SEG; i++) {
    const phi = theta + bow * (i / SEG - 0.6);
    curve.set([x, z, -Math.sin(phi), Math.cos(phi)], i * 4);
    const mid = theta + bow * ((i + 0.5) / SEG - 0.6);
    x += Math.cos(mid) * ds;
    z += Math.sin(mid) * ds;
  }
}

type Flat = { rest: Float32Array; toLeaf: THREE.Matrix4; toMesh: THREE.Matrix4 };
const v = new THREE.Vector3();

/** A card leaf hinged on the spine, with everything mounted on it. All of it bends together. */
function Leaf({ index, turned, live }: { index: number; turned: number; live: boolean }) {
  const root = useRef<THREE.Group>(null);
  const at = useRef(0);
  const shaped = useRef(0);
  const flats = useRef(new WeakMap<THREE.BufferGeometry, Flat>());
  const album = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  // the front of leaf i is the right-hand page when i leaves are turned; its back is the left-hand page one turn later
  const frontPage = (index - 1) * 2;
  const front = usePageMat(frontPage, "left");
  const back = usePageMat(frontPage + 1, "right");
  const shutZ = COVER_T + (LEAVES - index) * STEP + STEP / 2;
  const openZ = COVER_T + (index - 1) * STEP + STEP / 2;
  const goal = turned > index ? 1 : 0;

  useFrame((_, dt) => {
    const g = root.current;
    if (!g) return;
    const held = pull.leaf === index;
    const want = held ? pull.a : goal;
    const gap = want - at.current;
    at.current = Math.abs(gap) < 0.0005 ? want : at.current + gap * (1 - Math.exp(-dt * (held ? 22 : 5.5)));
    const a = at.current;
    g.position.z = shutZ + (openZ - shutZ) * a;

    // bend every sheet on the leaf to the curve; a sheet seen for the first time (a print
    // whose photo has just loaded is a new one) is measured flat first
    let fresh = false;
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !flats.current.has(m.geometry)) fresh = true;
    });
    if (!fresh && shaped.current === a) return;
    if (fresh) g.updateWorldMatrix(true, true);
    shaped.current = a;
    shapeCurve(a);
    const inv = fresh ? g.matrixWorld.clone().invert() : null;
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const pos = m.geometry.attributes.position as THREE.BufferAttribute;
      let flat = flats.current.get(m.geometry);
      if (!flat) {
        const toLeaf = inv!.clone().multiply(m.matrixWorld);
        flat = { rest: Float32Array.from(pos.array as Float32Array), toLeaf, toMesh: toLeaf.clone().invert() };
        flats.current.set(m.geometry, flat);
      }
      for (let i = 0; i < pos.count; i++) {
        v.fromArray(flat.rest, i * 3).applyMatrix4(flat.toLeaf);
        // v.x is how far along the page from the spine, v.z how far off its surface
        const t = Math.min(SEG, Math.max(0, (v.x / W) * SEG));
        const k = Math.min(SEG - 1, Math.floor(t)) * 4;
        const f = t - k / 4;
        const lift = v.z;
        v.x = curve[k] + (curve[k + 4] - curve[k]) * f + (curve[k + 2] + (curve[k + 6] - curve[k + 2]) * f) * lift;
        v.z = curve[k + 1] + (curve[k + 5] - curve[k + 1]) * f + (curve[k + 3] + (curve[k + 7] - curve[k + 3]) * f) * lift;
        v.applyMatrix4(flat.toMesh);
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      pos.needsUpdate = true;
      m.geometry.computeVertexNormals();
      m.geometry.computeBoundingSphere();
    });
  });

  // how wide the page is on screen, for turning a drag in pixels into a turn
  const span = () => {
    const g = root.current;
    if (!g) return 300;
    const p0 = g.localToWorld(new THREE.Vector3(0, 0, 0)).project(album);
    const p1 = v.set(at.current > 0.5 ? -W : W, 0, 0);
    g.localToWorld(p1).project(album);
    return Math.max(80, (Math.abs(p1.x - p0.x) * size.width) / 2);
  };
  // each side can be taken hold of only while it is the page lying open
  // fetch this leaf's photos once the album is open within a couple of turns of it
  const near = live && Math.abs(turned - index) <= 2;
  const frontLive = live && turned === index;
  const backLive = live && turned === index + 1;
  const pressFront = frontLive ? (e: ThreeEvent<PointerEvent>, photo: number | null = null) => startPress(e, photo, index, 0, span()) : undefined;
  const pressBack = backLive ? (e: ThreeEvent<PointerEvent>, photo: number | null = null) => startPress(e, photo, index, 1, span()) : undefined;
  const hover = (on: boolean) => () => {
    if (on) document.body.style.cursor = "grab";
  };
  const leave = (on: boolean) => () => {
    if (on) document.body.style.cursor = "";
  };
  const e = LEAF_T / 2;
  return (
    <group ref={root} position={[0, 0, shutZ]}>
      <group position={[W / 2, 0, e]}>
        <mesh material={front} castShadow receiveShadow onPointerDown={pressFront && ((ev) => pressFront(ev))} onPointerOver={hover(frontLive)} onPointerOut={leave(frontLive)}>
          <planeGeometry args={[PAGE.w, PAGE.h, SEG, 1]} />
        </mesh>
        <group position={[0, 0, 0.0002]}>
          <Face page={frontPage} near={near} onPress={pressFront} />
        </group>
      </group>
      <group position={[W / 2, 0, -e]} rotation={[0, Math.PI, 0]}>
        <mesh material={back} castShadow receiveShadow onPointerDown={pressBack && ((ev) => pressBack(ev))} onPointerOver={hover(backLive)} onPointerOut={leave(backLive)}>
          <planeGeometry args={[PAGE.w, PAGE.h, SEG, 1]} />
        </mesh>
        <group position={[0, 0, 0.0002]}>
          <Face page={frontPage + 1} near={near} onPress={pressBack} />
        </group>
      </group>
    </group>
  );
}

function Cover({ turned }: { turned: number }) {
  const fonts = useFonts();
  const ref = useRef<THREE.Group>(null);
  const at = useRef(0);
  const coverTex = useCanvasTexture(512, 670, (c, w, h) => drawCover(c, w, h, fonts), [fonts]);
  const endTex = useCanvasTexture(512, 670, (c, w, h) => drawEndpaper(c, w, h, fonts), [fonts]);
  const reliefTex = useMemo(() => {
    const t = canvasTexture(512, 670, drawCoverRelief);
    t.colorSpace = THREE.NoColorSpace;
    return t;
  }, []);
  useEffect(() => () => reliefTex.dispose(), [reliefTex]);
  const mats = useMemo(() => {
    // the grey sheet does two jobs: its relief catches the light, and it says how dull each spot is
    const out = new THREE.MeshStandardMaterial({ map: coverTex, roughness: 1, roughnessMap: reliefTex, bumpMap: reliefTex, bumpScale: 1.2 });
    const inside = new THREE.MeshStandardMaterial({ map: endTex, roughness: 0.9 });
    // box faces: +x, -x, +y, -y, +z (outside), -z (inside)
    return [boardMat, boardMat, boardMat, boardMat, out, inside];
  }, [coverTex, endTex, reliefTex]);
  useEffect(
    () => () => {
      mats[4].dispose();
      mats[5].dispose();
    },
    [mats],
  );
  // a stiff board on a hinge: shut it is the top of the right-hand stack, open the bottom of the left
  const shutZ = COVER_T + LEAVES * STEP + COVER_T / 2;
  const openZ = COVER_T / 2;
  const goal = turned > 0 ? 1 : 0;
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    at.current += (goal - at.current) * (1 - Math.exp(-dt * 5.5));
    g.rotation.y = -OPEN * at.current;
    g.position.z = shutZ + (openZ - shutZ) * at.current;
  });
  const z = -COVER_T / 2 - 0.0004;
  return (
    <group ref={ref} position={[0, 0, shutZ]}>
      <mesh position={[W / 2, 0, 0]} material={mats} castShadow receiveShadow>
        <boxGeometry args={[W, H, COVER_T]} />
      </mesh>
      {/* the print set into the cover: the first photograph in the album */}
      {photos.length > 0 && (
        <group position={[W / 2 + W * 0.0525, INSET.y, COVER_T / 2 + 0.0001]}>
          <Picture index={0} maxW={INSET.w} maxH={INSET.h} wanted glow={0.1} />
        </group>
      )}
      {/* brass on the two outer corners */}
      <mesh geometry={brassGeo} material={brassMat} position={[W + 0.0006, -H / 2 - 0.0006, z]} rotation={[0, 0, Math.PI / 2]} castShadow />
      <mesh geometry={brassGeo} material={brassMat} position={[W + 0.0006, H / 2 + 0.0006, z]} rotation={[0, 0, Math.PI]} castShadow />
    </group>
  );
}

export function Album() {
  const focused = useRoom((s) => s.focus === "album");
  const zoomed = useRoom((s) => s.zoomed !== null);
  const turned = useRoom((s) => s.albumTurned);
  const ref = useRef<THREE.Group>(null);
  const lamp = useRef<THREE.PointLight>(null);
  const lastPage = usePageMat(LEAVES * 2, "left");
  usePressHandling();

  // picked up, the cover opens once the album is on its way; put down, it shuts
  useEffect(() => {
    const { setAlbumTurned } = useRoom.getState();
    if (!focused) return setAlbumTurned(0);
    const id = setTimeout(() => {
      click(0.8);
      setAlbumTurned(1);
    }, 420);
    return () => clearTimeout(id);
  }, [focused]);

  useEffect(() => {
    if (!focused || zoomed) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") turnAlbum(1);
      if (e.key === "ArrowLeft") turnAlbum(-1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [focused, zoomed]);

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const k = 1 - Math.exp(-dt * 4.5);
    g.position.lerp(focused ? HELD_POS : REST_POS, k);
    g.quaternion.slerp(focused ? HELD_ROT : REST_ROT, k);
    // held up, the pages are tipped into the lamplight
    if (lamp.current) lamp.current.intensity += ((focused ? 1.0 : 0) - lamp.current.intensity) * k;
  });

  const live = focused && turned >= 1;
  // the last page is pasted down: nothing to turn, but its prints can be looked at
  const pressLast = live && turned === MAX_TURNED ? (e: ThreeEvent<PointerEvent>, photo: number | null = null) => startPress(e, photo, 0, 0, 1) : undefined;
  const thick = COVER_T * 2 + LEAVES * STEP;
  return (
    <Interactive target="album">
      <group ref={ref} position={REST_POS} quaternion={REST_ROT}>
        {/* spine and back cover; the last page is pasted inside the back cover */}
        <mesh position={[-0.0015, 0, thick / 2]} material={boardMat} castShadow>
          <boxGeometry args={[0.003, H, thick]} />
        </mesh>
        <mesh position={[W / 2, 0, COVER_T / 2]} material={boardMat} castShadow receiveShadow>
          <boxGeometry args={[W, H, COVER_T]} />
        </mesh>
        <mesh position={[W / 2, 0, COVER_T + 0.0002]} material={lastPage} onPointerDown={pressLast && ((ev) => pressLast(ev))}>
          <planeGeometry args={[PAGE.w, PAGE.h]} />
        </mesh>
        <group position={[W / 2, 0, COVER_T + 0.0004]}>
          <Face page={LEAVES * 2} near={live && turned >= MAX_TURNED - 2} onPress={pressLast} />
        </group>

        <Cover turned={turned} />
        {Array.from({ length: LEAVES }, (_, i) => (
          <Leaf key={i} index={i + 1} turned={turned} live={live} />
        ))}

        {/* far enough off that a page lifting towards it does not flare */}
        <pointLight ref={lamp} position={[-0.05, 0.14, 0.62]} color="#ffc98c" intensity={0} distance={1.8} decay={1.6} />
      </group>
    </Interactive>
  );
}
