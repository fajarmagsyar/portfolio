"use client";

import type { ThreeElements, ThreeEvent } from "@react-three/fiber";
import { useRoom, type FocusId } from "./store";

/**
 * Wraps an object in the room. From the wide view, hovering shows its name and clicking
 * moves the camera to it. Once focused, the wrapper steps aside so the object's own
 * controls (tapes, strings, buttons) receive the pointer.
 */
export function Interactive({ target, children, ...props }: { target: FocusId } & ThreeElements["group"]) {
  const focus = useRoom((s) => s.focus);
  const booted = useRoom((s) => s.booted);
  const setHover = useRoom((s) => s.setHover);
  const setFocus = useRoom((s) => s.setFocus);
  const live = booted && focus === null;

  return (
    <group
      {...props}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        if (!live) return;
        e.stopPropagation();
        setHover(target);
      }}
      onPointerOut={() => {
        if (live) setHover(null);
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (!live) return;
        e.stopPropagation();
        setFocus(target);
      }}
    >
      {children}
    </group>
  );
}
