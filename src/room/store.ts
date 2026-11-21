"use client";

import { create } from "zustand";
import { DEFAULT_CHORDS, setDistortion as driveAmp, setShape } from "@/audio/guitar";
import { setSound as switchSound } from "@/audio/sound";
import type { StringKey } from "@/content/strings";
import type { PlanetId } from "./planets";

export type FocusId = "tv" | "tapes" | "cds" | "cd" | "guitar" | "frames" | "notes" | "cards" | "canonet" | "album" | "saturn" | "dice" | "receipt" | "clock" | "portrait";
export type TvScreen = "menu" | "memory" | "game" | "about";

export const FOCUS_ORDER: FocusId[] = ["tv", "tapes", "cds", "cd", "guitar", "frames", "notes", "cards", "canonet", "album", "saturn", "dice", "receipt", "clock", "portrait"];

export const FOCUS_LABEL: Record<FocusId, StringKey> = {
  tv: "obj_tv",
  tapes: "obj_tapes",
  cds: "obj_cds",
  cd: "obj_cd",
  guitar: "obj_guitar",
  frames: "obj_frames",
  notes: "obj_notes",
  cards: "obj_cards",
  canonet: "obj_canonet",
  album: "obj_album",
  saturn: "obj_saturn",
  dice: "obj_dice",
  receipt: "obj_receipt",
  clock: "obj_clock",
  portrait: "obj_portrait",
};

type RoomState = {
  booted: boolean;
  /** whether the room makes sound: chosen on the way in */
  sound: boolean;
  setSound: (on: boolean) => void;
  focus: FocusId | null;
  hover: FocusId | null;
  /** what the control under the cursor does, shown beside the cursor (the Discman's keys) */
  tip: StringKey | null;
  tvScreen: TvScreen;
  /** job id pulled out of the rack */
  selectedTape: string | null;
  selectedCd: string | null;
  /** the CD whose case is standing open: for a moment longer than it is selected, while it shuts */
  cdOpen: string | null;
  setCdOpen: (id: string | null) => void;
  /** index 0-5 of the string plucked most recently, with a timestamp, so the mesh can wobble */
  plucks: number[];
  /** lead: single notes anywhere on the neck. rhythm: a chord is held and the strings are strummed */
  guitarMode: "lead" | "rhythm";
  /** the eight fingerings round the chord wheel (fret per string, low E first, -1 muted); the visitor can change them */
  chords: number[][];
  /** which of them is held in rhythm playing */
  slot: number;
  /** whether the amp is overdriven */
  distortion: boolean;
  setGuitarMode: (mode: "lead" | "rhythm") => void;
  setSlot: (slot: number) => void;
  /** refingers one string of the chord being held */
  setFret: (string: number, fret: number) => void;
  /** puts one place on the wheel back to the chord it started as */
  resetChord: (slot: number) => void;
  setDistortion: (on: boolean) => void;
  /** looking through the Canonet's viewfinder, rather than at the Canonet */
  finder: boolean;
  setFinder: (on: boolean) => void;
  /** how many times the shutter has been pressed; each press is a picture to be taken of what the finder shows */
  shutter: number;
  pressShutter: () => void;
  /** the last picture taken, as an image; it is kept, and goes on the album's first page */
  shot: string | null;
  setShot: (shot: string) => void;
  /** the pack of contact cards: whether it has been cut open, the card in the hand, and those taken before it, in order */
  packOpen: boolean;
  cardHeld: number | null;
  cardsTaken: number[];
  openPack: () => void;
  /** takes a card into the hand; the one that was there joins those already taken */
  holdCard: (card: number) => void;
  /** puts every card back in the pack, which stays open */
  returnCards: () => void;
  /** how many leaves of the photo album are turned over: 0 is shut, 1 is the cover open */
  albumTurned: number;
  /** index of the album photo the camera has moved in on */
  zoomed: number | null;
  /** which planet the globe of the Saturn lamp is showing */
  planet: PlanetId;
  setPlanet: (planet: PlanetId) => void;
  setBooted: () => void;
  setFocus: (focus: FocusId | null) => void;
  setHover: (hover: FocusId | null) => void;
  setTip: (tip: StringKey | null) => void;
  setTvScreen: (s: TvScreen) => void;
  selectTape: (id: string | null) => void;
  selectCd: (id: string | null) => void;
  markPluck: (string: number, at: number) => void;
  setAlbumTurned: (n: number) => void;
  setZoomed: (z: number | null) => void;
};

const SHOT_KEY = "canonet-shot";
function savedShot(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const kept = localStorage.getItem(SHOT_KEY);
    return kept && kept.startsWith("data:image/") ? kept : null;
  } catch {
    return null;
  }
}

// The visitor's own fingerings are kept between visits.
const CHORDS_KEY = "guitar-chords";
function savedChords(): number[][] {
  const fresh = DEFAULT_CHORDS.map((c) => c.slice());
  if (typeof window === "undefined") return fresh;
  try {
    const kept: unknown = JSON.parse(localStorage.getItem(CHORDS_KEY) ?? "null");
    const ok = Array.isArray(kept) && kept.length === fresh.length && kept.every((c) => Array.isArray(c) && c.length === 6 && c.every((f) => Number.isInteger(f) && f >= -1 && f <= 24));
    const chords = ok ? (kept as number[][]) : fresh;
    setShape(chords[5]);
    return chords;
  } catch {
    return fresh;
  }
}
/** Replaces one fingering, keeps it, and hands it to the strings if it is the one being held. */
function refinger(chords: number[][], slot: number, frets: number[], held: number) {
  const next = chords.map((c, i) => (i === slot ? frets.slice() : c));
  if (slot === held) setShape(next[slot]);
  try {
    localStorage.setItem(CHORDS_KEY, JSON.stringify(next));
  } catch {
    // private browsing: the change still lasts for this visit
  }
  return { chords: next };
}

export const useRoom = create<RoomState>((set) => ({
  booted: false,
  sound: true,
  setSound: (sound) => {
    switchSound(sound);
    set({ sound });
  },
  focus: null,
  hover: null,
  tip: null,
  tvScreen: "menu",
  selectedTape: null,
  selectedCd: null,
  cdOpen: null,
  setCdOpen: (cdOpen) => set({ cdOpen }),
  plucks: [-10, -10, -10, -10, -10, -10],
  setBooted: () => set({ booted: true }),
  guitarMode: "lead",
  chords: savedChords(),
  slot: 5,
  distortion: false,
  setGuitarMode: (guitarMode) => set({ guitarMode }),
  setSlot: (slot) =>
    set((s) => {
      setShape(s.chords[slot]);
      return { slot };
    }),
  setFret: (string, fret) => set((s) => refinger(s.chords, s.slot, s.chords[s.slot].map((f, i) => (i === string ? fret : f)), s.slot)),
  resetChord: (slot) => set((s) => refinger(s.chords, slot, DEFAULT_CHORDS[slot], s.slot)),
  setDistortion: (distortion) => {
    driveAmp(distortion);
    set({ distortion });
  },
  finder: false,
  setFinder: (finder) => set({ finder, tip: null }),
  shutter: 0,
  pressShutter: () => set((s) => ({ shutter: s.shutter + 1 })),
  shot: savedShot(),
  setShot: (shot) => {
    try {
      localStorage.setItem(SHOT_KEY, shot);
    } catch {
      // too big to keep, or private browsing: it still lasts for this visit
    }
    set({ shot });
  },
  packOpen: false,
  cardHeld: null,
  cardsTaken: [],
  openPack: () => set({ packOpen: true }),
  returnCards: () => set({ cardHeld: null, cardsTaken: [] }),
  holdCard: (card) =>
    set((s) => ({
      cardHeld: card,
      cardsTaken: [...s.cardsTaken.filter((c) => c !== card), ...(s.cardHeld !== null && s.cardHeld !== card ? [s.cardHeld] : [])],
    })),
  albumTurned: 0,
  zoomed: null,
  planet: "mars",
  setPlanet: (planet) => set({ planet }),
  setFocus: (focus) => set({ focus, hover: null, tip: null, tvScreen: "menu", zoomed: null, selectedCd: null, selectedTape: null, finder: false }),
  setAlbumTurned: (albumTurned) => set({ albumTurned }),
  setZoomed: (zoomed) => set({ zoomed }),
  setHover: (hover) => set((s) => (s.hover === hover ? s : { hover })),
  setTip: (tip) => set((s) => (s.tip === tip ? s : { tip })),
  setTvScreen: (tvScreen) => set({ tvScreen }),
  selectTape: (selectedTape) => set({ selectedTape }),
  selectCd: (selectedCd) => set({ selectedCd }),
  markPluck: (string, at) =>
    set((s) => {
      const plucks = s.plucks.slice();
      plucks[string] = at;
      return { plucks };
    }),
}));
