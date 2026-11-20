"use client";

import { useState } from "react";
import { CHORDS, getChord, setChord, strum, type ChordName } from "@/audio/guitar";
import { click, clunk, whirr } from "@/audio/sfx";
import {
  certifications,
  education,
  jobs,
  jobYears,
  links,
  projects,
  skills,
  spotifyEmbedUrl,
  type Job,
  type Project,
} from "@/content/data";
import { useLang, useT } from "@/state/lang";
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

function ProjectCard({ project, index }: { project: Project; index: number }) {
  const lang = useLang();
  const t = useT();
  const empty = project.name === null;
  return (
    <article className={s.card} data-empty={empty} style={{ ["--ink" as string]: project.disc }}>
      <p className={s.cardKicker}>
        CD {String(index + 1).padStart(2, "0")}
        {project.year ? ` / ${project.year}` : ""}
      </p>
      <h3 className={s.cardTitle}>{project.name ?? t("empty_slot")}</h3>
      <p>{project.body ? project.body[lang] : t("empty_slot_body")}</p>
      {project.tech.length > 0 && (
        <ul className={s.chips}>
          {project.tech.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}
      {project.url && (
        <a href={project.url} target="_blank" rel="noopener noreferrer">
          {project.url.replace(/^https?:\/\//, "")}
        </a>
      )}
    </article>
  );
}

function Playlist() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const embed = spotifyEmbedUrl(links.spotifyPlaylistUrl);
  if (!embed) {
    return (
      <div className={s.missing}>
        <strong>{t("playlist_missing")}</strong>
        <span>{t("playlist_missing_hint")}</span>
      </div>
    );
  }
  if (!open) {
    return (
      <button
        className={s.primary}
        onClick={() => {
          whirr();
          setOpen(true);
        }}
      >
        {t("play_playlist")}
      </button>
    );
  }
  return (
    <iframe
      className={s.spotify}
      src={embed}
      title="Spotify"
      loading="lazy"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
    />
  );
}

function TapesPanel() {
  const t = useT();
  const lang = useLang();
  const selected = useRoom((r) => r.selectedTape);
  const loaded = useRoom((r) => r.loadedTape);
  const selectTape = useRoom((r) => r.selectTape);
  const loadTape = useRoom((r) => r.loadTape);
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
              <span className={s.rowMeta}>{loaded === j.id ? `★ ${t("now_loaded")}` : jobYears(j, lang)}</span>
            </button>
          </li>
        ))}
      </ul>
      {job && (
        <>
          <JobCard job={job} />
          <button
            className={s.primary}
            onClick={() => {
              clunk();
              loadTape(job.id);
            }}
          >
            {t("insert_tape")}
          </button>
        </>
      )}
    </>
  );
}

function CassettePanel() {
  const t = useT();
  const loaded = useRoom((r) => r.loadedTape);
  const loadTape = useRoom((r) => r.loadTape);
  const setFocus = useRoom((r) => r.setFocus);
  const job = jobs.find((j) => j.id === loaded);
  return (
    <>
      {job ? (
        <>
          <p className={s.lead}>★ {t("now_loaded")}</p>
          <JobCard job={job} />
          <button
            className={s.ghost}
            onClick={() => {
              click(0.7);
              loadTape(null);
            }}
          >
            {t("eject")}
          </button>
        </>
      ) : (
        <>
          <p className={s.lead}>{t("nothing_loaded")}</p>
          <button className={s.ghost} onClick={() => setFocus("tapes")}>
            {t("obj_tapes").split(" — ")[0]}
          </button>
        </>
      )}
      <Playlist />
    </>
  );
}

function CdsPanel() {
  const t = useT();
  const selected = useRoom((r) => r.selectedCd);
  const loaded = useRoom((r) => r.loadedCd);
  const selectCd = useRoom((r) => r.selectCd);
  const loadCd = useRoom((r) => r.loadCd);
  const index = projects.findIndex((p) => p.id === selected);
  return (
    <>
      <p className={s.lead}>{t("projects_note")}</p>
      <ul className={s.list}>
        {projects.map((p, i) => (
          <li key={p.id}>
            <button
              className={s.row}
              aria-pressed={selected === p.id}
              onClick={() => {
                click();
                selectCd(selected === p.id ? null : p.id);
              }}
            >
              <span className={s.swatch} style={{ background: p.disc, borderRadius: "50%" }} />
              <span className={s.rowMain}>{p.name ?? `${t("empty_slot")} ${String(i + 1).padStart(2, "0")}`}</span>
              <span className={s.rowMeta}>{loaded === p.id ? `★ ${t("now_loaded")}` : (p.year ?? "—")}</span>
            </button>
          </li>
        ))}
      </ul>
      {index >= 0 && (
        <>
          <ProjectCard project={projects[index]} index={index} />
          <button
            className={s.primary}
            onClick={() => {
              clunk();
              whirr();
              loadCd(projects[index].id);
            }}
          >
            {t("insert_cd")}
          </button>
        </>
      )}
    </>
  );
}

function CdPanel() {
  const t = useT();
  const loaded = useRoom((r) => r.loadedCd);
  const loadCd = useRoom((r) => r.loadCd);
  const setFocus = useRoom((r) => r.setFocus);
  const index = projects.findIndex((p) => p.id === loaded);
  return (
    <>
      {index >= 0 ? (
        <>
          <p className={s.lead}>★ {t("now_loaded")}</p>
          <ProjectCard project={projects[index]} index={index} />
          <button
            className={s.ghost}
            onClick={() => {
              click(0.7);
              loadCd(null);
            }}
          >
            {t("eject")}
          </button>
        </>
      ) : (
        <>
          <p className={s.lead}>{t("nothing_loaded")}</p>
          <button className={s.ghost} onClick={() => setFocus("cds")}>
            {t("obj_cds").split(" — ")[0]}
          </button>
        </>
      )}
      <Playlist />
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

const BODY: Record<Exclude<FocusId, "tv">, () => React.ReactNode> = {
  tapes: TapesPanel,
  cassette: CassettePanel,
  cds: CdsPanel,
  cd: CdPanel,
  guitar: GuitarPanel,
  frames: FramesPanel,
  notes: NotesPanel,
  cards: CardsPanel,
};

/** The panel that slides in on the right while the camera is close on an object. */
export function SidePanel({ focus }: { focus: Exclude<FocusId, "tv"> }) {
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
