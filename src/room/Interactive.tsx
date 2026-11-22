"use client";

import type { ThreeElements, ThreeEvent } from "@react-three/fiber";
import type * as THREE from "three";
import { FOCUS_LABEL, useRoom, type FocusId } from "./store";
import { holdCancel, holdMove, holdStart, tap } from "./touch";

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

      onPointerOut={() => {
        if (live && useRoom.getState().hover === target) setHover(null);
      }}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        if (!live) return;
        holdStart(target, FOCUS_LABEL[target], e.nativeEvent.clientX, e.nativeEvent.clientY);
      }}
      onPointerMove={(e: ThreeEvent<PointerEvent>) => {
        if (!live) return;
        holdMove(e.nativeEvent.clientX, e.nativeEvent.clientY);
        let part: THREE.Object3D | null = e.intersections[0]?.eventObject ?? null;
        while (part && part !== e.eventObject) part = part.parent;
        const nearest = part === e.eventObject;
        if (nearest) setHover(target);
        else if (useRoom.getState().hover === target) setHover(null);
      }}
      onPointerUp={holdCancel}
      onPointerCancel={holdCancel}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (!live) return;
        e.stopPropagation();
        tap(target, FOCUS_LABEL[target], e.nativeEvent.clientX, e.nativeEvent.clientY, () => setFocus(target));
      }}
    >
      {children}
    </group>
  );
}
