"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { profile } from "@/content/data";
import type { StringKey } from "@/content/strings";
import { useLangStore, useT } from "@/state/lang";
import { CreditsList } from "@/ui/CreditsList";
import { FOCUS_LABEL, useRoom, type FocusId, type TvScreen } from "../store";
import { tvBack } from "../tv/program";
import { SidePanel } from "./Panels";
import { TvOverlay } from "./TvOverlay";
import s from "./ui.module.css";

/** The few places the navigation jumps to. Everything else is found by clicking around the desk. */
const NAV: { label: StringKey; focus: FocusId; tv?: TvScreen }[] = [
  { label: "nav_about", focus: "tv", tv: "about" },
  { label: "nav_work", focus: "tapes" },
  { label: "nav_projects", focus: "cds" },
  { label: "nav_certs", focus: "frames" },
  { label: "nav_contact", focus: "cards" },
];

/** Name tag that follows the cursor while it is over something clickable in the room. */
function HoverLabel() {
  const t = useT();
  const hover = useRoom((r) => r.hover);
  const tip = useRoom((r) => r.tip);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (ref.current) ref.current.style.transform = `translate(${e.clientX + 16}px, ${e.clientY + 18}px)`;
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);
  return (
    <div ref={ref} className={s.hover} data-on={!!hover || !!tip} aria-hidden="true">
      {tip ? t(tip) : hover ? t(FOCUS_LABEL[hover]).split(" — ")[0] : ""}
    </div>
  );
}

function LangPill() {
  const lang = useLangStore((r) => r.lang);
  const setLang = useLangStore((r) => r.setLang);
  return (
    <div className={s.pill} role="group" aria-label="Bahasa / Language">
      <button aria-pressed={lang === "id"} onClick={() => setLang("id")}>
        ID
      </button>
      <button aria-pressed={lang === "en"} onClick={() => setLang("en")}>
        EN
      </button>
    </div>
  );
}

/** Everything drawn over the 3D room. Before the visitor has entered, that is only the name. */
export function Hud() {
  const t = useT();
  const booted = useRoom((r) => r.booted);
  const focus = useRoom((r) => r.focus);
  const tvScreen = useRoom((r) => r.tvScreen);
  const zoomed = useRoom((r) => r.zoomed !== null);
  const setFocus = useRoom((r) => r.setFocus);
  const [credits, setCredits] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // close in on a photo, Escape steps back to the open album first
      if (e.key === "Escape" && useRoom.getState().zoomed !== null) return useRoom.getState().setZoomed(null);
      // a CD that is out goes back in its place before the view leaves the shelf
      if (e.key === "Escape" && useRoom.getState().focus === "cds" && useRoom.getState().selectedCd) return useRoom.getState().selectCd(null);
      if (e.key === "Escape") setCredits(false);
      // the TV handles its own Escape (it has screens to back out of first)
      if (e.key === "Escape" && useRoom.getState().focus && useRoom.getState().focus !== "tv") setFocus(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setFocus]);

  const go = (item: (typeof NAV)[number]) => {
    setCredits(false);
    setFocus(item.focus);
    if (item.tv) useRoom.getState().setTvScreen(item.tv);
  };

  return (
    <div className={s.hud}>
      <header className={s.top}>
        <button className={s.brand} onClick={() => setFocus(null)}>
          {profile.name}
        </button>
        {booted && (
          <nav aria-label={t("hint_look")}>
            <ul className={s.nav}>
              {NAV.map((item) => (
                <li key={item.label}>
                  <button className={s.navItem} aria-current={focus === item.focus && (!item.tv || tvScreen === item.tv)} onClick={() => go(item)}>
                    {t(item.label)}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>

      <HoverLabel />

      {booted && focus === null && credits && (
        <aside className={s.panel} aria-label={t("credits")}>
          <header className={s.panelHead}>
            <h2>{t("credits")}</h2>
            <button className={s.back} onClick={() => setCredits(false)}>
              {t("close")} <kbd>Esc</kbd>
            </button>
          </header>
          <div className={s.panelBody}>
            <p className={s.lead}>{t("credits_note")}</p>
            <CreditsList className={s.credits} />
          </div>
        </aside>
      )}

      {focus === "tv" && <TvOverlay />}
      {focus && focus !== "tv" && focus !== "cd" && focus !== "cds" && !zoomed && <SidePanel key={focus} focus={focus} />}

      <footer className={s.foot}>
        {!booted ? (
          <p className={s.hint} data-blink="true">
            {t("enter")}
          </p>
        ) : focus ? (
          <button className={s.leave} onClick={() => (focus === "tv" ? tvBack() : zoomed ? useRoom.getState().setZoomed(null) : setFocus(null))}>
            ← {t("back")} <kbd>Esc</kbd>
          </button>
        ) : (
          <p className={s.hint}>{t("hint_look")}</p>
        )}
        <div className={s.pills}>
          {booted && focus === null && (
            <button className={s.pill} onClick={() => setCredits((v) => !v)}>
              {t("credits")}
            </button>
          )}
          <LangPill />
          <Link className={s.pill} href="/lite" title={t("lofi_tip")}>
            <svg viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.2">
              <rect x="1.6" y="0.6" width="8.8" height="10.8" rx="1" />
              <path d="M3.8 3.6h4.4M3.8 6h4.4M3.8 8.4h2.6" />
            </svg>
            {t("lofi")}
          </Link>
        </div>
      </footer>
    </div>
  );
}
