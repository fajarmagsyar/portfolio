"use client";

import { create } from "zustand";
import { tracks } from "@/content/music";

// The Discman's transport: one <audio> element playing the files listed in content/music.ts.

export type PlayerState = "stopped" | "playing" | "paused";

type Player = { state: PlayerState; index: number; seconds: number };
export const usePlayer = create<Player>(() => ({ state: "stopped", index: 0, seconds: 0 }));

let audio: HTMLAudioElement | null = null;
let cued = -1;

function el() {
  if (!audio) {
    audio = new Audio();
    audio.preload = "auto";
    audio.addEventListener("timeupdate", () => usePlayer.setState({ seconds: audio!.currentTime }));
    // at the end of a track the disc runs on; after the last one it stops
    audio.addEventListener("ended", () => {
      const { index } = usePlayer.getState();
      if (index + 1 < tracks.length) start(index + 1);
      else stop();
    });
    audio.addEventListener("error", () => usePlayer.setState({ state: "stopped" }));
  }
  return audio;
}

function start(index: number) {
  const a = el();
  if (cued !== index) {
    a.src = tracks[index].src;
    cued = index;
  }
  usePlayer.setState({ index, state: "playing" });
  // An AbortError only means this request was overtaken (by a newer one, or by a browser
  // extension that manages media and replays it); the element's own events say what happened.
  void a.play().catch((e: unknown) => {
    if ((e as DOMException)?.name !== "AbortError") usePlayer.setState({ state: "stopped" });
  });
}

export const hasDisc = () => tracks.length > 0;

export function play() {
  if (!hasDisc() || usePlayer.getState().state === "playing") return;
  start(usePlayer.getState().index);
}

export function pause() {
  if (usePlayer.getState().state !== "playing") return;
  el().pause();
  usePlayer.setState({ state: "paused" });
}

export function stop() {
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
  usePlayer.setState({ state: "stopped", index: 0, seconds: 0 });
  cued = -1;
}

/** Steps to another track, keeping the transport as it was: playing stays playing, stopped stays stopped. */
function skipTo(index: number) {
  const { state } = usePlayer.getState();
  if (state === "playing") return start(index);
  if (audio && cued === index) audio.currentTime = 0;
  usePlayer.setState({ index, seconds: 0 });
  if (state === "paused" && audio) {
    audio.src = tracks[index].src;
    cued = index;
  }
}

export function next() {
  if (!hasDisc()) return;
  skipTo((usePlayer.getState().index + 1) % tracks.length);
}

export function prev() {
  if (!hasDisc()) return;
  const { index, seconds } = usePlayer.getState();
  // a few seconds in, the button goes back to the start of the track, as on the real thing
  if (seconds > 3) return skipTo(index);
  skipTo((index - 1 + tracks.length) % tracks.length);
}
