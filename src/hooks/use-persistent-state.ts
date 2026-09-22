import { useCallback, useSyncExternalStore } from "react";

/** Last-read cache: getSnapshot must return a stable reference per payload. */
const snapshotCache = new Map<string, { raw: string | null; value: string[] }>();

function readStored(key: string, fallback: string[]): string[] {
  let raw: string | null = null;
  try {
    raw = globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    raw = null;
  }
  const hit = snapshotCache.get(key);
  if (hit && hit.raw === raw) return hit.value;
  let value = fallback;
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) value = parsed.filter((entry): entry is string => typeof entry === "string");
    } catch {
      value = fallback;
    }
  }
  snapshotCache.set(key, { raw, value });
  return value;
}

/**
 * String array persisted to localStorage (accordion open state, etc.).
 * SSR-safe: the server snapshot is the fallback, so prerender output never
 * mismatches hydration; the stored value applies on first client read.
 * Corrupt payloads collapse back to the fallback. Pass a stable (module
 * scope) fallback so snapshots stay referentially stable.
 */
export function usePersistentStrings(key: string, fallback: string[]): [string[], (next: string[]) => void] {
  const getSnapshot = useCallback(() => readStored(key, fallback), [key, fallback]);
  const getServerSnapshot = useCallback(() => fallback, [fallback]);
  const subscribe = useCallback(
    (notify: () => void) => {
      const onStorage = (event: StorageEvent) => {
        if (event.key === key) notify();
      };
      globalThis.addEventListener("storage", onStorage);
      return () => globalThis.removeEventListener("storage", onStorage);
    },
    [key],
  );

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (next: string[]) => {
      try {
        globalThis.localStorage?.setItem(key, JSON.stringify(next));
      } catch {
        // Private mode: state just doesn't survive reloads.
      }
      globalThis.dispatchEvent(new StorageEvent("storage", { key }));
    },
    [key],
  );

  return [value, setValue];
}

/** Last-read cache: getSnapshot must return a stable reference per payload. */
const stringSnapshotCache = new Map<string, { raw: string | null; value: string }>();

function readStoredString(key: string, fallback: string): string {
  let raw: string | null = null;
  try {
    raw = globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    raw = null;
  }
  const hit = stringSnapshotCache.get(key);
  if (hit && hit.raw === raw) return hit.value;
  let value = fallback;
  if (raw !== null) value = raw;
  stringSnapshotCache.set(key, { raw, value });
  return value;
}

/**
 * Single string persisted to localStorage (quality filter etc.). Same
 * SSR-safe contract as `usePersistentStrings`: the server snapshot is the
 * fallback, corrupt payloads are impossible (any stored string is valid —
 * callers normalize), and writes notify same-tab subscribers.
 */
export function usePersistentString(key: string, fallback: string): [string, (next: string) => void] {
  const getSnapshot = useCallback(() => readStoredString(key, fallback), [key, fallback]);
  const getServerSnapshot = useCallback(() => fallback, [fallback]);
  const subscribe = useCallback(
    (notify: () => void) => {
      const onStorage = (event: StorageEvent) => {
        if (event.key === key) notify();
      };
      globalThis.addEventListener("storage", onStorage);
      return () => globalThis.removeEventListener("storage", onStorage);
    },
    [key],
  );

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (next: string) => {
      try {
        globalThis.localStorage?.setItem(key, next);
      } catch {
        // Private mode: state just doesn't survive reloads.
      }
      globalThis.dispatchEvent(new StorageEvent("storage", { key }));
    },
    [key],
  );

  return [value, setValue];
}
