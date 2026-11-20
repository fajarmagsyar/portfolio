"use client";

/* eslint-disable react-hooks/immutability -- three.js textures and uniforms are mutable by design */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useLang, useLangStore } from "@/state/lang";
import { useRoom } from "../store";
import { useFonts } from "../textures";
import { drawTv, tvKey, tvPointer, TV_H, TV_W, type TvMode } from "../tv/program";

// The picture area of Television_01, in the model's own space: the opening in the bezel.
// The glass behind it is a bulged 10 x 10 grid; the picture is drawn on those very faces.
export const TUBE = { x0: -0.2492, x1: 0.1184, y0: 0.1193, y1: 0.3991, z: 0.1924 };

/** Picks the tube's glass faces out of the TV mesh and gives them picture coordinates. */
function glassGeometry(scene: THREE.Object3D) {
  let src: THREE.BufferGeometry | null = null;
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !src) src = m.geometry;
  });
  const out = new THREE.BufferGeometry();
  const geo = src as THREE.BufferGeometry | null;
  if (!geo?.index) return out;
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const onGlass = (i: number) =>
    nor.getZ(i) > 0.95 && pos.getX(i) > -0.258 && pos.getX(i) < 0.127 && pos.getY(i) > 0.1136 && pos.getY(i) < 0.4047 && pos.getZ(i) > 0.167 && pos.getZ(i) < 0.1935;
  const p: number[] = [];
  const n: number[] = [];
  const uv: number[] = [];
  for (let t = 0; t < geo.index.count; t += 3) {
    const tri = [geo.index.getX(t), geo.index.getX(t + 1), geo.index.getX(t + 2)];
    if (!tri.every(onGlass)) continue;
    for (const i of tri) {
      p.push(pos.getX(i), pos.getY(i), pos.getZ(i) + 0.0004);
      n.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      uv.push((pos.getX(i) - TUBE.x0) / (TUBE.x1 - TUBE.x0), (pos.getY(i) - TUBE.y0) / (TUBE.y1 - TUBE.y0));
    }
  }
  out.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(n, 3));
  out.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return out;
}

const vert = /* glsl */ `
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

/** A cathode-ray tube: scanlines, a phosphor mask, soft colour fringes, a dark rim, and a faint glare on the glass. */
const frag = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uTime;
  uniform float uSince;   // seconds since the picture last changed
  uniform float uLines;   // scanlines down the picture
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  vec3 tube(vec2 uv) {
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec3(0.0);
    return texture2D(uMap, uv).rgb;
  }

  void main() {
    // the electron gun overshoots a little towards the corners
    vec2 c = vUv * 2.0 - 1.0;
    c *= 0.975 + 0.025 * dot(c, c);
    // a change of channel: the picture opens out from a bright line
    float on = smoothstep(0.0, 0.28, uSince);
    c.y /= max(on, 0.02);
    // the whole picture trembles by a fraction of a line
    c.x += (hash(vec2(floor(vUv.y * uLines), floor(uTime * 24.0))) - 0.5) * 0.0012;
    vec2 uv = c * 0.5 + 0.5;

    // the three guns never quite converge away from the centre
    vec2 fringe = c * 0.0016;
    vec2 px = vec2(1.0 / 800.0, 0.0);
    vec3 col;
    col.r = (tube(uv + fringe).r + tube(uv + fringe + px).r) * 0.5;
    col.g = (tube(uv).g + tube(uv + px).g) * 0.5;
    col.b = (tube(uv - fringe).b + tube(uv - fringe + px).b) * 0.5;
    // bright areas bleed sideways into the phosphor
    vec3 smear = (tube(uv - px * 3.0) + tube(uv + px * 3.0)) * 0.5;
    col += max(smear - 0.35, 0.0) * 0.22;

    // scanlines, fading out when they would be finer than a screen pixel
    float fine = fwidth(uv.y * uLines);
    float line = 0.5 + 0.5 * cos(uv.y * uLines * 6.2832);
    float lum = dot(col, vec3(0.3, 0.6, 0.1));
    float scan = mix(1.0, mix(0.42, 1.0, pow(line, 1.0 + lum)), smoothstep(0.9, 0.3, fine));
    col *= scan;
    // phosphor stripes
    float stripe = mod(gl_FragCoord.x, 3.0);
    vec3 mask = vec3(stripe < 1.0 ? 1.0 : 0.0, stripe >= 1.0 && stripe < 2.0 ? 1.0 : 0.0, stripe >= 2.0 ? 1.0 : 0.0);
    col *= mix(vec3(1.0), 0.72 + mask * 0.84, 0.3);

    // a slow bright band rolling down, mains flicker, and noise in the signal
    float band = fract(uv.y * 0.6 + uTime * 0.09);
    col *= 1.0 + 0.07 * smoothstep(0.0, 0.08, band) * smoothstep(0.2, 0.08, band);
    col *= 0.985 + 0.015 * sin(uTime * 110.0);
    col += (hash(uv * vec2(800.0, 600.0) + uTime * 60.0) - 0.5) * 0.045;

    // the picture dims towards the rim of the tube
    vec2 e = vUv * (1.0 - vUv);
    col *= pow(clamp(e.x * e.y * 18.0, 0.0, 1.0), 0.32);
    // the tube glows a touch even where the picture is black, and flares as it switches
    col = pow(col, vec3(1.12)) * 1.4 + vec3(0.012, 0.016, 0.026);
    col *= 1.0 + 3.0 * (1.0 - on);

    // the room reflected in curved glass: a soft glare, stronger at grazing angles
    vec3 nrm = normalize(vNormal);
    float fres = pow(1.0 - clamp(dot(nrm, normalize(vView)), 0.0, 1.0), 3.0);
    float glare = smoothstep(0.75, 0.0, length(vUv - vec2(0.2, 0.86)));
    col += vec3(1.0, 0.86, 0.7) * (glare * 0.035 + fres * 0.12);

    gl_FragColor = vec4(max(col, 0.0), 1.0);
  }
`;

/** The TV's picture, drawn on the tube's own curved glass. */
export function TvScreen({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const geometry = useMemo(() => glassGeometry(scene), [scene]);
  const fonts = useFonts();
  const lang = useLang();
  const focus = useRoom((s) => s.focus);
  const tvScreen = useRoom((s) => s.tvScreen);
  const booted = useRoom((s) => s.booted);
  const mode: TvMode = !booted ? "enter" : focus === "tv" ? tvScreen : "idle";

  const { canvas, game, uniforms } = useMemo(() => {
    const make = (w: number, h: number) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      return c;
    };
    const canvas = make(TV_W, TV_H);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.generateMipmaps = false;
    map.minFilter = THREE.LinearFilter;
    return {
      canvas,
      game: make(768, 672),
      uniforms: { uMap: { value: map }, uTime: { value: 0 }, uSince: { value: 10 }, uLines: { value: 240 } },
    };
  }, []);
  useEffect(() => () => uniforms.uMap.value.dispose(), [uniforms]);

  // every change of picture starts with the tube switching over
  useEffect(() => {
    uniforms.uSince.value = 0;
  }, [mode, uniforms]);

  // the game engine is only loaded, and only runs, while its screen is up
  useEffect(() => {
    if (mode !== "game") return;
    let stop: (() => void) | null = null;
    let alive = true;
    import("@/game/engine").then((m) => {
      if (alive) stop = m.startGame(game, () => useLangStore.getState().lang);
    });
    return () => {
      alive = false;
      stop?.();
    };
  }, [mode, game]);

  useEffect(() => {
    if (focus !== "tv") return;
    const onKey = (e: KeyboardEvent) => {
      if (!tvKey(e)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [focus]);

  const last = useRef(-1);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    uniforms.uTime.value = t;
    uniforms.uSince.value += dt;
    // the idle card only needs a few frames a second; a screen in use is redrawn every frame
    if ((mode === "idle" || mode === "enter") && t - last.current < 1 / 12) return;
    last.current = t;
    drawTv(canvas.getContext("2d")!, mode, lang, fonts, t, game);
    uniforms.uMap.value.needsUpdate = true;
  });

  const live = focus === "tv";
  return (
    <mesh
      geometry={geometry}
      onPointerMove={(e: ThreeEvent<PointerEvent>) => {
        if (!live || !e.uv) return;
        e.stopPropagation();
        document.body.style.cursor = tvPointer(e.uv.x, e.uv.y, false) ? "pointer" : "";
      }}
      onPointerOut={() => {
        if (live) document.body.style.cursor = "";
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (!live || !e.uv) return;
        e.stopPropagation();
        tvPointer(e.uv.x, e.uv.y, true);
      }}
    >
      <shaderMaterial vertexShader={vert} fragmentShader={frag} uniforms={uniforms} toneMapped={false} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
    </mesh>
  );
}
