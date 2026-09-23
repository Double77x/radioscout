# RadioScout Architecture Overview

## 1. System Design

RadioScout is a mobile-first free worldwide radio player powered by **TanStack Start (Build-Time SSG)** on **Cloudflare Pages** — and the same static artifact ships inside a **Capacitor Android shell** (`pnpm build:android:apk`). It combines instantaneous first-paint and SEO via pre-rendered static HTML with strict privacy by keeping everything on-device: favourites, history, volume and votes live in a local IndexedDB (Dexie `RadioDB`), and there is no backend server.

### Key Modules

1. **Home (`/`):**
   - `HomePage` with URL search state (`q`, `tag`): `RadioHeader` (search + genre chips + directory total), accordion sections (Saved first, Most loved, Recently played), footer directory credit. Search autofocuses on fine-pointer devices; the dock Browse button focuses it from anywhere via event.
   - Prerendered to static HTML at build time (8 pages) with embedded SEO meta, JSON-LD schemas, and OpenGraph headers.
2. **Station lists:**
   - `StationCard` rows (play, art, details sheet, favourite, drag-reorder in Saved).
   - Card-shaped skeletons (`StationCardSkeleton`/`StationListSkeleton`) mirror row geometry so lists swap with no shift; sections carry `aria-busy`.
3. **Radio engine (`src/lib/radio/` + hooks):**
   - `api.ts` (radio-browser directory: top/search/stats, mirror failover), `store.ts` (isolated `RadioDB`: favourites with persisted `sort`, history deduped latest-wins), `prefs.ts` (volume/muted), `votes.ts`, `genres.ts`, `backup.ts` (versioned JSON envelope: export via share/download, import via Settings → Data).
   - `use-radio.ts` (directory queries with `keepPreviousData`; favourites/history with `initialData: []` so they never flash), `use-player.ts` (web `<audio>` singleton via `useSyncExternalStore`, MediaSession).
4. **Quick Find Command Palette (`CommandPalette`):**
   - **Shortcuts:** Powered by `@tanstack/react-hotkeys` (`⌘K` / `Ctrl+K`, `Esc`).
   - **Dialog Shell:** Base UI Dialog (`@base-ui/react/dialog`) with smooth animations and accessibility.
   - **Search:** Client-side fuzzy search via Fuse.js across sections, legal pages, and theme actions.

## 2. Routing & SSG Lifecycle (TanStack Start)

- **Entry Factory (`src/router.tsx`):** Exports the shared `createRouter(routeTree)` factory for both SSG build-time crawling and client hydration.
- **Root Document (`src/routes/__root.tsx`):**
  - Emits `<HeadContent />` with preloaded fonts and render-blocking `?url` stylesheets.
  - Houses the pre-hydration dark mode initialization script.
  - Mounts global providers (`ThemeProvider`, `TooltipProvider`, `Sonner`).
- **File-Based Routes (`src/routes/`):**
  - Home (`/`) plus legal pages code-split via `.lazy.tsx` chunks.
  - SSG prerender crawls chip and card links and produces static `.html` files for all 8 pages during `pnpm build`.
- **Catch-All 404 (`src/routes/$.tsx`):**
  - Handles unmatched client routes cleanly.

## 3. Data Flow & Security

- **Local User Data:** Favourites, history, player prefs and votes live exclusively in on-device IndexedDB (Dexie `RadioDB`: `favourites`, `history`). No backend server exists.
- **Radio backup:** Settings → Data exports the versioned envelope as JSON (`src/lib/radio/backup.ts:1`) — share sheet on native, file download on web; import restores favourites/history/prefs.
- **Theme State:** Managed via `next-themes` and synchronized with `localStorage` and `matchMedia("(prefers-color-scheme: dark)")`.

## 4. Design System & Component Infrastructure

- **UI Primitives:** Base UI primitives (`@base-ui/react`) styled with Tailwind CSS v4 in `src/components/ui/` (`select.tsx`, `popover.tsx` mirror the shadcn composition API over Base UI parts).
- **Settings (`SettingsMenu`):** Logo/tab trigger opens a screen-centred flyout with radio Data (export/import) and Style (System/Light/Dark, device-following by default) stacked in one scroll view, plus version footer. The app is local-only: no accounts, no sync.
- **Brand mark (`Logo`):** Inline adaptive SVG (glass music note + sparkle, per-instance gradient IDs, silver note in dark scheme). `scripts/generate-icons.mjs` is the single artwork source for `public/` icons (SVGs, PNGs, ICO) and `pnpm cap:assets` carries it into the android drawables.
- **Layouts & Shells (DRY Centralization):**
  - `AppShell` (`src/components/scout/AppShell.tsx:1`): Mobile-first centred-column frame with `PlayerDock` and `StationDetailSheet`.
  - `LegalLayout` (`src/components/layout/LegalLayout.tsx:1`): Clean reading layout with breadcrumbs, now driven by `LegalLayout` + `Prose`/`ProseH2` (`src/components/layout/Prose.tsx:1`).
  - `StateShell`/`CenteredState` (`src/components/shared/StateShell.tsx:1`): Unified full-page error/404 shells (used by `GlobalErrorComponent`, `NotFoundComponent`).
- **Navigation Single Source:** `src/data/navigation.ts:1` (`FOOTER_*`, `COMMAND_STATIC_ITEMS` + `LEGAL_META` from `src/data/legal.ts:1`) drives `Footer` and `CommandPalette` (fuzzy search via Fuse.js) — eliminates drift between palette, footer, and route SEO.
- **Site Config:** `src/lib/site.ts:1` centralizes `url`, `email`, `links` (github/twitter) for `Seo`/`Footer`.
- **Typography:** Self-hosted Poppins font family with pre-computed CSS metric fallbacks to prevent layout shift.
- **Scout Tokens:** `src/styles/index.css:1` maps `--scout-*` brand and pastel-tint variables (plus `text-scout-title`, `rounded-scout-card`/`rounded-scout-hero`) into Tailwind v4 theme tokens — no arbitrary values in components.
- **Local-first radio store (`src/lib/radio/store.ts`):** Isolated `RadioDB` (favourites with `sort` for drag-reorder, history capped + deduped) — deliberately separate from any other store so version bumps can't disturb each other.
- **Quality Gates:** `fallow.toml:1` (migrated from `knip.ts`) runs `dead-code`/`dupes`/`health`/`audit` with `ignorePatterns`/`ignoreDependencies` and embedded `regression.baseline` for CI `--fail-on-regression`.

## 5. Native App (Capacitor APK)

One SSG artifact (`dist/client` — must stay in sync with `pages_build_output_dir` in `wrangler.toml`) serves Pages and the Android shell (`capacitor.config.ts:1`, `android/` committed, only local outputs/secrets gitignored).

- **Shell bootstrap (`NativeShell`, mounted in `RootDocument`):** theme-following status bar, splash hide, Android hardware back (animated via the `SwipeBack` frame when mounted, `App.exitApp()` at root), plus the zero-service OTA check (`src/lib/ota.ts:1`) — all client-only, no-op on web.
- **Edge-swipe back (`SwipeBack` in `AppShell`):** touch-gated page gesture with flick/commit thresholds; blocked inside dialogs, fields, and scrollable chip rows. Shared guard in `src/lib/animated-back.ts:1` so gesture and OS back never double-navigate.
- **Native branches (`src/lib/capacitor.ts:1`):** every native call site has a web fallback — radio backup goes through the share sheet (`src/lib/files.ts:1`).
- **Builds:** `pnpm build:android:apk` (debug) / `build:android:aab` (release) — `cap:version` syncs `package.json` version into `versionName` plus a deterministic `versionCode`; `cap:assets` regenerates icons/splash from source art. Never commit `capacitor.config.local.ts` (LAN live-reload URL).
