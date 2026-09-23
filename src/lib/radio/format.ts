/** Compact directory counts: 81234 → "81.2K", 80012 → "80K", 42 → "42". */
export function formatStationCount(count: number): string {
  if (!Number.isFinite(count) || count < 0) return "…";
  if (count < 1000) return String(count);
  const thousands = count / 1000;
  const rounded = thousands >= 100 ? String(Math.round(thousands)) : thousands.toFixed(1).replace(/\.0$/, "");
  return `${rounded}K`;
}

/**
 * Compact listening time: 45 → "45s", 90 → "1m", 2700 → "45m",
 * 3600 → "1h", 7380 → "2h 3m". Floored, never "0s" for positive input.
 */
export function formatListeningTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "0s";
  const seconds = Math.floor(totalSeconds);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/**
 * Ordinal day-of-month: 1 → "1st", 2 → "2nd", 3 → "3rd", 10 → "10th",
 * 22 → "22nd". Falls back to the plain number outside 1–31.
 */
export function formatDayOrdinal(day: number): string {
  if (!Number.isInteger(day) || day < 1 || day > 31) return String(day);
  const teen = day % 100 >= 11 && day % 100 <= 13;
  const suffix = teen ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[day % 10] ?? "th");
  return `${day}${suffix}`;
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
