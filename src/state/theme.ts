"use client";

import { useEffect } from "react";
import { create } from "zustand";

type Theme = "light" | "dark";

const KEY = "theme";

function read(): Theme {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {}
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Mirrors the theme onto <html>, which the preflight script in layout.tsx also sets before paint. */
function mark(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

type ThemeState = {
  theme: Theme;
  setTheme: (t: Theme) => void;
};

// The server cannot know the visitor's choice, so the first render is always light and the
// saved theme is restored after hydration (the preflight attribute keeps it from flashing).
export const useTheme = create<ThemeState>((set) => ({
  theme: "light",
  setTheme: (theme) => {
    try {
      localStorage.setItem(KEY, theme);
    } catch {}
    mark(theme);
    set({ theme });
  },
}));

/** Call once near the root: restores the saved (or system) theme after hydration. */
export function useRestoreTheme() {
  useEffect(() => {
    const theme = read();
    mark(theme);
    useTheme.setState({ theme });
  }, []);
}

export function themeClass(theme: Theme): string {
  return theme === "dark" ? "theme-dark" : "theme-light";
}
