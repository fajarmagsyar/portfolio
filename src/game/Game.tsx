"use client";

import { useEffect, useRef } from "react";
import { strings } from "@/content/strings";
import { useLang, useLangStore } from "@/state/lang";
import ui from "@/room/ui/ui.module.css";
import { GAME_SIZE, startGame } from "./engine";

/** The game on a plain canvas element. The room's TV runs the same engine straight onto its tube instead. */
export default function Game() {
  const lang = useLang();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => startGame(canvasRef.current!, () => useLangStore.getState().lang), []);

  return <canvas ref={canvasRef} className={ui.game} width={GAME_SIZE.w} height={GAME_SIZE.h} role="img" aria-label={strings[lang].game_title} />;
}
