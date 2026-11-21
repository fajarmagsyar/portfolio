"use client";

import { onSound, soundOn } from "./sound";

// Plucked-string synthesis (Karplus-Strong): a burst of noise fed round a short delay
// line with a gentle low-pass. No audio files. Sound starts only after a user gesture.
//
// Each of the six strings has one voice. A note is the string's recording for the fret it
// was picked at; sliding to another fret or bending the string retunes that same note while
// it rings, as on the real thing, and a new pick on a string cuts off what it was sounding.
// Everything then goes through a small amp, which can be run clean or overdriven.

const OPEN = [82.41, 110.0, 146.83, 196.0, 246.94, 329.63]; // E2 A2 D3 G3 B3 E4

/**
 * The chords the wheel starts with. Fret per string, low E first; -1 = the string is muted.
 * Each can be refingered on the neck, so these are only where the eight places begin.
 */
export const DEFAULT_CHORDS: number[][] = [
  [0, 2, 2, 1, 0, 0], // E
  [-1, 0, 2, 2, 2, 0], // A
  [-1, -1, 0, 2, 3, 2], // D
  [3, 2, 0, 0, 0, 3], // G
  [-1, 3, 2, 0, 1, 0], // C
  [0, 2, 2, 0, 0, 0], // Em
  [-1, 0, 2, 2, 1, 0], // Am
  [-1, -1, 0, 2, 3, 1], // Dm
];

const NOTES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const OPEN_NOTE = [40, 45, 50, 55, 59, 64]; // the open strings as MIDI notes
// what a chord is called, by the steps above its root that it contains
const KINDS: [number[], string][] = [
  [[0, 4, 7], ""],
  [[0, 3, 7], "m"],
  [[0, 4, 7, 10], "7"],
  [[0, 3, 7, 10], "m7"],
  [[0, 4, 7, 11], "maj7"],
  [[0, 2, 7], "sus2"],
  [[0, 5, 7], "sus4"],
  [[0, 2, 4, 7], "add9"],
  [[0, 4, 7, 9], "6"],
  [[0, 3, 7, 9], "m6"],
  [[0, 3, 6], "dim"],
  [[0, 4, 8], "aug"],
  [[0, 5, 7, 10], "7sus4"],
  [[0, 4, 10], "7"],
  [[0, 3, 10], "m7"],
  [[0, 7], "5"],
  [[0], ""],
];

/** Names a fingering: "Em", "G", "D/F#", "A5". One it cannot place is named by its lowest note, with a star. */
export function chordName(frets: readonly number[]): string {
  const sounding = frets.map((f, i) => (f < 0 ? -1 : OPEN_NOTE[i] + f)).filter((n) => n >= 0);
  if (!sounding.length) return "×";
  const bass = Math.min(...sounding) % 12;
  const classes = [...new Set(sounding.map((n) => n % 12))];
  // the lowest note is tried as the root first; failing that, the chord is an inversion of another
  for (const root of [bass, ...classes.filter((c) => c !== bass)]) {
    const steps = classes.map((c) => (c - root + 12) % 12).sort((x, y) => x - y);
    const kind = KINDS.find(([k]) => k.length === steps.length && k.every((v, i) => v === steps[i]));
    if (kind) return NOTES[root] + kind[1] + (root === bass ? "" : `/${NOTES[bass]}`);
  }
  return `${NOTES[bass]}*`;
}

const LEVEL = 0.5;
let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let clean: GainNode | null = null;
let driven: GainNode | null = null;
let shape: readonly number[] = DEFAULT_CHORDS[5];
let distortion = false;
const cache = new Map<string, AudioBuffer>();

type Voice = { src: AudioBufferSourceNode; gain: GainNode };
const voices: (Voice | null)[] = [null, null, null, null, null, null];

// with sound off the strings are still played and still move; the amp is just turned right down
onSound((on) => {
  if (ctx && out) out.gain.setTargetAtTime(on ? LEVEL : 0, ctx.currentTime, 0.02);
});

/** The fingering the left hand is holding, which strumming then sounds. */
export function setShape(frets: readonly number[]) {
  shape = frets;
}

/** One gain stage: the wave is driven flat against the rails, a little harder on one side than the other. */
function clipCurve(drive: number, lean: number) {
  const n = 4096;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh((x + lean) * drive) - Math.tanh(lean * drive);
  }
  return curve;
}

function levels(ac: AudioContext) {
  if (!clean || !driven) return;
  const t = ac.currentTime;
  clean.gain.setTargetAtTime(distortion ? 0 : 1, t, 0.03);
  driven.gain.setTargetAtTime(distortion ? 1 : 0, t, 0.03);
}

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
    out = ctx.createGain();
    out.gain.value = soundOn() ? LEVEL : 0;
    // The clean channel: roll off the fizz, add a short slapback for a sense of room.
    clean = ctx.createGain();
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
    out.connect(clean).connect(body).connect(tone).connect(ctx.destination);
    tone.connect(delay).connect(fb).connect(ctx.destination);

    // The other channel is a high-gain stack, built the way metal tones are:
    //  - a boost in front that cuts the lows and pushes the upper mids, so the low strings stay tight
    //  - two gain stages one into the other, with enough gain that a note is a square wave for as long as it rings
    //  - the amp's tone stack with the mids scooped out and the bottom put back for the thump
    //  - a 4x12 cabinet, which is what takes the buzz off the top and leaves the growl
    //  - a compressor, since everything coming out is as loud as everything else
    driven = ctx.createGain();
    const node = <T extends AudioNode>(n: T, set: (n: T) => void) => {
      set(n);
      return n;
    };
    const filter = (type: BiquadFilterType, frequency: number, gain = 0, q = 0.707) =>
      node(ctx!.createBiquadFilter(), (f) => {
        f.type = type;
        f.frequency.value = frequency;
        f.gain.value = gain;
        f.Q.value = q;
      });
    const amount = (v: number) => node(ctx!.createGain(), (g) => (g.gain.value = v));
    const stage = (drive: number, lean: number) =>
      node(ctx!.createWaveShaper(), (w) => {
        w.curve = clipCurve(drive, lean);
        w.oversample = "4x";
      });
    const chain: AudioNode[] = [
      // the boost
      filter("highpass", 170),
      filter("peaking", 1100, 9, 0.8),
      amount(40),
      stage(6, 0.12),
      // between the stages: lose the rumble the first one made, and its harshest fizz
      filter("highpass", 110),
      filter("lowpass", 7000),
      amount(8),
      stage(4, -0.06),
      // tone stack: scooped
      filter("lowshelf", 130, 8),
      filter("peaking", 650, -11, 0.9),
      filter("peaking", 2600, 6, 1.1),
      filter("highshelf", 5000, 3),
      // cabinet
      filter("highpass", 75),
      filter("peaking", 110, 4, 1.4),
      filter("lowpass", 4800, 0, 0.9),
      filter("lowpass", 5600, 0, 0.6),
      node(ctx.createDynamicsCompressor(), (c) => {
        c.threshold.value = -18;
        c.ratio.value = 6;
        c.attack.value = 0.003;
        c.release.value = 0.12;
      }),
      amount(0.34),
      driven,
    ];
    chain.reduce((from, to) => from.connect(to), out as AudioNode);
    // a little air around it: the cabinet in a room
    const room = ctx.createDelay(0.2);
    room.delayTime.value = 0.037;
    driven.connect(ctx.destination);
    driven.connect(room).connect(amount(0.22)).connect(ctx.destination);
    clean.gain.value = distortion ? 0 : 1;
    driven.gain.value = distortion ? 1 : 0;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Switches the amp between its clean and its overdriven channel. */
export function setDistortion(on: boolean) {
  distortion = on;
  if (ctx) levels(ctx);
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

/** Stops whatever a string is sounding, quickly but without a click. */
export function mute(string: number) {
  const v = voices[string];
  if (!v || !ctx) return;
  voices[string] = null;
  const t = ctx.currentTime;
  v.gain.gain.cancelScheduledValues(t);
  v.gain.gain.setTargetAtTime(0, t, 0.012);
  v.src.stop(t + 0.1);
}

/** Picks one string (0 = low E) held at a fret (0 = open). Returns false if audio is unavailable. */
export function pick(string: number, fret: number, velocity = 1): boolean {
  const ac = ensure();
  if (!ac || !out) return false;
  const freq = OPEN[string] * Math.pow(2, fret / 12);
  const key = `${string}:${fret}`;
  let buf = cache.get(key);
  if (!buf) {
    buf = synth(ac, freq, 3.6);
    cache.set(key, buf);
  }
  mute(string);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const gain = ac.createGain();
  gain.gain.value = 0.32 * Math.max(0.2, Math.min(1, velocity));
  src.connect(gain).connect(out);
  src.start();
  const voice = { src, gain };
  voices[string] = voice;
  src.onended = () => {
    if (voices[string] === voice) voices[string] = null;
  };
  return true;
}

/**
 * Retunes the note a string is sounding, in semitones away from the fret it was picked at:
 * whole numbers for a slide along the neck, anything in between for a bend.
 */
export function retune(string: number, semitones: number, glide = 0.018) {
  const v = voices[string];
  if (!v || !ctx) return;
  v.src.detune.setTargetAtTime(semitones * 100, ctx.currentTime, glide);
}

/** Plucks one string as the current fingering holds it. Returns false if muted or audio is unavailable. */
export function pluck(string: number, velocity = 1): boolean {
  const fret = shape[string];
  if (fret < 0) return false;
  return pick(string, fret, velocity);
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
