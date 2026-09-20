/**
 * Single source of truth for legal / compliance pages.
 * Pages, SEO, Footer and CommandPalette should derive titles / descriptions / keywords from here
 * to avoid drift between route meta and searchable palette items.
 */

export type LegalSlug = "privacy" | "terms" | "cookies" | "security" | "changelog";

export interface LegalMeta {
  slug: LegalSlug;
  title: string;
  description: string;
  keywords: string[];
  lastUpdated?: string;
}

export const LEGAL_META: Record<LegalSlug, LegalMeta> = {
  privacy: {
    slug: "privacy",
    title: "Privacy Policy",
    description: "How RadioScout handles your data — local-only favourites and history, no accounts.",
    keywords: ["privacy policy", "data protection", "user privacy", "local data", "information security"],
    lastUpdated: "20 September 2026",
  },
  terms: {
    slug: "terms",
    title: "Terms of Service",
    description: "The terms for using RadioScout, including your rights and responsibilities.",
    keywords: ["terms of service", "user agreement", "legal information", "usage rights", "responsibilities"],
    lastUpdated: "20 September 2026",
  },
  cookies: {
    slug: "cookies",
    title: "Cookie Policy",
    description: "The cookies RadioScout uses and how you can control them.",
    keywords: ["cookies", "cookie policy", "browser storage", "local storage", "data privacy"],
    lastUpdated: "20 September 2026",
  },
  security: {
    slug: "security",
    title: "Security",
    description: "How RadioScout keeps your data safe with static hosting and on-device storage.",
    keywords: ["data security", "static hosting", "privacy-first", "local-first", "infrastructure safety"],
  },
  changelog: {
    slug: "changelog",
    title: "Changelog",
    description: "New features, improvements and fixes in RadioScout.",
    keywords: ["changelog", "product updates", "new features", "release notes", "version history"],
  },
};
