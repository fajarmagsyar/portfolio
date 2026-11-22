"use client";

import {
  certifications,
  education,
  skills,
} from "@/content/data";
import { useLang, useT } from "@/state/lang";
import { FOCUS_LABEL, useRoom, type FocusId } from "../store";

import s from "./ui.module.css";

function FramesPanel() {
  const t = useT();
  const lang = useLang();
  return (
    <>
      <h3 className={s.sub}>{t("education")}</h3>
      <article className={s.card}>
        <h3 className={s.cardTitle}>{education.school}</h3>
        <p className={s.cardRole}>{education.degree[lang]}</p>
        <p>
          {education.years} · {t("gpa")} {education.gpa}
        </p>
      </article>
      <h3 className={s.sub}>{t("certs")}</h3>
      <ul className={s.certs}>
        {certifications.map((c) => (
          <li key={`${c.year}${c.title}${c.issuer}`}>
            <span>{c.year}</span>
            <div>
              <strong>{c.title}</strong>
              <br />
              {c.issuer}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function NotesPanel() {
  return (
    <ul className={`${s.chips} ${s.chipsLarge}`}>
      {skills.map((x) => (
        <li key={x}>{x}</li>
      ))}
    </ul>
  );
}

const BODY: Record<Exclude<FocusId, "tv" | "tapes" | "cd" | "cds" | "saturn" | "guitar" | "cards" | "dice" | "receipt" | "clock" | "album" | "canonet" | "portrait">, () => React.ReactNode> = {
  frames: FramesPanel,
  notes: NotesPanel,
};

/** The panel that slides in on the right while the camera is close on an object. */
export function SidePanel({ focus }: { focus: Exclude<FocusId, "tv" | "tapes" | "cd" | "cds" | "saturn" | "guitar" | "cards" | "dice" | "receipt" | "clock" | "album" | "canonet" | "portrait"> }) {
  const t = useT();
  const setFocus = useRoom((r) => r.setFocus);
  const Body = BODY[focus];
  return (
    <aside className={s.panel} aria-label={t(FOCUS_LABEL[focus])}>
      <header className={s.panelHead}>
        <h2>{t(FOCUS_LABEL[focus]).split(" — ")[0]}</h2>
        <button className={s.back} onClick={() => setFocus(null)}>
          ◀ {t("back")} <kbd>Esc</kbd>
        </button>
      </header>
      <div className={s.panelBody}>
        <Body />
      </div>
    </aside>
  );
}
