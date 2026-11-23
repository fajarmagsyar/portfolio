"use client";

import { useProgress } from "@react-three/drei";
import { asset } from "@/asset";
import { profile } from "@/content/data";
import s from "./ui.module.css";

/**
 * Covers the room while its models and textures load: the logo, filling up from the bottom.
 * When the room is ready it lifts; the TV in the room then asks for a click to enter.
 */
export function Boot({ ready }: { ready: boolean }) {
  const progress = useProgress((p) => p.progress);
  const pct = ready ? 100 : Math.min(99, Math.round(progress));
  const mask = `url(${asset("/logo.png")})`;
  return (
    <div className={s.boot} data-leaving={ready} role="status" aria-label="Loading">
      <div className={s.bootBox}>
        <div className={s.bootLogo} style={{ maskImage: mask, WebkitMaskImage: mask }} aria-hidden="true">
          <div className={s.bootFill} style={{ height: `${pct}%` }} />
        </div>
        <p className={s.bootName}>{profile.name}</p>
      </div>
    </div>
  );
}
