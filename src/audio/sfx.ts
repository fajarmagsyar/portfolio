"use client";

// Tiny synthesised interface sounds: no files. Silent until the first user gesture.

import { soundOn } from "./sound";

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined" || !soundOn()) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function noise(a: AudioContext, seconds: number) {
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * seconds), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  return src;
}

/** Plastic click: picking up a tape or case, pressing a button. */
export function click(pitch = 1) {
  const a = ac();
  if (!a) return;
  const src = noise(a, 0.04);
  const f = a.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 2400 * pitch;
  f.Q.value = 2;
  const g = a.createGain();
  g.gain.setValueAtTime(0.25, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.04);
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}

/** Heavier mechanical clunk: a door closing on a tape or disc. */
export function clunk() {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(140, a.currentTime);
  o.frequency.exponentialRampToValueAtTime(50, a.currentTime + 0.12);
  const g = a.createGain();
  g.gain.setValueAtTime(0.3, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.16);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + 0.18);
  click(0.5);
}

/** Motor spinning up: a disc or tape starting. */
export function whirr() {
  const a = ac();
  if (!a) return;
  const src = noise(a, 1.4);
  const f = a.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = 6;
  f.frequency.setValueAtTime(300, a.currentTime);
  f.frequency.exponentialRampToValueAtTime(1800, a.currentTime + 1.1);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, a.currentTime);
  g.gain.linearRampToValueAtTime(0.07, a.currentTime + 0.3);
  g.gain.linearRampToValueAtTime(0.0001, a.currentTime + 1.4);
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}

/** Short square-wave blip for the TV menu and the game. */
export function blip(freq = 660, seconds = 0.06) {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator();
  o.type = "square";
  o.frequency.value = freq;
  const g = a.createGain();
  g.gain.setValueAtTime(0.05, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + seconds);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + seconds + 0.02);
}

let lastTick = -1;

/** A quiet clock tick for the passing second. */
export function tick(sec: number) {
  if (sec === lastTick) return;
  lastTick = sec;
  const a = ac();
  if (!a) return;
  const src = noise(a, 0.025);
  const f = a.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = 4200;
  const g = a.createGain();
  g.gain.setValueAtTime(0.2, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.025);
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}
