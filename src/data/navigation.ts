import {
  ChartColumn,
  CodeXml,
  Crown,
  Heart,
  Home,
  ListPlus,
  Radio,
  Smartphone,
  Sparkles,
  Star,
  SunMoon,
  History,
  Shield,
  FileText,
  Lock,
  Cookie,
  type LucideIcon,
} from "lucide-react";
import { LEGAL_META } from "@/data/legal";
import { siteConfig } from "@/lib/site";

export interface NavLink {
  to: string;
  label: string;
  id?: string;
}

export interface CommandItemStatic {
  id: string;
  title: string;
  category: "Sections" | "Legal" | "Actions" | "Links";
  to?: string;
  /** External destination (footer icon links) — opened in a new tab. */
  href?: string;
  icon: LucideIcon;
  synonyms: string[];
}

/** Footer column definitions — drives Footer.tsx rendering. */
export const FOOTER_PRODUCT_LINKS: NavLink[] = [
  { to: "/features", label: "Features" },
  { to: "/legal/changelog", label: "Changelog" },
  { to: "/adding-stations", label: "Adding stations" },
];

export const FOOTER_LEGAL_LINKS: NavLink[] = [
  { to: "/legal/privacy", label: LEGAL_META.privacy.title },
  { to: "/legal/terms", label: LEGAL_META.terms.title },
  { to: "/legal/cookies", label: LEGAL_META.cookies.title },
  { to: "/legal/security", label: LEGAL_META.security.title },
];

/** Command palette static registry — every footer link (internal + external) and home section lives here so Quick Find stays in sync with the footer and homepage. CommandPalette.tsx merges with dynamic actions. */
export const COMMAND_STATIC_ITEMS: CommandItemStatic[] = [
  {
    id: "nav-home",
    title: "Home",
    category: "Sections",
    to: "/",
    icon: Home,
    synonyms: ["overview", "main", "home", "on air", "stations", "radio", "music", "listen"],
  },
  {
    id: "nav-features",
    title: "Features",
    category: "Sections",
    to: "/features",
    icon: Sparkles,
    synonyms: ["features", "tour", "capabilities", "android", "apk", "sleep timer", "crossfade", "backup"],
  },
  {
    id: "nav-adding-stations",
    title: "Adding stations",
    category: "Sections",
    to: "/adding-stations",
    icon: ListPlus,
    synonyms: ["add station", "submit station", "missing station", "directory", "radio-browser"],
  },
  {
    id: "section-saved",
    title: "Saved",
    category: "Sections",
    to: "/#home-section-saved",
    icon: Star,
    synonyms: ["saved", "favourites", "favorites", "bookmarks", "star", "my stations", "collection"],
  },
  {
    id: "section-top",
    title: "Most loved",
    category: "Sections",
    to: "/#home-section-top",
    icon: Heart,
    synonyms: ["most loved", "loved", "top", "popular", "heart", "votes", "best"],
  },
  {
    id: "section-british",
    title: "Best of British",
    category: "Sections",
    to: "/#home-section-british",
    icon: Crown,
    synonyms: [
      "best of british",
      "british",
      "britain",
      "uk",
      "united kingdom",
      "england",
      "bbc",
      "kiss",
      "kisstory",
      "capital",
      "heart",
      "lbc",
      "anthems",
    ],
  },
  {
    id: "section-recent",
    title: "Recently played",
    category: "Sections",
    to: "/#home-section-recent",
    icon: History,
    synonyms: ["recently played", "recent", "history", "just played", "latest"],
  },
  {
    id: "section-stats",
    title: "Listening",
    category: "Sections",
    to: "/#home-section-stats",
    icon: ChartColumn,
    synonyms: ["listening", "stats", "statistics", "charts", "trends", "time", "streak"],
  },
  {
    id: "link-android",
    title: "Android app",
    category: "Links",
    href: siteConfig.links.releases,
    icon: Smartphone,
    synonyms: ["android", "apk", "app", "download", "install", "release", "mobile"],
  },
  {
    id: "link-github",
    title: "GitHub repository",
    category: "Links",
    href: siteConfig.links.github,
    icon: CodeXml,
    synonyms: ["github", "repo", "repository", "source", "code", "issues", "contribute"],
  },
  {
    id: "link-directory",
    title: "Station directory",
    category: "Links",
    href: "https://www.radio-browser.info",
    icon: Radio,
    synonyms: ["station directory", "directory", "radio-browser", "radio browser", "database", "source"],
  },
  {
    id: "legal-changelog",
    title: LEGAL_META.changelog.title,
    category: "Legal",
    to: "/legal/changelog",
    icon: History,
    synonyms: ["changelog", "updates", "releases", "versions", "new", "features"],
  },
  {
    id: "legal-privacy",
    title: LEGAL_META.privacy.title,
    category: "Legal",
    to: "/legal/privacy",
    icon: Shield,
    synonyms: ["privacy", "gdpr", "data", "confidentiality", "security"],
  },
  {
    id: "legal-terms",
    title: LEGAL_META.terms.title,
    category: "Legal",
    to: "/legal/terms",
    icon: FileText,
    synonyms: ["terms", "conditions", "tos", "legal", "usage"],
  },
  {
    id: "legal-security",
    title: `${LEGAL_META.security.title} Overview`,
    category: "Legal",
    to: "/legal/security",
    icon: Lock,
    synonyms: ["security", "encryption", "client-side", "safety"],
  },
  {
    id: "legal-cookies",
    title: LEGAL_META.cookies.title,
    category: "Legal",
    to: "/legal/cookies",
    icon: Cookie,
    synonyms: ["cookies", "tracking", "storage"],
  },
];

export const COMMAND_ACTION_THEME: Omit<CommandItemStatic, "to"> & { id: "action-theme" } = {
  id: "action-theme",
  title: "Toggle Theme (Light / Dark)",
  category: "Actions",
  icon: SunMoon,
  synonyms: ["theme", "dark", "light", "mode", "color", "appearance"],
};
