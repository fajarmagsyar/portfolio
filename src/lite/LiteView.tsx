"use client";

import { asset } from "@/asset";
import Image from "next/image";
import { useRef, type CSSProperties } from "react";
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
import type { StringKey } from "@/content/strings";
import { themeClass, useTheme } from "@/state/theme";
import { FidelityToggle, LangToggle, ThemeToggle } from "@/ui/Switches";
import { useLiteMotion } from "./useLiteMotion";
import s from "./LiteView.module.css";

const NAV_IDS = ["about", "work", "projects", "education", "skills", "contact"] as const;
type NavId = typeof NAV_IDS[number];

const NAV_LABELS: Record<NavId, StringKey> = {
  about: "nav_about",
  work: "nav_work",
  projects: "nav_projects",
  education: "education",
  skills: "skills",
  contact: "nav_contact",
};

/** A title whose words can be lifted out from behind a mask by the scroll hook. */
function KineticTitle({
  text,
  as: Tag = "h2",
  className,
  hero = false,
}: {
  text: string;
  as?: "h1" | "h2";
  className?: string;
  hero?: boolean;
}) {
  const words = text.split(" ");
  return (
    <Tag className={className} data-kinetic={hero ? undefined : true}>
      {words.map((word, i) => (
        <span key={`${word}-${i}`} className={s.word}>
          <span
            data-hero-word={hero ? true : undefined}
            data-kinetic-word={hero ? undefined : true}
          >
            {word}
          </span>
          {" "}
        </span>
      ))}
    </Tag>
  );
}

/** The static version: the whole story on one page, with a cinematic scroll. */
export function LiteView() {
  useRestoreLang();
  const lang = useLang();
  const t = useT();
  const { theme } = useTheme();
  const root = useRef<HTMLDivElement>(null);

  useLiteMotion(root, `${lang}-${theme}`);

  return (
    <div ref={root} className={`${s.page} ${s[themeClass(theme)]} lite-root`}>
      <svg className={s.glassDefs} aria-hidden="true" focusable="false">
        <defs>
          <filter id="lite-glass" primitiveUnits="objectBoundingBox">
            <feImage result="map" width="100%" height="100%" x="0" y="0" href="data:image/webp;base64,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" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.04" result="blur" />
            <feDisplacementMap in="blur" in2="map" scale="0.5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="lite-glass-pill" primitiveUnits="objectBoundingBox">
            <feImage result="map" width="100%" height="100%" x="0" y="0" href="data:image/webp;base64,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" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.01" result="blur" />
            <feDisplacementMap in="blur" in2="map" scale="0.5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
      <div className={s.navDock}>
        <header className={s.nav} data-nav>
          <div className={s.navInner}>
            <a className={s.brand} href="#top">
              <Image
                className={s.brandLogo}
                src={asset("/logo.png")}
                alt=""
                width={22}
                height={28}
                priority
              />
              <span>{profile.name}</span>
            </a>
            <nav className={s.navLinks} data-nav-links aria-label="Main">
              {NAV_IDS.map((id) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className={s.navLink}
                  data-nav-link={id}
                >
                  {t(NAV_LABELS[id])}
                </a>
              ))}
            </nav>
            <div className={s.navTools}>
              <LangToggle />
              <ThemeToggle />
              <FidelityToggle current="lofi" />
            </div>
          </div>
          <span className={s.navPill} data-nav-pill aria-hidden="true" />
          <div className={s.progressTrack} aria-hidden="true">
            <span className={s.progressBar} data-progress />
          </div>
        </header>
      </div>

      <main>
        <section id="top" className={s.hero} data-hero>
          <div className={s.heroInner}>
            <p className={s.eyebrow} data-hero-line>
              <span className={s.pulse} aria-hidden="true" />
              {profile.role} · Surabaya · {profile.since}
            </p>
            <KineticTitle text={profile.hello[lang]} as="h1" className={s.heroTitle} hero />
            <p className={s.heroLede} data-hero-line>{profile.intro[lang]}</p>
            <div className={s.heroActions} data-hero-cta>
              <a className={s.primaryBtn} href="#work">
                {t("nav_work")}
                <span aria-hidden="true">↓</span>
              </a>
              <a className={s.textBtn} href={asset("/?room=1")}>
                {t("static_cta")}
                <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
        </section>

        <section id="about" className={s.section}>
          <div className={s.sectionHead}>
            <p className={s.kicker} data-reveal>{t("more_about")}</p>
            <KineticTitle text={t("nav_about")} className={s.sectionTitle} />
          </div>
          <div className={s.aboutGrid} data-reveal-group>
            {profile.about[lang].map((paragraph) => (
              <p key={paragraph} className={s.aboutText} data-reveal-item>{paragraph}</p>
            ))}
          </div>
          <p className={s.likes} data-reveal>{profile.likes[lang]}</p>
        </section>

        <section id="work" className={s.section}>
          <div className={s.sectionHead}>
            <p className={s.kicker} data-reveal>{t("work_note")}</p>
            <KineticTitle text={t("work")} className={s.sectionTitle} />
          </div>
          <div className={s.deck} data-deck>
            <div className={s.deckMeta}>
              <span>{t("work")}</span>
            </div>
            <div className={s.deckStage} data-deck-stage>
              {jobs.map((job) => (
                <article
                  key={job.id}
                  className={s.deckCard}
                  data-deck-card
                  style={
                    {
                      "--tape-shell": job.tape.shell,
                      "--tape-label": job.tape.label,
                      "--tape-ink": job.tape.ink,
                    } as CSSProperties
                  }
                >
                  <span className={s.cardStripe} aria-hidden="true" />
                  <div className={s.deckCardInner}>
                    <div className={s.deckCardTop}>
                      {job.logo ? (
                        <span className={s.logoPlate}>
                          <Image src={asset(job.logo)} alt="" fill sizes="110px" className={s.logoImage} />
                        </span>
                      ) : (
                        <span className={s.logoFallback} aria-hidden="true">
                          {job.company.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <p className={s.jobCompany}>{job.company}</p>
                    <h3 className={s.jobTitle}>{job.title}</h3>
                    <p className={s.jobMeta}>{job.place[lang]} · {jobYears(job, lang)}</p>
                    <p className={s.jobBody}>{job.body[lang]}</p>
                    <ul className={s.chips}>
                      {job.tech.map((tech) => <li key={tech}>{tech}</li>)}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="projects" className={s.section}>
          <div className={s.sectionHead}>
            <p className={s.kicker} data-reveal>{t("projects_note")}</p>
            <KineticTitle text={t("projects")} className={s.sectionTitle} />
          </div>
          <div className={s.projectGrid} data-reveal-group>
            {projects.map((project, i) => {
              const title = project.name ?? `${t("empty_slot")} ${String(i + 1).padStart(2, "0")}`;
              return (
                <article
                  key={project.id}
                  className={s.projectCard}
                  data-project
                  data-reveal-item
                  data-empty={!project.name}
                  style={{ "--disc": project.disc } as CSSProperties}
                >
                  <div className={s.projectVisual}>
                    {project.shots?.[0] ? (
                      <Image
                        src={asset(project.shots[0])}
                        alt=""
                        fill
                        sizes="(max-width: 800px) 90vw, 520px"
                        className={s.shot}
                        data-project-shot
                      />
                    ) : (
                      <span className={s.disc} aria-hidden="true">
                        {title.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <span className={s.yearTag}>{project.year ?? t("empty_slot")}</span>
                  </div>
                  <div className={s.projectInfo}>
                    <h3>{title}</h3>
                    <p>{project.body ? project.body[lang] : t("empty_slot_body")}</p>
                    {project.tech.length > 0 && (
                      <ul className={s.chips}>
                        {project.tech.map((tech) => <li key={tech}>{tech}</li>)}
                      </ul>
                    )}
                    {project.url && (
                      <a className={s.cardLink} href={project.url} target="_blank" rel="noreferrer">
                        {project.url.replace(/^https?:\/\//, "")}
                        <span aria-hidden="true">↗</span>
                      </a>
                    )}
                    {project.coverage && (
                      <p className={s.coverage}>
                        {t("covered_by")}:{" "}
                        {project.coverage.map((source, k) => (
                          <span key={source.url}>
                            {k > 0 && " · "}
                            <a href={source.url} target="_blank" rel="noreferrer">{source.name}</a>
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section id="education" className={s.section}>
          <div className={s.sectionHead}>
            <p className={s.kicker} data-reveal>{t("education")}</p>
            <KineticTitle text={t("education")} className={s.sectionTitle} />
          </div>
          <div className={s.eduGrid}>
            <div className={s.eduCard} data-reveal>
              <p className={s.cardLabel}>{education.years}</p>
              <h3>{education.school}</h3>
              <p>{education.degree[lang]}</p>
              <p className={s.gpa}>{t("gpa")} <strong>{education.gpa}</strong></p>
            </div>
            <div className={s.certCard}>
              <KineticTitle text={t("certs")} className={s.cardTitle} />
              <ul className={s.certs} data-reveal-group>
                {certifications.map((cert) => (
                  <li key={`${cert.year}-${cert.title}-${cert.issuer}`} data-reveal-item>
                    <span className={s.rule} data-rule aria-hidden="true" />
                    <span className={s.certYear}>{cert.year}</span>
                    <span><strong>{cert.title}</strong> — {cert.issuer}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="skills" className={s.section}>
          <div className={s.sectionHead}>
            <p className={s.kicker} data-reveal>{profile.role}</p>
            <KineticTitle text={t("skills")} className={s.sectionTitle} />
          </div>
          <ul className={s.skillGrid} data-reveal-group>
            {skills.map((skill) => (
              <li key={skill} data-reveal-item>{skill}</li>
            ))}
          </ul>
        </section>

        <section id="contact" className={s.contactSection}>
          <div className={s.contactPanel}>
            <p className={s.kicker} data-reveal>{t("contact")}</p>
            <KineticTitle text={t("contact")} className={s.contactTitle} />
            <a className={s.emailLink} href={`mailto:${links.email}`} data-reveal>{links.email}</a>
            <ul className={s.contactList} data-reveal-group>
              <li data-reveal-item><span>{t("email")}</span><a href={`mailto:${links.email}`}>{links.email}</a></li>
              <li data-reveal-item><span>GitHub</span><a href={links.github.url} target="_blank" rel="noreferrer">{links.github.label} ↗</a></li>
              <li data-reveal-item><span>LinkedIn</span><a href={links.linkedin.url} target="_blank" rel="noreferrer">{links.linkedin.label} ↗</a></li>
              <li data-reveal-item><span>Steam</span><a href={links.steam.url} target="_blank" rel="noreferrer">{links.steam.label} ↗</a></li>
            </ul>
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <span>{profile.name} · {profile.role}</span>
        <a href={asset("/?room=1")}>{t("hifi")} ↗</a>
      </footer>
    </div>
  );
}
