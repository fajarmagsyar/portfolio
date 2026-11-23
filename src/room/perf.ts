"use client";

// Performance debugging: open the room with ?debugperformance=1 and a panel appears with the frame
// rate, where each frame's time goes, scene statistics, switches for the expensive features, and a
// benchmark that turns each one off in turn and ranks them by what it gives back.
// Nothing here runs without the parameter, apart from the flags below, which are all "on".

import { create } from "zustand";

export const DEBUG_PERF = typeof window !== "undefined" && new URLSearchParams(location.search).get("debugperformance") === "1";

/** What can be switched. `true` is how the room normally is; `lowres` is the exception, off normally. */
export type Flags = {
  shadows: boolean;
  composer: boolean;
  bloom: boolean;
  focus: boolean;
  noise: boolean;
  grade: boolean;
  soft: boolean;
  vignette: boolean;
  tonemap: boolean;
  lightsPoint: boolean;
  lightsSpot: boolean;
  lowres: boolean;
};

export const DEFAULT_FLAGS: Flags = {
  shadows: true,
  composer: true,
  bloom: true,
  focus: true,
  noise: true,
  grade: true,
  soft: true,
  vignette: true,
  tonemap: true,
  lightsPoint: true,
  lightsSpot: true,
  lowres: false,
};

export const FLAG_LABEL: Record<keyof Flags, string> = {
  shadows: "Lamp shadows",
  composer: "Post-processing (all)",
  bloom: "Bloom",
  focus: "Depth of field",
  noise: "Film grain",
  grade: "Color grade",
  soft: "Soft focus",
  vignette: "Vignette",
  tonemap: "Tone mapping",
  lightsPoint: "Point lights (no shadow)",
  lightsSpot: "Spotlights (no shadow)",
  lowres: "Render at 75% resolution",
};

export type Metrics = {
  fps: number;
  frameMs: number;
  worstMs: number;
  /** CPU: every useFrame callback of the room (animation, camera, textures) */
  updateMs: number;
  /** CPU: submitting the draw calls (scene and post-processing) */
  renderMs: number;
  /** GPU time for the frame, when the browser allows timing it */
  gpuMs: number | null;
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  lights: number;
  meshes: number;
};

export type Result = { id: string; label: string; ms: number; fps: number; gainMs: number; gainPct: number };

type PerfState = {
  flags: Flags;
  metrics: Metrics | null;
  results: Result[] | null;
  baseline: { ms: number; fps: number } | null;
  /** what the benchmark is doing now, or null */
  running: string | null;
  setFlags: (flags: Partial<Flags>) => void;
  setMetrics: (m: Metrics) => void;
  runBenchmark: () => Promise<void>;
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Average time of a frame over `ms` milliseconds, counted on requestAnimationFrame. */
function measure(ms: number) {
  return new Promise<number>((resolve) => {
    let frames = 0;
    let t0 = 0;
    const step = (t: number) => {
      if (!t0) t0 = t;
      else frames++;
      if (t - t0 < ms) requestAnimationFrame(step);
      else resolve((t - t0) / Math.max(frames, 1));
    };
    requestAnimationFrame(step);
  });
}

const EFFECTS: (keyof Flags)[] = ["bloom", "focus", "noise", "grade", "soft", "vignette", "tonemap"];

const EXPERIMENTS: { id: string; label: string; off: Partial<Flags> }[] = [
  { id: "shadows", label: "Lamp shadows off", off: { shadows: false } },
  { id: "composer", label: "Post-processing off", off: { composer: false } },
  { id: "effects", label: "All effects off (composer on)", off: Object.fromEntries(EFFECTS.map((k) => [k, false])) },
  { id: "bloom", label: "Bloom off", off: { bloom: false } },
  { id: "focus", label: "Depth of field off", off: { focus: false } },
  { id: "noise", label: "Film grain off", off: { noise: false } },
  { id: "grade", label: "Color grade off", off: { grade: false } },
  { id: "soft", label: "Soft focus off", off: { soft: false } },
  { id: "vignette", label: "Vignette off", off: { vignette: false } },
  { id: "tonemap", label: "Tone mapping off", off: { tonemap: false } },
  { id: "lightsPoint", label: "Point lights off", off: { lightsPoint: false } },
  { id: "lightsSpot", label: "Spotlights off", off: { lightsSpot: false } },
  { id: "lowres", label: "75% resolution", off: { lowres: true } },
];

const SETTLE = 4000; // time for shaders to recompile after a change
const SAMPLE = 2500;

export const usePerf = create<PerfState>((set, get) => ({
  flags: DEFAULT_FLAGS,
  metrics: null,
  results: null,
  baseline: null,
  running: null,
  setFlags: (flags) => set((s) => ({ flags: { ...s.flags, ...flags } })),
  setMetrics: (metrics) => set({ metrics }),
  async runBenchmark() {
    if (get().running) return;
    const before = get().flags;
    set({ results: null, baseline: null });
    try {
      set({ running: "Baseline", flags: DEFAULT_FLAGS });
      await sleep(SETTLE);
      const base = await measure(SAMPLE);
      set({ baseline: { ms: base, fps: 1000 / base } });
      const out: Result[] = [];
      for (const e of EXPERIMENTS) {
        set({ running: e.label, flags: { ...DEFAULT_FLAGS, ...e.off } });
        await sleep(SETTLE);
        const ms = await measure(SAMPLE);
        out.push({ id: e.id, label: e.label, ms, fps: 1000 / ms, gainMs: base - ms, gainPct: ((base - ms) / base) * 100 });
        set({ results: [...out].sort((a, b) => b.gainMs - a.gainMs) });
      }
    } finally {
      set({ running: null, flags: before });
    }
  },
}));
