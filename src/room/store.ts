"use client";

import { create } from "zustand";
import type { StringKey } from "@/content/strings";

export type FocusId = "tv" | "tapes" | "cassette" | "cds" | "cd" | "guitar" | "frames" | "notes" | "cards";
export type TvScreen = "menu" | "memory" | "game" | "about";

export const FOCUS_ORDER: FocusId[] = ["tv", "tapes", "cassette", "cds", "cd", "guitar", "frames", "notes", "cards"];

export const FOCUS_LABEL: Record<FocusId, StringKey> = {
  tv: "obj_tv",
  tapes: "obj_tapes",
  cassette: "obj_cassette",
  cds: "obj_cds",
  cd: "obj_cd",
  guitar: "obj_guitar",
  frames: "obj_frames",
  notes: "obj_notes",
  cards: "obj_cards",
};

type RoomState = {
  booted: boolean;
  focus: FocusId | null;
  hover: FocusId | null;
  tvScreen: TvScreen;
  /** job id pulled out of the rack */
  selectedTape: string | null;
  /** job id sitting in the cassette player */
  loadedTape: string | null;
  selectedCd: string | null;
  loadedCd: string | null;
  /** index 0-5 of the string plucked most recently, with a timestamp, so the mesh can wobble */
  plucks: number[];
  setBooted: () => void;
  setFocus: (focus: FocusId | null) => void;
  setHover: (hover: FocusId | null) => void;
  setTvScreen: (s: TvScreen) => void;
  selectTape: (id: string | null) => void;
  loadTape: (id: string | null) => void;
  selectCd: (id: string | null) => void;
  loadCd: (id: string | null) => void;
  markPluck: (string: number, at: number) => void;
};

export const useRoom = create<RoomState>((set) => ({
  booted: false,
  focus: null,
  hover: null,
  tvScreen: "menu",
  selectedTape: null,
  loadedTape: null,
  selectedCd: null,
  loadedCd: null,
  plucks: [-10, -10, -10, -10, -10, -10],
  setBooted: () => set({ booted: true }),
  setFocus: (focus) => set({ focus, hover: null, tvScreen: "menu" }),
  setHover: (hover) => set({ hover }),
  setTvScreen: (tvScreen) => set({ tvScreen }),
  selectTape: (selectedTape) => set({ selectedTape }),
  loadTape: (loadedTape) => set({ loadedTape, selectedTape: null }),
  selectCd: (selectedCd) => set({ selectedCd }),
  loadCd: (loadedCd) => set({ loadedCd, selectedCd: null }),
  markPluck: (string, at) =>
    set((s) => {
      const plucks = s.plucks.slice();
      plucks[string] = at;
      return { plucks };
    }),
}));
