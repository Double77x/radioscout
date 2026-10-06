# Scout — Agent Guide

This is the entry point for AI coding agents in this repo. Human docs: `README.md`.

## Read first

Read **all four** of these before any task. They are the contractual and procedural surface of the codebase, and together they are small enough to read every time:

- `docs/standards/CODING_STANDARDS.md` — the rules: hooks, state, performance, a11y, Fallow, comments and docs, plus the standing prohibitions and verification traps in §15
- `docs/standards/STYLE_GUIDE.md` — tokens, layout and motion
- `docs/standards/TECH_STACK.md` — what is installed, and why
- `docs/standards/ARCHITECTURE.md` — the system map: modules, routing and the SSG lifecycle, data flow, native shell

`scripts/check-doc-pointers.js` fails the build if a file lands in `docs/standards/` without appearing in this list, so adding a standard means adding it here.

Everything else is on demand. [`docs/README.md`](docs/README.md) is the map for the rest.

## Project

Scout is a TanStack Start (SSG) starter on Cloudflare Pages — `radioscout.pages.dev`. Type-safe Router + Query, Base UI + shadcn, Tailwind v4, self-hosted Poppins. All routes prerender to `dist/client` and are served as static HTML. The same artifact also ships as an Android APK via Capacitor (`capacitor.config.ts`, `android/`).

## Decision log

One line per decision, oldest first. The full text lives in `docs/lineage.md`: what was chosen, why, and what it cost. That file is append-only and never describes current behaviour, so search it when you need to know `why` something ended up the way it does. Nine of the decisions have a long-form plan, and each entry links to its own from there.

Standing prohibitions and verification traps are not in the log, because they are rules in force rather than history. They live in `docs/standards/CODING_STANDARDS.md` §15.

Append a new entry to `docs/lineage.md` and add its line here. Do not put the reasoning back into this file; that regrowth is what this split exists to prevent.

- 2026-09-01 — TanStack Start CSS & Font Loading Architecture

- 2026-09-01 — Font Metric Matching & Preload Strategy

- 2026-09-01 — CSS Keyframe Animation Stability

- 2026-09-01 — TanStack Start Root Layout Pattern

- 2026-09-01 — TanStack Hotkeys & Quick Find Architecture

- 2026-09-01 — Deterministic CSS Asset Naming

- 2026-09-01 — Inline Adaptive SVG Logo Architecture

- 2026-09-02 — Fallow Migration (knip -> fallow)

- 2026-09-02 — Fallow Agentic Tidy Process

- 2026-09-02 — TanStack Start Prerender Hang

- 2026-09-20 — Stream URL Hygiene + HTTP-only Policy

- 2026-09-23 — HTTP Upgrade Allowlist

- 2026-09-21 — Console-Error Sweep (mixed content + favicon 402 + React #418)

- 2026-09-20 — Launcher Artwork Source of Truth

- 2026-09-24 — F-Droid Build Flavor

- 2026-09-27 — Obtainium Listing

- 2026-09-30 — Vite+ 1.0 Migration

- 2026-10-01 — React Compiler via plugin Oxc transform

- 2026-10-01 — Stream Titles (dock subtitle)

- 2026-10-01 — Edge Caching via Cache API

- 2026-10-01 — Post-Migration Fallout (types + CI)

- 2026-10-02 — Stream titles reach the media session, not just the dock

- 2026-10-02 — Car skip buttons loop Saved favourites

- 2026-10-02 — Native favourites loop (skip that survives lock/doze)

- 2026-10-04 — Car displays that freeze on the first song

- 2026-10-04 — BBC live metadata (tracks for HLS streams)

- 2026-10-04 — BBC titles on the APK

- 2026-10-04 — Artwork proxy chain (third-party cookie fix, client-side only)

- 2026-10-05 — BBC titles missing on APK builds (canonical fallback)

- 2026-10-05 — Song history in the detail sheet

- 2026-10-05 — Vote count alignment (sheet vs rows)

- 2026-10-05 — Song-history duplicates (padding variants)

- 2026-10-05 — Tabbed detail sheet (Info/Recent/Stats)

- 2026-10-05 — Sheet refinements (fixed height, tab memory, compact ages)

- 2026-10-05 — Inline sheet actions (Save/Play/Vote)

- 2026-10-05 — Icon-only sheet actions everywhere

- 2026-10-05 — Primary state colour + pop tween

- 2026-10-05 — Song rollup, live ages, per-station clear

- 2026-10-05 — Filtered-home back arrow

- 2026-10-05 — Colour flavours (Gruvbox, Nord, Sunset, Catppuccin)

- 2026-10-05 — Theme-aware logo tile

- 2026-10-05 — PWA offline pass (web-only)

- 2026-10-05 — F-Droid pipeline failures (schema + rewritemeta + check apk)

- 2026-10-05 — Workers Logs for Pages Functions

- 2026-10-05 — Two-stage leveling + safety limiter (broadcast chain)
- 2026-10-05 — Settle symmetry + silence-budget fixes
- 2026-10-06 — Artwork chain order is a safety decision
- 2026-10-06 — CSP blocked the title socket; `aria-hidden` fought `inert`
- 2026-10-06 — BBC host allowlist: one host added, one deliberately refused
- 2026-10-06 — Leveling trim compounding and volume-slider decoupling
- 2026-10-06 — Unfiltered charts page until full
- 2026-10-06 — R8 shrinking enabled for release builds (F-Droid request)

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
- Run `pnpm lint`, `pnpm format`, `pnpm exec vp run build` before finishing; check `fallow audit` for dead code. Run `pnpm fdroid:check` whenever Android versioning or F-Droid listing metadata changes.
- Before finishing, ask whether your change made a document wrong: behaviour a module doc describes means that doc gets updated in the same change, and a decision or a new constraint means a `docs/lineage.md` entry or a §15 rule. The table is in `docs/standards/CODING_STANDARDS.md` §24.
- Git commits from a non-interactive shell must pass `-m` (or `GIT_EDITOR=true`): `core.editor` is VS Code `--wait`, so a commit without a message waits on an editor tab forever.

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
- `SavedStations.tsx` — unmount mid-drag aborts the gesture listeners (they own no state).
- `RadioHeader.tsx` — search-input focus subscription (`focus-radio-search` event + fine-pointer autofocus on mount; no declarative alternative for cross-component focus).
- `SwipeBack.tsx:81` — back-animator registration/cleanup (subscription by nature).
- `NativeShell.tsx` OTA check — one-shot native boot check with an AbortController-owned fetch (not reactive data; Query would add a subscription lifecycle to a fire-and-forget bridge call).
- `Home.tsx` — `open-home-section` global event subscription (command palette lives outside Home; expands the accordion section before scrolling it into view).
- `RadioHeader.tsx` — search-box draft adoption (URL writes come from typing, chips, clear, back/forward and palette jumps; adopting a still-committing navigation while focused is what yanked the cursor mid-word).
- `StationDetailSheet.tsx` (RecentTracks) — 30s interval re-render so wall-clock song ages stay honest between title banks (time has no reactive source; unmount clears it).
