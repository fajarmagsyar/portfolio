"use client";

import { asset } from "@/asset";
import Link from "next/link";
import { useLangStore, useT } from "@/state/lang";
import { useTheme } from "@/state/theme";
import s from "./LiteControls.module.css";
import styles from "./Switches.module.css";

export function LangToggle() {
  const lang = useLangStore((st) => st.lang);
  const setLang = useLangStore((st) => st.setLang);
  return (
    <div className={s.group} role="group" aria-label="Bahasa / Language">
      <button className={s.btn} aria-pressed={lang === "id"} onClick={() => setLang("id")}>ID</button>
      <button className={s.btn} aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button>
    </div>
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className={s.group} role="group" aria-label="Theme">
      <button className={s.btn} aria-pressed={theme === "light"} onClick={() => setTheme("light")}>Light</button>
      <button className={s.btn} aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}>Dark</button>
    </div>
  );
}

/** Switch between the 3D room (hi-fi) and the static page (lo-fi). */
export function FidelityToggle({ current }: { current: "hifi" | "lofi" }) {
  const t = useT();
  return (
    <div className={s.group} role="group" aria-label="Hi-fi / Lo-fi">
      {current === "hifi" ? (
        <span className={s.btn} aria-current="true">{t("hifi")}</span>
      ) : (
        <a className={s.btn} href={asset("/?room=1")} title={t("hifi_tip")}>{t("hifi")}</a>
      )}
      {current === "lofi" ? (
        <span className={s.btn} aria-current="true">{t("lofi")}</span>
      ) : (
        <Link className={s.btn} href="/lite" title={t("lofi_tip")}>{t("lofi")}</Link>
      )}
    </div>
  );
}

// keep the old retro group export for the 3D HUD
export { styles as switchStyles };
