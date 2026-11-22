"use client";

import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import type { StringKey } from "@/content/strings";
import { useRoom } from "./store";

/**
 * Tap acts at once. On touch, a long press only shows the name beside the finger - the same
 * plain style as the desktop hover label - and never triggers the action. The kind of input
 * is remembered from the last pointer that went down, so a hybrid laptop can use either.
 */
if (typeof window !== "undefined") {
  window.addEventListener(
    "pointerdown",
    (e) => useRoom.getState().setInput(e.pointerType === "touch" || e.pointerType === "pen" ? "touch" : "mouse"),
    { capture: true, passive: true },
  );
}

export function touch() {
  return useRoom.getState().input === "touch";
}

let dismiss: ReturnType<typeof setTimeout> | null = null;
let hold: { timer: ReturnType<typeof setTimeout>; id: string; x: number; y: number } | null = null;
let held: { id: string; until: number } | null = null;
const HOLD_MS = 420;
const HOLD_DRIFT = 12;

/** Retires the label after a moment, or when the kind of input changes. */
export function clearTapTip() {
  if (dismiss) clearTimeout(dismiss);
  dismiss = null;
  useRoom.getState().clearTapTip();
}

function showTip(id: string, text: StringKey, x: number, y: number, ms = 1800) {
  useRoom.getState().showTapTip({ id, text, x, y });
  if (dismiss) clearTimeout(dismiss);
  dismiss = setTimeout(clearTapTip, ms);
}

/** On touch, holding shows the tooltip and marks this id so the following tap is ignored. */
export function holdStart(id: string, text: StringKey, x: number, y: number) {
  if (!touch()) return;
  holdCancel();
  hold = {
    id,
    x,
    y,
    timer: setTimeout(() => {
      hold = null;
      held = { id, until: performance.now() + 900 };
      showTip(id, text, x, y, 2200);
    }, HOLD_MS),
  };
}

export function holdMove(x: number, y: number) {
  if (hold && Math.hypot(x - hold.x, y - hold.y) > HOLD_DRIFT) holdCancel();
}

export function holdCancel() {
  if (!hold) return;
  clearTimeout(hold.timer);
  hold = null;
}

/** Runs `action` on click/tap. A completed long press shows tooltip only. */
export function tap(id: string, text: StringKey, x: number, y: number, action: () => void): boolean {
  if (touch()) {
    if (hold?.id === id) holdCancel();
    if (held?.id === id && performance.now() < held.until) {
      held = null;
      return false;
    }
    held = null;
  }
  action();
  return true;
}

/** The handler for a React button. */
export function tapClick(id: string, text: StringKey, action: () => void) {
  return (e: ReactMouseEvent) => {
    e.preventDefault();
    tap(id, text, e.clientX, e.clientY, action);
  };
}

/** For controls that act on pointer down (pads, strings, pages). */
export function tapDown(id: string, text: StringKey, action: (e: ReactPointerEvent) => void) {
  return (e: ReactPointerEvent) => {
    if (tap(id, text, e.clientX, e.clientY, () => action(e))) e.stopPropagation();
  };
}
