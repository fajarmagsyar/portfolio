"use client";

import { asset } from "@/asset";
import { useState } from "react";
import {
  certifications,
  education,
  jobs,
  jobYears,
  links,
  profile,
  projects,
  skills,
} from "@/content/data";
import { useLang, useRestoreLang, useT } from "@/state/lang";
import { CreditsList } from "@/ui/CreditsList";
import { FidelityToggle, LangToggle } from "@/ui/Switches";
import s from "./LiteView.module.css";

/** The static, lo-fi version: every piece of content on one plain page. */
export function LiteView({ routed = false }: { routed?: boolean }) {
  useRestoreLang();
  const lang = useLang();
  const t = useT();
  const [noticeOpen, setNoticeOpen] = useState(true);

  return (
    <div className={`${s.page} lite-root`}>
      <header className={s.header}>
        <a className={s.brand} href="#top">
          {profile.name}
        </a>
        <nav className={s.nav} aria-label="Main">
          <a href="#about">{t("nav_about")}</a>
          <a href="#work">{t("nav_work")}</a>
          <a href="#projects">{t("nav_projects")}</a>
          <a href="#contact">{t("nav_contact")}</a>
        </nav>
        <div className={s.switches}>
          <FidelityToggle current="lofi" />
          <LangToggle />
        </div>
      </header>

      <main id="top" className={s.main}>
        <section className={s.hero}>
          <p className={s.prompt}>&gt;_ {profile.role}</p>
          <h1>{profile.hello[lang]}</h1>
          <p className={s.lede}>{profile.intro[lang]}</p>
          <p className={s.likes}>{profile.likes[lang]}</p>
        </section>

        {noticeOpen && (
          <aside className={s.notice}>
            <button className={s.noticeClose} onClick={() => setNoticeOpen(false)} aria-label={t("close")}>
              ×
            </button>
            <strong>{t("static_title")}</strong>
            <p>
              {routed ? `${t("routed_note")} ` : ""}
              {t("static_body")}
            </p>
            <a href={asset("/?room=1")}>{t("static_cta")} →</a>
          </aside>
        )}

        <section id="about" className={s.section}>
          <h2>{t("nav_about")}</h2>
          {profile.about[lang].map((p) => (
            <p key={p}>{p}</p>
          ))}
        </section>

        <section id="work" className={s.section}>
          <h2>{t("work")}</h2>
          <p className={s.note}>{t("work_note")}</p>
          <ol className={s.tapes}>
            {jobs.map((job) => (
              <li key={job.id} className={s.tape}>
                <div
                  className={s.spine}
                  style={{ background: job.tape.shell, ["--label" as string]: job.tape.label, ["--ink" as string]: job.tape.ink }}
                  aria-hidden="true"
                >
                  <span className={s.spineLabel}>{job.company}</span>
                  <span className={s.spineYear}>{jobYears(job, lang)}</span>
                </div>
                <div className={s.tapeBody}>
                  <h3>
                    {job.title} <span className={s.at}>· {job.company}</span>
                  </h3>
                  <p className={s.meta}>
                    {job.place[lang]} / {jobYears(job, lang)}
                  </p>
                  <p>{job.body[lang]}</p>
                  <ul className={s.chips}>
                    {job.tech.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="projects" className={s.section}>
          <h2>{t("projects")}</h2>
          <p className={s.note}>{t("projects_note")}</p>
          <ul className={s.discs}>
            {projects.map((p, i) => (
              <li key={p.id} className={s.disc} data-empty={p.name === null}>
                <span className={s.discArt} style={{ background: p.disc }} aria-hidden="true" />
                <div>
                  <h3>{p.name ?? `${t("empty_slot")} ${String(i + 1).padStart(2, "0")}`}</h3>
                  <p>{p.body ? p.body[lang] : t("empty_slot_body")}</p>
                  {p.url && <a href={p.url}>{p.url.replace(/^https?:\/\//, "")}</a>}
                  {p.coverage && (
                    <p>
                      {t("covered_by")}:{" "}
                      {p.coverage.map((c, k) => (
                        <span key={c.url}>
                          {k > 0 && " · "}
                          <a href={c.url}>{c.name}</a>
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section id="education" className={s.section}>
          <h2>{t("education")}</h2>
          <p className={s.edu}>
            <strong>{education.school}</strong>
            <br />
            {education.degree[lang]} · {education.years} · {t("gpa")} {education.gpa}
          </p>
          <h2 className={s.sub}>{t("certs")}</h2>
          <ul className={s.certs}>
            {certifications.map((c) => (
              <li key={`${c.year}-${c.title}-${c.issuer}`}>
                <span className={s.year}>{c.year}</span>
                <span>
                  <strong>{c.title}</strong> — {c.issuer}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section id="skills" className={s.section}>
          <h2>{t("skills")}</h2>
          <ul className={s.chips}>
            {skills.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>

        <section id="contact" className={s.section}>
          <h2>{t("contact")}</h2>
          <ul className={s.contact}>
            <li>
              <span>{t("email")}</span>
              <a href={`mailto:${links.email}`}>{links.email}</a>
            </li>
            <li>
              <span>GitHub</span>
              <a href={links.github.url}>{links.github.label}</a>
            </li>
            <li>
              <span>LinkedIn</span>
              <a href={links.linkedin.url}>{links.linkedin.label}</a>
            </li>
            <li>
              <span>Steam</span>
              <a href={links.steam.url}>{links.steam.label}</a>
            </li>
          </ul>
        </section>
        <section id="credits" className={s.section}>
          <h2>{t("credits")}</h2>
          <p className={s.note}>{t("credits_note")}</p>
          <CreditsList className={s.credits} />
        </section>
      </main>

      <footer className={s.footer}>
        <span>{profile.name}</span>
        <a href={asset("/?room=1")}>{t("hifi")} →</a>
      </footer>
    </div>
  );
}
