/** Recent search terms under the header search box (local-only, ephemeral). */

export const RECENT_SEARCHES_KEY = "radioscout:recent-searches";
/** Chips shown under search (newest first). */
export const MAX_RECENT_SEARCHES = 8;
/** Single characters are half-typed navigation, not searches. */
export const MIN_RECENT_SEARCH_LENGTH = 2;

function readTerms(): string[] {
  try {
    const raw = globalThis.localStorage?.getItem(RECENT_SEARCHES_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const cleaned: string[] = [];
    for (const entry of parsed) {
      if (typeof entry !== "string") continue;
      const trimmed = entry.trim();
      if (trimmed.length >= MIN_RECENT_SEARCH_LENGTH) cleaned.push(trimmed);
    }
    return [...new Set(cleaned)].slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

/** Stored terms, newest first. Never throws. */
export function readRecentSearches(): string[] {
  if (globalThis.window === undefined) return [];
  return readTerms();
}

function writeTerms(terms: string[]): void {
  try {
    globalThis.localStorage?.setItem(RECENT_SEARCHES_KEY, JSON.stringify(terms));
  } catch {
    // Private mode etc — recents just don't survive reloads.
  }
  // Notify same-tab `usePersistentStrings` subscribers (mirrors backup restore).
  try {
    if (typeof globalThis.dispatchEvent === "function" && typeof StorageEvent !== "undefined") {
      globalThis.dispatchEvent(new StorageEvent("storage", { key: RECENT_SEARCHES_KEY }));
    }
  } catch {
    // Notification is best-effort; the value is already written.
  }
}

/** Record a term (dedup move-to-front, capped). Short/empty terms ignored. Never throws. */
export function recordRecentSearch(term: string): void {
  if (globalThis.window === undefined) return;
  const cleaned = term.trim();
  if (cleaned.length < MIN_RECENT_SEARCH_LENGTH) return;
  const lowered = cleaned.toLowerCase();
  const rest = readTerms().filter((entry) => entry.toLowerCase() !== lowered);
  writeTerms([cleaned, ...rest].slice(0, MAX_RECENT_SEARCHES));
}

/** Clear all recent searches. Never throws. */
export function clearRecentSearches(): void {
  if (globalThis.window === undefined) return;
  writeTerms([]);
}
