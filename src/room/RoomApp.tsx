"use client";

import { useCallback, useEffect, useState } from "react";
import { blip } from "@/audio/sfx";
import { useRestoreLang } from "@/state/lang";
import Room from "./Room";
import { PLANETS } from "./planets";
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
    // add &tv=memory|about together with focus=tv to open a TV screen,
    // or &planet=earth to change the globe of the lamp (focus=saturn).
    const p = new URLSearchParams(location.search);
    if (p.get("noboot") === "1") useRoom.getState().setBooted();
    const f = p.get("focus") as FocusId | null;
    if (f && FOCUS_ORDER.includes(f)) useRoom.getState().setFocus(f);
    const tv = p.get("tv");
    if (tv === "memory" || tv === "about") useRoom.getState().setTvScreen(tv);
    // &guitar=rhythm starts the guitar in rhythm playing (focus=guitar)
    if (p.get("guitar") === "rhythm") useRoom.getState().setGuitarMode("rhythm");
    // &pack=open cuts the contact pack open, &pack=2 also takes that many cards (focus=cards)
    const pack = p.get("pack");
    if (pack) {
      useRoom.getState().openPack();
      for (let i = 0; i < Number(pack); i++) useRoom.getState().holdCard(i);
    }
    // &cd=<project id> takes that CD out of the shelf (focus=cds)
    const cd = p.get("cd");
    if (cd) useRoom.getState().selectCd(cd);
    const planet = PLANETS.find((x) => x.id === p.get("planet"));
    if (planet) useRoom.getState().setPlanet(planet.id);
  }, []);

  // Once the room has loaded, the TV asks whether the visitor wants sound, and either answer
  // lets them in (see objects/TvScreen.tsx). From the keyboard: Enter for sound, M for none.
  useEffect(() => {
    if (!ready || booted) return;
    const enter = (e: KeyboardEvent) => {
      const quiet = e.key === "m" || e.key === "M";
      if (e.key !== "Enter" && e.key !== " " && !quiet) return;
      useRoom.getState().setSound(!quiet);
      blip(880, 0.12);
      useRoom.getState().setBooted();
    };
    window.addEventListener("keydown", enter);
    return () => window.removeEventListener("keydown", enter);
  }, [ready, booted]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0c0907" }} data-ready={ready}>
      <Room onReady={onReady} />
      <Hud />
      {!booted && <Boot ready={ready} />}
    </div>
  );
}
