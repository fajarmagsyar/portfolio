"use client";

import { useEffect } from "react";
import { create } from "zustand";
import type { Lang } from "@/content/data";
import { strings, type StringKey } from "@/content/strings";

const KEY = "fm-lang";

type LangState = { lang: Lang; setLang: (lang: Lang) => void };

// Indonesian is the default; the server always renders Indonesian.
export const useLangStore = create<LangState>((set) => ({
  lang: "id",
  setLang: (lang) => {
    try {
      localStorage.setItem(KEY, lang);
    } catch {}
    document.documentElement.lang = lang;
    set({ lang });
  },
}));

/** Call once near the root: restores the saved language after hydration. */
export function useRestoreLang() {
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "en" || saved === "id") useLangStore.getState().setLang(saved);
    } catch {}
  }, []);
}

export function useLang(): Lang {
  return useLangStore((s) => s.lang);
}

export function useT() {
  const lang = useLang();
  return (key: StringKey) => strings[lang][key];
}
