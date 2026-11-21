"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { click } from "@/audio/sfx";
import { Interactive } from "../Interactive";
import { POS, SATURN_GLOBE_R, SATURN_GLOBE_Y, SATURN_SCALE } from "../layout";
import { hint } from "../hint";
import { orbit } from "../orbit";
import { PLANETS, type PlanetId } from "../planets";
import { useRoom } from "../store";

// Model: "Saturn Desk Lamp" by MooseMannequin (Sketchfab Standard licence). See CREDITS.md.
// The file is in metres and 35 cm tall; on this desk it is a smaller one (SATURN_SCALE).
// Its chrome ring and tripod are kept. Its globe is a plain glass ball with no picture on it,
// so it is replaced here by a ball of the same size that carries the surface of a planet.
const SATURN = "/models/sk/saturn_lamp.glb";

// Mercury, Venus, Earth, Mars and Jupiter are the surface maps of the planet models by
// Akshat (CC BY 4.0, see CREDITS.md), reduced to 2048 px. The other three are painted below.
const PHOTOS: Partial<Record<PlanetId, string>> = {
  mercury: "/textures/planets/mercury.jpg",
  venus: "/textures/planets/venus.jpg",
  earth: "/textures/planets/earth.jpg",
  mars: "/textures/planets/mars.jpg",
  jupiter: "/textures/planets/jupiter.jpg",
};

/* ---------- painting the planets there is no map for ---------- */

// Each is painted pixel by pixel onto a map of the whole globe. The patterns come from
// noise read at the point on the sphere each pixel stands for, so they join up across the
// seam and do not pinch at the poles.

const W = 768;
const H = 384;

type RGB = [number, number, number];

const sat = (v: number) => Math.min(1, Math.max(0, v));
const ease = (lo: number, hi: number, v: number) => {
  const t = sat((v - lo) / (hi - lo));
  return t * t * (3 - 2 * t);
};
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function hash(x: number, y: number, z: number, seed: number) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177) + seed) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise(x: number, y: number, z: number, seed: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const s = (t: number) => t * t * (3 - 2 * t);
  const u = s(x - xi);
  const v = s(y - yi);
  const w = s(z - zi);
  const at = (dx: number, dy: number, dz: number) => hash(xi + dx, yi + dy, zi + dz, seed);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  return l(
    l(l(at(0, 0, 0), at(1, 0, 0), u), l(at(0, 1, 0), at(1, 1, 0), u), v),
    l(l(at(0, 0, 1), at(1, 0, 1), u), l(at(0, 1, 1), at(1, 1, 1), u), v),
    w,
  );
}

/** Layered noise, 0-1. */
function fbm(x: number, y: number, z: number, seed: number, octaves: number) {
  let sum = 0;
  let amp = 0.5;
  let total = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x, y, z, seed + i * 17) * amp;
    total += amp;
    amp *= 0.5;
    x *= 2;
    y *= 2;
    z *= 2;
  }
  return sum / total;
}

/** Cloud belts: the colours follow each other from pole to pole, `wobble` bending the edges. */
function belts(palette: RGB[], lat: number, count: number, wobble: number): RGB {
  const b = (lat / Math.PI + 0.5) * count + wobble;
  const i = Math.floor(b);
  const n = palette.length;
  return mix(palette[((i % n) + n) % n], palette[(((i + 1) % n) + n) % n], ease(0.2, 0.8, b - i));
}

/** The colour of a planet at a point on its surface: x, y, z on the unit sphere (y up), and the latitude. */
type Shade = (x: number, y: number, z: number, lat: number) => RGB;
type Painted = Exclude<PlanetId, "mercury" | "venus" | "earth" | "mars" | "jupiter">;

const SHADES: Record<Painted, Shade> = {
  saturn: (x, y, z, lat) => {
    const churn = fbm(x * 2, y * 8, z * 2, 61, 4) - 0.5;
    const streak = fbm(x * 4, y * 46, z * 4, 62, 3);
    const c = belts(
      [
        [236, 196, 122],
        [206, 158, 92],
        [244, 214, 152],
        [190, 140, 80],
      ],
      lat,
      16,
      churn * 0.6,
    );
    return mix(c, [170, 122, 70], (streak - 0.5) * 0.3);
  },
  uranus: (x, y, z, lat) => {
    const n = fbm(x * 2, y * 14, z * 2, 71, 3);
    return mix(mix([150, 216, 224], [178, 232, 236], n), [124, 196, 212], ease(0.5, 1.4, Math.abs(lat)) * 0.6);
  },
  neptune: (x, y, z, lat) => {
    const churn = fbm(x * 2, y * 7, z * 2, 81, 4) - 0.5;
    const streak = fbm(x * 4, y * 34, z * 4, 82, 4);
    const c = belts(
      [
        [38, 76, 196],
        [58, 108, 224],
        [30, 62, 170],
        [72, 128, 232],
      ],
      lat,
      9,
      churn * 1.2,
    );
    return mix(c, [150, 190, 250], ease(0.62, 0.8, streak) * 0.5);
  },
};

/** A soft oval patch, drawn again one map-width to either side so it survives lying on the seam. */
function oval(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, inner: string, outer: string) {
  for (const dx of [-W, 0, W]) {
    ctx.save();
    ctx.translate(x + dx, y);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, inner);
    g.addColorStop(0.6, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** The marks a planet is known by, put on after the surface is painted. */
const MARKS: Partial<Record<Painted, (ctx: CanvasRenderingContext2D) => void>> = {
  neptune: (ctx) => {
    // a dark storm with a scrap of white cloud riding its edge
    oval(ctx, W * 0.62, H * 0.61, 30, 14, "rgba(16,32,110,0.8)", "rgba(16,32,110,0)");
    oval(ctx, W * 0.63, H * 0.66, 20, 3.5, "rgba(236,244,255,0.8)", "rgba(236,244,255,0)");
  },
};

function paintPlanet(id: Painted) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(W, H);
  const shade = SHADES[id];
  for (let py = 0; py < H; py++) {
    const lat = (0.5 - (py + 0.5) / H) * Math.PI;
    const cl = Math.cos(lat);
    const y = Math.sin(lat);
    for (let px = 0; px < W; px++) {
      const lon = (px / W) * Math.PI * 2;
      const c = shade(cl * Math.cos(lon), y, cl * Math.sin(lon), lat);
      const i = (py * W + px) * 4;
      img.data[i] = c[0];
      img.data[i + 1] = c[1];
      img.data[i + 2] = c[2];
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  MARKS[id]?.(ctx);
  return canvas;
}

/* ---------- the maps ---------- */

function dress(t: THREE.Texture) {
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// Each map is made or fetched the first time its planet is chosen, and kept: there are only eight.
const maps = new Map<PlanetId, Promise<THREE.Texture>>();
function planetMap(id: PlanetId) {
  let map = maps.get(id);
  if (!map) {
    const photo = PHOTOS[id];
    map = photo ? new THREE.TextureLoader().loadAsync(photo).then(dress) : Promise.resolve(dress(new THREE.CanvasTexture(paintPlanet(id as Painted))));
    // a map that failed to arrive is asked for again next time
    map.catch(() => maps.delete(id));
    maps.set(id, map);
  }
  return map;
}

/* ---------- the lamp ---------- */

/** where the socket for the flex is on the stand, in the file's own units */
const SOCKET = { min: [-12.4, 11.4, 0.9], max: [-5.5, 17.8, 6.7] };

const GLOBE_Y = SATURN_GLOBE_Y - POS.saturn[1];
/** how big a planet is while it waits to be picked, against its size as the lamp's globe */
const SMALL = 0.36;
const GAP = 0.058;
const SLOT = new THREE.Vector3();
const HOME = new THREE.Vector3(0, GLOBE_Y, 0);

/** Where a planet waits while the lamp is being looked at: in a row above it, or in a column beside it on an upright screen. */
function slot(i: number, upright: boolean, out: THREE.Vector3) {
  const n = i - (PLANETS.length - 1) / 2;
  return upright ? out.set(-0.17, GLOBE_Y + 0.17 - n * GAP, 0.04) : out.set(n * GAP, GLOBE_Y + 0.115, 0.04);
}

/** what the drag and the slow turn have added up to, shared by every globe */
type Turn = { spin: number; pitch: number };

function Globe({ index, map, turn }: { index: number; map: THREE.Texture; turn: React.RefObject<Turn> }) {
  const info = PLANETS[index];
  const chosen = useRoom((s) => s.planet === info.id);
  const held = useRoom((s) => s.focus === "saturn");
  const upright = useThree((s) => s.size.width < s.size.height);
  const at = useRef<THREE.Group>(null);
  const tip = useRef<THREE.Group>(null);
  const ball = useRef<THREE.Mesh>(null);
  const skin = useRef<THREE.MeshStandardMaterial>(null);
  // it starts where it belongs: in the lamp if it is the one showing, otherwise nowhere to be seen
  const size = useRef(chosen ? 1 : 0);

  useFrame((_, dt) => {
    const g = at.current;
    if (!g) return;
    const k = 1 - Math.exp(-dt * 7);
    // the chosen one is the lamp; the others wait in line while the lamp is looked at, and are put away inside it otherwise
    const goal = chosen ? HOME : held ? slot(index, upright, SLOT) : HOME;
    g.position.lerp(goal, k);
    size.current += ((chosen ? 1 : held ? SMALL : 0) - size.current) * k;
    g.visible = size.current > 0.02;
    g.scale.setScalar(Math.max(size.current, 0.001));
    if (ball.current) ball.current.rotation.y = turn.current.spin + index * 0.9;
    if (tip.current) tip.current.rotation.x = turn.current.pitch;
    // from across the room it is a lamp; close up it is turned down so the surface can be read
    if (skin.current) skin.current.emissiveIntensity += ((held ? (chosen ? 0.62 : 0.8) : 1.1) - skin.current.emissiveIntensity) * (1 - Math.exp(-dt * 4));
  });

  const pick = held && !chosen;
  return (
    <group ref={at} position={HOME} scale={chosen ? 1 : 0.001} visible={chosen}>
      <group ref={tip}>
        <group rotation={[0, 0, info.tilt]}>
          {/* it is the light, so it casts no shadow of its own */}
          <mesh
            ref={ball}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              if (!pick) return;
              e.stopPropagation();
              click(1.1);
              document.body.style.cursor = "";
              useRoom.getState().setTip(null);
              useRoom.getState().setPlanet(info.id);
            }}
            onPointerOver={(e: ThreeEvent<PointerEvent>) => {
              // the one that is the lamp is there to be turned; the others, to be picked
              if (held && chosen) hint(info.about, "grab");
              if (!pick) return;
              e.stopPropagation();
              document.body.style.cursor = "pointer";
              useRoom.getState().setTip(info.about);
            }}
            onPointerOut={() => {
              if (!held) return;
              document.body.style.cursor = "";
              if (useRoom.getState().tip === info.about) useRoom.getState().setTip(null);
            }}
          >
            <sphereGeometry args={[SATURN_GLOBE_R, 64, 40]} />
            <meshStandardMaterial ref={skin} map={map} emissiveMap={map} color="#6a6a6a" emissive="#ffffff" emissiveIntensity={1.1} roughness={0.55} toneMapped={false} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/**
 * The Saturn lamp at the right-hand end of the desk: a glowing globe for the side the desk lamp
 * does not reach. Looked at close up, the other planets come out of it and line up; clicking
 * one makes it the lamp. A drag turns them.
 */
export function SaturnLamp() {
  const { scene } = useGLTF(SATURN);
  const planet = useRoom((s) => s.planet);
  const held = useRoom((s) => s.focus === "saturn");
  const [got, setGot] = useState<Partial<Record<PlanetId, THREE.Texture>>>({});
  // the others are only fetched once the lamp has been looked at
  const [opened, setOpened] = useState(false);
  if (held && !opened) setOpened(true);

  useEffect(() => {
    let alive = true;
    for (const p of PLANETS) {
      if (!opened && p.id !== planet) continue;
      planetMap(p.id).then(
        (map) => alive && setGot((g) => (g[p.id] ? g : { ...g, [p.id]: map })),
        () => {},
      );
    }
    return () => {
      alive = false;
    };
  }, [planet, opened]);

  const stand = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = (m.material as THREE.MeshPhysicalMaterial).clone();
      if (mat.name.startsWith("saturn_") || mat.name.startsWith("saturnCord")) {
        // the file's own globe: the ones below take its place. And its flex: this one has none trailing off it.
        m.visible = false;
      } else {
        // The socket the flex plugged into is part of the stand's one mesh. It is the only
        // thing in its corner of it, so the faces that lie wholly there are taken out.
        if (m.geometry.index) {
          const g = m.geometry.clone();
          const at = g.attributes.position;
          const inSocket = (i: number) => {
            const x = at.getX(i);
            const y = at.getY(i);
            const z = at.getZ(i);
            return x > SOCKET.min[0] && x < SOCKET.max[0] && y > SOCKET.min[1] && y < SOCKET.max[1] && z > SOCKET.min[2] && z < SOCKET.max[2];
          };
          const kept: number[] = [];
          for (let t = 0; t < g.index!.count; t += 3) {
            const tri = [g.index!.getX(t), g.index!.getX(t + 1), g.index!.getX(t + 2)];
            if (!tri.every(inSocket)) kept.push(...tri);
          }
          g.setIndex(kept);
          m.geometry = g;
        }
        m.castShadow = true;
        m.receiveShadow = true;
        mat.envMapIntensity = 1.6;
      }
      m.material = mat;
    });
    return c;
  }, [scene]);

  const lightColour = useMemo(() => new THREE.Color(PLANETS.find((p) => p.id === planet)!.light), [planet]);
  const light = useRef<THREE.PointLight>(null);
  const turn = useRef<Turn>({ spin: 0, pitch: 0 });
  const drag = useRef({ last: 0, wasHeld: false });

  useFrame(({ clock }, dt) => {
    const t = turn.current;
    const d = drag.current;
    // in the hand, the drag turns them; left alone, they go round slowly by themselves
    if (held && d.wasHeld) t.spin -= orbit.yaw - d.last;
    d.last = orbit.yaw;
    d.wasHeld = held;
    if (!(held && orbit.dragging)) t.spin += dt * 0.1;
    t.pitch += ((held ? orbit.pitch : 0) - t.pitch) * (1 - Math.exp(-dt * 10));
    if (light.current) {
      // a slow breath, barely there
      light.current.intensity = 0.85 + Math.sin(clock.elapsedTime * 0.7) * 0.04;
      light.current.color.lerp(lightColour, 1 - Math.exp(-dt * 4));
    }
  });

  return (
    <Interactive target="saturn" position={POS.saturn}>
      <primitive object={stand} scale={SATURN_SCALE} rotation={[0, 0.9, 0]} />
      {PLANETS.map((p, i) => {
        const map = got[p.id];
        return map ? <Globe key={p.id} index={i} map={map} turn={turn} /> : null;
      })}
      <pointLight ref={light} position={HOME} color={PLANETS.find((p) => p.id === "mars")!.light} distance={4} decay={1.7} />
    </Interactive>
  );
}

useGLTF.preload(SATURN);
