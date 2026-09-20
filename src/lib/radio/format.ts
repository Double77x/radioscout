/** Compact directory counts: 81234 → "81.2K", 80012 → "80K", 42 → "42". */
export function formatStationCount(count: number): string {
  if (!Number.isFinite(count) || count < 0) return "…";
  if (count < 1000) return String(count);
  const thousands = count / 1000;
  const rounded = thousands >= 100 ? String(Math.round(thousands)) : thousands.toFixed(1).replace(/\.0$/, "");
  return `${rounded}K`;
}

/**
 * Tidy a comma-separated tag list for display:
 * "christian,christian music,jesus" → "Christian, Christian music, Jesus".
 */
export function formatTags(tags: string): string {
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag !== "")
    .map((tag) => tag.charAt(0).toUpperCase() + tag.slice(1))
    .join(", ");
}

const REGION_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

/**
 * Short display country: ISO code first ("The United Kingdom Of Great
 * Britain And Northern Ireland" → "United Kingdom"), tidied raw text
 * as fallback.
 */
export function formatCountryName(country: string, countrycode: string): string {
  const iso = countrycode.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(iso)) {
    try {
      const short = REGION_NAMES.of(iso);
      if (short) return short;
    } catch {
      // Below: raw-text fallback.
    }
  }
  return country
    .replace(/^the\s+/i, "")
    .replaceAll(/\s{2,}/g, " ")
    .trim();
}
