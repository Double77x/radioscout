import { useTheme } from "next-themes";
import { useCallback } from "react";

export function useThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  return {
    theme,
    resolvedTheme,
    toggleTheme,
    isDark: resolvedTheme === "dark",
  };
}
