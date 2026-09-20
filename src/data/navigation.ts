import { Home, SunMoon, History, Shield, FileText, Lock, Cookie, type LucideIcon } from "lucide-react";
import { LEGAL_META } from "@/data/legal";

export interface NavLink {
  to: string;
  label: string;
  id?: string;
}

export interface CommandItemStatic {
  id: string;
  title: string;
  category: "Sections" | "Legal" | "Actions";
  to?: string;
  icon: LucideIcon;
  synonyms: string[];
}

/** Main navbar links — single source for Navbar pill and scroll-spy. */
export const NAV_LINKS: NavLink[] = [{ to: "/", label: "Home" }];

/** Footer column definitions — drives Footer.tsx rendering. */
export const FOOTER_PRODUCT_LINKS: NavLink[] = [
  { to: "/", label: "Home" },
  { to: "/legal/changelog", label: "Changelog" },
];

export const FOOTER_LEGAL_LINKS: NavLink[] = [
  { to: "/legal/privacy", label: LEGAL_META.privacy.title },
  { to: "/legal/terms", label: LEGAL_META.terms.title },
  { to: "/legal/cookies", label: LEGAL_META.cookies.title },
  { to: "/legal/security", label: LEGAL_META.security.title },
];

/** Command palette static registry — CommandPalette.tsx merges with dynamic actions. */
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
