"use client";

import { useState } from "react";
import { CHORDS, getChord, setChord, strum, type ChordName } from "@/audio/guitar";
import { click } from "@/audio/sfx";
import {
  certifications,
  education,
  jobs,
  jobYears,
  links,
  skills,
  type Job,
} from "@/content/data";
import { useLang, useT } from "@/state/lang";
import { MAX_TURNED } from "../album";
import { turnAlbum } from "../objects/Album";
import { FOCUS_LABEL, useRoom, type FocusId } from "../store";
import s from "./ui.module.css";

function JobCard({ job }: { job: Job }) {
  const lang = useLang();
  return (
    <article className={s.card} style={{ ["--ink" as string]: job.tape.ink }}>
      <p className={s.cardKicker}>
        {job.place[lang]} / {jobYears(job, lang)}
      </p>
      <h3 className={s.cardTitle}>{job.company}</h3>
      <p className={s.cardRole}>{job.title}</p>
      <p>{job.body[lang]}</p>
      <ul className={s.chips}>
        {job.tech.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </article>
  );
}

function TapesPanel() {
  const t = useT();
  const lang = useLang();
  const selected = useRoom((r) => r.selectedTape);
  const selectTape = useRoom((r) => r.selectTape);
  const job = jobs.find((j) => j.id === selected);
  return (
    <>
      <p className={s.lead}>{t("work_note")}</p>
      <ul className={s.list}>
        {jobs.map((j) => (
          <li key={j.id}>
            <button
              className={s.row}
              aria-pressed={selected === j.id}
              onClick={() => {
                click();
                selectTape(selected === j.id ? null : j.id);
              }}
            >
              <span className={s.swatch} style={{ background: j.tape.shell }} />
              <span className={s.rowMain}>{j.company}</span>
              <span className={s.rowMeta}>{jobYears(j, lang)}</span>
            </button>
          </li>
        ))}
      </ul>
      {job && <JobCard job={job} />}
    </>
  );
}

/** Tells the 3D strings which one just sounded, so it can wobble. */
const mark = (i: number) => useRoom.getState().markPluck(i, performance.now() / 1000);

function GuitarPanel() {
  const t = useT();
  const [chord, setLocal] = useState<ChordName>(getChord());
  return (
    <>
      <p className={s.lead}>{t("guitar_hint")}</p>
      <div className={s.chords} role="group" aria-label="Chord">
        {(Object.keys(CHORDS) as ChordName[]).map((name) => (
          <button
            key={name}
            className={s.chord}
            aria-pressed={chord === name}
            onClick={() => {
              setChord(name);
              setLocal(name);
              strum(mark);
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <div className={s.strumRow}>
        <button className={s.primary} onClick={() => strum(mark)}>
          Strum ↓
        </button>
        <button className={s.ghost} onClick={() => strum(mark, true)}>
          Strum ↑
        </button>
      </div>
    </>
  );
}

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

function CardsPanel() {
  const t = useT();
  const rows = [
    { label: t("email"), text: links.email, href: `mailto:${links.email}` },
    { label: "GitHub", text: links.github.label, href: links.github.url },
    { label: "LinkedIn", text: links.linkedin.label, href: links.linkedin.url },
    { label: "Steam", text: links.steam.label, href: links.steam.url },
  ];
  return (
    <ul className={s.contact}>
      {rows.map((r) => (
        <li key={r.label}>
          <span>{r.label}</span>
          <a href={r.href} target={r.href.startsWith("mailto:") ? undefined : "_blank"} rel="noopener noreferrer">
            {r.text}
          </a>
        </li>
      ))}
    </ul>
  );
}

function CanonetPanel() {
  const t = useT();
  const setFocus = useRoom((r) => r.setFocus);
  return (
    <>
      <p className={s.lead}>{t("canonet_note")}</p>
      <button className={s.primary} onClick={() => setFocus("album")}>
        {t("open_album")}
      </button>
    </>
  );
}

function AlbumPanel() {
  const t = useT();
  const turned = useRoom((r) => r.albumTurned);
  return (
    <>
      <p className={s.lead}>{t("album_note")}</p>
      <p className={s.lead}>{turned < 1 ? t("album_cover") : `${t("album_page")} ${turned} / ${MAX_TURNED}`}</p>
      <div className={s.strumRow}>
        <button className={s.ghost} disabled={turned <= 1} onClick={() => turnAlbum(-1)}>
          ← {t("prev")}
        </button>
        <button className={s.primary} disabled={turned < 1 || turned >= MAX_TURNED} onClick={() => turnAlbum(1)}>
          {t("next")} →
        </button>
      </div>
    </>
  );
}

const BODY: Record<Exclude<FocusId, "tv" | "cd" | "cds">, () => React.ReactNode> = {
  tapes: TapesPanel,
  guitar: GuitarPanel,
  frames: FramesPanel,
  notes: NotesPanel,
  cards: CardsPanel,
  canonet: CanonetPanel,
  album: AlbumPanel,
};

/** The panel that slides in on the right while the camera is close on an object. */
export function SidePanel({ focus }: { focus: Exclude<FocusId, "tv" | "cd" | "cds"> }) {
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
