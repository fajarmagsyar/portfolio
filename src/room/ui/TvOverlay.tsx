"use client";

import { useLang } from "@/state/lang";
import { useRoom } from "../store";
import { tvText } from "../tv/program";
import s from "./ui.module.css";

/**
 * The picture itself is drawn on the tube in the 3D scene (see objects/TvScreen.tsx).
 * This is the same content as text, for screen readers.
 */
export function TvOverlay() {
  const lang = useLang();
  const screen = useRoom((r) => r.tvScreen);
  return (
    <p className={s.srOnly} aria-live="polite">
      {tvText(screen, lang)}
    </p>
  );
}
