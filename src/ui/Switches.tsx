"use client";

import Link from "next/link";
import { useLangStore, useT } from "@/state/lang";
import styles from "./Switches.module.css";

export function LangToggle() {
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  return (
    <div className={styles.group} role="group" aria-label="Bahasa / Language">
      <button className={styles.btn} aria-pressed={lang === "id"} onClick={() => setLang("id")}>
        ID
      </button>
      <button className={styles.btn} aria-pressed={lang === "en"} onClick={() => setLang("en")}>
        EN
      </button>
    </div>
  );
}

/** Switch between the 3D room (hi-fi) and the static page (lo-fi). */
export function FidelityToggle({ current }: { current: "hifi" | "lofi" }) {
  const t = useT();
  return (
    <div className={styles.group} role="group" aria-label="Hi-fi / Lo-fi">
      {current === "hifi" ? (
        <span className={styles.btn} aria-current="true">
          {t("hifi")}
        </span>
      ) : (
        // Plain <a>: a full load lets the preflight script in layout.tsx run.
        // eslint-disable-next-line @next/next/no-html-link-for-pages
        <a className={styles.btn} href="/?room=1" title={t("hifi_tip")}>
          {t("hifi")}
        </a>
      )}
      {current === "lofi" ? (
        <span className={styles.btn} aria-current="true">
          {t("lofi")}
        </span>
      ) : (
        <Link className={styles.btn} href="/lite" title={t("lofi_tip")}>
          {t("lofi")}
        </Link>
      )}
    </div>
  );
}
