"use client";

import { create } from "zustand";
import type { StringKey } from "@/content/strings";

export type FocusId = "tv" | "tapes" | "cds" | "cd" | "guitar" | "frames" | "notes" | "cards" | "canonet" | "album";
export type TvScreen = "menu" | "memory" | "game" | "about";

export const FOCUS_ORDER: FocusId[] = ["tv", "tapes", "cds", "cd", "guitar", "frames", "notes", "cards", "canonet", "album"];

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
};

type RoomState = {
  booted: boolean;
  focus: FocusId | null;
  hover: FocusId | null;
  /** what the control under the cursor does, shown beside the cursor (the Discman's keys) */
  tip: StringKey | null;
  tvScreen: TvScreen;
  /** job id pulled out of the rack */
  selectedTape: string | null;
  selectedCd: string | null;
  /** index 0-5 of the string plucked most recently, with a timestamp, so the mesh can wobble */
  plucks: number[];
  /** how many leaves of the photo album are turned over: 0 is shut, 1 is the cover open */
  albumTurned: number;
  /** index of the album photo the camera has moved in on */
  zoomed: number | null;
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

export const useRoom = create<RoomState>((set) => ({
  booted: false,
  focus: null,
  hover: null,
  tip: null,
  tvScreen: "menu",
  selectedTape: null,
  selectedCd: null,
  plucks: [-10, -10, -10, -10, -10, -10],
  setBooted: () => set({ booted: true }),
  albumTurned: 0,
  zoomed: null,
  setFocus: (focus) => set({ focus, hover: null, tip: null, tvScreen: "menu", zoomed: null, selectedCd: null, selectedTape: null }),
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
