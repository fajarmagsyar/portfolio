"use client";

import { asset } from "@/asset";

// Whether the room makes any sound at all. The visitor chooses on the way in, and can change
// it afterwards. Everything that makes sound asks here, or is told when it changes.

let on = false;
let bgm: HTMLAudioElement | null = null;
const listeners = new Set<(on: boolean) => void>();

function syncBgm() {
  if (typeof window === "undefined") return;
  if (!on) { bgm?.pause(); return; }
  if (!bgm) {
    bgm = new Audio(asset("/music/bgm-rain.mp3"));
    bgm.loop = true;
    bgm.volume = 0.28;
    bgm.preload = "auto";
  }
  void bgm.play().catch(() => {});
}

export const soundOn = () => on;

export function setSound(next: boolean) {
  on = next;
  syncBgm();
  listeners.forEach((tell) => tell(on));
}

/** Calls back whenever sound is switched on or off. */
export function onSound(tell: (on: boolean) => void) {
  listeners.add(tell);
}
