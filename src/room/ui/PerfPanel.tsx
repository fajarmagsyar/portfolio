"use client";

import { useState } from "react";
import { FLAG_LABEL, usePerf, type Flags } from "../perf";

const box: React.CSSProperties = {
  position: "fixed",
  top: 8,
  right: 8,
  zIndex: 9999,
  width: 330,
  maxHeight: "calc(100vh - 16px)",
  overflowY: "auto",
  padding: 10,
  background: "rgba(8,8,10,0.88)",
  color: "#d8e0e8",
  font: "11px/1.45 ui-monospace, Menlo, Consolas, monospace",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 6,
  pointerEvents: "auto",
};
const h: React.CSSProperties = { margin: "10px 0 4px", color: "#8fa6bb", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 10 };
const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 8 };

function Bar({ label, ms, total, color }: { label: string; ms: number | null; total: number; color: string }) {
  const w = ms === null ? 0 : Math.min(100, (ms / Math.max(total, 1)) * 100);
  return (
    <div style={{ margin: "3px 0" }}>
      <div style={row}>
        <span>{label}</span>
        <span>{ms === null ? "n/a" : `${ms.toFixed(1)} ms`}</span>
      </div>
      <div style={{ height: 5, background: "rgba(255,255,255,0.1)" }}>
        <div style={{ width: `${w}%`, height: "100%", background: color }} />
      </div>
    </div>
  );
}

const n = (v: number) => v.toLocaleString("en-US");

/** The performance debugger's panel: open the room with ?debugperformance=1. */
export function PerfPanel() {
  const m = usePerf((s) => s.metrics);
  const flags = usePerf((s) => s.flags);
  const setFlags = usePerf((s) => s.setFlags);
  const results = usePerf((s) => s.results);
  const baseline = usePerf((s) => s.baseline);
  const running = usePerf((s) => s.running);
  const run = usePerf((s) => s.runBenchmark);
  const [open, setOpen] = useState(true);

  const cpu = m ? m.updateMs + m.renderMs : 0;
  const verdict = !m ? "" : m.gpuMs === null ? "GPU time unavailable in this browser" : m.gpuMs > cpu * 1.2 ? "GPU-bound: the graphics card is the limit" : cpu > m.gpuMs * 1.2 ? "CPU-bound: JavaScript / draw calls are the limit" : "CPU and GPU about balanced";

  return (
    <div style={box} onPointerDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <div style={{ ...row, alignItems: "center" }}>
        <strong style={{ color: "#fff" }}>PERFORMANCE</strong>
        <button onClick={() => setOpen(!open)} style={{ all: "unset", cursor: "pointer", color: "#8fa6bb" }}>
          {open ? "hide" : "show"}
        </button>
      </div>
      {open && (
        <>
          {m && (
            <>
              <div style={{ fontSize: 26, color: m.fps >= 55 ? "#7be07b" : m.fps >= 35 ? "#f0c060" : "#ff7070" }}>
                {m.fps.toFixed(0)} <span style={{ fontSize: 11, color: "#8fa6bb" }}>fps · {m.frameMs.toFixed(1)} ms · worst {m.worstMs.toFixed(0)} ms</span>
              </div>
              <div style={h}>Where a frame goes</div>
              <Bar label="JS: room callbacks (useFrame)" ms={m.updateMs} total={m.frameMs} color="#6fa8ff" />
              <Bar label="CPU: drawing (draw-call submit)" ms={m.renderMs} total={m.frameMs} color="#b48cff" />
              <Bar label="GPU: time on the graphics card" ms={m.gpuMs} total={m.frameMs} color="#ff9f5a" />
              <div style={{ color: "#8fa6bb", marginTop: 4 }}>{verdict}</div>
              <div style={h}>Scene</div>
              <div style={row}><span>draw calls</span><span>{n(m.calls)}</span></div>
              <div style={row}><span>triangles</span><span>{n(m.triangles)}</span></div>
              <div style={row}><span>visible meshes</span><span>{n(m.meshes)}</span></div>
              <div style={row}><span>visible lights</span><span>{n(m.lights)}</span></div>
              <div style={row}><span>geometries / textures</span><span>{n(m.geometries)} / {n(m.textures)}</span></div>
              <div style={row}><span>shader programs</span><span>{n(m.programs)}</span></div>
            </>
          )}
          <div style={h}>Benchmark: what costs the most</div>
          <button
            onClick={run}
            disabled={Boolean(running)}
            style={{ width: "100%", padding: "5px 0", background: running ? "#333" : "#2a5a9a", color: "#fff", border: 0, borderRadius: 4, cursor: running ? "default" : "pointer", font: "inherit" }}
          >
            {running ? `Testing: ${running}…` : "Run benchmark (about 90 s)"}
          </button>
          <div style={{ color: "#8fa6bb", margin: "4px 0" }}>Turns each feature off in turn and measures the frame time. Keep this tab in front and the mouse still.</div>
          {baseline && (
            <div style={row}>
              <span>baseline</span>
              <span>
                {baseline.ms.toFixed(1)} ms · {baseline.fps.toFixed(0)} fps
              </span>
            </div>
          )}
          {results && (
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 4 }}>
              <thead>
                <tr style={{ color: "#8fa6bb", textAlign: "right" }}>
                  <th style={{ textAlign: "left", fontWeight: 400 }}>turned off</th>
                  <th style={{ fontWeight: 400 }}>fps</th>
                  <th style={{ fontWeight: 400 }}>saves</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id} style={{ textAlign: "right", color: r.gainPct > 10 ? "#ffb07a" : r.gainPct > 3 ? "#f0e0a0" : "#8a96a2" }}>
                    <td style={{ textAlign: "left" }}>{r.label}</td>
                    <td>{r.fps.toFixed(0)}</td>
                    <td>
                      {r.gainMs.toFixed(1)} ms ({r.gainPct.toFixed(0)}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {results && !running && <div style={{ color: "#8fa6bb", marginTop: 4 }}>Differences under about 1.5 ms are within noise. If the baseline is near 60 fps the screen&apos;s refresh rate may be capping it.</div>}
          <div style={h}>Switches</div>
          {(Object.keys(FLAG_LABEL) as (keyof Flags)[]).map((k) => (
            <label key={k} style={{ ...row, cursor: "pointer" }}>
              <span>{FLAG_LABEL[k]}</span>
              <input type="checkbox" checked={flags[k]} disabled={Boolean(running)} onChange={(e) => setFlags({ [k]: e.target.checked })} />
            </label>
          ))}
        </>
      )}
    </div>
  );
}
