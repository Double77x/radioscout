import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { readStoredTheme, THEME_STORAGE_KEY, ThemeContext, type ResolvedTheme, type Theme } from "@/lib/theme";

// Local system/light/dark state with the `dark` class on <html>.
// Pre-paint class comes from THEME_SCRIPT in the root route head.

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);
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

  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === "dark") {
      root.classList.add("dark");
      root.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
      root.style.colorScheme = "light";
    }
  }, [resolvedTheme]);

  const value = useMemo(() => ({ theme, setTheme: persistTheme, resolvedTheme }), [theme, persistTheme, resolvedTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
