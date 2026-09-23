/**
 * Curated alias → directory search-term table for agentic `?play=` links.
 * Tiny static map (~2KB, no network): covers the most-requested stations so
 * `/?play=kisstory` resolves deterministically instead of gambling on
 * free-text ranking. Unknown names fall through to free-text search.
 * Seeded from real user favourites (2026-09-23): BBC network, Bauer Kiss /
 * Kisstory, Global (Heart/Capital/Smooth/Gold/Classic/LBC), dance niche.
 */
const ALIASES: Record<string, string> = {
  "bbc-radio-1": "BBC Radio 1",
  "bbc-radio-2": "BBC Radio 2",
  "bbc-radio-3": "BBC Radio 3",
  "bbc-radio-4": "BBC Radio 4",
  "bbc-radio-4-extra": "BBC Radio 4 Extra",
  "bbc-radio-5-live": "BBC Radio 5 Live",
  "bbc-radio-6-music": "BBC Radio 6 Music",
  "bbc-radio-1xtra": "BBC Radio 1Xtra",
  "bbc-radio-1-anthems": "BBC Radio 1 Anthems",
  "bbc-radio-1-dance": "BBC Radio 1 Dance",
  "bbc-live-news": "BBC Live News",
  "bbc-1xtra": "BBC 1Xtra",
  "1xtra": "BBC 1Xtra",
  "bbc-5-live": "BBC Radio 5 Live",
  "bbc-6-music": "BBC 6 Music",
  "bbc-asian-network": "BBC Asian Network",
  capital: "Capital FM",
  "capital-fm": "Capital FM",
  "capital-london": "Capital FM",
  "capital-fm-london": "Capital FM",
  "capital-dance": "Capital Dance",
  "capital-xtra": "Capital Xtra",
  heart: "Heart FM",
  "heart-fm": "Heart FM",
  "heart-80s": "Heart 80s",
  "heart-90s": "Heart 90s",
  "classic-fm": "Classic FM",
  "classic-fm-hd": "Classic FM HD",
  gold: "Gold",
  "gold-radio": "Gold",
  kiss: "Kiss FM",
  "kiss-uk": "KISS UK",
  kisstory: "Kisstory",
  "kisstory-rb": "KISSTORY R&B",
  "kisstory-rnb": "KISSTORY R&B",
  "kiss-fresh": "Kiss Fresh",
  lbc: "LBC",
  "lbc-news": "LBC News",
  "radio-x": "Radio X",
  "radio-x-classic": "Radio X Classic Rock",
  absolute: "Absolute Radio",
  "absolute-radio": "Absolute Radio",
  "absolute-80s": "Absolute 80s",
  "absolute-90s": "Absolute 90s",
  talksport: "talkSPORT",
  "talk-sport": "talkSPORT",
  "times-radio": "Times Radio",
  smooth: "Smooth Radio",
  "smooth-radio": "Smooth Radio",
  "smooth-chill": "Smooth Chill",
  magic: "Magic Radio",
  "magic-radio": "Magic Radio",
  "magic-radio-uk": "Magic Radio",
  "dance-wave": "Dance Wave",
  mangoradio: "MANGORADIO",
  "mango-radio": "MANGORADIO",
  jazzfm: "Jazz FM",
};

/** Normalize a `?play=` value to alias-key form (`BBC Radio 1` → `bbc-radio-1`). */
export function normalizeAlias(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036F]/g, "")
    .trim()
    .replaceAll(/[\s_/.]+/g, "-")
    .replaceAll(/[^a-z0-9-]/g, "")
    .replaceAll(/-{2,}/g, "-")
    .replaceAll(/^-+|-+$/g, "");
}

/** Curated search term for a `?play=` value, or null when unaliased. */
export function resolveAlias(raw: string): string | null {
  const key = normalizeAlias(raw);
  if (key === "") return null;
  return ALIASES[key] ?? null;
}
