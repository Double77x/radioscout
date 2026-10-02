import { createContext, useContext } from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: ResolvedTheme;
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  setTheme: () => {},
  resolvedTheme: "light",
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export const THEME_STORAGE_KEY = "theme";

export function readStoredTheme(): Theme {
  if (globalThis.window === undefined) return "system";
  try {
    const stored = globalThis.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  } catch {
    // Storage blocked (private mode): fall back to system.
    return "system";
  }
}

/** Toggle from the applied class list, which derived state can lag. */
export function flippedTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "light" : "dark";
}
