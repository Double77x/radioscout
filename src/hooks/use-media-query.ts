import { useSyncExternalStore, useCallback } from "react";

/** True when the viewport matches the given CSS media query. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      const mediaQueryList = globalThis.matchMedia(query);
      mediaQueryList.addEventListener("change", callback);
      return () => {
        mediaQueryList.removeEventListener("change", callback);
      };
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    return globalThis.matchMedia(query).matches;
  }, [query]);

  const getServerSnapshot = useCallback(() => {
    return false;
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
