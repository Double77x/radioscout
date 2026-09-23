/** Station-country filter (directory country names, exact match). Empty = worldwide. */

export const COUNTRIES_KEY = "radioscout:countries";

function readStored(): string[] {
  try {
    const raw = globalThis.localStorage?.getItem(COUNTRIES_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? normalizeCountries(parsed) : [];
  } catch {
    return [];
  }
}

/**
 * Trimmed, whitespace-collapsed, deduped, order-stable. Case is preserved:
 * directory country names are Title Case and `?country=` matches them
 * exactly — dedupe folds case only to catch `germany`/`Germany` doubles.
 * Never throws.
 */
export function normalizeCountries(ids: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string") continue;
    const clean = id.replaceAll(/\s{2,}/g, " ").trim();
    const fold = clean.toLowerCase();
    if (clean !== "" && !seen.has(fold)) {
      seen.add(fold);
      out.push(clean);
    }
  }
  return out;
}

/** Selected countries, worldwide (`[]`) during prerender. Never throws. */
export function readCountries(): string[] {
  if (globalThis.window === undefined) return [];
  return readStored();
}

/** Replace the selection (backup restore). Never throws. */
export function writeCountries(ids: string[]): void {
  try {
    globalThis.localStorage?.setItem(COUNTRIES_KEY, JSON.stringify(normalizeCountries(ids)));
  } catch {
    // Private mode etc — the filter just won't survive reloads.
  }
}

/**
 * Short display names for the directory's longest country names. Storage
 * and `?country=` keep the exact directory form — this is display only.
 */
const SHORT_COUNTRY_NAMES: Record<string, string> = {
  "The United States Of America": "United States",
  "The United Kingdom Of Great Britain And Northern Ireland": "United Kingdom",
  "The Russian Federation": "Russia",
  "The United Arab Emirates": "UAE",
  "The Republic Of Korea": "South Korea",
  "Taiwan, Republic Of China": "Taiwan",
  "Bolivarian Republic Of Venezuela": "Venezuela",
  "Islamic Republic Of Iran": "Iran",
};

/** Compact caption ("United Kingdom") for a directory country name. Never throws. */
export function displayCountryName(name: string): string {
  const short = SHORT_COUNTRY_NAMES[name];
  if (short) return short;
  return name.startsWith("The ") ? name.slice("The ".length) : name;
}
