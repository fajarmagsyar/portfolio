"use client";

import { asset } from "@/asset";
import Image from "next/image";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  certifications,
  education,
  jobs,
  jobYears,
  links,
  profile,
  projects,
  skillNotes,
  skills,
  type Lang,
} from "@/content/data";
import { useLang, useRestoreLang, useT } from "@/state/lang";
import type { StringKey } from "@/content/strings";
import { themeClass, useRestoreTheme, useTheme } from "@/state/theme";
import { FidelityToggle, LangToggle, ThemeToggle } from "@/ui/Switches";
import { useLiteMotion } from "./useLiteMotion";
import { useBauhausCursor } from "./useBauhausCursor";
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

/** The hero artwork: half and quarter discs on a 4 x 5 grid, like a screen-printed poster. */
type ArtPattern = "stripes-ink" | "stripes-paper" | "dots" | "rings" | "rings-up";
const ART: Array<{ d: string; fill: "ink" | "orange" | "teal" | "yellow" | "paper"; pattern?: ArtPattern }> = [
  { d: "M100,0 A100,100 0 0 0 100,200 Z", fill: "ink" },
  { d: "M100,0 A100,100 0 0 1 100,200 Z", fill: "orange", pattern: "stripes-ink" },
  { d: "M200,0 A100,100 0 0 0 400,0 Z", fill: "orange", pattern: "rings" },
  { d: "M200,200 A100,100 0 0 1 400,200 Z", fill: "ink", pattern: "stripes-paper" },
  { d: "M0,200 H200 V400 H0 Z", fill: "ink" },
  { d: "M200,200 H400 V400 H200 Z", fill: "teal", pattern: "dots" },
  { d: "M300,300 A100,100 0 0 1 400,200 L400,300 Z", fill: "orange" },
  { d: "M300,400 A100,100 0 0 1 400,300 L400,400 Z", fill: "yellow", pattern: "stripes-ink" },
  { d: "M200,200 A100,100 0 0 0 200,400 Z", fill: "yellow" },
  { d: "M200,200 A100,100 0 0 1 200,400 Z", fill: "paper", pattern: "dots" },
  { d: "M0,500 A100,100 0 0 1 200,500 Z", fill: "ink", pattern: "rings-up" },
  { d: "M200,400 A100,100 0 0 1 300,500 L200,500 Z", fill: "yellow" },
  { d: "M300,500 A100,100 0 0 1 400,400 L400,500 Z", fill: "teal", pattern: "stripes-paper" },
];

/** Screen-print textures: 70s stripes, a halftone screen and sunset rings, inked over a shape. */
function ArtPatterns() {
  return (
    <defs>
      <pattern id="lite-stripes-ink" width="14" height="14" patternUnits="userSpaceOnUse">
        <rect width="14" height="5" fill="#1d1d1d" />
      </pattern>
      <pattern id="lite-stripes-paper" width="14" height="14" patternUnits="userSpaceOnUse">
        <rect width="14" height="5" fill="#e5dccf" />
      </pattern>
      <pattern id="lite-dots" width="11" height="11" patternUnits="userSpaceOnUse">
        <circle cx="5.5" cy="5.5" r="2.4" fill="#1d1d1d" />
      </pattern>
      {/* Sunset rings: a short radial ramp, repeated outward from the shape's flat edge. */}
      <radialGradient id="lite-rings" cx="50%" cy="0%" r="16%" spreadMethod="repeat">
        <stop offset="0.55" stopColor="#e5dccf" stopOpacity="0" />
        <stop offset="0.55" stopColor="#e5dccf" stopOpacity="0.9" />
        <stop offset="1" stopColor="#e5dccf" stopOpacity="0.9" />
      </radialGradient>
      <radialGradient id="lite-rings-up" cx="50%" cy="100%" r="16%" spreadMethod="repeat">
        <stop offset="0.55" stopColor="#e5dccf" stopOpacity="0" />
        <stop offset="0.55" stopColor="#e5dccf" stopOpacity="0.9" />
        <stop offset="1" stopColor="#e5dccf" stopOpacity="0.9" />
      </radialGradient>
    </defs>
  );
}

function HeroArt() {
  return (
    <svg className={s.art} viewBox="0 0 400 500" aria-hidden="true" focusable="false" data-hero-art>
      <ArtPatterns />
      {ART.map((shape, i) => (
        <g key={i} className={s.artShape} data-art-shape>
          <path d={shape.d} className={s[`fill_${shape.fill}`]} />
          {shape.pattern && <path d={shape.d} className={s.artPattern} fill={`url(#lite-${shape.pattern})`} />}
        </g>
      ))}
    </svg>
  );
}

/** A section's title row: a coloured shape and the title, like the head of a poster. */
function SectionHead({ shape, title }: { shape: "a" | "b" | "c" | "d" | "e"; title: string }) {
  return (
    <div className={s.sectionHead} data-section-head data-build>
      <span className={s.glyph} data-g={shape} data-glyph aria-hidden="true" />
      <div className={s.sectionTitleWrap}>
        <KineticTitle text={title} className={s.sectionTitle} />
      </div>
      <span className={s.headRule} data-head-rule aria-hidden="true" />
    </div>
  );
}

/**
 * Skill tiles. Opening one widens it to explain the skill; GSAP Flip animates every tile from
 * where it was to where the new grid puts it, so the reflow glides instead of jumping.
 */
function SkillGrid({ lang }: { lang: Lang }) {
  const [open, setOpen] = useState<string | null>(null);
  const grid = useRef<HTMLUListElement>(null);
  const before = useRef<Flip.FlipState | null>(null);

  const toggle = (skill: string) => {
    const tiles = grid.current?.querySelectorAll("li");
    if (tiles?.length) {
      gsap.registerPlugin(Flip);
      before.current = Flip.getState(tiles);
    }
    setOpen((current) => (current === skill ? null : skill));
  };

  useLayoutEffect(() => {
    const state = before.current;
    const box = grid.current;
    before.current = null;
    if (!state || !box) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      ScrollTrigger.refresh();
      return;
    }
    box.setAttribute("data-flipping", "");
    Flip.from(state, {
      duration: 0.6,
      ease: "power3.inOut",
      onComplete: () => {
        box.removeAttribute("data-flipping");
        ScrollTrigger.refresh();
      },
    });
    const note = box.querySelector("[data-skill-note]");
    if (note) gsap.from(note, { autoAlpha: 0, y: 12, duration: 0.45, delay: 0.3, ease: "power2.out" });
  }, [open]);

  return (
    <ul className={s.skillGrid} ref={grid} data-reveal-group>
      {skills.map((skill) => {
        const isOpen = open === skill;
        const id = `skill-${skill.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
        return (
          <li key={skill} data-reveal-item data-build data-open={isOpen || undefined}>
            <button type="button" className={s.skillBtn} aria-expanded={isOpen} aria-controls={id} onClick={() => toggle(skill)}>
              <span className={s.skillName}>{skill}</span>
              <span className={s.skillMark} aria-hidden="true">{isOpen ? "−" : "+"}</span>
            </button>
            <p id={id} className={s.skillNote} data-skill-note={isOpen || undefined} hidden={!isOpen}>
              {skillNotes[skill]?.[lang]}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The logo's three shapes (traced from public/logo.png), each in a Bauhaus colour: the tall
 * rounded bar in teal, the quarter disc in orange, the small leaf in yellow.
 */
function BauhausLogo() {
  return (
    <svg className={s.brandLogo} viewBox="100 40 860 1160" aria-hidden="true" focusable="false">
      <path className={s.logoBar} d="M119,192 H180 A356,356 0 0 1 536,548 V1178 H476 A357,357 0 0 1 119,821 Z" />
      <path className={s.logoQuarter} d="M445,59 H942 V556 H913 A468,468 0 0 1 445,88 Z" />
      <path className={s.logoLeaf} d="M830,610 H893 V658 A248,248 0 0 1 645,906 H584 V857 A247,247 0 0 1 830,610 Z" />
    </svg>
  );
}

/** A row of quarter discs and circles that separates the sections. */
function ShapeBand() {
  return (
    <div className={s.band} data-band data-build aria-hidden="true">
      {Array.from({ length: 10 }, (_, i) => <span key={i} />)}
    </div>
  );
}

/** The static version: the whole story on one page, with a cinematic scroll. */
export function LiteView() {
  useRestoreLang();
  useRestoreTheme();
  const lang = useLang();
  const t = useT();
  const { theme } = useTheme();
  const root = useRef<HTMLDivElement>(null);

  useLiteMotion(root, `${lang}-${theme}`);
  useBauhausCursor(root);

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
      {/* Bauhaus cursor: a dot on the pointer and a trailing shape (driven by useBauhausCursor). */}
      <div className={s.cursor} data-cursor aria-hidden="true">
        <span className={s.cursorShape} data-cursor-shape />
        <span className={s.cursorDot} data-cursor-dot />
      </div>
      <div className={s.navDock} data-nav-dock>
        <header className={s.nav} data-nav>
          <div className={s.navInner}>
            <a className={s.brand} href="#top">
              <BauhausLogo />
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

      {/* ScrollSmoother moves this pair; the fixed nav has to stay outside it. */}
      <div className={s.smoothWrapper} data-smooth-wrapper>
      <div data-smooth-content>
      <main>
        <section id="top" className={s.hero} data-hero data-scene data-build>
          {/* The opening screen: a blank backdrop and a subtitle under the greeting (shown by the motion hook). */}
          <div className={s.introBackdrop} data-intro-bg aria-hidden="true" />
          <p className={s.introSub} data-intro-sub aria-hidden="true">
            <span data-intro-sub-text>{t("intro_role")}</span>
          </p>
          <div className={s.poster} data-stage>
            <div className={s.posterTop}>
              <KineticTitle text={profile.hello[lang]} as="h1" className={s.heroTitle} hero />
            </div>

            <div className={s.posterBody}>
              <HeroArt />
              <div className={s.heroMain}>
                <p className={s.heroLede} data-hero-rest>{profile.intro[lang]}</p>
                <div className={s.heroActions} data-hero-rest>
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
            </div>
          </div>
        </section>

        <ShapeBand />

        <section id="about" className={s.section} data-scene>
          <div data-stage>
          <SectionHead shape="a" title={t("nav_about")} />
          <div className={s.aboutGrid} data-reveal-group data-build>
            {/* The lite page keeps the first two paragraphs; the room still tells the whole story. */}
            {profile.about[lang].slice(0, 2).map((paragraph) => (
              <p key={paragraph} className={s.aboutText} data-reveal-item data-build>{paragraph}</p>
            ))}
          </div>
          </div>
        </section>

        <section id="work" className={s.section} data-scene>
          <div data-stage>
          <SectionHead shape="b" title={t("work")} />
          <div className={s.workList} data-work-list>
            {jobs.map((job) => (
              <article
                key={job.id}
                className={s.workCard}
                data-work-card
                data-build
                style={
                  {
                    "--tape-shell": job.tape.shell,
                    "--tape-label": job.tape.label,
                    "--tape-ink": job.tape.ink,
                  } as CSSProperties
                }
              >
                <div className={s.workLead}>
                  <p className={s.workPeriod}>{jobYears(job, lang)}</p>
                  <p className={s.jobCompany}>{job.company}</p>
                </div>

                <div className={s.workMain}>
                  <div className={s.workHeading}>
                    <div className={s.workTitleWrap}>
                      <h3 className={s.jobTitle}>{job.title}</h3>
                      <p className={s.jobMeta}>{job.place[lang]}</p>
                    </div>
                    {job.logo ? (
                      <span className={s.logoPlate}>
                        <Image src={asset(job.logo)} alt="" fill sizes="96px" className={s.logoImage} />
                      </span>
                    ) : (
                      <span className={s.logoFallback} aria-hidden="true">
                        {job.company.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
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

        <section id="projects" className={s.section} data-scene>
          <div data-stage>
          <SectionHead shape="c" title={t("projects")} />
          <div className={s.projectGrid} data-reveal-group>
            {projects.map((project, i) => {
              const title = project.name ?? `${t("empty_slot")} ${String(i + 1).padStart(2, "0")}`;
              return (
                <article
                  key={project.id}
                  className={s.projectCard}
                  data-project
                  data-build
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
          </div>
        </section>

        <section id="education" className={s.section} data-scene>
          <div data-stage>
          <SectionHead shape="d" title={t("education")} />
          <div className={s.eduGrid}>
            <div className={s.eduCard} data-reveal data-build>
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
          </div>
        </section>

        <section id="skills" className={s.section} data-scene>
          <div data-stage>
          <SectionHead shape="e" title={t("skills")} />
          <SkillGrid lang={lang} />
          </div>
        </section>

        <section id="contact" className={s.contactSection} data-scene>
          <div className={s.contactPanel} data-stage>
            <div className={s.contactArt} data-contact-art aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
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
      </div>
    </div>
  );
}
