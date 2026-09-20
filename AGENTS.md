# Scout — Agent Guide

This file is the single source for AI coding agents working in this repo. Read it before any task. Human docs: `README.md`, `docs/`.

## Project

Scout is a TanStack Start (SSG) starter on Cloudflare Pages — `radioscout.pages.dev`. Type-safe Router + Query, Base UI + shadcn, Tailwind v4, self-hosted Poppins. All routes prerender to `dist/client` and are served as static HTML. The same artifact also ships as an Android APK via Capacitor (`capacitor.config.ts`, `android/`).

## Stack Decisions (from GEMINI.md — now merged)

- `[2026-09-01]`: TanStack Start CSS & Font Loading Architecture -> Use `import fontsCss from "@/styles/fonts.css?url";` and `import indexCss from "@/styles/index.css?url";` in `src/routes/__root.tsx` and pass them into `Route.head({ links: [{ rel: "stylesheet", href: fontsCss }, { rel: "stylesheet", href: indexCss }] })`. Side-effect CSS imports (`import "@/styles/index.css"`) are treated by Vite/TanStack Start as async client bundle chunks rather than render-blocking `<head>` resources, causing severe FOUC where elements start smaller in fallback fonts and pop to full size upon hydration.
- `[2026-09-01]`: Font Metric Matching & Preload Strategy -> Self-host Poppins font weights (`300`, `400`, `500`, `600`, `700`) in `public/fonts/` with `font-display: swap` and a metric-adjusted fallback (`Poppins Fallback` on `local("Arial")` with `size-adjust: 98.5%`, `ascent-override: 105%`, `descent-override: 35%`, `line-gap-override: 0%`). Preload all critical weights in `Route.head` to eliminate font-swap layout shift.
- `[2026-09-01]`: CSS Keyframe Animation Stability -> Staggered CSS animations (e.g. `--animate-fade-in` with `animationDelay: 0.3s`) must use `animation-fill-mode: both` rather than `forwards`. This ensures the element applies the `0%` keyframe state during the initial delay rather than popping abruptly from `translateY(0)` to `translateY(20px)` when the animation begins.
- `[2026-09-01]`: TanStack Start Root Layout Pattern -> Use `shellComponent: RootDocument` in `createRootRoute` rendering `<html lang="en"><head><HeadContent /></head><body>{children}<Scripts /></body></html>`, with `component: RootComponent` rendering providers (`ThemeProvider`, `TooltipProvider`, `Outlet`, `Sonner`). Avoid injecting un-reset inline `<style>` tags in `<head>` that conflict with Tailwind's Preflight resets.
- `[2026-09-01]`: TanStack Hotkeys & Quick Find Architecture -> Integrated `@tanstack/react-hotkeys` with `HotkeysProvider` wrapping the root component tree. Global shortcuts (`Mod+K`, `/`, `Escape`) trigger the accessible Base UI Dialog `CommandPalette` with Fuse.js client-side fuzzy search across sections, legal routes, and theme actions.
- `[2026-09-01]`: Deterministic CSS Asset Naming -> In `vite.config.ts`, configure `assetFileNames` to emit `.css` files as `assets/[name][extname]` (`assets/index.css`, `assets/fonts.css`). This eliminates hash divergence between Client and SSR prerendering environments, preventing 404 MIME type errors in production.
- `[2026-09-01]`: Inline Adaptive SVG Logo Architecture -> Implemented `Logo.tsx` as an inline adaptive SVG component with CSS-switched gradients instead of dual `<img>` tags. This prevents React 19 SSR from generating image preloads for hidden light/dark variants, eliminating browser "preloaded using link preload but not used" console warnings.
- `[2026-09-02]`: Fallow Migration (knip -> fallow) -> Migrated `knip.ts` (`project`, `ignore`, `ignoreDependencies: tailwindcss-animate`) to `fallow.toml` (TOML, `ignorePatterns`, `ignoreDependencies`, `ignoreExportsUsedInFile`, `production=false`, `[rules]`, `[duplicates]`, `[health]`, `[audit] gate=new-only`, `[boundaries] bulletproof`, `[regression.baseline]`). Removed `axe-core`/`jest-axe` (0 imports, `fallow dead-code --trace-dependency`), kept `@tanstack/react-query` (future use) and `tailwindcss`/`react-doctor` (build/lint false positives) via `ignoreDependencies`. Added `tests/*.test.ts` mirroring `src` unit tests and consolidated `test.include` to `src+tests`. Agentic gate: `npx fallow audit --format json --quiet 2>/dev/null` with `0/1=success, 2=error envelope`.
- `[2026-09-02]`: Fallow Agentic Tidy Process -> Use `fallow audit` after each feature, `fallow dead-code --trace <file>:<export>` before deleting flagged exports, `fallow health --hotspots` for refactoring prioritization, and `fallow guard <files>` before editing. CI uses embedded `regression.baseline` with `--fail-on-regression`. See `fallow.toml:1` and `docs/CODING_STANDARDS.md:17`.
- `[2026-09-02]`: TanStack Start Prerender Hang -> `vite build` hung at `Prerendering pages...` for minutes. Root causes: (1) `tanstackStart({ prerender: { crawlLinks: true } })` crawled hash links (`/#features`, `/#quick-start` etc) as separate pages and retried; fix `filter: ({ path: routePath }) => !routePath.includes("#")`. `[2026-09-09]`: same hang from search-param "routes" — chip links (`/?tag=tools` etc) crawled as separate pages; extend the filter to also drop `?` (`!routePath.includes("?")`). Filtered query pages still resolve at runtime (`/` serves them; search state is client-side). (2) `WeatherSection` used `useSearch`/`useWeather`/`useVirtualizer` during SSR — `fetchWeather` hit `open-meteo` on server and `Base UI` virtualizer measured DOM, causing hang; fix `useWeather` `enabled: isClient && ...` + `keepPreviousData` and `WeatherSection` client gate (`isClient` + skeleton) so prerender emits static skeletons only. (3) `vite.config.ts` `manualChunks` still referenced deleted deps (`d3-scale`, `papaparse`, `xlsx`, `html-to-image`) — removed `vendor-parse`/`vendor-export`, kept `d3-shape` for Charts. After fix `pnpm build` prerenders 7 pages in ~0.7s.

## UI Primitives

`src/components/ui/*` holds Base UI + shadcn primitives: `accordion`, `badge`, `breadcrumb`, `button`, `input`, `popover`, `select`, `sonner`, `table`, `tabs`, `tooltip` (plus `button-variants`/`badge-variants`). Dialogs use `@base-ui/react/dialog` directly (no wrapper file). When you need another primitive, re-add the Base UI + shadcn version, not Radix:

```bash
pnpm dlx shadcn@latest add <primitive> --yes
# e.g. pnpm dlx shadcn@latest add alert label scroll-area select separator slider switch tabs textarea --yes
```

Then rewire the generated file from `@radix-ui/*` to `@base-ui/react/*` (see `src/components/ui/dialog.tsx` as reference) and run `pnpm lint` + `npx fallow dead-code --trace src/components/ui/<primitive>.tsx:Export` to confirm no dead code. Fallow is silenced for primitives via `fallow.toml:ignorePatterns` — remove the entry when the file is re-added.

## Working Agreements

- Prefer `edit`/`read`/`grep`/`glob` over shell; use `skill` when a task matches a skill (Humanizer, Cloudflare, etc.).
- Use TanStack Query (`useQuery` + `keepPreviousData`) — no `useEffect` fetch. Use Router search for URL state.
- Run `pnpm lint`, `pnpm format`, `pnpm build` before finishing; check `fallow audit` for dead code.

## useEffect Discipline (2026-09-10)

`useEffect` is a last resort, not a lifecycle tool. Reach for these first, in order:

1. Derive in render / `useMemo` — never sync state with an effect.
2. `on*` props on the element that owns the interaction — a focused dialog's keys bubble through its popup (`CommandPalette.tsx`), no `document.addEventListener` needed.
3. `@tanstack/react-hotkeys` (`useHotkey` + `enabled`) — never hand-roll global keydown listeners.
4. TanStack Query for async data, Router search params for shareable state.
5. Write refs alongside their state setters when every writer is known.

New `useEffect` calls need a justification comment and an entry below. The audited
inventory (all load-bearing, no declarative alternative found 2026-09-10):

- `CommandPalette.tsx:144` — search-input focus timer (dialog focus trap settles after mount; `autoFocus` loses the race).
- `CommandPalette.tsx:154` — `open-command-palette` global event subscription (cross-component signal without prop drilling).
- `NativeShell.tsx` — Capacitor StatusBar/Splash imperative APIs + App back-button and OTA update subscriptions (native bridge, client-only by construction).
- `use-navbar-scroll.ts:50` — IntersectionObserver wiring for scroll state + scroll-spy (imperative browser API).
- `SavedStations.tsx` — unmount mid-drag aborts the gesture listeners (they own no state).
- `RadioHeader.tsx` — search-input focus subscription (`focus-radio-search` event + fine-pointer autofocus on mount; no declarative alternative for cross-component focus).
- `SwipeBack.tsx:81` — back-animator registration/cleanup (subscription by nature).
- `NativeShell.tsx` OTA check — one-shot native boot check with an AbortController-owned fetch (not reactive data; Query would add a subscription lifecycle to a fire-and-forget bridge call).
