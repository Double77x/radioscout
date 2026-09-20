# RadioScout Tech Stack

This project is a mobile-first, privacy-first free worldwide radio player built with **TanStack Start (Build-Time SSG)** on **Cloudflare Pages**, with the same static artifact shipping inside a **Capacitor Android shell**. Optimized for instantaneous initial paint, zero FOUC, type safety, and 100% on-device data (IndexedDB) — no backend.

## Core Frameworks

- **React 19:** Modern UI Library with concurrent rendering.
- **TypeScript:** Strict type system.
- **TanStack Start:** Framework providing build-time Static Site Generation (SSG) with automatic route crawling.
- **TanStack Router:** Fully type-safe routing with file-based route tree (`src/routeTree.gen.ts`).
- **TanStack Query (React Query):** Client & server state management.
- **Vite (v8):** Build tool and dev server.
- **Cloudflare Pages:** Global CDN static asset and HTML hosting.

## Styling, Fonts & UI

- **Tailwind CSS 4 (`@tailwindcss/vite`):** Utility-first styling with `@theme` token system.
- **Base UI (`@base-ui/react`):** Headless, accessible component primitives.
- **Lucide React:** Iconography.
- **Tailwind CSS Animate:** Keyframe-based animations with `animation-fill-mode: both`.
- **Self-Hosted Poppins:** WOFF2 fonts served from `/fonts/` with metric-matched `Poppins Fallback` and preloaded via `Route.head`.
- **Next Themes:** Dark/Light theme switching with pre-hydration inline script.

## Data, Native & Utilities

- **Dexie (IndexedDB):** Local-first radio store — isolated `RadioDB` (favourites with persisted sort, deduped history). Async chunk (`vendor-dexie`); `fake-indexeddb` backs the unit tests.
- **Capacitor 8 (Android shell):** Same `dist/client` artifact in a native app — StatusBar/Splash, hardware back, Filesystem + Share sheets, Keyboard resize, Preferences. Every native call site has a web fallback (`src/lib/capacitor.ts` gate); `pnpm build:android:apk` / `build:android:aab` ship debug APKs and release bundles.
- **@tanstack/react-hotkeys:** Cross-platform keyboard shortcuts and global hotkey manager.
- **@tanstack/charts + d3-shape:** Removed 2026-09-11 (zero imports; dashboard renders labeled HTML bars instead). Re-add with a chunk rule if analytics ever need them.
- **Fuse.js:** In-memory fuzzy search for Quick Find command palette.
- **Sonner:** Toasts (favourites, history cleared, restores, backup states).
- **Zod:** Radio backup envelope + station schema validation.
- **Clsx & Tailwind Merge:** Class name utilities (`cn()`).
- **Oxlint & oxfmt:** High-speed Rust linting and formatting (oxlint plugins: better-tailwindcss, react-hooks, react-refresh, react-doctor).
- **Fallow:** Dead-code, duplication, complexity, and architecture linting (`fallow.toml`, `fallow audit --format json --quiet`, `fallow dead-code --trace`, `fallow health --hotspots`). Replaces knip; embedded `regression.baseline` for CI `--fail-on-regression`; agentic tidy gate (`exit 0`/`1` success, `2` error envelope).
- **Vite Plugin PWA (`vite-plugin-pwa`, installed):** Manifest + icons ship from `public/`; the service-worker offline pass is still roadmap (see below), so the plugin stays unwired in `vite.config.ts` until then.
- **Playwright:** End-to-end and accessibility (`@axe-core/playwright`) automated testing suite (axe-core via `@axe-core/playwright`; direct `axe-core`/`jest-axe` removed as unused — see `fallow dead-code --trace-dependency`).
- **Vitest + Testing Library:** Unit tests (`tests/unit`, `fake-indexeddb`, jsdom) — pure lib functions and radio store flows.

## Project Standards

- **Theme Tokens:** Semantic tokens defined in `src/styles/index.css` (e.g. `bg-primary`, `text-muted-foreground`, `border-hairline`).
- **No `any`:** Strict TypeScript across all component interfaces and data loaders.
- **Zero FOUC:** Render-blocking stylesheets injected via `?url` in `Route.head`.
