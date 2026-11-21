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
      // The name shown is that of the nearest thing under the cursor, decided on every move.
      // (Claiming the hover outright with stopPropagation would be remembered for as long as
      // the cursor stayed on the object, and after a click into the close-up it would go on
      // swallowing the pointer before the object's own controls saw it.)
      onPointerMove={(e: ThreeEvent<PointerEvent>) => {
        if (!live) return;
        const nearest = e.intersections[0]?.eventObject === e.eventObject;
        if (nearest) setHover(target);
        else if (useRoom.getState().hover === target) setHover(null);
      }}
      onPointerOut={() => {
        if (live && useRoom.getState().hover === target) setHover(null);
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
