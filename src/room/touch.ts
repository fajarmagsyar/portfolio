"use client";

import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import type { StringKey } from "@/content/strings";
import { useRoom } from "./store";

/**
 * Touch screens have no hover, so the first tap only says what a thing does and the second
 * one carries it out. Mouse and keyboard keep the old one-click behaviour. The kind of input
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

/** A tap somewhere else, or a change of view, retires the explanation. */
export function clearTapTip() {
  if (dismiss) clearTimeout(dismiss);
  dismiss = null;
  useRoom.getState().clearTapTip();
}

/**
 * Runs `action` now for a mouse. On touch, the first tap on this id raises its tooltip and
 * swallows the action; the second tap on the same id performs it. Different ids replace the
 * tooltip, so moving to another thing never acts by accident.
 */
export function tap(id: string, text: StringKey, x: number, y: number, action: () => void): boolean {
  if (!touch()) {
    action();
    return true;
  }
  const room = useRoom.getState();
  if (room.tapTip?.id === id) {
    clearTapTip();
    action();
    return true;
  }
  room.showTapTip({ id, text, x, y });
  if (dismiss) clearTimeout(dismiss);
  dismiss = setTimeout(clearTapTip, 6000);
  return false;
}

/** The handler for a React button: its label is the first tap's tooltip. */
export function tapClick(id: string, text: StringKey, action: () => void) {
  return (e: ReactMouseEvent) => {
    e.preventDefault();
    tap(id, text, e.clientX, e.clientY, action);
  };
}

/** The same, for controls that act as soon as the finger lands (strings, pages, pads). */
export function tapDown(id: string, text: StringKey, action: (e: ReactPointerEvent) => void) {
  return (e: ReactPointerEvent) => {
    if (tap(id, text, e.clientX, e.clientY, () => action(e))) e.stopPropagation();
  };
}
