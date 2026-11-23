"use client";

import { addEffect } from "@react-three/fiber";
import { useEffect } from "react";

const CAP = 120;

/** Skips R3F's render callback when the frame arrives too soon, capping at 120fps. */
export function FrameLimiter() {
  useEffect(() => {
    const every = 1000 / CAP;
    let last = 0;
    const unsub = addEffect((t) => {
      if (t - last < every) return false;
      last = t;
    });
    return unsub;
  }, []);
  return null;
}
