"use client";

import { asset } from "@/asset";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { chordName } from "@/audio/guitar";
import { click } from "@/audio/sfx";
import { profile } from "@/content/data";
import { useLangStore, useT } from "@/state/lang";
import { finderCam, lookFinderCam, resetFinderCam } from "../finderCam";
import { FOCUS_LABEL, useRoom } from "../store";
import { tvBack } from "../tv/program";
import { SidePanel } from "./Panels";
import { TvOverlay } from "./TvOverlay";
import s from "./ui.module.css";

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
  const lines = (tip ? t(tip) : hover ? t(FOCUS_LABEL[hover]).split(" — ")[0] : "").split("\n");
  return (
    <div ref={ref} className={s.hover} data-on={!!hover || !!tip} aria-hidden="true">
      {/* a name; and for some things a few lines under it */}
      {lines[0]}
      {lines.slice(1).map((line) => (
        <span key={line} className={s.hoverMore}>
          {line}
        </span>
      ))}
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

/** The only controls the guitar has outside the room: how it is played, and whether the amp is pushed. */
function GuitarSwitches() {
  const t = useT();
  const mode = useRoom((r) => r.guitarMode);
  const distortion = useRoom((r) => r.distortion);
  const setMode = useRoom((r) => r.setGuitarMode);
  const setDistortion = useRoom((r) => r.setDistortion);
  return (
    <>
      <div className={s.pill} role="group" aria-label="Guitar">
        <button aria-pressed={mode === "lead"} onClick={() => setMode("lead")}>
          {t("guitar_lead")}
        </button>
        <button aria-pressed={mode === "rhythm"} onClick={() => setMode("rhythm")}>
          {t("guitar_rhythm")}
        </button>
      </div>
      <div className={s.pill}>
        <button aria-pressed={distortion} onClick={() => setDistortion(!distortion)}>
          {t("guitar_distortion")}
        </button>
      </div>
    </>
  );
}

/**
 * Rhythm playing: the chords stand round a wheel, as on a game pad's stick. One hand picks
 * the chord (its number on the keyboard, or a click here); the other drags across the strings.
 * The chords are the visitor's to change: a click on the neck refingers the one being held,
 * and the wheel names whatever it has become. A double click here puts a place back as it was.
 */
function ChordWheel() {
  const t = useT();
  const mode = useRoom((r) => r.guitarMode);
  const chords = useRoom((r) => r.chords);
  const slot = useRoom((r) => r.slot);
  const setSlot = useRoom((r) => r.setSlot);
  const resetChord = useRoom((r) => r.resetChord);
  if (mode !== "rhythm") return null;
  const n = chords.length;
  const R = 100;
  const at = (i: number, r: number) => {
    const a = ((i + 0.5) / n) * Math.PI * 2 - Math.PI / 2 - Math.PI / n;
    return [Math.cos(a) * r, Math.sin(a) * r] as const;
  };
  const edge = (i: number, r: number) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2 - Math.PI / n;
    return `${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;
  };
  const names = chords.map(chordName);
  return (
    <div className={s.wheelBox}>
      <svg className={s.wheel} viewBox="-104 -104 208 208" role="group" aria-label="Chords">
        {names.map((name, i) => {
          const [x, y] = at(i, 70);
          const [kx, ky] = at(i, 91);
          return (
            <g key={i} className={s.wedge} data-on={slot === i} onPointerDown={() => setSlot(i)} onDoubleClick={() => resetChord(i)}>
              <path d={`M ${edge(i, 42)} L ${edge(i, R)} A ${R} ${R} 0 0 1 ${edge(i + 1, R)} L ${edge(i + 1, 42)} A 42 42 0 0 0 ${edge(i, 42)} Z`} />
              <text x={x} y={y + 6} textAnchor="middle" data-long={name.length > 4}>
                {name}
              </text>
              <text className={s.wedgeKey} x={kx} y={ky + 3} textAnchor="middle">
                {i + 1}
              </text>
            </g>
          );
        })}
        <text className={s.wheelNow} y={10} textAnchor="middle" data-long={names[slot].length > 4}>
          {names[slot]}
        </text>
      </svg>
      <p className={s.wheelHint}>{t("guitar_chord_hint")}</p>
    </div>
  );
}

/**
 * What the eye sees at the Canonet's viewfinder besides the room: the dark of the finder
 * round a bright window, the frame lines that show what the film will take, and the pale
 * patch in the middle that a rangefinder focuses by.
 */
function Viewfinder() {
  const t = useT();
  const [fired, setFired] = useState(0);
  const press = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  // W A S D (or the arrows) walk; Q and E go down and up
  useEffect(() => {
    resetFinderCam();
    const walk = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
    const down = (e: KeyboardEvent) => {
      if (!walk.has(e.code)) return;
      e.preventDefault();
      finderCam.keys.add(e.code);
    };
    const up = (e: KeyboardEvent) => finderCam.keys.delete(e.code);
    const clear = () => finderCam.keys.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      resetFinderCam();
    };
  }, []);

  const shoot = () => {
    click(0.5);
    setTimeout(() => click(0.9), 70);
    useRoom.getState().pressShutter();
    setFired((n) => n + 1);
  };

  return (
    // The mouse looks about while its button is held; a press that does not move is the
    // shutter, and the picture goes on the first page of the album.
    <div
      className={s.finder}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        press.current = { x: e.clientX, y: e.clientY, moved: false };
      }}
      onPointerMove={(e) => {
        const p = press.current;
        if (!p) return;
        const dx = e.clientX - p.x;
        const dy = e.clientY - p.y;
        if (!p.moved && Math.hypot(dx, dy) < 4) return;
        p.moved = true;
        lookFinderCam(dx, dy);
        p.x = e.clientX;
        p.y = e.clientY;
      }}
      onPointerUp={() => {
        const p = press.current;
        press.current = null;
        if (p && !p.moved) shoot();
      }}
      onPointerCancel={() => {
        press.current = null;
      }}
    >
      <div className={s.finderWindow}>
        <svg viewBox="0 0 300 200" preserveAspectRatio="none" aria-hidden="true">
          {/* the bright-line frame: broken at the middle of each side, as they are */}
          <path d="M 34 44 V 28 H 124 M 176 28 H 266 V 44 M 266 156 V 172 H 176 M 124 172 H 34 V 156 M 34 76 V 124 M 266 76 V 124" />
          {/* where the frame moves to for something close */}
          <path d="M 46 40 H 62 M 46 40 V 52" className={s.finderFaint} />
          {/* the rangefinder patch */}
          <rect x="135" y="88" width="30" height="24" rx="2" className={s.finderPatch} />
        </svg>
        {/* the shutter crossing the frame: one blink for each picture */}
        {fired > 0 && <i key={fired} className={s.finderBlink} />}
      </div>
      {/* and a word that it has been kept */}
      {fired > 0 && (
        <p key={fired} className={s.finderSaved} role="status">
          {t("shot_saved")}
        </p>
      )}
    </div>
  );
}

/** Everything drawn over the 3D room. Before the visitor has entered, that is only the name. */
export function Hud() {
  const t = useT();
  const booted = useRoom((r) => r.booted);
  const focus = useRoom((r) => r.focus);
  const zoomed = useRoom((r) => r.zoomed !== null);
  const setFocus = useRoom((r) => r.setFocus);
  const finder = useRoom((r) => r.finder);
  const sound = useRoom((r) => r.sound);
  const setSound = useRoom((r) => r.setSound);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // close in on a photo, Escape steps back to the open album first
      if (e.key === "Escape" && useRoom.getState().zoomed !== null) return useRoom.getState().setZoomed(null);
      // from the viewfinder, Escape takes the eye away from the camera first
      if (e.key === "Escape" && useRoom.getState().finder) return useRoom.getState().setFinder(false);
      // a CD that is out goes back in its place before the view leaves the shelf
      if (e.key === "Escape" && useRoom.getState().focus === "cds" && useRoom.getState().selectedCd) return useRoom.getState().selectCd(null);
      // the TV handles its own Escape (it has screens to back out of first)
      if (e.key === "Escape" && useRoom.getState().focus && useRoom.getState().focus !== "tv") setFocus(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setFocus]);

  return (
    <div className={s.hud}>
      <header className={s.top}>
        <button className={s.brand} onClick={() => setFocus(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a small fixed mark */}
          <img className={s.mark} src={asset("/logo.png")} alt="" />
          {profile.name}
        </button>
      </header>

      <HoverLabel />

      {focus === "tv" && <TvOverlay />}
      {focus === "guitar" && <ChordWheel />}
      {focus === "canonet" && finder && <Viewfinder />}
      {focus && focus !== "tv" && focus !== "tapes" && focus !== "cd" && focus !== "cds" && focus !== "saturn" && focus !== "guitar" && focus !== "cards" && focus !== "dice" && focus !== "receipt" && focus !== "clock" && focus !== "album" && focus !== "canonet" && focus !== "portrait" && !zoomed && <SidePanel key={focus} focus={focus} />}

      <footer className={s.foot}>
        {!booted ? (
          <p className={s.hint} data-blink="true">
            {t("enter")}
          </p>
        ) : focus ? (
          <button className={s.leave} onClick={() => (focus === "tv" ? tvBack() : finder ? useRoom.getState().setFinder(false) : zoomed ? useRoom.getState().setZoomed(null) : setFocus(null))}>
            ← {t("back")} <kbd>Esc</kbd>
          </button>
        ) : (
          <span />
        )}
        <div className={s.pills}>
          {focus === "guitar" && <GuitarSwitches />}
          {(focus === "tapes" || focus === "cds") && (
            <div className={s.pill} role="group" aria-label={t("rack")}>
              <button aria-pressed={focus === "tapes"} onClick={() => setFocus("tapes")}>
                {t("rack_tapes")}
              </button>
              <button aria-pressed={focus === "cds"} onClick={() => setFocus("cds")}>
                {t("rack_cds")}
              </button>
            </div>
          )}
          {booted && (
            <div className={s.pill}>
              <button aria-pressed={sound} onClick={() => setSound(!sound)} title={t(sound ? "sound_on_tip" : "sound_off_tip")}>
                {t("sound")}
              </button>
            </div>
          )}
          <LangPill />
          {/* while the guitar is being played the corner belongs to its two switches */}
          {focus !== "guitar" && (
            <Link className={s.pill} href="/lite" title={t("lofi_tip")}>
              <svg viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.2">
                <rect x="1.6" y="0.6" width="8.8" height="10.8" rx="1" />
                <path d="M3.8 3.6h4.4M3.8 6h4.4M3.8 8.4h2.6" />
              </svg>
              {t("lofi")}
            </Link>
          )}
        </div>
      </footer>
    </div>
  );
}
