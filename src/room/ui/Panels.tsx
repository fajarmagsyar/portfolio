"use client";

import { skills } from "@/content/data";
import { useT } from "@/state/lang";
import { FOCUS_LABEL, useRoom, type FocusId } from "../store";

import s from "./ui.module.css";

function NotesPanel() {
  return (
    <ul className={`${s.chips} ${s.chipsLarge}`}>
      {skills.map((x) => (
        <li key={x}>{x}</li>
      ))}
    </ul>
  );
}

const BODY: Record<Exclude<FocusId, "tv" | "tapes" | "cd" | "cds" | "saturn" | "guitar" | "cards" | "dice" | "receipt" | "clock" | "album" | "canonet" | "portrait" | "frames">, () => React.ReactNode> = {
  notes: NotesPanel,
};

/** The panel that slides in on the right while the camera is close on an object. */
export function SidePanel({ focus }: { focus: Exclude<FocusId, "tv" | "tapes" | "cd" | "cds" | "saturn" | "guitar" | "cards" | "dice" | "receipt" | "clock" | "album" | "canonet" | "portrait" | "frames"> }) {
  const t = useT();
  const setFocus = useRoom((r) => r.setFocus);
  const Body = BODY[focus];
  return (
    <aside className={s.panel} aria-label={t(FOCUS_LABEL[focus])}>
      <header className={s.panelHead}>
        <h2>{t(FOCUS_LABEL[focus]).split(" · ")[0]}</h2>`n        <button className={s.back} onClick={() => setFocus(null)}>`n          ← {t("back")} <kbd>Esc</kbd>
        </button>
      </header>
      <div className={s.panelBody}>
        <Body />
      </div>
    </aside>
  );
}
