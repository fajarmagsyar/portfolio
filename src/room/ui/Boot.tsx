"use client";

import { useProgress } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import { LOGO } from "@/ui/logo";
import s from "./Boot.module.css";

/** The order the shapes light up in. */
const SHAPES = [LOGO.bar, LOGO.quarter, LOGO.leaf];
/** The shortest wait between one shape and the next, so a quick load still lights them one by one.
    A shape takes a little longer than this to reach full light (Boot.module.css), so they flow. */
const STEP_MS = 1100;

/**
 * How many shapes are lit. The first comes with half of the files, the second with all of them,
 * the last only when the room is ready. It never steps back, although the files arrive in several
 * batches and the share loaded drops each time a new batch starts.
 */
function useLitShapes(ready: boolean) {
  // already ready on arrival (the visitor shut the TV down): nothing to show again
  const [lit, setLit] = useState(() => (ready ? SHAPES.length : 0));
  const steppedAt = useRef(-STEP_MS);
  useEffect(() => {
    if (lit >= SHAPES.length) return;
    const id = window.setInterval(() => {
      const { loaded, total } = useProgress.getState();
      const files = total ? loaded / total : 0;
      const earned = ready ? SHAPES.length : files >= 1 ? 2 : files >= 0.5 ? 1 : 0;
      if (earned <= lit || performance.now() - steppedAt.current < STEP_MS) return;
      steppedAt.current = performance.now();
      setLit(lit + 1);
    }, 100);
    return () => window.clearInterval(id);
  }, [lit, ready]);
  return lit;
}

/**
 * Covers the room while its models and textures load: the logo in the dark, its shapes lighting
 * up one at a time. Once all are lit it lifts onto the room; the TV there then asks for a click
 * to enter.
 */
export function Boot({ ready }: { ready: boolean }) {
  const lit = useLitShapes(ready);
  return (
    <div className={s.boot} data-leaving={lit === SHAPES.length} role="status">
      <div className={s.box}>
        <div className={s.logo} aria-hidden="true">
          {SHAPES.map((d, i) => (
            // one drawing for each shape, so that its light can fade by itself
            <span key={d} className={s.shape} data-state={i < lit ? "lit" : i === lit ? "next" : "dark"}>
              <svg className={s.unlit} viewBox={LOGO.viewBox}>
                <path d={d} />
              </svg>
              <span className={s.glimmer}>
                <svg viewBox={LOGO.viewBox}>
                  <path d={d} />
                </svg>
              </span>
              <span className={s.light}>
                <svg viewBox={LOGO.viewBox}>
                  <path d={d} />
                </svg>
              </span>
            </span>
          ))}
        </div>
        <p className={s.label}>Loading</p>
      </div>
    </div>
  );
}
