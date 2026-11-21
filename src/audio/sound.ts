"use client";

// Whether the room makes any sound at all. The visitor chooses on the way in, and can change
// it afterwards. Everything that makes sound asks here, or is told when it changes.

let on = true;
const listeners = new Set<(on: boolean) => void>();

export const soundOn = () => on;

export function setSound(next: boolean) {
  on = next;
  listeners.forEach((tell) => tell(on));
}

/** Calls back whenever sound is switched on or off. */
export function onSound(tell: (on: boolean) => void) {
  listeners.add(tell);
}
