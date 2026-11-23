"use client";

// The parts of the performance debugger that live inside the Canvas (see perf.ts).

import { useEffect, useRef } from "react";
import { useFrame, useStore, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { usePerf } from "./perf";

type TimerExt = { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number };

/**
 * Times each frame in three parts: the room's own useFrame callbacks (priority below everything),
 * the drawing (up to the last priority), and, if the browser exposes it, the GPU's own time.
 */
export function PerfProbe() {
  const gl = useThree((s) => s.gl);
  const store = useStore();
  const scene = useThree((s) => s.scene);
  const st = useRef({
    t0: 0,
    t1: 0,
    prev: 0,
    since: 0,
    frames: 0,
    worst: 0,
    upd: 0,
    rnd: 0,
    gpu: null as number | null,
    pending: [] as WebGLQuery[],
    active: null as WebGLQuery | null,
  });
  const ext = useRef<TimerExt | null>(null);

  useEffect(() => {
    const info = store.getState().gl.info;
    info.autoReset = false; // the composer draws several times a frame; count them all
    const ctx = gl.getContext() as WebGL2RenderingContext;
    ext.current = ctx.getExtension("EXT_disjoint_timer_query_webgl2") as TimerExt | null;
    return () => {
      info.autoReset = true;
    };
  }, [gl, store]);

  // the very start of the frame
  useFrame(() => {
    const s = st.current;
    const now = performance.now();
    s.t0 = now;
    if (s.prev) s.worst = Math.max(s.worst, now - s.prev);
    s.prev = now;
    gl.info.reset();
    const x = ext.current;
    if (!x) return;
    const ctx = gl.getContext() as WebGL2RenderingContext;
    const head = s.pending[0];
    if (head && ctx.getQueryParameter(head, ctx.QUERY_RESULT_AVAILABLE)) {
      if (!ctx.getParameter(x.GPU_DISJOINT_EXT)) s.gpu = Number(ctx.getQueryParameter(head, ctx.QUERY_RESULT)) / 1e6;
      ctx.deleteQuery(head);
      s.pending.shift();
    }
    if (!s.active && s.pending.length < 3) {
      const q = ctx.createQuery();
      if (q) {
        ctx.beginQuery(x.TIME_ELAPSED_EXT, q);
        s.active = q;
      }
    }
  }, -1e6);

  // after every ordinary callback, before the composer draws (priority 1)
  useFrame(() => {
    st.current.t1 = performance.now();
  }, 0.5);

  // after the Shutter (1000), which is the last thing in the frame
  useFrame(() => {
    const s = st.current;
    const now = performance.now();
    s.upd += s.t1 - s.t0;
    s.rnd += now - s.t1;
    s.frames++;
    const x = ext.current;
    if (x && s.active) {
      const ctx = gl.getContext() as WebGL2RenderingContext;
      ctx.endQuery(x.TIME_ELAPSED_EXT);
      s.pending.push(s.active);
      s.active = null;
    }
    if (!s.since) s.since = now;
    if (now - s.since < 500) return;
    const secs = (now - s.since) / 1000;
    let lights = 0;
    let meshes = 0;
    scene.traverse((o) => {
      if ((o as THREE.Light).isLight && o.visible) lights++;
      if ((o as THREE.Mesh).isMesh && o.visible) meshes++;
    });
    usePerf.getState().setMetrics({
      fps: s.frames / secs,
      frameMs: (secs * 1000) / s.frames,
      worstMs: s.worst,
      updateMs: s.upd / s.frames,
      renderMs: s.rnd / s.frames,
      gpuMs: s.gpu,
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      programs: gl.info.programs?.length ?? 0,
      lights,
      meshes,
    });
    s.since = now;
    s.frames = 0;
    s.worst = 0;
    s.upd = 0;
    s.rnd = 0;
  }, 1001);

  return null;
}

/** Applies the panel's switches to the lights in the scene (the rest are read where they are used). */
export function PerfApply() {
  const scene = useThree((s) => s.scene);
  const flags = usePerf((s) => s.flags);
  useEffect(() => {
    const apply = () =>
      scene.traverse((o) => {
        const l = o as THREE.Light;
        if (!l.isLight) return;
        if (l.userData.perfCast === undefined) l.userData.perfCast = l.castShadow;
        if (l.name === "lamp") {
          l.castShadow = Boolean(l.userData.perfCast) && flags.shadows;
        } else if (!l.userData.perfCast) {
          if ((l as THREE.PointLight).isPointLight) l.visible = flags.lightsPoint;
          else if ((l as THREE.SpotLight).isSpotLight) l.visible = flags.lightsSpot;
        }
      });
    apply();
    const id = setInterval(apply, 2000); // objects that mount later get the same treatment
    return () => clearInterval(id);
  }, [scene, flags]);
  return null;
}
