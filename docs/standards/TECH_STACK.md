# RadioScout Tech Stack

This project is a mobile-first, privacy-first free worldwide radio player built with **TanStack Start (Build-Time SSG)** on **Cloudflare Pages**, with the same static artifact shipping inside a **Capacitor Android shell**. Optimized for instantaneous initial paint, zero FOUC, type safety, and 100% on-device data (IndexedDB) — no backend.

## Core Frameworks

- **React 19:** Modern UI Library with concurrent rendering.
- **TypeScript:** Strict type system.
- **TanStack Start:** Framework providing build-time Static Site Generation (SSG) with automatic route crawling.
- **TanStack Router:** Fully type-safe routing with file-based route tree (`src/routeTree.gen.ts`).
- **TanStack Query (React Query):** Client & server state management.
- **Vite+ 1.0:** Build tool and dev server (Vite 8 + Rolldown via the `catalog:` entry; lint/format live in `toolchain.config.ts`).
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
- **No charting dependency.** The listening dashboard renders labelled HTML bars. Re-add a chart library with an explicit chunk rule if analytics ever need one.
- **`vite-plugin-pwa`, installed but unwired.** Deliberately so: the verified offline path is the hand-rolled workbox script above. See `docs/lineage.md` (2026-10-05) before touching it.
- **Fuse.js:** In-memory fuzzy search for Quick Find command palette.
- **Sonner:** Toasts (favourites, history cleared, restores, backup states).
- **Zod:** Radio backup envelope + station schema validation.
- **Clsx & Tailwind Merge:** Class name utilities (`cn()`).
- **Oxlint & oxfmt:** High-speed Rust linting and formatting (oxlint plugins: better-tailwindcss, react-hooks, react-refresh, react-doctor).
- **Fallow:** Dead-code, duplication, complexity, and architecture linting (`fallow.toml`, `fallow audit --format json --quiet`, `fallow dead-code --trace`, `fallow health --hotspots`). Replaces knip; embedded `regression.baseline` for CI `--fail-on-regression`; agentic tidy gate (`exit 0`/`1` success, `2` error envelope).
- **Service worker (offline, web only):** `scripts/generate-sw.mjs` drives `workbox-build` to emit `dist/client/sw.js` in the build chain — precached shell, routes, fonts and manifest; `NetworkOnly` for `/api/*` and streams; daily directory cache, monthly artwork cache, and a shell fallback for navigation. Registration is hand-rolled in `src/lib/pwa.ts` (update and offline toasts, no `workbox-window`). Native pipelines strip the file unconditionally rather than relying on an env flag, because the build task cache replays outputs without re-running.
- **Playwright:** End-to-end and accessibility (`@axe-core/playwright`) automated testing suite.
- **Vitest + Testing Library:** Unit tests (`tests/unit`, `fake-indexeddb`, jsdom) — pure lib functions and radio store flows.

## Project Standards

- **Theme Tokens:** Semantic tokens defined in `src/styles/index.css` (e.g. `bg-primary`, `text-muted-foreground`, `border-hairline`).
- **No `any`:** Strict TypeScript across all component interfaces and data loaders.
- **Zero FOUC:** Render-blocking stylesheets injected via `?url` in `Route.head`.
