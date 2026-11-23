"use client";

import { create } from "zustand";

type Theme = "light" | "dark";

const KEY = "theme";

function read(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(KEY) as Theme | null;
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

type ThemeState = {
  theme: Theme;
  setTheme: (t: Theme) => void;
};

export const useTheme = create<ThemeState>((set) => ({
  theme: read(),
  setTheme: (theme) => {
    if (typeof window !== "undefined") localStorage.setItem(KEY, theme);
    set({ theme });
  },
}));

export function themeClass(theme: Theme): string {
  return theme === "dark" ? "theme-dark" : "theme-light";
}
