import { createContext, useContext } from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

/**
 * Colour flavour behind the SHADCN tokens. Orthogonal to the light/dark
 * mode above: `<html data-flavor="…">` picks the palette, the `dark` class
 * picks the scheme, and the two combine in CSS (`style/index.css`) — so a
 * switch is one attribute write with no component re-render cost.
 */
export type Flavor = "default" | "gruvbox" | "nord" | "sunset" | "catppuccin";

export const FLAVORS: readonly Flavor[] = ["default", "gruvbox", "nord", "sunset", "catppuccin"] as const;

export interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: ResolvedTheme;
  flavor: Flavor;
  setFlavor: (flavor: Flavor) => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  setTheme: () => {},
  resolvedTheme: "light",
  flavor: "default",
  setFlavor: () => {},
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

/** Persisted flavour (`radioscout:flavor`, default when missing/garbage). */
export const FLAVOR_STORAGE_KEY = "radioscout:flavor";

/** Stored value → flavour, collapsing garbage to default. Never throws. */
export function storedFlavor(value: unknown): Flavor {
  if (typeof value !== "string") return "default";
  return FLAVORS.find((flavor) => flavor === value) ?? "default";
}

/** Read the persisted flavour, default outside the browser. Never throws. */
export function readStoredFlavor(): Flavor {
  if (globalThis.window === undefined) return "default";
  try {
    return storedFlavor(globalThis.localStorage?.getItem(FLAVOR_STORAGE_KEY));
  } catch {
    // Storage blocked (private mode): fall back to default.
    return "default";
  }
}

/** Persist the flavour (restore path). Never throws. */
export function writeStoredFlavor(flavor: Flavor): void {
  try {
    globalThis.localStorage?.setItem(FLAVOR_STORAGE_KEY, flavor);
  } catch {
    // Private mode etc — the swatch just resets next launch.
  }
}
