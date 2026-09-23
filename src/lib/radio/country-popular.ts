/**
 * Curated shortlist for the location picker (most stations first). Stays in
 * the initial bundle (~2KB); the full country directory lives in
 * `country-all.ts` and loads on demand behind search.
 *
 * `name` is the exact directory country name — the value sent to `?country=`.
 * `iso` is the ISO 3166-1 alpha-2 code for the picker flag (missing codes
 * fall back to a code pill — e.g. AE, which has no bundled flag).
 */
export interface PopularCountry {
  /** Directory country name — the exact value sent to `?country=`. */
  name: string;
  /** ISO 3166-1 alpha-2 code for the picker flag. */
  iso: string;
}

export const POPULAR_COUNTRIES: PopularCountry[] = [
  { name: "The United States Of America", iso: "US" },
  { name: "Germany", iso: "DE" },
  { name: "France", iso: "FR" },
  { name: "The Russian Federation", iso: "RU" },
  { name: "Mexico", iso: "MX" },
  { name: "The United Kingdom Of Great Britain And Northern Ireland", iso: "GB" },
  { name: "Greece", iso: "GR" },
  { name: "China", iso: "CN" },
  { name: "Australia", iso: "AU" },
  { name: "Italy", iso: "IT" },
  { name: "Brazil", iso: "BR" },
  { name: "Canada", iso: "CA" },
  { name: "The Netherlands", iso: "NL" },
  { name: "Spain", iso: "ES" },
  { name: "Argentina", iso: "AR" },
  { name: "Poland", iso: "PL" },
  { name: "India", iso: "IN" },
  { name: "Romania", iso: "RO" },
  { name: "The Philippines", iso: "PH" },
  { name: "The United Arab Emirates", iso: "AE" },
  { name: "Türkiye", iso: "TR" },
  { name: "Colombia", iso: "CO" },
  { name: "Switzerland", iso: "CH" },
  { name: "Indonesia", iso: "ID" },
  { name: "Chile", iso: "CL" },
  { name: "Belgium", iso: "BE" },
  { name: "Serbia", iso: "RS" },
  { name: "Hungary", iso: "HU" },
  { name: "Ukraine", iso: "UA" },
  { name: "Austria", iso: "AT" },
  { name: "Portugal", iso: "PT" },
  { name: "Bulgaria", iso: "BG" },
  { name: "Czechia", iso: "CZ" },
  { name: "Croatia", iso: "HR" },
  { name: "Sweden", iso: "SE" },
  { name: "Ireland", iso: "IE" },
];
