"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

/** The frame rate the room is held to: 60 leaves it free. Try ?fps=30 for a steady half rate. */
const CAP = (() => {
  if (typeof window === "undefined") return 60;
  const q = Number(new URLSearchParams(location.search).get("fps"));
  return Number.isFinite(q) && q > 0 ? q : 60;
})();

/**
 * Draws the room at a steady rate instead of as fast as it can. On a screen that refreshes at
 * 60 Hz a frame that takes 28 ms is shown for 2 or 3 refreshes at random, which looks like
 * stutter even though the average is fine. Drawing every other refresh makes each frame last
 * the same 33 ms. It only helps while a frame costs less than that, which is why the room's
 * cost matters more than its peak frame rate. (R3F's "never" mode with advance() drew a black
 * screen here, so this uses "demand" and asks for one frame per tick.)
 */
export function FrameLimiter() {
  const setFrameloop = useThree((s) => s.setFrameloop);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (CAP >= 59) return;
    const every = 1000 / CAP - 1.5; // a hair under, so a 60 Hz refresh lands on the right frame
    let last = 0;
    let raf = 0;
    setFrameloop("demand");
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last < every) return;
      last = t;
      invalidate();
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      setFrameloop("always");
    };
  }, [setFrameloop, invalidate]);
  return null;
}
