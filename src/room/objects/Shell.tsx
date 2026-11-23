"use client";

/* eslint-disable react-hooks/immutability -- three.js geometry and uniforms are mutable by design */

import { asset } from "@/asset";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox, useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { DESK, LAMP_LIGHT_OFFSET, POS, SILL, WALL_Z, WIN } from "../layout";
import { useRoom } from "../store";
import { canvasTexture, rng } from "../textures";
import { useClone } from "./Guitar";

function usePbr(id: string, repeatX: number, repeatY: number) {
  const maps = useTexture({
    map: `/textures/${id}/diff.jpg`,
    normalMap: `/textures/${id}/nor.jpg`,
    roughnessMap: `/textures/${id}/rough.jpg`,
  });
  return useMemo(() => {
    const out = {} as typeof maps;
    for (const key of Object.keys(maps) as (keyof typeof maps)[]) {
      const t = maps[key].clone();
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeatX, repeatY);
      t.anisotropy = 8;
      if (key === "map") t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
      out[key] = t;
    }
    return out;
  }, [maps, repeatX, repeatY]);
}

const ROOM = { left: -2.25, right: 3.2, h: 2.9, depth: 5 };
const ROOM_W = ROOM.right - ROOM.left;
const ROOM_X = (ROOM.left + ROOM.right) / 2;

// The view outside is a photograph: a crop of Poly Haven's "Vignaioli Night" panorama
// (CC0), a small Italian square on a wet night. The crop covers these angles, so each
// pixel of glass can look up the direction its line of sight leaves the room in.
// Because the lookup follows the camera, the square slides behind the window frame as
// you move, the way a real view does. See scripts/fetch-assets.mjs and CREDITS.md.
const VIEW_URL = "/textures/window/vignaioli_night.jpg";
const VIEW = { lon: 64.8, latMin: -25, latMax: 45 }; // degrees: ±lon either side of straight ahead

/**
 * Rain on a misted window. The glass is fogged, which blurs the square outside; drops
 * running down wipe clear tracks through the mist, and every drop is a small lens that
 * shows the view bent and sharp. Behind the glass, three sheets of falling rain at
 * different distances drift against each other and against the buildings.
 */
const rainFrag = /* glsl */ `
  uniform float uTime;
  uniform sampler2D uView;
  uniform vec3 uLamp;      // the desk lamp, mirrored in the glass
  uniform float uGlassZ;
  uniform float uAspect;
  uniform vec4 uAngles;    // of the photo, in radians: longitude half-span, lowest latitude, highest latitude
  varying vec2 vUv;
  varying vec3 vWorld;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  vec2 hash2(vec2 p) { return vec2(hash(p), hash(p + 17.3)); }

  vec3 outside(vec3 dir, float lod) {
    float lon = atan(dir.x, -dir.z);
    float lat = asin(clamp(dir.y, -1.0, 1.0));
    vec2 uv = vec2(lon / (2.0 * uAngles.x) + 0.5, (lat - uAngles.y) / (uAngles.z - uAngles.y));
    return texture2D(uView, clamp(uv, 0.003, 0.997), lod).rgb;
  }

  // the view through fogged glass: a wide, soft blur
  vec3 misted(vec3 dir, float amount) {
    float lod = amount * 2.7;
    float rad = amount * 0.013;
    vec3 acc = outside(dir, lod) * 2.0;
    for (int i = 0; i < 6; i++) {
      float a = float(i) * 1.0472 + 0.5;
      acc += outside(normalize(dir + vec3(cos(a), sin(a), 0.0) * rad), lod);
    }
    return acc / 8.0;
  }

  // drops sliding down in columns: xy = how the drop bends the view, z = water, w = track wiped in the mist
  vec4 runners(vec2 uv, float cols, float t, float seed, float size) {
    float cid = floor(uv.x * cols);
    float s = hash(vec2(cid, seed));
    float fx = fract(uv.x * cols) - 0.5;
    float rows = 1.3 + s * 1.2;
    // a drop sits where it is, creeping a hair, then lets go all at once: a quick hard slide
    // down the glass that stops dead again
    float beat = 0.3 + s * 0.4;
    float ph = t * beat + s * 31.0;
    float f = fract(ph);
    float slide = 1.0 - pow(1.0 - clamp(f / 0.08, 0.0, 1.0), 2.5);
    float tj = floor(ph) + slide * 0.96 + f * 0.04;
    float y = (uv.y + tj * (0.14 + s * 0.22) + s * 7.31) * rows;
    float rid = floor(y);
    float fy = fract(y);
    float h = hash(vec2(cid * 3.1 + seed, rid));
    if (h < 0.42) return vec4(0.0);
    // a drop sticks, creeps, then lets go
    float headY = 0.22 + 0.09 * sin(t * (0.7 + h) + h * 40.0);
    float wob = sin(uv.y * 21.0 + h * 30.0) * 0.1 + sin(uv.y * 47.0 + h * 11.0) * 0.04;
    float dx = (fx - (h - 0.5) * 0.3 - wob * 0.6) / cols;
    float dy = (fy - headY) / rows;
    float r = (0.0026 + 0.003 * h) * size;
    // a teardrop: round below, drawn out above
    vec2 d = vec2(dx, dy > 0.0 ? dy * 0.55 : dy);
    float head = smoothstep(r, r * 0.35, length(d));
    float tw = r * 0.5;
    float track = smoothstep(tw, tw * 0.25, abs(dx)) * smoothstep(headY, headY + 0.04, fy) * smoothstep(0.75, 0.3, fy);
    // the track breaks up into beads as it dries
    float broken = 0.55 + 0.45 * smoothstep(-0.3, 0.3, sin(uv.y * 240.0 + s * 50.0) * sin(uv.y * 71.0 + h * 9.0));
    return vec4(d / r * head, head, track * broken);
  }

  // drops that sit still, grow slowly and are replaced
  vec3 beads(vec2 uv, float scale, float t) {
    vec2 g = uv * scale;
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    float h = hash(id);
    vec2 c = (hash2(id + 3.7) - 0.5) * 0.4;
    float life = fract(h * 9.0 + t * 0.02 * (0.5 + h));
    float r = (0.05 + 0.13 * hash(id + 9.1)) * smoothstep(0.0, 0.15, life) * smoothstep(1.0, 0.92, life);
    float m = smoothstep(r, r * 0.5, length(f - c)) * step(0.4, h);
    return vec3((f - c) / max(r, 0.001) * m, m);
  }

  // one sheet of rain falling a given distance beyond the glass
  float rain(vec3 dir, float depth, float dens, float speed, float seed) {
    float k = (uGlassZ - depth - cameraPosition.z) / dir.z;
    vec2 p = (cameraPosition + dir * k).xy;
    p.x += p.y * 0.16; // a little wind
    vec2 q = vec2(p.x * dens, p.y * dens * 0.035 + uTime * speed + seed);
    vec2 f = fract(q);
    float h = hash(floor(q) + seed);
    float line = smoothstep(0.5, 0.0, abs(f.x - 0.5 - (h - 0.5) * 0.6) * 8.0);
    float seg = smoothstep(0.0, 0.2, f.y) * smoothstep(1.0, 0.45, f.y);
    return step(0.5, h) * line * seg;
  }

  void main() {
    vec3 dir = normalize(vWorld - cameraPosition);
    vec2 g = vec2(vUv.x * uAspect, vUv.y);

    vec4 r1 = runners(g, 14.0, uTime, 1.0, 1.0);
    vec4 r2 = runners(g + vec2(0.37, 0.0), 23.0, uTime * 1.2, 5.0, 0.8);
    vec4 r3 = runners(g + vec2(0.11, 0.3), 37.0, uTime * 0.8, 9.0, 0.6);
    vec3 b1 = beads(g, 64.0, uTime);
    vec3 b2 = beads(g + 7.3, 118.0, uTime);
    vec2 bend = r1.xy + r2.xy + r3.xy * 0.8 + b1.xy * 0.8 + b2.xy * 0.6;
    float water = clamp(r1.z + r2.z + r3.z + b1.z + b2.z, 0.0, 1.0);
    float wiped = clamp(water + r1.w + r2.w + r3.w, 0.0, 1.0);

    // condensation is heavier low on the pane and near the frame
    vec2 edge = vUv * (1.0 - vUv);
    float mist = 0.3 + 0.5 * smoothstep(0.7, 0.0, vUv.y) + 0.3 * smoothstep(0.05, 0.0, min(edge.x, edge.y));
    mist = clamp(mist, 0.0, 1.0) * (1.0 - wiped);

    // each drop is a lens: it shows the view sharp, wide and turned over
    vec3 seen = normalize(dir + vec3(-bend * 0.5, 0.0) * water);
    vec3 col = misted(seen, mist);

    // rain in the air outside, lit from behind by the lamps in the square
    float lum = dot(col, vec3(0.3, 0.6, 0.1));
    float falling = rain(dir, 0.7, 26.0, 9.5, 1.0) * 0.4 + rain(dir, 2.2, 15.0, 6.5, 4.0) * 0.3 + rain(dir, 5.5, 8.0, 4.2, 8.0) * 0.22;

    // night outside: darker than the room, with the lamps left burning
    col = pow(col, vec3(1.9)) * vec3(0.25, 0.3, 0.44);
    col += pow(max(col - 0.13, 0.0), vec3(2.0)) * 16.0;

    // rain is added after the night grade, or the grade crushes it to dots wherever the view is dark:
    // long pale streaks all across the pane, a little brighter where the lamps light the air
    col += falling * (0.1 + lum * 0.3) * vec3(0.5, 0.64, 0.82) * (1.0 - water);

    // water catches the light along its upper edge, and the glass mirrors the desk lamp
    col += water * max(dot(normalize(bend + 0.0001), vec2(-0.5, 0.86)), 0.0) * 0.05;
    float lamp = max(dot(dir, normalize(uLamp - cameraPosition)), 0.0);
    col += vec3(1.0, 0.7, 0.4) * (pow(lamp, 900.0) * 0.22 + pow(lamp, 60.0) * 0.012);
    col += mist * vec3(0.006, 0.007, 0.01);

    gl_FragColor = vec4(col, 1.0);
  }
`;

const rainVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

// Model: "Window" by adventurer (CC BY 4.0). See CREDITS.md. The outer frame and the two sashes
// are used, scaled to stand a little proud of the hole in the wall; the leaf over the top is left
// out. In the file it is 2.37 m wide and 2.27 m tall (the frame), with its middle 1.1355 m up.
const WINDOW = asset("/models/window/scene.gltf");
const WINDOW_SCALE = (WIN.w + 0.08) / 2.37;
/** the glass: the city behind it is drawn on a plane just inside the frame's depth */
const GLASS_Z = -0.115;

function WindowFrame() {
  const scene = useClone(WINDOW);
  useEffect(() => {
    scene.traverse((o) => {
      if (o.name === "UP") o.visible = false;
      const m = o as THREE.Mesh;
      if (m.isMesh && !o.name.includes("_g_")) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
  }, [scene]);
  return <primitive object={scene} position={[0, -1.1355 * WINDOW_SCALE, -0.045]} scale={WINDOW_SCALE} />;
}

/**
 * Pale oak veneer for the sill, using the colour and roughness maps from the supplied glTF.
 * Tiled along the board and wrapped over a rounded edge, so it reads as a finished timber lip.
 */
function useSillWood() {
  const maps = useTexture({
    map: "/textures/oak_veneer_01/diff.jpg",
    roughnessMap: "/textures/oak_veneer_01/rough.jpg",
  });
  return useMemo(() => {
    const out = {} as typeof maps;
    for (const key of Object.keys(maps) as (keyof typeof maps)[]) {
      const t = maps[key].clone();
      t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
      t.center.set(0.5, 0.5);
      t.rotation = Math.PI / 2;
      t.repeat.set(1.5, 1);
      t.anisotropy = 8;
      if (key === "map") t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
      out[key] = t;
    }
    return out;
  }, [maps]);
}

function CityWindow() {
  const sillWood = useSillWood();
  const mat = useRef<THREE.ShaderMaterial>(null);
  const photo = useTexture(VIEW_URL);
  const uniforms = useMemo(() => {
    const view = photo.clone();
    view.colorSpace = THREE.SRGBColorSpace;
    view.anisotropy = 4;
    view.needsUpdate = true;
    const rad = Math.PI / 180;
    // where the desk lamp appears to be, seen in the glass
    const glassZ = POS.window[2] + GLASS_Z;
    const lamp = new THREE.Vector3(POS.lamp[0] + LAMP_LIGHT_OFFSET[0], POS.lamp[1] + LAMP_LIGHT_OFFSET[1], 2 * glassZ - (POS.lamp[2] + LAMP_LIGHT_OFFSET[2]));
    return {
      uTime: { value: 0 },
      uView: { value: view },
      uLamp: { value: lamp },
      uGlassZ: { value: glassZ },
      uAspect: { value: WIN.w / WIN.h },
      uAngles: { value: new THREE.Vector4(VIEW.lon * rad, VIEW.latMin * rad, VIEW.latMax * rad, 0) },
    };
  }, [photo]);
  useFrame((_, dt) => {
    if (mat.current && useRoom.getState().booted) mat.current.uniforms.uTime.value += dt;
  });
  return (
    <group position={POS.window}>
      <mesh position={[0, 0, GLASS_Z]}>
        <planeGeometry args={[WIN.w, WIN.h]} />
        <shaderMaterial ref={mat} vertexShader={rainVert} fragmentShader={rainFrag} uniforms={uniforms} toneMapped={false} />
      </mesh>
      <WindowFrame />
      {/* sill */}
      <RoundedBox args={[WIN.w + 0.3, 0.035, 0.2]} radius={0.008} smoothness={3} position={[0, -WIN.h / 2 - 0.035, 0.06]} castShadow receiveShadow>
        <meshStandardMaterial {...sillWood} roughness={1} />
      </RoundedBox>
    </group>
  );
}

/**
 * Plain woven cloth, tiled: threads over and under, a few thick slubs, fibre fuzz and speckle.
 * It serves both as the colour and as the bump, so every thread catches the light.
 */
function useCloth(base: string, tile: number, repeatX: number, repeatY: number) {
  return useMemo(() => {
    const make = (grey: boolean) => {
      const t = canvasTexture(tile, tile, (ctx, w, h) => {
        const r = rng(41);
        ctx.fillStyle = grey ? "#808080" : base;
        ctx.fillRect(0, 0, w, h);
        // slow mottling in the cloth: dye and wear, patches a few centimetres across
        for (let i = 0; i < 90; i++) {
          const x = r() * w;
          const y = r() * h;
          const rad = 30 + r() * 110;
          const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
          const dark = r() < 0.5;
          g.addColorStop(0, grey ? `rgba(${dark ? "0,0,0" : "255,255,255"},0.05)` : `rgba(${dark ? "120,86,50" : "255,244,222"},0.1)`);
          g.addColorStop(1, "rgba(128,128,128,0)");
          ctx.fillStyle = g;
          ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
        }
        // a coarse linen weave, threads about 3 mm across so they still show from across the room
        const n = 40;
        const step = w / n;
        for (let i = 0; i < n; i++) {
          const slubV = r() < 0.16 ? 1 : 0;
          const slubH = r() < 0.16 ? 1 : 0;
          const toneV = (r() - 0.5) * 0.12;
          const toneH = (r() - 0.5) * 0.12;
          // warp, running down
          ctx.fillStyle = grey ? `rgba(255,255,255,${0.2 + slubV * 0.25})` : `rgba(${toneV > 0 ? "255,246,226" : "95,68,38"},${0.1 + Math.abs(toneV) + slubV * 0.14})`;
          ctx.fillRect(i * step, 0, step * (0.62 + slubV * 0.25), h);
          // weft, running across
          ctx.fillStyle = grey ? `rgba(0,0,0,${0.2 + slubH * 0.25})` : `rgba(${toneH > 0 ? "255,246,226" : "95,68,38"},${0.1 + Math.abs(toneH) + slubH * 0.14})`;
          ctx.fillRect(0, i * step, w, step * (0.55 + slubH * 0.3));
        }
        // each crossing: a small dome, so the weave reads as threads going over and under
        for (let y = 0; y < n; y++) {
          for (let x = 0; x < n; x++) {
            const over = (x + y) % 2 === 0;
            const cx = (x + 0.5) * step;
            const cy = (y + 0.5) * step;
            const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, step * 0.7);
            g.addColorStop(0, grey ? (over ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.2)") : over ? "rgba(255,248,232,0.12)" : "rgba(80,56,30,0.1)");
            g.addColorStop(1, "rgba(128,128,128,0)");
            ctx.fillStyle = g;
            ctx.fillRect(x * step - step * 0.3, y * step - step * 0.3, step * 1.6, step * 1.6);
          }
        }
        // loose fibres lying across the surface
        for (let i = 0; i < 700; i++) {
          ctx.strokeStyle = grey ? (r() > 0.5 ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.14)") : r() > 0.5 ? "rgba(255,250,238,0.22)" : "rgba(100,72,42,0.14)";
          ctx.lineWidth = 0.7;
          const x = r() * w;
          const y = r() * h;
          const a = r() * 6.28;
          const len = 5 + r() * 16;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
          ctx.stroke();
        }
      });
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      t.repeat.set(repeatX, repeatY);
      return t;
    };
    return { map: make(false), bump: make(true) };
  }, [base, tile, repeatX, repeatY]);
}

/**
 * A hanging curtain: a sheet of cloth with soft vertical folds, stirring in a slow draught.
 * The rail holds the top still; the hem swings most. `side` is which way is away from the window.
 */
function Curtain({ x, width, seed, side }: { x: number; width: number; seed: number; side: 1 | -1 }) {
  const top = WIN.y + WIN.h / 2 + 0.16;
  // it hangs from the rail to just above the sill, so it clears what stands there and what hangs on the wall below
  const bottom = SILL.y + 0.06;
  // a tile of linen is about 12 cm across
  const cloth = useCloth("#d8c2a0", 1024, width / 0.12, (top - bottom) / 0.12);
  useEffect(
    () => () => {
      cloth.map.dispose();
      cloth.bump.dispose();
    },
    [cloth],
  );
  const { geo, rest, phase } = useMemo(() => {
    const r = rng(seed);
    const g = new THREE.PlaneGeometry(width, top - bottom, 20, 8);
    const p = g.attributes.position;
    const phase = r() * 6;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) / width + 0.5;
      const v = p.getY(i) / (top - bottom) + 0.5; // 0 bottom, 1 top
      // folds are tight at the rail and open out towards the hem
      const depth = 0.012 + (1 - v) * 0.022;
      p.setZ(i, Math.sin(u * 22 + phase) * depth + Math.sin(u * 9 + phase * 2) * depth * 0.6);
      p.setX(i, p.getX(i) * (0.9 + (1 - v) * 0.1));
    }
    g.computeVertexNormals();
    return { geo: g, rest: Float32Array.from(p.array as Float32Array), phase };
  }, [width, top, bottom, seed]);
  useEffect(() => () => geo.dispose(), [geo]);

  const frozenT = useRef(0);
  const lastUpdate = useRef(0);
  useFrame(({ clock }, dt) => {
    const s = useRoom.getState();
    if (s.booted) frozenT.current += dt;
    // curtains are in the background — 15 fps is plenty, and skip entirely when focused on something
    if (s.focus !== null) return;
    const now = clock.elapsedTime;
    if (now - lastUpdate.current < 1 / 15) return;
    lastUpdate.current = now;
    const t = frozenT.current;
    const p = geo.attributes.position as THREE.BufferAttribute;
    const height = top - bottom;
    const gust = 0.45 + 0.35 * Math.sin(t * 0.21 + phase) + 0.2 * Math.sin(t * 0.083 + phase * 3);
    for (let i = 0; i < p.count; i++) {
      const x0 = rest[i * 3];
      const y0 = rest[i * 3 + 1];
      const u = x0 / width + 0.5;
      const free = 1 - (y0 / height + 0.5);
      const hang = free * free * (0.4 + 0.6 * free);
      const billow = Math.sin(t * 0.55 + phase - free * 2.6 + u * 1.7) * 0.6 + Math.sin(t * 0.93 + phase * 2 + u * 5.2 - free * 4.1) * 0.25;
      const ripple = Math.sin(t * 1.4 + u * 13 + free * 6 + phase) * 0.1;
      const push = (billow + ripple + 0.55) * gust * hang;
      p.setXYZ(i, x0 + side * push * 0.014 + Math.sin(t * 0.4 + phase) * hang * 0.006, y0 + push * 0.004, rest[i * 3 + 2] + push * 0.05);
    }
    p.needsUpdate = true;
  });

  return (
    <mesh geometry={geo} position={[x, (top + bottom) / 2, CURTAIN_Z]} castShadow receiveShadow frustumCulled={false}>
      <meshPhysicalMaterial map={cloth.map} bumpMap={cloth.bump} bumpScale={2.2} roughness={1} sheen={0.7} sheenRoughness={0.85} sheenColor="#f1e2c4" side={THREE.DoubleSide} />
    </mesh>
  );
}

/** The cloth hangs close to the wall: it ends above the sill, so it has no need to clear it. */
const CURTAIN_Z = WALL_Z + 0.09;

function Curtains() {
  const edge = WIN.w / 2;
  const railY = WIN.y + WIN.h / 2 + 0.17;
  return (
    <group>
      <Curtain x={-edge - 0.1} width={0.36} seed={3} side={-1} />
      <Curtain x={edge + 0.1} width={0.36} seed={8} side={1} />
      <mesh position={[0, railY, CURTAIN_Z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, WIN.w + 0.72, 12]} />
        <meshStandardMaterial color="#6a4a30" roughness={0.5} />
      </mesh>
      {/* the rail stands out from the wall on a bracket at each end */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (WIN.w / 2 + 0.34), railY, (WALL_Z + CURTAIN_Z) / 2]}>
          <boxGeometry args={[0.02, 0.02, CURTAIN_Z - WALL_Z]} />
          <meshStandardMaterial color="#6a4a30" roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function Walls() {
  const plaster = usePbr("white_plaster_02", 1, 1);
  const wall = useMemo(() => {
    // back wall with a hole cut for the window, so the glass sits inside it
    const s = new THREE.Shape();
    s.moveTo(ROOM.left, 0);
    s.lineTo(ROOM.right, 0);
    s.lineTo(ROOM.right, ROOM.h);
    s.lineTo(ROOM.left, ROOM.h);
    s.closePath();
    const hole = new THREE.Path();
    hole.moveTo(WIN.x - WIN.w / 2, WIN.y - WIN.h / 2);
    hole.lineTo(WIN.x - WIN.w / 2, WIN.y + WIN.h / 2);
    hole.lineTo(WIN.x + WIN.w / 2, WIN.y + WIN.h / 2);
    hole.lineTo(WIN.x + WIN.w / 2, WIN.y - WIN.h / 2);
    hole.closePath();
    s.holes.push(hole);
    const g = new THREE.ShapeGeometry(s);
    // ShapeGeometry UVs are in world units; scale them to tile the plaster every 1.6 m
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.6, uv.getY(i) / 1.6);
    return g;
  }, []);
  const wallColor = "#efe0c4"; // warm cream
  return (
    <group>
      <mesh geometry={wall} position={[0, 0, WALL_Z]} receiveShadow>
        <meshStandardMaterial {...plaster} color={wallColor} roughness={0.95} normalScale={new THREE.Vector2(0.5, 0.5)} />
      </mesh>
      {/* window reveal */}
      <mesh position={[WIN.x, WIN.y, WALL_Z - 0.09]}>
        <boxGeometry args={[WIN.w + 0.02, WIN.h + 0.02, 0.16]} />
        <meshStandardMaterial color="#a78c6a" side={THREE.BackSide} roughness={0.9} />
      </mesh>
      {/* side walls */}
      <mesh position={[ROOM.left, ROOM.h / 2, ROOM.depth / 2 + WALL_Z]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[ROOM.depth, ROOM.h]} />
        <meshStandardMaterial color={wallColor} roughness={0.95} />
      </mesh>
      <mesh position={[ROOM.right, ROOM.h / 2, ROOM.depth / 2 + WALL_Z]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[ROOM.depth, ROOM.h]} />
        <meshStandardMaterial color={wallColor} roughness={0.95} />
      </mesh>
      {/* skirting board */}
      <mesh position={[ROOM_X, 0.05, WALL_Z + 0.012]} receiveShadow>
        <boxGeometry args={[ROOM_W, 0.1, 0.024]} />
        <meshStandardMaterial color="#6a4a30" roughness={0.6} />
      </mesh>
    </group>
  );
}

function Floor() {
  const wood = usePbr("wood_floor", 4, 3);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[ROOM_X, 0, ROOM.depth / 2 + WALL_Z]} receiveShadow>
      <planeGeometry args={[ROOM_W, ROOM.depth]} />
      <meshStandardMaterial {...wood} color="#b08a66" roughness={0.75} />
    </mesh>
  );
}

// Model: "Dining table wood with black metal" by Mr.N0b0dy (CC BY 4.0). See CREDITS.md.
const TABLE = asset("/models/sk/dining_table.glb");
// In the file it is 1.867 m long (along z), 0.801 m deep and 0.777 m high, standing on the floor about its own middle.
const TABLE_SIZE = { long: 1.867, deep: 0.801, high: 0.777 };

/** The desk: a wooden table top on black metal legs, turned to run along the wall and brought to the desk's footprint. */
function Desk() {
  const { scene } = useGLTF(TABLE);
  const table = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
    });
    return c;
  }, [scene]);
  // its own axes: x is its depth, z its length. It is a few per cent off the desk's size each way.
  const scale: [number, number, number] = [(DESK.z1 - DESK.z0) / TABLE_SIZE.deep, DESK.y / TABLE_SIZE.high, (DESK.x1 - DESK.x0) / TABLE_SIZE.long];
  return <primitive object={table} position={[(DESK.x0 + DESK.x1) / 2, 0, (DESK.z0 + DESK.z1) / 2]} rotation={[0, Math.PI / 2, 0]} scale={scale} />;
}
useGLTF.preload(TABLE);
useTexture.preload([asset("/textures/oak_veneer_01/diff.jpg"), asset("/textures/oak_veneer_01/rough.jpg")]);

export function Shell() {
  return (
    <group>
      <Walls />
      <CityWindow />
      <Curtains />
      <Floor />
      <Desk />
    </group>
  );
}
