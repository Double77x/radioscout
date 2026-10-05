import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  FLAVOR_STORAGE_KEY,
  readStoredFlavor,
  readStoredTheme,
  THEME_STORAGE_KEY,
  ThemeContext,
  type Flavor,
  type ResolvedTheme,
  type Theme,
} from "@/lib/theme";

// Local system/light/dark state with the `dark` class on <html>, plus the
// persisted flavour behind `data-flavor`. Pre-paint attributes come from
// THEME_SCRIPT in the root route head.

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);
  const [flavor, setFlavor] = useState<Flavor>(readStoredFlavor);
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  const resolvedTheme: ResolvedTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  const persistTheme = useCallback((next: Theme): void => {
    setTheme(next);
    try {
      globalThis.localStorage?.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage blocked: state still updates for this session.
    }
  }, []);

  const persistFlavor = useCallback((next: Flavor): void => {
    setFlavor(next);
    try {
      globalThis.localStorage?.setItem(FLAVOR_STORAGE_KEY, next);
    } catch {
      // Storage blocked: state still updates for this session.
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.flavor = flavor;
    if (resolvedTheme === "dark") {
      root.classList.add("dark");
      root.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
      root.style.colorScheme = "light";
    }
  }, [resolvedTheme, flavor]);

  // Cross-tab + backup-restore sync: the restore path writes storage and
  // dispatches a synthetic `storage` event (real ones never fire in the
  // originating tab), so both arrive here and apply without a reload.
  useEffect(() => {
    const onStorage = (event: StorageEvent): void => {
      if (event.key === THEME_STORAGE_KEY) setTheme(readStoredTheme());
      if (event.key === FLAVOR_STORAGE_KEY) setFlavor(readStoredFlavor());
    };
    globalThis.addEventListener("storage", onStorage);
    return () => {
      globalThis.removeEventListener("storage", onStorage);
    };
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme: persistTheme, resolvedTheme, flavor, setFlavor: persistFlavor }),
    [theme, persistTheme, resolvedTheme, flavor, persistFlavor],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
