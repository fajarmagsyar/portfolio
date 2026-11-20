"use client";

import { useProgress } from "@react-three/drei";
import { profile } from "@/content/data";
import { useT } from "@/state/lang";
import s from "./ui.module.css";

const CELLS = 22;

/**
 * Covers the room while its models and textures load, with a bar of blocks filling up.
 * When the room is ready it lifts; the TV in the room then asks for a click to enter.
 */
export function Boot({ ready }: { ready: boolean }) {
  const t = useT();
  const progress = useProgress((p) => p.progress);
  const pct = ready ? 100 : Math.min(99, Math.round(progress));
  return (
    <div className={s.boot} data-leaving={ready} role="status">
      <div className={s.bootBox}>
        <p className={s.bootName}>{profile.name}</p>
        <div className={s.bootBar} aria-hidden="true">
          {Array.from({ length: CELLS }, (_, i) => (
            <i key={i} data-on={i < Math.round((pct / 100) * CELLS)} />
          ))}
          <span>{pct}%</span>
        </div>
        <p className={s.bootHint}>{t("loading")}</p>
      </div>
    </div>
  );
}
