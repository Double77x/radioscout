/** Content-language filter (directory language names, e.g. "english"). Empty = worldwide. */

export const LANGUAGES_KEY = "radioscout:languages";

function readStored(): string[] {
  try {
    const raw = globalThis.localStorage?.getItem(LANGUAGES_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? normalizeLanguages(parsed) : [];
  } catch {
    return [];
  }
}

/** Lowercase-trimmed, deduped, order-stable. Never throws. */
export function normalizeLanguages(ids: unknown[]): string[] {
  const seen = new Set<string>();
  for (const id of ids) {
    if (typeof id !== "string") continue;
    const clean = id.trim().toLowerCase();
    if (clean !== "" && !seen.has(clean)) seen.add(clean);
  }
  return [...seen];
}

/** Selected languages, worldwide (`[]`) during prerender. Never throws. */
export function readLanguages(): string[] {
  if (globalThis.window === undefined) return [];
  return readStored();
}

/** Replace the selection (backup restore). Never throws. */
export function writeLanguages(ids: string[]): void {
  try {
    globalThis.localStorage?.setItem(LANGUAGES_KEY, JSON.stringify(normalizeLanguages(ids)));
  } catch {
    // Private mode etc — the filter just won't survive reloads.
  }
}
