/**
 * Curated shortlist for the language picker (most stations first). Stays in
 * the initial bundle (~2KB); the full 624-row directory lives in
 * `language-all.ts` and loads on demand behind "Browse all".
 *
 * `flag` is a flag-icons country code for the most-associated country.
 * Empty means none fits (transnational languages) — the picker renders a
 * code pill instead. Never derive the flag from `code`: ISO 639 is not
 * ISO 3166 (`be` is Belarusian AND Belgium).
 */
export interface PopularLanguage {
  /** Directory language name — the exact value sent to `?language=`. */
  name: string;
  /** ISO 639 shortcode shown in the picker; "" when the directory has none. */
  code: string;
  /** flag-icons country code; "" renders a code pill. */
  flag: string;
}

export const POPULAR_LANGUAGES: PopularLanguage[] = [
  { name: "english", code: "en", flag: "gb" },
  { name: "spanish", code: "es", flag: "es" },
  { name: "german", code: "de", flag: "de" },
  { name: "french", code: "fr", flag: "fr" },
  { name: "chinese", code: "zh", flag: "cn" },
  { name: "russian", code: "ru", flag: "ru" },
  { name: "italian", code: "it", flag: "it" },
  { name: "greek", code: "el", flag: "gr" },
  { name: "dutch", code: "nl", flag: "nl" },
  { name: "polish", code: "pl", flag: "pl" },
  { name: "portuguese", code: "pt", flag: "pt" },
  { name: "arabic", code: "ar", flag: "eg" },
  { name: "hindi", code: "hi", flag: "in" },
  { name: "romanian", code: "ro", flag: "ro" },
  { name: "serbian", code: "sr", flag: "rs" },
  { name: "turkish", code: "tr", flag: "tr" },
  { name: "tamil", code: "ta", flag: "in" },
  { name: "ukrainian", code: "uk", flag: "ua" },
  { name: "croatian", code: "hr", flag: "hr" },
  { name: "indonesian", code: "id", flag: "id" },
  { name: "czech", code: "cs", flag: "cz" },
  { name: "nepali", code: "ne", flag: "np" },
  { name: "bulgarian", code: "bg", flag: "bg" },
  { name: "japanese", code: "ja", flag: "jp" },
  { name: "slovak", code: "sk", flag: "sk" },
  { name: "swedish", code: "sv", flag: "se" },
  { name: "cantonese", code: "yue", flag: "hk" },
  { name: "korean", code: "ko", flag: "kr" },
  { name: "danish", code: "da", flag: "dk" },
  { name: "catalan", code: "ca", flag: "es" },
  { name: "bosnian", code: "bs", flag: "ba" },
  { name: "malayalam", code: "ml", flag: "in" },
  { name: "finnish", code: "fi", flag: "fi" },
  { name: "slovenian", code: "sl", flag: "si" },
  { name: "thai", code: "th", flag: "th" },
  { name: "hebrew", code: "he", flag: "il" },
  { name: "norwegian", code: "no", flag: "no" },
  { name: "urdu", code: "ur", flag: "pk" },
  { name: "latvian", code: "lv", flag: "lv" },
  { name: "estonian", code: "et", flag: "ee" },
];
