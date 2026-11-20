"use client";

import { useCallback, useEffect, useState } from "react";
import { blip } from "@/audio/sfx";
import { useRestoreLang } from "@/state/lang";
import Room from "./Room";
import { FOCUS_ORDER, useRoom, type FocusId } from "./store";
import { Boot } from "./ui/Boot";
import { Hud } from "./ui/Hud";

/** The hi-fi version: the 3D room plus every 2D layer drawn over it. */
export default function RoomApp() {
  useRestoreLang();
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const booted = useRoom((r) => r.booted);

  useEffect(() => {
    document.documentElement.classList.add("will-room");
    // Development helpers: /?room=1&noboot=1&focus=guitar jumps straight to an object;
    // add &tv=memory|game|about together with focus=tv to open a TV screen.
    const p = new URLSearchParams(location.search);
    if (p.get("noboot") === "1") useRoom.getState().setBooted();
    const f = p.get("focus") as FocusId | null;
    if (f && FOCUS_ORDER.includes(f)) useRoom.getState().setFocus(f);
    const tv = p.get("tv");
    if (tv === "memory" || tv === "game" || tv === "about") useRoom.getState().setTvScreen(tv);
  }, []);

  // Once the room has loaded, the TV asks for a click; any click or key lets the visitor in.
  useEffect(() => {
    if (!ready || booted) return;
    const enter = () => {
      blip(880, 0.12);
      useRoom.getState().setBooted();
    };
    window.addEventListener("pointerdown", enter);
    window.addEventListener("keydown", enter);
    return () => {
      window.removeEventListener("pointerdown", enter);
      window.removeEventListener("keydown", enter);
    };
  }, [ready, booted]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0c0907" }} data-ready={ready}>
      <Room onReady={onReady} />
      <Hud />
      {!booted && <Boot ready={ready} />}
    </div>
  );
}
