"use client";

/* eslint-disable react-hooks/refs -- the press handlers read the leaf ref when the pointer goes down, not while rendering */

import { asset } from "@/asset";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { click } from "@/audio/sfx";
import { photos, type Photo } from "@/content/photos";
import { strings } from "@/content/strings";
import { useLang } from "@/state/lang";
import { drawPlaceholder, LEAVES, MAX_TURNED, PER_PAGE } from "../album";
import { Interactive } from "../Interactive";
import { ALBUM_HELD, POS } from "../layout";
import { orbit } from "../orbit";
import { hint } from "../hint";
import { useRoom } from "../store";
import { canvasTexture, paper, rng, useCanvasTexture, useFonts, type Fonts } from "../textures";

// A photo album. Its binding is an old leather-bound book (see "the binding", below); its
// pages and prints are made here. Shut, it lies on the desk. Focused, it is lifted towards the chair and the cover swings open
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

/* ---------- the binding ---------- */

// Model: "Old Book" by Mike Rowley (CC BY 4.0). See CREDITS.md. Its covers and its rounded
// spine are the album's binding. In the file the book lies shut and is one piece; here the
// front board is cut from the rest so that it can swing open, and the whole is pressed flat
// to the album's thickness. The lettering on it is left off, and this album's own put on.
const BOOK = asset("/models/sk/old_book.glb");
// The file, in its own units: the book lies on its back, its spine along x at z = 0 or so,
// its boards running out to z = -7.16; the front board is the top 0.2 or so of its height.
const FILE = { hinge: -0.74, fore: -7.16, top: 2.45, foot: 0.27, x0: -6.51, x1: 4.16, board: 2.17 };
const THICK = COVER_T * 2 + LEAVES * STEP;
/** where the front board lies when the album is shut: the top of the stack */
const SHUT_Z = COVER_T + LEAVES * STEP + COVER_T / 2;

/** The two halves of the binding, in the album's own space: the front board about its hinge, and the spine with the back board. */
function useBinding() {
  const { scene } = useGLTF(BOOK);
  return useMemo(() => {
    scene.updateMatrixWorld(true);
    const front: { geometry: THREE.BufferGeometry; material: THREE.Material }[] = [];
    const rest: { geometry: THREE.BufferGeometry; material: THREE.Material }[] = [];
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !o.name.toLowerCase().includes("cover") || o.name.includes("Front")) return;
      const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
      if (!g.index) return;
      const at = g.attributes.position;
      // which faces are the front board: high up, and out past the hinge
      const board: number[] = [];
      const other: number[] = [];
      for (let t = 0; t < g.index.count; t += 3) {
        const tri = [g.index.getX(t), g.index.getX(t + 1), g.index.getX(t + 2)];
        const y = tri.reduce((sum, i) => sum + at.getY(i), 0) / 3;
        const z = tri.reduce((sum, i) => sum + at.getZ(i), 0) / 3;
        (y > FILE.board && z < FILE.hinge + 0.14 ? board : other).push(...tri);
      }
      // into the album's space: across from the hinge, up the page, out of the cover
      const across = W / (FILE.hinge - FILE.fore);
      for (let i = 0; i < at.count; i++) {
        const out = FILE.hinge - at.getZ(i);
        at.setXYZ(
          i,
          // the round of the spine is kept shallow: it is a slim album, not a ledger
          out >= 0 ? out * across : out * across * 0.42,
          -(at.getX(i) - (FILE.x0 + FILE.x1) / 2) * (H / (FILE.x1 - FILE.x0)),
          ((at.getY(i) - FILE.foot) / (FILE.top - FILE.foot)) * THICK,
        );
      }
      // plain leather, with none of the file's mottling: the boards dark, the spine a shade redder
      const spine = (m.material as THREE.Material).name === "Material.001";
      const material = new THREE.MeshStandardMaterial({ color: spine ? "#4a2d1f" : "#3a2a22", roughness: spine ? 0.7 : 0.8, envMapIntensity: 0.5, side: THREE.DoubleSide });
      const a = g.clone();
      a.setIndex(board);
      a.translate(0, 0, -SHUT_Z);
      a.computeVertexNormals();
      const b = g;
      b.setIndex(other);
      b.computeVertexNormals();
      if (board.length) front.push({ geometry: a, material });
      if (other.length) rest.push({ geometry: b, material });
    });
    return { front, rest };
  }, [scene]);
}

// All there is on the front board: one line, written small near the top in a joined-up hand.
function drawTitle(ctx: CanvasRenderingContext2D, w: number, h: number, fonts: Fonts | null) {
  ctx.clearRect(0, 0, w, h);
  if (!fonts) return;
  ctx.fillStyle = "#d8b876";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `400 27px ${fonts.script}`;
  ctx.fillText("The world through my lens", w / 2, h * 0.17, w - 120);
}

/* ---------- painted pages ---------- */

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

// The inside of the front board: the same leather, turned in, with nothing on it.
function drawEndpaper(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "#3a2a22";
  ctx.fillRect(0, 0, w, h);
  const r = rng(23);
  for (let i = 0; i < 5200; i++) {
    ctx.fillStyle = `rgba(${r() > 0.55 ? "255,210,170" : "10,4,0"},${0.03 + r() * 0.06})`;
    ctx.beginPath();
    ctx.arc(r() * w, r() * h, 0.6 + r() * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  const wear = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.75);
  wear.addColorStop(0, "rgba(255,200,150,0.06)");
  wear.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = wear;
  ctx.fillRect(0, 0, w, h);
}

/* ---------- prints ---------- */

/**
 * The picture for one slot, and its proportions: the file once it has loaded, a stand-in
 * until then. Nothing is fetched until `wanted`, so only the pages near the open one cost
 * anything; once fetched, a photo is kept.
 */
/** What is in the album: the photographs, and before them the one taken here with the Canonet, if one has been. */
function useAlbumPhotos(): Photo[] {
  const shot = useRoom((s) => s.shot);
  return useMemo(() => {
    // it goes in only if there is a slot to spare for it
    const room = (LEAVES * 2 + 1) * PER_PAGE > photos.length;
    return shot && room ? [{ src: shot, caption: { id: strings.id.shot_caption, en: strings.en.shot_caption } }, ...photos] : photos;
  }, [shot]);
}

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
  const list = useAlbumPhotos();
  const { tex, aspect } = usePhoto(list[index], index, strings[lang].photo_slot, wanted);
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
        onPointerOver={(e) => {
          if (!onPress) return;
          // the photo is what is under the pointer, not the page it is on
          e.stopPropagation();
          hint("tip_photo", "zoom-in");
        }}
        onPointerOut={() => {
          if (onPress) hint(null);
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
// moves drags the page over by hand; let go a third of the way across and it falls on over.
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
      // The page's edge crosses two page-widths of screen on its way over, but the hand that
      // took it by its middle cannot: a drag of a little over one page-width takes it right across.
      pull.a = Math.min(1, Math.max(0, press.from - dx / (press.span * 1.25)));
    };
    const up = () => {
      const p = press;
      press = null;
      orbit.locked = false;
      if (!p) return;
      const s = useRoom.getState();
      if (p.moved) {
        if (pull.leaf < 0) return;
        // let go a third of the way from where it started, it carries on over; short of that it falls back
        const over = p.from === 0 ? pull.a > 0.32 : pull.a > 0.68;
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
  const count = useAlbumPhotos().length;
  return (
    <>
      {Array.from({ length: PER_PAGE }, (_, slot) => first + slot)
        .filter((i) => i < count)
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
    if (on) hint("tip_page", "grab");
  };
  const leave = (on: boolean) => () => {
    if (on) hint(null);
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

function Cover({ turned, binding }: { turned: number; binding: ReturnType<typeof useBinding> }) {
  const fonts = useFonts();
  const ref = useRef<THREE.Group>(null);
  const at = useRef(0);
  const endTex = useCanvasTexture(512, 670, (c, w, h) => drawEndpaper(c, w, h), []);
  const titleTex = useCanvasTexture(512, 670, (c, w, h) => drawTitle(c, w, h, fonts), [fonts]);
  // a stiff board on a hinge: shut it is the top of the right-hand stack, open the bottom of the left
  const openZ = COVER_T / 2;
  const goal = turned > 0 ? 1 : 0;
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    at.current += (goal - at.current) * (1 - Math.exp(-dt * 5.5));
    g.rotation.y = -OPEN * at.current;
    g.position.z = SHUT_Z + (openZ - SHUT_Z) * at.current;
  });
  return (
    <group ref={ref} position={[0, 0, SHUT_Z]}>
      {binding.front.map((part, i) => (
        <mesh key={i} geometry={part.geometry} material={part.material} castShadow receiveShadow />
      ))}
      {/* the one line written on the leather */}
      <mesh position={[W / 2, 0, COVER_T / 2 + 0.0004]}>
        <planeGeometry args={[W * 0.9, H * 0.9]} />
        <meshStandardMaterial map={titleTex} emissiveMap={titleTex} emissive="#ffffff" emissiveIntensity={0.25} transparent metalness={0.85} roughness={0.38} envMapIntensity={2} depthWrite={false} />
      </mesh>
      {/* and the endpaper pasted inside it */}
      <mesh position={[W / 2, 0, COVER_T / 2 - (THICK / (FILE.top - FILE.foot)) * 0.26]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[PAGE.w, PAGE.h]} />
        <meshStandardMaterial map={endTex} roughness={0.85} />
      </mesh>
    </group>
  );
}

export function Album() {
  const focused = useRoom((s) => s.focus === "album");
  const zoomed = useRoom((s) => s.zoomed !== null);
  const turned = useRoom((s) => s.albumTurned);
  const ref = useRef<THREE.Group>(null);
  const lamp = useRef<THREE.PointLight>(null);
  const spine = useRef<THREE.Group>(null);
  const lastPage = usePageMat(LEAVES * 2, "left");
  const binding = useBinding();
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
    // Shut, the spine stands the height of the book. Opened flat, a spine lies down under the
    // spread; left standing it would come up through the cover and the pages turned onto it.
    if (spine.current) spine.current.scale.z += ((turned > 0 ? 0.1 : 1) - spine.current.scale.z) * (1 - Math.exp(-dt * 7));
    // held up, the pages are tipped into the lamplight
    if (lamp.current) lamp.current.intensity += ((focused ? 1.0 : 0) - lamp.current.intensity) * k;
  });

  const live = focused && turned >= 1;
  // the last page is pasted down: nothing to turn, but its prints can be looked at
  const pressLast = live && turned === MAX_TURNED ? (e: ThreeEvent<PointerEvent>, photo: number | null = null) => startPress(e, photo, 0, 0, 1) : undefined;
  return (
    <Interactive target="album">
      <group ref={ref} position={REST_POS} quaternion={REST_ROT}>
        {/* spine and back cover; the last page is pasted inside the back cover */}
        <group ref={spine}>
          {binding.rest.map((part, i) => (
            <mesh key={i} geometry={part.geometry} material={part.material} castShadow receiveShadow />
          ))}
        </group>
        <mesh position={[W / 2, 0, COVER_T + 0.0002]} material={lastPage} onPointerDown={pressLast && ((ev) => pressLast(ev))}>
          <planeGeometry args={[PAGE.w, PAGE.h]} />
        </mesh>
        <group position={[W / 2, 0, COVER_T + 0.0004]}>
          <Face page={LEAVES * 2} near={live && turned >= MAX_TURNED - 2} onPress={pressLast} />
        </group>

        <Cover turned={turned} binding={binding} />
        {Array.from({ length: LEAVES }, (_, i) => (
          <Leaf key={i} index={i + 1} turned={turned} live={live} />
        ))}

        {/* far enough off that a page lifting towards it does not flare */}
        <pointLight ref={lamp} position={[-0.05, 0.14, 0.62]} color="#ffc98c" intensity={0} distance={1.8} decay={1.6} />
      </group>
    </Interactive>
  );
}

useGLTF.preload(BOOK);
