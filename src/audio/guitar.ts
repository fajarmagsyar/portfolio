"use client";

// Plucked-string synthesis (Karplus-Strong): a burst of noise fed round a short delay
// line with a gentle low-pass. No audio files. Sound starts only after a user gesture.

const OPEN = [82.41, 110.0, 146.83, 196.0, 246.94, 329.63]; // E2 A2 D3 G3 B3 E4

/** Fret per string, low E first. -1 = string is muted in this chord. */
export const CHORDS = {
  Open: [0, 0, 0, 0, 0, 0],
  E: [0, 2, 2, 1, 0, 0],
  Em: [0, 2, 2, 0, 0, 0],
  G: [3, 2, 0, 0, 0, 3],
  C: [-1, 3, 2, 0, 1, 0],
  D: [-1, -1, 0, 2, 3, 2],
  Am: [-1, 0, 2, 2, 1, 0],
} as const;
export type ChordName = keyof typeof CHORDS;

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let chord: ChordName = "Em";
const cache = new Map<string, AudioBuffer>();

export function setChord(name: ChordName) {
  chord = name;
}
export function getChord(): ChordName {
  return chord;
}

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
    // amp-ish chain: roll off the fizz, add a short slapback for a sense of room
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 3800;
    const body = ctx.createBiquadFilter();
    body.type = "peaking";
    body.frequency.value = 900;
    body.gain.value = 4;
    const delay = ctx.createDelay(0.5);
    delay.delayTime.value = 0.11;
    const fb = ctx.createGain();
    fb.gain.value = 0.18;
    out = ctx.createGain();
    out.gain.value = 0.5;
    out.connect(body).connect(tone).connect(ctx.destination);
    tone.connect(delay).connect(fb).connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function synth(ac: AudioContext, freq: number, seconds: number): AudioBuffer {
  const sr = ac.sampleRate;
  const n = Math.floor(sr * seconds);
  const buf = ac.createBuffer(1, n, sr);
  const data = buf.getChannelData(0);
  const period = sr / freq;
  const size = Math.floor(period);
  const frac = period - size;
  const line = new Float32Array(size + 1);
  // noise burst, comb-filtered as if picked a fifth of the way along the string
  const pick = Math.max(1, Math.floor(size * 0.2));
  for (let i = 0; i < size; i++) line[i] = Math.random() * 2 - 1;
  for (let i = size - 1; i >= pick; i--) line[i] -= line[i - pick];
  let prev = 0;
  // higher strings ring a little shorter
  const damping = 0.9965 - Math.min(0.004, freq / 200000);
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const a = line[idx];
    const b = line[(idx + 1) % size];
    const sample = a + (b - a) * frac;
    const filtered = (sample * 0.56 + prev * 0.44) * damping;
    prev = sample;
    line[idx] = filtered;
    data[i] = sample;
    idx = (idx + 1) % size;
  }
  // short fade so the tail never clicks
  const fade = Math.floor(sr * 0.15);
  for (let i = 0; i < fade; i++) data[n - 1 - i] *= i / fade;
  return buf;
}

/** Plucks one string (0 = low E) using the current chord shape. Returns false if muted or audio is unavailable. */
export function pluck(string: number, velocity = 1): boolean {
  const fret = CHORDS[chord][string];
  if (fret < 0) return false;
  const ac = ensure();
  if (!ac || !out) return false;
  const freq = OPEN[string] * Math.pow(2, fret / 12);
  const key = `${string}:${fret}`;
  let buf = cache.get(key);
  if (!buf) {
    buf = synth(ac, freq, 3.2);
    cache.set(key, buf);
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  const g = ac.createGain();
  g.gain.value = 0.32 * Math.max(0.2, Math.min(1, velocity));
  src.connect(g).connect(out);
  src.start();
  return true;
}

/** Strums all six strings, low to high (or high to low for an upstroke). */
export function strum(onString: (s: number) => void, up = false) {
  for (let i = 0; i < 6; i++) {
    const s = up ? 5 - i : i;
    setTimeout(() => {
      if (pluck(s, 0.9)) onString(s);
    }, i * 28);
  }
}
