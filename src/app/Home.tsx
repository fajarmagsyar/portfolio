"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { LiteView } from "@/lite/LiteView";

const RoomApp = dynamic(() => import("@/room/RoomApp"), { ssr: false });

/** Same test as the preflight script in layout.tsx. `?room=1` forces the room. */
function canRunRoom(): boolean {
  try {
    if (new URLSearchParams(location.search).get("room") === "1") return true;
    return (
      innerWidth >= 860 &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches &&
      !!document.createElement("canvas").getContext("webgl2")
    );
  } catch {
    return false;
  }
}

/**
 * The server always sends the static page (good for search engines and slow devices).
 * Capable browsers swap it for the 3D room right after load.
 */
export function Home() {
  const [mode, setMode] = useState<"pending" | "room" | "lite">("pending");

  useEffect(() => {
    const room = canRunRoom();
    if (!room) document.documentElement.classList.remove("will-room");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(room ? "room" : "lite");
    return () => document.documentElement.classList.remove("will-room");
  }, []);

  if (mode === "room") return <RoomApp />;
  return <LiteView routed={mode === "lite"} />;
}
