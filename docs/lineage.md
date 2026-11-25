# Lineage

Append-only decision log, oldest first. One entry per decision: what was chosen,
why, and what it cost.

Read it when you need to know *why* something ended up the way it is. Do not
read it to learn what the code currently does. Current behaviour lives in the
code and in the module contracts under [`modules/`](modules/), and this file
never describes the present, which is exactly what stops the two from
contradicting each other.

## Index

One line per entry, oldest first. `scripts/check-doc-pointers.js` keeps this in
step with the headings below, so an entry without a line here fails the build.

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
- 2026-10-07 — F-Droid review round 2: category, committed config, autoupdate
- 2026-10-17 — Native leveling parity (tap, mono, anchor cadence, glide)
- 2026-10-18 — Tablet-width app frame (600px step, `md` 768px, `xl` 896px)
- 2026-10-18 — Android permission alias could strand playback
- 2026-10-19 — Volume arrow keys on the web dock
- 2026-10-19 — Fresh installs started silent (missing volume key read as 0)
- 2026-10-19 — ICY probe: caller-supplied URLs gated, reads budgeted
- 2026-10-19 — Player dock split out of one 480-line component
- 2026-10-20 — Fallow health pass: probes, drag, store and sheet seams
- 2026-10-20 — APK smoke finds native pause status; device checks become repeatable
- 2026-10-20 — Native release gates: fixture smoke, R8, permission fail-open
- 2026-10-20 — Dependabot cooldown matches pnpm's release age
- 2026-10-20 — Native verification follows native changes
- 2026-10-20 — Android emulator needs KVM, not a longer timeout
- 2026-10-20 — Gradle stays on 8.x until AGP 9
- 2026-10-20 — Hosted runners do not all expose KVM
- 2026-10-20 — Workflow files are checked by actionlint
- 2026-10-20 — A composite action shell is not a workflow shell
- 2026-10-21 — Gates run once, at the end of a task
- 2026-10-21 — Spectrum wings tap the leveling graph
- 2026-10-21 — Spectrum wings: opt-in, primary tint, dBFS reading
- 2026-10-22 — AGENTS.md is rules; the decision index moved beside its entries
- 2026-10-22 — Formatter moves to the pre-commit hook; gates scale with the change
- 2026-10-22 — One verify gate, progressive standards, and a lint rule for effects
- 2026-10-23 — Spectrum wings: width sets the bands, paint reuses its skin
- 2026-10-23 — One gate includes e2e, and the hook runs unit tests
- 2026-10-23 — Pre-commit runs both test suites
- 2026-10-29 — F-Droid review round 3: ask once, overlays own back
- 2026-11-12 — Dependency refresh: age-gated, PRs superseded
- 2026-11-15 — Best of British: Capital swap and a reach-led expansion
- 2026-11-16 — Drops are three shapes: loud, silent, and a clean close
- 2026-11-17 — A silent drop cost 18.7s of audible silence
- 2026-11-20 — A stall is judged by the playhead, not by the event
- 2026-11-21 — Lyrics overlay from LRCLIB (web, opt-in)
- 2026-11-21 — Lyrics timing: anchored cursor, tighter probe, nudge
- 2026-11-21 — Lyrics without a cursor: the whole song in the station sheet
- 2026-11-21 — Lyrics section: collapsed until opened, titles required
- 2026-11-21 — Lyrics moved onto the live row in the Recent tab
- 2026-11-21 — Lyrics as stanzas, and the row width that overflowed
- 2026-11-21 — LRCLIB identification, serial requests, Retry-After honoured
- 2026-11-21 — Bracket lyric lines italic, skeleton while lyrics load
- 2026-11-25 — Listening average rows name the sample, not a time share
- 2026-11-25 — Listening stats read (station, day) rollups, not the session log
- 2026-11-25 — Flavour palettes brought to WCAG AA
- 2026-11-25 — OTA publish survives a re-run

## How this fits the other docs

Current truth has two homes: the code, and the module contract its file header
points to. History lives here or in a plan under [`plans/`](plans/). The
standards are for rules that are in force right now.

- **Standing prohibitions** are not here. The few rules that will damage the
  repo if ignored are current constraints, so they live in
  [`standards/CODING_STANDARDS.md`](standards/CODING_STANDARDS.md) where every
  task reads them.
- **A decision with a deep dive links to it.** Nine of the larger ones have a
  plan; the rest stand alone.
- **Entry text is never edited.** A later decision appends a new entry, and if
  it reverses an older one it says so. Append-only is the safety property: a
  record nobody rewrites cannot end up disagreeing with itself.

## Adding an entry

Append at the end as `### YYYY-MM-DD · Title`, body underneath. Newest last,
which keeps the file diffable.

### 2026-09-01 · TanStack Start CSS & Font Loading Architecture

Use `import fontsCss from "@/styles/fonts.css?url";` and `import indexCss from "@/styles/index.css?url";` in `src/routes/__root.tsx` and pass them into `Route.head({ links: [{ rel: "stylesheet", href: fontsCss }, { rel: "stylesheet", href: indexCss }] })`. Side-effect CSS imports (`import "@/styles/index.css"`) are treated by Vite/TanStack Start as async client bundle chunks rather than render-blocking `<head>` resources, causing severe FOUC where elements start smaller in fallback fonts and pop to full size upon hydration.

### 2026-09-01 · Font Metric Matching & Preload Strategy

Self-host Poppins font weights (`300`, `400`, `500`, `600`, `700`) in `public/fonts/` with `font-display: swap` and a metric-adjusted fallback (`Poppins Fallback` on `local("Arial")` with `size-adjust: 98.5%`, `ascent-override: 105%`, `descent-override: 35%`, `line-gap-override: 0%`). Preload all critical weights in `Route.head` to eliminate font-swap layout shift.

### 2026-09-01 · CSS Keyframe Animation Stability

Staggered CSS animations (e.g. `--animate-fade-in` with `animationDelay: 0.3s`) must use `animation-fill-mode: both` rather than `forwards`. This ensures the element applies the `0%` keyframe state during the initial delay rather than popping abruptly from `translateY(0)` to `translateY(20px)` when the animation begins.

### 2026-09-01 · TanStack Start Root Layout Pattern

Use `shellComponent: RootDocument` in `createRootRoute` rendering `<html lang="en"><head><HeadContent /></head><body>{children}<Scripts /></body></html>`, with `component: RootComponent` rendering providers (`ThemeProvider`, `TooltipProvider`, `Outlet`, `Sonner`). Avoid injecting un-reset inline `<style>` tags in `<head>` that conflict with Tailwind's Preflight resets.

### 2026-09-01 · TanStack Hotkeys & Quick Find Architecture

Integrated `@tanstack/react-hotkeys` with `HotkeysProvider` wrapping the root component tree. Global shortcuts (`Mod+K`, `/`, `Escape`) trigger the accessible Base UI Dialog `CommandPalette` with Fuse.js client-side fuzzy search across sections, legal routes, and theme actions.

### 2026-09-01 · Deterministic CSS Asset Naming

In `vite.config.ts`, configure `assetFileNames` to emit `.css` files as `assets/[name][extname]` (`assets/index.css`, `assets/fonts.css`). This eliminates hash divergence between Client and SSR prerendering environments, preventing 404 MIME type errors in production.

### 2026-09-01 · Inline Adaptive SVG Logo Architecture

Implemented `Logo.tsx` as an inline adaptive SVG component with CSS-switched gradients instead of dual `<img>` tags. This prevents React 19 SSR from generating image preloads for hidden light/dark variants, eliminating browser "preloaded using link preload but not used" console warnings.

### 2026-09-02 · Fallow Migration (knip -> fallow)

Migrated `knip.ts` (`project`, `ignore`, `ignoreDependencies: tailwindcss-animate`) to `fallow.toml` (TOML, `ignorePatterns`, `ignoreDependencies`, `ignoreExportsUsedInFile`, `production=false`, `[rules]`, `[duplicates]`, `[health]`, `[audit] gate=new-only`, `[boundaries] bulletproof`, `[regression.baseline]`). Removed `axe-core`/`jest-axe` (0 imports, `fallow dead-code --trace-dependency`), kept `@tanstack/react-query` (future use) and `tailwindcss`/`react-doctor` (build/lint false positives) via `ignoreDependencies`. Added `tests/*.test.ts` mirroring `src` unit tests and consolidated `test.include` to `src+tests`. Agentic gate: `npx fallow audit --format json --quiet 2>/dev/null` with `0/1=success, 2=error envelope`.

### 2026-09-02 · Fallow Agentic Tidy Process

Use `fallow audit` after each feature, `fallow dead-code --trace <file>:<export>` before deleting flagged exports, `fallow health --hotspots` for refactoring prioritization, and `fallow guard <files>` before editing. CI uses embedded `regression.baseline` with `--fail-on-regression`. See `fallow.toml:1` and `docs/standards/CODING_STANDARDS.md:17`.

Deep dive: docs/standards/CODING_STANDARDS.md

### 2026-09-02 · TanStack Start Prerender Hang

`vite build` hung at `Prerendering pages...` for minutes. Root causes: (1) `tanstackStart({ prerender: { crawlLinks: true } })` crawled hash links (`/#features`, `/#quick-start` etc) as separate pages and retried; fix `filter: ({ path: routePath }) => !routePath.includes("#")`. `[2026-09-09]`: same hang from search-param "routes" — chip links (`/?tag=tools` etc) crawled as separate pages; extend the filter to also drop `?` (`!routePath.includes("?")`). Filtered query pages still resolve at runtime (`/` serves them; search state is client-side). (2) `WeatherSection` used `useSearch`/`useWeather`/`useVirtualizer` during SSR — `fetchWeather` hit `open-meteo` on server and `Base UI` virtualizer measured DOM, causing hang; fix `useWeather` `enabled: isClient && ...` + `keepPreviousData` and `WeatherSection` client gate (`isClient` + skeleton) so prerender emits static skeletons only. (3) `vite.config.ts` `manualChunks` still referenced deleted deps (`d3-scale`, `papaparse`, `xlsx`, `html-to-image`) — removed `vendor-parse`/`vendor-export`, kept `d3-shape` for Charts. After fix `pnpm build` prerenders 7 pages in ~0.7s.

### 2026-09-20 · Stream URL Hygiene + HTTP-only Policy

radio-browser rows can carry playlist junk (`...aac??direct=true&...%20#EXTINF:0,...` — doubled `?` + fused M3U line, upstream data corruption). `sanitizeStreamUrl()` in `src/lib/radio/types.ts` strips it (EXTINF cut, whitespace/fragment cut, `??` collapse); wired into `pickPlayableUrl()`, `isHlsUrl()`, and `resolveUrl()` in `src/hooks/use-player.ts` so stored favourites benefit too. Legacy `http://stream-*.planetradio.co.uk` edges abort TLS (`ERR_SSL_PROTOCOL_ERROR`); removed `upgrade-insecure-requests` from `public/_headers` (it laundered mixed-content blocks into misleading SSL errors — and never applied in the APK WebView anyway), and `use-player.ts` now names HTTP-only failures explicitly (`isInsecureHttpStream()` + `https:` page check) instead of the generic offline message. Discovery lists (`search`/`topvote`/`topclick` in `api.ts`) drop unplayable rows via `filterPlayableStations()` (`isPlayableStreamUrl()`: non-empty `https://` only) so every visible station can load; favourites/history keep saved rows (tapping explains why). Chrome auto-upgrades `http://` subresources itself regardless of CSP, and there is no `https` twin for main Absolute in the directory — `http://`-only stations stay unplayable without the Media3 service — see `docs/plans/NATIVE_AUDIO_PLAN.md`.

Deep dive: docs/plans/NATIVE_AUDIO_PLAN.md

### 2026-09-23 · HTTP Upgrade Allowlist

`url_resolved` can't prove TLS (verified live: BBC HLS has `http` in both `url` and `url_resolved` with `lastcheckok: 1` — the https upgrade happens client-side). `src/lib/radio/types.ts` now has an exact-host `HTTPS_UPGRADE_HOSTS` allowlist (`as-hls-ww-live.akamaized.net` first entry): `canonicalStreamUrl()` sanitizes then rewrites `http→https` for those hosts only; `pickPlayableUrl()` and engine `resolveUrl()` (local + fresh `/json/url/` remote) both use it, so discovery keeps BBC-style rows while unverified HTTP still drops. Blind scheme-swaps on unknown hosts stay out (they surface as misleading TLS errors); engine failure verdicts use `isPolicyBlockedHttp()` so upgraded hosts get the generic message, not the insecure-HTTP one. No probing at discovery (CORS + hundreds of rows) — verification is one request per tap at playback. No `network_security_config` change: canonical https needs no cleartext (unlike Dance Wave's https→http downgrade). Verify a candidate by loading its https variant directly before adding its exact host.

### 2026-09-21 · Console-Error Sweep (mixed content + favicon 402 + React #418)

`upgradeInsecureUrl()` in `src/lib/radio/types.ts` rewrites `http://` to `https://` when the page is secure (no-op on `http` dev pages and SSR); applied in `StationArt` (favicons + `referrerPolicy='no-referrer'`), web `<audio>` src and MediaSession artwork in `use-player.ts` (native Media3 path keeps the original URL — it plays HTTP fine). This silences the per-image / per-HLS-segment mixed-content warnings. `reyfm.de/icon.png` 402 is upstream (`X-Vercel-Error: DEPLOYMENT_DISABLED`) — unfixable client-side, the art fallback covers it. Hydration hardening with the existing `useIsClient` gate: `SavedStations` prerenders the skeleton (not the empty state), `RadioHeader`/`Home` render default search UI until mount (direct `/?q=`/`?tag=` loads would otherwise mismatch chips/results → #418), `sonner.tsx` pins theme to `system` until mount (next-themes reads localStorage during hydration while SSR used the default). Follow-up: quick-resume stores the last station, so `use-player` now uses a static idle `getServerSnapshot` (hydrating a stored station over "Nothing playing" markup would #418 every returning user) and `toggle()` no longer gates on the audio element existing (the row play button was dead on fresh loads). A lone #418 on plain `/` with default state did NOT reproduce (fresh + stored-dark-theme Playwright runs are clean) — prime suspects are a browser extension touching the DOM pre-hydration or a stale-deploy HTML/JS skew; capture the full dev-mode error text to confirm.

### 2026-09-20 · Launcher Artwork Source of Truth

the APK icon rendered dark-on-dark because `scripts/generate-native-assets.mjs` rasterizes `public/logo.svg` via sharp, which ignores the `prefers-color-scheme` query — so the adaptive (dark-default) mark baked as `#3a3a3a` on the `#171717` tile, while the live `Logo.tsx` is always silver. `scripts/generate-icons.mjs` now also emits a silver-always `svgIcon` variant (`MARK_DEFS_SILVER`, no scheme query — pixel-identical paths to `Logo.tsx`) as `logo.svg`/`logo-dark.svg`; `favicon.svg` + PNGs stay adaptive (the favicon scheme test requires distinct light/dark renders). Splash moved to the dark tile (silver needs the dark field). Regen: `node scripts/generate-icons.mjs` (revert favicon/PNG churn — committed files predate the script) then `pnpm cap:assets`.

### 2026-09-24 · F-Droid Build Flavor

`VITE_DISTRIBUTION=fdroid` gates both store-bypassing update paths: `runOtaUpdateCheck()` returns before any Capgo contact in `NativeShell.tsx`, and `checkApkUpdate()` returns before install inspection or GitHub access, so the existing dialog never receives an update. `pnpm fdroid:check` enforces `package.json` ↔ committed Gradle `0.3.7`/`307` plus Fastlane listing limits/assets. Never run `git sparse-checkout` in this app checkout to obtain fdroidserver files: it hides tracked files behind skip-worktree while status can look clean. Clone fdroidserver separately; recipe/validation lives in `docs/plans/FDROID_PLAN.md`.

Deep dive: docs/plans/FDROID_PLAN.md

### 2026-09-27 · Obtainium Listing

Obtainium is a pull-based client, not a store, and it reads `/releases` (the `/tags` path is track-only, for repos with no releases at all). `release-apk.yml` already publishes everything it needs on every `v*` tag: universal APK, one stable keystore, `targetSdk` 36, monotonic `versionCode`, and a tag whose version matches what Android reports. **There is no Obtainium workflow and no Obtainium tag, deliberately** — the listing config is static (no version, just a pointer at the repo), so a sync job wrote byte-identical JSON after the first run and only cost a standing write-scoped PAT to a third-party repo. An extra tag would be worse: a second release carrying a duplicate of the same APK at the same version is a version tie, and every Obtainium selection lever (`includePrereleases`, `filterReleaseTitlesByRegEx`, `filterReleaseNotesByRegEx`, `apkFilterRegEx`) is config-side, so no tag can tell it what to pick. The only artefact is `distribution/obtainium/*.json`, submitted by hand to the `simple/` bucket, which needs **no** `additionalSettings`: `fdroid-reference.yml` marks its reference APK `prerelease: true`, so `includePrereleases: false` (the default) skips it and the F-Droid flavor can never reach a sideload user. That flag is what replaced the old `apkFilterRegEx`. Never enable `includePrereleases` on this config (comment at the `--prerelease` line in `scripts/publish-ota.mjs` and §4.2 of the plan). `description.en` reuses `fastlane/.../short_description.txt` verbatim, and `pnpm obtainium:links --check` fails if the two drift; the same command generates the README deep link, whose percent-encoding embeds `name`/`author` and rots on a rename. The README badge lives in `image/README/`, not `public/`, so it never reaches `dist/client` or the APK. The badge is pre-cut to 107x32 because GitHub strips `width`/`height` from README images and natural size is what renders; the markdown uses plain image syntax with a reference link, keeping the deep link out of the heading. Audit lives in `docs/plans/OBTAINIUM_PLAN.md`.

Deep dive: docs/plans/OBTAINIUM_PLAN.md

### 2026-09-30 · Vite+ 1.0 Migration

Manual migration (`vp migrate` not attempted after the JSON-config crash seen elsewhere): pins (`.node-version` 26.8.2, `packageManager` pnpm@12.8.1, wrangler NODE/PNPM, Vite+ + TanStack release-age carve-outs), `vite`/`vite-plus` via `catalog:`, 38 test imports to `vite-plus/test`, lint/format moved 1:1 into `toolchain.config.ts` (JSONC with comments, parity verified mechanically), test block already in `vite.config.ts`, cached `build` task (`vp build && tsc -b && sitemap && header-policy`; `pnpm build`/`postbuild` scripts removed, `cap:android`, `publish-ota.mjs`, the three native workflows and `docs/plans/FDROID_PLAN.md` all moved to `pnpm exec vp run build`), groups API already native, `assetInfo.name` (deprecated) replaced with `names.some(...)`. TanStack pair bumped together to the fleet-proven set (Router 1.170.40 + Start 1.168.59 + plugin 1.168.41, all exact): the lockfile had floated Router to 1.170.39, which drops the SSR API Start 1.168.53 calls (`takeInitialHydrationScriptTags is not a function`, prerender 500 on every page). Type-aware lint to zero with the two measured `overrides` off; two dead overrides (`garage/VehicleCard`, `finder/LocationSearchForm`) removed. Two real bugs fixed: `publish-ota.mjs` shelled `pnpm build` (would always fail post-migration) and several fire-and-forget promises (`SettingsMenu`/`StationDetailSheet`/`RadioHeader`/`PlayerDock`/`CommandPalette` invalidations, navigations and toasts) now use `void`. Scripts and `netlify`-less functions claimed by `tsconfig.node.json` with `allowJs` + `checkJs`. Oxlint renderer panics on parenthesised JSDoc casts (`/** @type {X} */ (expr)`) — narrowed with predicates and declaration-form annotations instead; `scripts/publish-ota.mjs` documents the shape. `generate-icons.mjs` KEPT (single artwork source for `cap:assets`, unlike the deleted one-offs elsewhere). `vite-plugin-pwa` deliberately installed-but-unwired (roadmap offline pass). Gates: `tsc -b` clean, `vp lint` 0/0, `vp fmt --check` clean, 37 files / 233 unit pass, `vp run build` prerenders 9 pages, fallow exit 0.

Deep dive: docs/plans/FDROID_PLAN.md

### 2026-10-01 · React Compiler via plugin Oxc transform

`react({ compiler: true })` + `oxc-transform-react` 0.151.0 (fallow-ignored, loaded by name), option-free per fleet precedent. No `??=` in src, so nothing to avoid; full `vp run build` green with `memo_cache` slots in 13 chunks (9 pages, entry stub unchanged).

### 2026-10-01 · Stream Titles (dock subtitle)

Web probes the station StreamTitle through `GET /api/icy-title` (dev middleware, edge function, direct fetch last and only on transport failure), polling every 45s against a 60s TTL; opt-in via Settings Audio, hidden on native. `TrackTicker` scrolls long subtitles on compact screens only. Native titles attach to the session ExoPlayer itself (`RadioPlaybackService` registry, re-attached across crossfade swaps) because timed metadata never crosses the MediaController boundary (no binder path in the Media3 1.9 session protocol, verified against the cached AAR) — a controller listener is deaf by framework design. Detail in `docs/plans/STREAM_TITLES.md`.

Deep dive: docs/plans/STREAM_TITLES.md

### 2026-10-01 · Edge Caching via Cache API

`Cache-Control: public, max-age=60` alone does not get Pages Function responses edge-cached (verified live: repeats re-probed upstream with no `cf-cache-status`). `functions/api/icy-title.ts` stores success verdicts explicitly with `caches.default.put` keyed on the full request URL; errors bypass. Verify live by comparing full bodies (`at` identical) plus MISS/HIT timings, not headers alone — deterministic error bodies look cached. Covered by `tests/unit/icy-title-function.test.ts` (hit without re-probe, errors never stored, direct probe with no Cache API).

### 2026-10-01 · Post-Migration Fallout (types + CI)

`vite` now resolves to vite-plus-core, which ships no `client` types, so the `vite-env.d.ts` reference went dead (`ImportMeta.env` untyped). Sanctioned `src/types/shims.d.ts` declares `env` instead, included in `tsconfig.node.json` too because functions share `src` modules (the error surfaced there first). CI: all four workflows pinned `pnpm/action-setup` to pnpm 10 against `packageManager` pnpm@12.8.1 (multi-version abort on tag builds); the `version:` inputs are deleted so the action follows `packageManager`. Tag builds check out the workflow from the tagged commit, so the `v0.3.7` tag had to move to the fix commit (force-pushed; the failed run produced no release).

### 2026-10-02 · Stream titles reach the media session, not just the dock

a Bluetooth car showed the app name, station and tags but never a song: ICY titles reached only `snapshot.track`, while every car/lock-screen/Auto surface reads the session metadata that `play` freezes at `startPlay` (title = station name, artist = tags). Both engines now republish on a title — APK: `RadioPlaybackService.publishTrackTitle` from the `metadataListener`, web: `updateMediaSession(station, handlers, track)` from `engine.ts` — with the song in the title slot and the station moved to artist, so no surface prints the station twice. Native side uses `Player.replaceMediaItems`, **not** `setMediaItem`: verified against media3-exoplayer 1.9.0 that only `replaceMediaItems` consults `MediaSource.canUpdateMediaItem` (playback identity only — URI plus source-specific config — metadata-blind), which hands the new item to the source already loading; `setMediaItem` builds a fresh source and re-reads the stream, i.e. a rebuffer per track change. Two verified API facts in that same AAR audit: `Player.Listener` declares only the legacy `onMetadata(Metadata)` (no `(Player, Metadata)` overload — `javap` it before changing that signature), and the player reference lives in the service, so metadata mutation belongs there, not on the plugin. Skipped mid-handoff (the retiring item is still on display). Logcat pair to check on device: `track:` (decoded) vs `session title:` (published).

### 2026-10-02 · Car skip buttons loop Saved favourites

steering-wheel next/previous did nothing: the session never advertised `SEEK_TO_NEXT/PREVIOUS`, so the stub rejected them with NOT_SUPPORTED before any callback ran (verified in `MediaSessionStub` bytecode). `RadioPlaybackService` now carries a session `Callback`: `onConnect` augments the default accepted commands with both seeks (defaults rebuilt via `AcceptedResultBuilder`, not hand-rolled), and `onPlayerCommandRequest` forwards to a static `SkipListener` set (same split as `trackUpdate` — the one-item live playlist has nothing to seek to, so the web layer owns the switch). Return-0-means-allow verified in the stub dispatch (non-zero is a SessionResult error code that rejects); the player no-ops the seek while the bridge event drives the real switch. Plugin registers its skip listener in `load()` (session-level, survives crossfade swaps; the static set remembers it pre-service), emitting `skipNext`/`skipPrevious` events the engine subscribes alongside status/title. Engine `skipFavourite` steps the full Saved order via pure `favouriteLoopTarget` (`native-bridge.ts`, unit-tested: wraps both ends, starts at head from idle/outside, silent under two saved) and `play()`s the target snapshot; per the user's calls, idle skip starts Saved #1 and under-two-saved is a silent no-op. Web `MediaSession` gains `nexttrack`/`previoustrack` handlers on the same function, so web Bluetooth and media keys loop favourites too, and the shade/notification gains skip buttons once the commands are advertised. No bridge signature changes, no new permissions. Logcat: `skip next` / `skip previous`.

### 2026-10-02 · Native favourites loop (skip that survives lock/doze)

device report: skip worked briefly, then buttons VANISHED from lockscreen/widget on certain stations (audio kept playing, persisted unlocked). Root cause, verified in AAR bytecode: notification/lock-screen buttons are built from the _player-level_ dynamic commands (`DefaultMediaNotificationProvider` reads `Player.getAvailableCommands()`), where `Util.getAvailableCommands` grants SEEK_TO_NEXT only on `hasNext || (live && dynamic)` — a single-item playlist has no next, so per-station timeline flags decided the buttons, and our session-level `onConnect` augmentation never reached those surfaces. The web-driven forward also dies when the WebView suspends under lock. Fix: the service now owns a genuine multi-item favourites loop — every `play()` ships the full Saved order (`buildSkipPlaylist`, current at index, outsider prepended, repeat-all) via `setMediaItems`, so `hasNext`/`hasPrevious` hold at every position and buttons stay put on every station; presses execute natively with zero WebView involvement. Web follows via a `stationChange` bridge event (controller `onMediaItemTransition`, which unlike `onMetadata` crosses the binder) plus a foreground resync (`currentStation` polled on `appStateChange`) and gapless `syncPlaylist` surgery (remove-gone, move-audible-home, insert-new) refreshed on every Saved edit. Web `<audio>` keeps the old `skipFavourite` path. Two regressions caught locally: the playlist read must not gate the web play chain (IndexedDB stalls under mocked timers — build it only when native), and `stop()` parks `usingNative=false` (earlier skip gating would have eaten idle presses). Old OTA shells send no playlist and fall back to the legacy single item. Follow-up from device logs: every song published twice ~0.8s apart (ICY repeats re-published because each publish re-transitioned and the transition reset cleared the dedupe lock), proving `evaluateMediaItemTransitionReason` returns PLAYLIST_CHANGED on equal window UIDs plus a changed timeline — our own metadata replaces echo as transitions, and the unconditional reset undid every live publish (car pinned on station/station, dock correct). `onMediaItemTransition` now skips same-id echoes via `lastTransitionMediaId`; only a genuinely new item resets and notifies. Next release: 0.3.9 (v0.3.8 already tagged — tags don't move).

### 2026-10-04 · Car displays that freeze on the first song

device report: the notification/lock-screen title updated live, a Bluetooth car kept the first song. Ruled out the app by reading `adb shell dumpsys media_session` on the connected device: `metadata: size=11, description=<song>, <station>, RadioScout` tracked two song changes, so `publishTrackTitle` -> `replaceMediaItems` -> `getMediaMetadata()` -> `MediaSessionLegacyStub$ControllerLegacyCbForBroadcast.updateMetadataIfChanged()` -> `MediaSessionCompat.setMetadata` -> platform session (all verified in the 1.9.0 AAR; the notification reads the same `Player.getMediaMetadata()`, which is why the two surfaces can only diverge after the platform call). Cause is the sink: androidx/media#430 — an AVRCP-era car console "only updates when the player state changes", reproduced with the stock Media3 demo; a live stream has no track boundary, and Media3's `MediaSession` has no `setMetadata` (absent in 1.9.0) to force the push the old ExoPlayer connector had. Settings -> Audio -> _Refresh car display_ (APK only, off by default) re-seeks to the current position on each published title, which re-pushes the platform `PlaybackState` (`onPositionDiscontinuity` -> `updateLegacySessionPlaybackState`; `onVolumeChanged` is not wired to it, so a volume nudge cannot). Opt-in because a seek can rebuffer — the warning lives in `CarRefreshSwitch` copy, and the flag is persisted (`radioscout:car-refresh`), passed on every `play`, and mirrored into the service static on each connect so a restarted service picks it up. Logcat: `car display nudge at <ms>`.

### 2026-10-04 · BBC live metadata (tracks for HLS streams)

BBC HLS carries no ICY blocks and RMS sends browsers no CORS headers, so titles come from the RMS JSON feeds (credit: simonprickett/pico-display-pack-2-radio-whats-on) via a new edge function `GET /api/bbc-title` (30s Cache API TTL) plus a dev-only `/__bbc/probe` middleware — the client only polls our endpoint. No station list to maintain: the service id is read out of the station row (homepage, then stream URLs). Segments feed `Artist - Track` when now-playing/fresh, else the broadcasts feed gives the on-air programme (verified live: `limit=200` + offset paging — Radio 4's window runs to 134 entries — and nearest-to-now selection, since `on_air` flags lag). Polling is one adaptive timeout chain per play (`bbcNextPollDelayMs`, unit-tested): tracks 30s, programmes back off to the `end`-aligned one-shot (+10s buffer) or a 3-minute net. Detail sheet gains a Tracks row (Sounds live page) for BBC stations next to Website. Detail in `docs/plans/STREAM_TITLES.md`.

Deep dive: docs/plans/STREAM_TITLES.md

### 2026-10-04 · BBC titles on the APK

the RMS probe never armed on native (it required the web-only titles switch) and nothing forwarded web titles into the service, whose session metadata only the ExoPlayer metadata listener fed. Fix: BBC feeds probe unconditionally (globally cached edge verdict, raw ICY stays opt-in/bridge-driven) and changed titles ride a new one-way `updateTrack` bridge method into the existing `publishTrackTitle` path — shared `lastTrack` dedupe, same mid-handoff skip, no ExoPlayer/ICY changes. Verified: lint/308 unit/fallow/build green plus a local `:app:compileDebugJavaWithJavac`.

### 2026-10-04 · Artwork proxy chain (third-party cookie fix, client-side only)

a plain `<img>` without `crossorigin` fetches with credentials `include`, so every station favicon host could read and write its cookies — measured live at 15 of 33 Best of British rows setting cookies (`.cnn.com` OneTrust sets, TuneIn CDN IDs). No client-side purge exists (`document.cookie`/`Clear-Site-Data` are origin-scoped), and `crossorigin="anonymous"` was rejected by measurement (60% of 70 directory hosts send no ACAO — art would blank). Fix is `src/lib/radio/artwork.ts`: DuckDuckGo `iu/` proxy primary (policy explicitly covers image proxying with no IP logging), wsrv.nl fallback (verified 32/32 preserved, rasterises the SVG DDG 400s; DDG failure is a non-2xx so `onError` failover is sound). DDG answers a refusal with a **decodable 260x180 SVG placeholder** and a 400 status — Chrome fires `load` and no `error`, so an `onError`-only chain never advances and the placeholder stays on screen (measured: 14 stuck placeholders in Most loved before the fix). `isDdgPlaceholder()` (exact dimensions — 86 live favicons measured, none 260x180 and none sharing its 1.444 aspect, so it cannot misfire on wide logos) is tested in `onLoad` AND in the ref callback at commit, because a cached instant decode resolves before React registers its listeners. Never gate that test on `stage`: an HTTP-cache hit can serve the decoded placeholder to the wsrv attempt. `StationArt` walks DDG → wsrv → lucide tile; MediaSession artwork (`native-bridge.ts`, `engine.ts` native play/playlist paths) uses the same builder ordered DDG-first. wsrv takes the full source URL including scheme (scheme-stripped defaults to plain HTTP and fails on TLS-only ports — caught live on the WALM `:8443` rows, which regressed to tiles until fixed; re-verified 32/33 BoB favicons after). `img-src` in `public/_headers` names exactly the two proxy hosts, so a future direct load fails loudly instead of leaking quietly. Own `/api/art` edge proxy remains the end state (kills the IP leak too); this chain is the zero-Workers stopgap and the swap is a one-line `src` change. Tests: `tests/unit/artwork-proxy.test.ts`.

### 2026-10-05 · BBC titles missing on APK builds (canonical fallback)

`refreshBbcTitle` in `src/lib/player/engine.ts` built its edge URL from `VITE_CANONICAL_URL` alone, which no APK build bakes in (CI sets no Vite env; `wrangler.toml [vars]` never reach the client bundle), so the endpoint stayed `null` and BBC probes never left the device while web worked. The native path now falls back to the hardcoded `siteConfig.url` (same pattern as `shareStation` for `capacitor://` origins; empty env counts as unset). Publish gate, ICY fallback and service code untouched — enrichment only, no playback behaviour changes. Detail in `docs/plans/STREAM_TITLES.md`.

Deep dive: docs/plans/STREAM_TITLES.md

### 2026-10-06 · CSP blocked the title socket; `aria-hidden` fought `inert`

Two prod console errors, both from the same mistake class — a mechanism was assumed to cover ground it doesn't.

The Radiolise push socket (`wss://backend.radiolise.com/api/data-service`) was blocked on every play. `connect-src` carried `https:`, which reads like it covers WebSockets; it does not. CSP scheme matching upgrades `http:` to `https:` and `ws:` to `wss:`, but `https:` never widens to `wss:` — so the socket needs its own scheme source. `public/_headers` now lists `wss://backend.radiolise.com` explicitly. Symptom was silent by design (the code already treats an unavailable socket as "fall back to polling"), so the whole push tier of the chain had been dead in prod while the REST tier carried titles alone. Adding a WebSocket means adding a `wss://` origin here, not just an `https:` one.

The dock volume overlay set both `inert` and `aria-hidden` on the same subtree. `inert` already removes content from the accessibility tree and blocks focus, so `aria-hidden` was pure duplication — and the active duplication, because React applies both in one commit: `aria-hidden` lands while the panel's own slider still holds focus, and Chrome refuses the attribute (a11y warning, element stays exposed). Dropping `aria-hidden` fixes the warning. Separately, closing the overlay now returns focus to the volume trigger — `inert` would otherwise drop a keyboard user on `<body>`, and the auto-hide timer fires with no click to move focus. `closeOverlay` tests both panels (each is viewport-gated by CSS, so both are mounted and either can hold focus) rather than assuming the wide one is the ref that got set.

Found while verifying the header fix: `scripts/apply-header-policy.js` built the deployed `_headers` from the copy already sitting in `dist/client`, falling back to `public/_headers` only when that copy was absent. The postbuild step was therefore self-referential — a stale `dist/` from any earlier build shadowed the source, so a policy edit rebuilt into the very policy it was meant to replace. It passed review because CI builds from a fresh checkout (`dist/` is untracked) and got the right answer by accident. The script now always derives the file from `public/_headers`, which makes it idempotent by construction and drops the marker guard it needed for the other behaviour. The trap and both root causes are now §15 rules rather than only history.

Deep dive: none — both fixes are local and the reasoning fits here.

### 2026-10-06 · BBC host allowlist: one host added, one deliberately refused

Chasing the mixed-content warnings surfaced the inverse bug: `filterPlayableStations` drops any row that is not `https` after canonicalisation, so a BBC row on a host missing from `HTTPS_UPGRADE_HOSTS` is invisible in search and Most loved. Live data had 8 BBC names vanishing entirely, including BBC Afrique Radio (6,026 votes) and BBC Arabic Radio (4,572) on `a.files.bbci.co.uk`, plus BBC World Service News Internet on `as-hls-ww.live.cf.md.bbci.co.uk`. The curated Best of British shelf was never affected — `best-of-british.ts` deliberately lists the Akamai rows, and its own comment says so.

Added `as-hls-ww.live.cf.md.bbci.co.uk`: verified by loading the https variant, `200` with a valid playlist and **relative** `.ts` segments, so the upgrade carries through.

Refused `a.files.bbci.co.uk`, which is the trap this whole class of warning comes from. Its https variant also answers `200`, but it serves a **master** playlist whose variant lines are absolute `http://as-hls-ww-live.akamaized.net/...`. Allowlisting it would upgrade only the master; the demuxer would then follow the body to http variants and log a mixed-content warning per variant and per segment — precisely the noise being removed. It also explains the original report: master over https (silent), then http variants and their segments warning, which is why the log showed variants but never the master. Verified the allowlisted host cannot do this: all 12 Akamai BBC rows are media playlists with relative refs. So `filterPlayableStations` is screening out the exact shape that produces the warning, not over-filtering by accident.

That leaves Afrique/Arabic on their discovery-ranking problem rather than a playability one — their audio is available on the Akamai rows, so those stations need the Akamai row to win the name-dedupe instead. Not done here; it changes what search returns and deserves its own change.

Deep dive: none — the verification steps are in the §15 trap.

### 2026-10-05 · Song history in the detail sheet

heard titles bank per station into a new Dexie `tracks` table (schema v3, 50 per station / 1000 global caps) and surface as a Recent tracks section with relative times (BBC programmes get a Show badge). Banking rides the two existing title funnels — probe `applyProbedTitle` (BBC verdict kinds, ICY otherwise) and the APK `onNativeTrackUpdate` bridge — fire-and-forget with query invalidation, playback untouched. Backup envelope goes to v7 (v6 restores default to empty); clearing history clears tracks. Two traps caught: query loaders must stay curried `(id) => () => promise` (a bare promise collapses inference to `never`, which tsc 7 accepts but the oxlint gate rejects), and per-station order uses auto-increment `id`, not wall-clock stamps (same-ms ties). Detail in `docs/plans/STREAM_TITLES.md`.

Deep dive: docs/plans/STREAM_TITLES.md

### 2026-10-05 · Vote count alignment (sheet vs rows)

the sheet bumped only its own detail cache then refetched the lists, whose server counts lag a vote by minutes — so the row snapped back behind the sheet's +1 (Saved/history snapshots never updated at all). New `bumpCachedVotes` in `src/lib/radio/votes.ts` applies the optimistic +1 to every cache that renders the count (detail, top/search lists, favourites/history snapshots) with deliberately no invalidation; the server converges on the next natural refetch (`refetchOnWindowFocus` is off). Tests: `tests/unit/radio-votes.test.ts`.

### 2026-10-05 · Song-history duplicates (padding variants)

stations re-send the same StreamTitle every few seconds with varying padding, and the probe funnel stored `raw` untrimmed while deduping by string equality — so every repeat banked ("Song", "Song " render identically but never match). New `normaliseTrackTitle` (trim + whitespace collapse) applied at both funnels, a consecutive-dupe guard in `logTrack`, and read-time collapse of consecutive normalised dupes so already-banked rows merge. Tests: +3 in `tests/unit/radio-song-history.test.ts`.

### 2026-10-05 · Tabbed detail sheet (Info/Recent/Stats)

the sheet now opens on an Info tab (badges, tiles, directory rows) with Recent (song history, 15 rows) and Stats tabs behind the sliding-pill `SegmentedControl`; transport actions stay persistent below. Stats reuses the home `DailyView`/`TrendView` on a station-scoped `summarizeListening` filter via `useStationListeningStats`, with a forced-compact mode — the 430px sheet never earns the `lg:` wide layouts, which would squeeze 14 columns on desktop. Tab state lives in a uuid-keyed child so switching stations resets to Info. Verified live in dev (tabs switch, empty states, persistent actions) plus `tests/unit/station-stats.test.tsx` and filter cases in `radio-listening.test.ts`.

### 2026-10-05 · Sheet refinements (fixed height, tab memory, compact ages)

the popup is now a fixed `85dvh` flex column with only the tab panel scrolling (header, tabs, actions stay put), the last tab persists per station in `radioscout:sheet-tab` (capped at 100), the Show badge sits right of the title with a fixed-width time column, and ages render compact (`45s`, `5m`, `3h`, `1d`). Verified live in dev (fixed card, internal scroll, reload restores Recent) plus `tests/unit/radio-sheet-tab.test.ts`.

### 2026-10-05 · Inline sheet actions (Save/Play/Vote)

the stacked Play + Save/Vote rows collapsed into one `1fr/1.5fr/1fr` grid with Play centred and wider (later went icon-only entirely — see below). Verified at 390px plus gates.

### 2026-10-05 · Icon-only sheet actions everywhere

labels truncated even at desktop sheet widths, so the text goes entirely: icon-only buttons at all sizes with full `aria-labels` (Vote keeps its ThumbsUp, filled).

### 2026-10-05 · Primary state colour + pop tween

Saved/Voted icons go `text-primary` (replacing the row's amber), and state swaps twirl via a new `animate-scout-pop` keyframe (transform/opacity only, reduced-motion guarded; key-remount replays it on persistent icons). Covers sheet, rows and dock toggle. Caught live: button-level `text-primary` loses to the secondary variant's token in the cascade, so the colour sits on the icon itself.

### 2026-10-05 · Song rollup, live ages, per-station clear

Recently-played rows append the latest heard song inline after the vote count — desktop web only (`lg` viewport, never the APK), so phones skip the read and keep their row height; one indexed `listLatestTracks` read via `useLatestTracks`, covered by the widened tracks-key invalidation. Recent-tab ages re-render on a 30s interval so they don't freeze between banks (logged in the `useEffect` inventory); the Recent tab gets its own Clear with confirm. Tests: rollup + clear cases in `radio-song-history.test.ts`.

### 2026-10-05 · Filtered-home back arrow

`/?q=` / `/?tag=` now shows the same circle back arrow as secondary pages (clears both params, keeps an open sheet, pushes history so browser-back returns to the filter). Client-gated like the rest of the header, so no hydration mismatch. Verified live (`?tag=rock` round trip).

### 2026-10-05 · Colour flavours (Gruvbox, Nord, Sunset, Catppuccin)

flavour stays orthogonal to light/dark/auto: `<html data-flavor>` picks the palette, the `dark` class picks the scheme, combined in pure CSS (`index.css`, full SHADCN token set × light/dark) — one attribute write, no re-render cost. Pre-paint `THEME_SCRIPT` extended, provider persists to `radioscout:flavor` with cross-tab/restore sync via the `storage` listener (logged in the `useEffect` inventory), backup envelope to v8, Settings gains a swatch picker under Appearance. Sunset uses the official supplied tokens verbatim (colours only); swatches are `rounded-xl`. Verified live (swatch switch repaints, reload keeps it with no flash) plus flavour storage, v8, and a mechanical token-completeness test over the stylesheet.

### 2026-10-05 · Theme-aware logo tile

the header mark sat on hardcoded `bg-neutral-900`; new `--logo-tile` token (mapped to `bg-logo-tile` like the surface tiers) keeps the dark field the silver mark needs in every scheme while shifting per flavour. Caught live: the first inspect still showed the old colour — stale HMR, fresh load confirmed gruvbox `#282828`.

### 2026-10-05 · PWA offline pass (web-only)

`scripts/generate-sw.mjs` (workbox-build) emits `dist/client/sw.js` in the `build` chain: precached shell/routes/fonts/manifest, NetworkOnly `/api/*` + streams, daily directory, monthly artwork, shell-fallback navigation. Registration is hand-rolled in `src/lib/pwa.ts` (update/offline toasts, no workbox-window). Native pipelines strip unconditionally (`strip-sw.mjs` in `cap:android`, `release-apk.yml`, `publish-ota.mjs`) after proving the `vp` task cache replays outputs without re-running — env flags alone can't guarantee it. Verified offline in Chromium (first-load control, offline `/` + `/legal/terms` render) and clean android assets after `cap:android`.

### 2026-10-05 · F-Droid pipeline failures (schema + rewritemeta + check apk)

the maintainer-triggered pipeline on the MR failed three jobs, all on us: (1) `Binaries` used a hardcoded asset URL, but the fdroiddata schema requires a `%v`/`%c` placeholder — templated to `fdroid-reference-%v-%c`; (2) `rewritemeta` wants wrapped scalars collapsed to single lines (`Changelog`, the `sudo echo`, both `node -e` steps, `AllowedAPKSigningKeys`); (3) `check apk` flagged an extra `Dependency metadata` signing block in our reference APK — AGP 8 embeds it by default (Play SDK-compliance metadata), F-Droid bans extra blocks, so `android/app/build.gradle` now sets `dependenciesInfo { includeInApk/includeInBundle = false }` (applies to sideload APKs too — Play-only metadata, no behaviour change). The published 0.4.1 reference asset predates the fix and must be rebuilt (workflow_dispatch overwrites it) with the recipe `commit:` advanced to the fix commit.

### 2026-10-05 · Workers Logs for Pages Functions

REVERTED same day: Pages project configs reject `[observability]` at build validation (`does not support "observability"`), so the block is out again with a note left in `wrangler.toml`. The Workers Logs docs only cover `wrangler deploy`; Functions visibility stays with the Pages dashboard per deployment.

### 2026-10-05 · Two-stage leveling + safety limiter (broadcast chain)

residual spread measured 14–16 LU in / 3.0 LU out on pathological pairs — still audible. Research says the industry answer is slow AGC plus a final peak limiter, never clamp-narrowing: Rocket Broadcaster's hybrid AGC (fast RMS stage + slow 15 s LUFS nudge + gates + final limiter, −14 LUFS streaming target), ffmpeg loudnorm's linear→dynamic fallback when gain would breach true-peak (pure linear gain provably can't solve boost-into-clip — our jazz finding exactly), BS.1770/EBU R128 gating. Shipped both platforms after offline validation (`ffmpeg` captures through a faithful loop model; harness in Temp, not committed): stage-2 slow trim (±3 dB servo on gated exact-K momentary, τ≈50 s, feedforward on stage-1-post loudness so the fixed point is exact) cuts spread to 1.7 LU integrated; brickwall limiter at −1 dBFS (web `DynamicsCompressorNode`, Android peak envelope + 50 ms release, instant attack needs no lookahead) catches boosted tips so boost clamp widens 2.0→2.8 and duck floor 0.5→0.35. LRA preserved ±0.1 (jazz −0.4 from limiter-tipped crests), spectrum flat ±0.02 dB, limiter engages only on hot masters. REJECTED with data: exact-K-as-primary-tap (2.8 vs 3.0 LU — no gain) and wider-duck-alone (over-ducks bass-heavy masters; the old clamp was accidentally right). Known limits: inter-sample true peaks can touch 0 dBFS on extreme crest (no 4× oversampling on live paths); 30 s windows understate stage-2 steady state (converges over ~3 min by design).

### 2026-10-06 · Artwork chain order is a safety decision

The chain ships **wsrv.nl first, DuckDuckGo second**, and that order is a safety choice rather than a quality preference. DuckDuckGo has no honest failure mode: where wsrv answers a refusal with a real 404, DDG answers with a decodable blank placeholder and a 400 status. Chrome fires `load` for that placeholder and never fires `error`, so an `onError`-only chain cannot advance past it and the row sits on a blank image indefinitely. DDG is in the chain only as the fallback leg, because it rasterises `.ico` sources wsrv cannot decode.

This supersedes the ordering given in the 2026-10-04 entry above, which describes DDG as primary. That entry's measurements still stand; its sequence does not.

`isDdgPlaceholder()` is the only thing making that fallback leg safe, and it matches **exact dimensions** (260x180) because a shape or aspect-ratio check would misfire on legitimately wide station logos. The exactness is also the weak point, worth stating plainly: DDG owns that placeholder, so a size change would silently disable the check. The failure stays contained rather than becoming silent in the dangerous direction — every station wsrv cannot serve would degrade from station art to the blank DDG image instead of the lucide tile, and the icon-only fallback would stop firing. Widening the check is reasonable; anything that widens it has to keep matching real artwork at the sizes station logos actually use. Current state and reasoning: `docs/modules/radio/artwork.md`.

### 2026-10-05 · Settle symmetry + silence-budget fixes

Stage-1 release rode up 6× slower than attack pulled down, which converged a boosted station 80× slower than a ducked one (145 s vs 1.8 s to within 0.5 dB of target) — anything needing lift stayed audibly quiet. RELEASE is now 0.15 against ATTACK 0.3, so both directions land inside the settle window. Separately, sub-floor ticks no longer spend the 32-tick settle budget: speech stations burned half their window on pauses and reached the steady crawl uncorrected. Both fixes are ported to the Android twin, which shared both defects (its wall-clock settle deadline hands frozen intervals back). Precursor to the two-stage entry: both address the same symptom, this one the convergence speed, that one the residual offset.

### 2026-10-06 · Leveling trim compounding and volume-slider decoupling

The Web Audio leveling stage suffered two interacting defects that caused gain to climb exponentially across ticks:
(1) `gain.gain.value *= trimLinear(trim.trimDb)` ran at ~4 Hz in-place. Because `GainNode.gain.value` is stateful graph state and stage 1 read node gain back as its base input on subsequent ticks, the trim correction compounded geometrically on every tick ($1.12^{40} \approx 93\times$ gain in 10s). Fixed by maintaining explicit `stageGain` JS state and assigning `gain.gain.value = stageGain * (trim ? trimLinear(trim.trimDb) : 1)` directly (never `*=`).
(2) In Web Audio, `<audio>` element volume attenuates audio *before* `createMediaElementSource`. While stage 1 divided out `element.volume`, stage 2 (`trimAccumulate`) read raw samples without volume scaling. Any volume setting below 100% caused stream energy to read cold, pegging `trimDb` at its +3 dB ceiling and supercharging the compounding loop. Fixed by scaling mean-square energy by `volume^2` in `trimAccumulate`, making stage 2 scale-invariant to the slider.
Native Android (`LevelingAudioProcessor.java`) never had compounding (stored `gain` distinctly and computed `applied = gain * trimLinear(trimDb)` dynamically) and receives unattenuated PCM before `AudioTrack`. Android was updated with stereo energy summation ($L^2 + R^2$) matching BS.1770 and settle-window deadband tracking (`trimAnchor = postLu` during tune-in). Tests: `tests/unit/player-leveling.test.ts`, `tests/unit/radio-normalize.test.ts`, `LevelingAudioProcessorTest.java`.

### 2026-10-06 · Unfiltered charts page until full

Most Loved showed 43 stations with no filters instead of 50: the unfiltered topvote/topclick path fetched a fixed 3× over-fetch (150 rows) and sliced after the HTTPS-only filter, but 108 of the top-150 rows are plain HTTP — only 42 survive. Fixed by routing the unfiltered charts through the same paging-until-full walker the filtered charts already use (`searchPaged`, 200-row pages, `hidebroken=true`), so the list stays full however HTTP-heavy the top rows get. Verified live (61 playable on the first page) and covered by paging regression tests. Removed the now-dead `chartFetchCount` over-fetch. Tests: `tests/unit/radio-charts.test.ts`.

### 2026-10-06 · R8 shrinking enabled for release builds (F-Droid request)

Maintainer (`linsui`) asked for R8 on the inclusion MR (!49999). The release build now sets `minifyEnabled true` + `shrinkResources true` with `proguard-android-optimize.txt`; `proguard-rules.pro` keeps the Capacitor annotation-driven dispatch (`@CapacitorPlugin` classes, `@PluginMethod`/`@PermissionCallback` members) and the app audio package. Capacitor core, Media3 and Guava ship their own consumer rules, so no library keeps were added. Verified with a local `assembleRelease` (R8 `minifyReleaseWithR8` green, APK ~3.9 MB vs ~7.5 MB unshrunk). The published F-Droid reference APK predates the change and must be rebuilt with the recipe `commit:` advanced to the R8 commit.


### 2026-10-07 · F-Droid review round 2: category, committed config, autoupdate

Maintainer (`linsui`) asked for three changes on !49999, all in `fdroiddata/metadata/io.github.double77x.radioscout.yml`.

**Category.** `Multimedia` is a real `categories.yml` entry but carries no description and says nothing about a radio player; it was a placeholder. Now `Radio`, whose description is "Stream live FM/AM radio stations and internet radio broadcasts".

**Capacitor config committed to the repo.** The recipe generated `capacitor.config.json` from an inline `node -e` one-liner, which buried `CapacitorUpdater.autoUpdate: false` in escaped JSON inside a YAML list. That config is now `capacitor.config.fdroid.json`, copied by the recipe. Capacitor's CLI reads `capacitor.config.ts` ahead of `capacitor.config.json`, so the recipe still moves the TypeScript file aside around `cap sync`; both temporary names are gitignored. **The duplication is the cost**: `capacitor.config.ts` is otherwise the single source of truth, so `pnpm fdroid:check` imports it with `VITE_DISTRIBUTION=fdroid` set and requires the JSON to match exactly. Drift fails CI instead of quietly shipping an F-Droid APK with the updater re-enabled. Teaching the CLI to load the TypeScript config would avoid the duplicate, and is the better fix if the recipe's complexity ever matters more than the gate.

**Autoupdate enabled.** The submission justified `AutoUpdateMode: None` on the `v0.3.6` tag, which still declared versionCode `202` and sorted below the corrected `306`. That reason expired: `scripts/cap-version.js` encodes the code from `package.json` and the release workflow fails on a Gradle mismatch, so every tag from `v0.3.7` on is correctly stamped. `v0.3.6` is still stale, but being older than the current code is the normal state for any old tag, not a blocker. Now `AutoUpdateMode: Version` with `UpdateCheckMode: Tags ^v[0-9.]+$` - the pattern is needed because the repo also carries `ota-production-*` and `fdroid-reference-*` tags.

Enabling autoupdate turned the reference APK from a one-off into a per-release obligation: `Binaries:` is version-templated, so F-Droid's build of each new tag blocks on a signed reference under `fdroid-reference-%v-%c`. `.github/workflows/fdroid-reference.yml` therefore moved from a hardcoded version to a `v*` trigger that derives everything from `android/app/build.gradle` and fails if the tag and committed `versionName` disagree. Details: `docs/plans/FDROID_PLAN.md` sections 2.7, 2.8, and "Review round 2".
### 2026-10-07 - The Capgo registry strip stays in the recipe, as jq

Maintainer's follow-up on the same objection (`!49999`): could `sed` or `jq` remove `@capgo/capacitor-updater` instead of the inline `node -e`? Answer: `jq`, and it stays in the recipe.

`sed` is out on evidence, not taste. The registry is JSON, the updater entry is the *last* array element, and a range delete leaves a trailing comma — verified for the entry in first, middle and last position, all invalid JSON, in a file the native bridge reads at startup.

`jq -j '[.[] | select(.pkg != "@capgo/capacitor-updater")]'` is byte-for-byte identical to the one-liner it replaces, which is the one thing that must not move: the registry ships inside the APK, so a whitespace difference invalidates the signed reference APK. Verified by running both against the real generated registry — 768 bytes each, 29 LF, no trailing newline, identical parsed content. A first measurement showed a 29-byte gap; that was Windows `jq.exe` emitting CRLF, which the Debian buildserver does not do.

**What was rejected, and why, is the durable part.** A committed `scripts/strip-capgo-plugin.mjs` was written first, on the argument that the recipe and the reference workflow should share one implementation. That argument mispriced the cost. Anything the recipe sources *out of the repository* pins the recipe to a commit, and the commit's timestamp is baked into the prerendered HTML, so adding a repo-sourced file forces a commit bump **and** a reference APK rebuild. That is a standing constraint on this recipe: the more it reads from the repo, the more often the reference must be rebuilt. `jq` is installed by the recipe's own `sudo` block and reads nothing from the checkout, so it costs nothing. The duplicated transform in two places is cheaper than the coupling, and the byte-equality check above is what makes the duplication safe.

### 2026-10-07 - Reference publishing uses gh, not softprops/action-gh-release

Found by the first real run of the reworked reference workflow, and it is a bug the `v*` trigger introduced. `softprops/action-gh-release` reconciles an *existing* release against the **current git ref**. That only ever worked because the old trigger was an `fdroid-reference-*` tag push, where ref == `tag_name`. Once the workflow runs from a `v*` tag (or a dispatch branch) the two differ, and republishing an existing reference fails with `Unexpected error fetching GitHub release for tag <ref>: HttpError` — after the APK has already been built and signed, so the whole run reports failure and no asset is updated.

Replaced with explicit `gh release view` / `edit` / `upload --clobber`, addressing the release by name rather than by ref. The step also stops force-moving the reference tag: on republish it edits the existing release and clobbers the asset, and only creates a tag at `$GITHUB_SHA` when the release is genuinely new. The lesson is that "the tag the workflow runs from" and "the tag the release is published under" are two different things, and an action that conflates them breaks the moment the trigger changes.

### 2026-10-17 · Native leveling parity (tap, mono, anchor cadence, glide)

The stage-1 tap was never ported. The web loop reads a shaped signal (`leveling-graph.ts`: 60 Hz high-pass then a +4 dB shelf at 1.5 kHz), while the Android twin read raw broadband short RMS — so speech and bass-heavy stations settled on different quantities, and the two players only agreed on material whose spectrum the shape leaves alone. The chain is now ported into `LevelingAudioProcessor` over the mono down-mix, and pinned to browser measurements rather than formula guessing: a temporary probe rendered both filters in Blink and Gecko (identical to the hundredth) and settled three semantics — Web Audio's high-pass treats Q as **dB** (`alpha = sin(w0) / (2 * 10^(Q/20))`, default Q = 1; a linear-Q port reads the cutoff a full dB low), the shelf is S = 1 with Q ignored, an analyser down-mixes stereo as `0.5(L+R)` (anti-phase reads silence, not a channel), and a splitter fed a mono stream puts silence on its second output. The probe also confirmed the channel bug in the old K tap: it treated consecutive samples as L/R, so mono streams pushed every second sample through the right K filter — now keyed per frame off the configured channel count, with mono right = silence like the splitter. `TRIM_ANCHOR_COEFF` kept the web's per-window 0.02 against 400 ms native windows (the web evaluates once per ~2.34 s of tick-sampled audio), landing the anchor at τ ≈ 20 s instead of the web's ~2 min — bursts moved the trim target that the deadband exists to protect it from. Scaled to 0.0034 (0.02 × 400/2340); `TRIM_COEFF` already carried the same rule. Disabling leveling now glides the applied gain to unity over the web's 50 ms `freezeGain` time constant instead of stepping, limiter live through the glide. Deliberately not ported, for the record: the compressor limiter shape (`DynamicsCompressorNode` knee vs native brickwall — the 2026-10-05 entry chose both), the 43 ms analyser snapshot window itself, mute-freezing (native sits before the volume stage and cannot see the slider), and the web's re-enable replay (native continues seamlessly while restarting the settle window). Tests: `LevelingAudioProcessorTest.java` — the tap against the browser-measured curves, the anchor cadence, the buffer path for mono/anti-phase/correlated down-mixes, and the toggle-off glide across decoder-sized buffers. Those buffer tests drive `queueInput` directly, so the app module now sets `unitTests.returnDefaultValues` (the settle path logs through `android.util.Log`). The gate (`gradlew :app:testDebugUnitTest`) first ran on 2026-10-18 — green at 27 tests, after it caught two slips the authoring machine could not: `Math.SQRT2` is a JavaScript constant, not Java, and failed the compile, and the glide restarted from the settled gain on every buffer, sawtoothing decoder-sized buffers instead of converging on unity.

### 2026-10-18 · Tablet-width app frame

`AppShell` capped the column at `max-w-107.5` (430px) until `lg:`, so every viewport from 640 to 1023px — every tablet, portrait or landscape — drew the phone column with ~170px of fog either side. It surfaced on the Android build: on a tablet the app looked like a phone pasted into the middle of the screen. The ladder now steps `min-[600px]:max-w-2xl` (672px) and `md:max-w-3xl` (768px), with `xl:max-w-4xl` (896px) unchanged. The 600px step is Android's own `sw600dp` tablet boundary, and the common 10" panels (`1280x800` at 1.33 density, `1920x1200` at 2.0) present 600–601px in portrait, so they land in the 672px band rather than staying at phone width. Beyond the bug, the only behaviour change is 1024–1279px, which moves from 672px to 768px. Verified in the browser panel at 390, 768 and 1440px (phone fills, tablet fills, desktop unchanged); `STYLE_GUIDE.md` §3 carries the new class list.

### 2026-10-18 · Android permission alias could strand playback

The 0.4.4 Android build could get stuck on “Tuning in” before any station started, even when notification permission was already granted. `NativeAudioPlugin.play()` queried Capacitor's `getPermissionState("notifications")`; on the affected APK it returned `null` despite Android reporting `POST_NOTIFICATIONS` granted. The plugin interpreted null as denied and entered Capacitor's permission-request callback path, which never resumed the play call. Audio levelling was unrelated. The gate now checks the actual Android permission using `ContextCompat.checkSelfPermission()` (Android 13+ only); permission-inspection exceptions fail open, and a denied notification grant does not block audio playback. Keep this platform check as the source of truth for the native playback gate; the module contract is recorded in `docs/plans/NATIVE_AUDIO_PLAN.md`.

### 2026-10-19 · Volume arrow keys on the web dock

The dock has always taken `K` for play/pause (YouTube's key); volume was pointer-and-focus only, so changing it without a mouse meant tabbing into the slider. `←`/`→` now move it from anywhere on the page in **1% steps** — the same step the dock's focused range input takes, so an arrow means the same thing wherever it is pressed.

A two-speed scheme (1% a tap, 5% per held repeat, detected via `event.repeat`) was built and then dropped: at the fast end of the OS repeat range (Windows reaches ~30/s) a 1% repeat already ramps ~30%/s, so a hold crosses the full range in about three seconds, and a second speed only added a rule — plus a throttle, because uncapped 5% repeats would have crossed the range in half a second on that same keyboard while crawling on a slow one. Consistent and interpretable won: one step, one number on screen, and the repeat rate left to the user's own keyboard setting.

The overlay reveals on the first press so the level is visible, and focus deliberately stays where it is — moving it into the range input would hand every later press to that input's handlers.

`↑`/`↓` was rejected, despite being the more conventional volume pair, because Home's accordion owns Up/Down to move between its triggers and the hotkey manager cannot see that: its `ignoreInputs` reads ARIA roles, and an accordion trigger is a plain `role="button"` that claims only Enter/Space. A global Up/Down would have hijacked accordion navigation in every section. `←`/`→` has no such claimant here — live radio has nothing to seek, music players keep track skip on Ctrl/Shift+arrows, and the library's own ARIA check already steps aside for the segmented control (native radios), Base UI selects and menus, text fields, and the dock's `role="slider"` (which binds arrows to the same 5% step when focused). The one gesture it takes is a future previous/next-station key: the car skip buttons make that gesture in the native shell, so if web ever grows it, volume moves to Ctrl/Shift+arrows.

The nudge bases on the stored `volume`, not the muted `level`, so an arrow while muted restores the level instead of raising from silence (what YouTube does). `aria-keyshortcuts='ArrowLeft ArrowRight'` plus a title hint on the dock's volume trigger carry the pair, matching the play button's existing `k`.

Covered by `tests/player-keys.spec.ts` (mocked directory, silence fixture): the 1% press and overlay reveal, the held repeat staying at 1%, immunity while the caret is in search, and the focused slider keeping its native step instead of taking the dock's.

### 2026-10-19 · Fresh installs started silent

`loadVolume()` read the stored key with `Number(localStorage.getItem(...))` and kept the result when it was finite. A missing key is `null`, `Number(null)` is `0`, and `0` is finite — so the "missing means `DEFAULT_VOLUME`" branch could never run for the one case it existed for, and every fresh profile started at 0% output. The 2026-09-22 change that introduced `DEFAULT_VOLUME = 0.25` ("fresh installs start at 25% instead of 90%") therefore only reached the SSR snapshot; the client snapshot still read 0. Found by the volume-key Playwright spec, whose fresh-context precondition asserted 25 and got 0.

`loadVolume()` now treats an absent or empty key as `DEFAULT_VOLUME` before parsing, while a stored `"0"` stays silence the user chose. Covered by `tests/unit/radio-prefs.test.ts` (missing, empty, stored 0, clamped, junk, throwing storage).

### 2026-10-19 · ICY probe: caller-supplied URLs gated, reads budgeted

The full Fallow security pass flagged five SSRF candidates. Four are client-side fetches governed by CORS/CSP (directory, artwork, OTA manifest, in-page titles); the real one was `functions/api/icy-title.ts`, which accepted any `?url=` and fetched it from the edge with no bound on what the target could send back.

The endpoint now checks the target with `isProbeableStreamUrl` before touching the cache or the network: only `http(s)`, no embedded credentials, no loopback/private/ULA/link-local literals, 2 KB maximum. A public IP literal stays legal because some stations publish one. A host allowlist was rejected: the directory is a live third-party service, the client may hold a `url_resolved` variant the directory never listed, and the Function holds no copy of the directory — an allowlist would either miss real stations or need a second API call per probe.

`fetchIcyTitles` now treats an `icy-metaint` above 1 MiB as "no usable metadata" and stops a probe after 2 MiB of body (`byte-limit`), keeping any title already decoded; a single oversized chunk is truncated rather than buffered. Real streams send an 8–64 KiB interval and deliver the first block within a few KB, so the production path is unchanged. `byte-limit` routes like `timeout` (publish a found title, otherwise retry direct next poll) and is never cached as a "no title" verdict.

Rejected: an `Origin`/`Sec-Fetch-Site` gate. The APK loads from `https://localhost` and calls the endpoint at the canonical origin, so the browser labels it cross-site; allowlisting that origin would still be forgeable by curl and would break the native title path for very little. The remaining per-IP control is a Cloudflare rate-limit rule on `/api/icy-title` (account configuration, not repo state); the code's contribution is bounding each invocation.

Covered by `tests/unit/icy-probe.test.ts` (gate accept/refuse cases, oversized metaint, byte budget, route) and `tests/unit/icy-title-function.test.ts` (invalid targets never call fetch, public targets do).

### 2026-10-19 · Player dock split out of one 480-line component

Fallow's project-wide health pass ranked `PlayerDock` as the top web-player hotspot: cognitive 71 / cyclomatic 36 inside one 355-line function (CRAP 1,332). The old Phase 3 note in `docs/plans/REFACTOR_PLAYER_ENGINE_PLAN.md` only proposed lifting `VolumeSlider`, but the JSX branches held most of the complexity, so the split followed responsibility instead:

- `PlayerNowPlaying` — artwork, identity, live dot, and the subtitle (the old tuning/track/pause nested ternary).
- `PlayerControls` — volume trigger, play/pause, stop.
- `PlayerVolumeOverlay` — both volume panels and the touch slider; its `div role="slider"` rationale moves with it, and `toolchain.config.ts`'s scoped a11y exception follows the file.
- `useDockVolume` — open state, auto-hide timer, trigger/panel refs, key-step nudge.

`PlayerDock` keeps the wiring, browse/idle actions and the three hotkeys. Markup is equivalent (same DOM order and classes), so the dock's e2e coverage applies unchanged. Measured after: cognitive 71 → 17, cyclomatic 36 → 7, function body 355 → 153 lines; the three extracted components sit at 16–18 cognitive, under the 30 threshold. CRAP stays above 30 because Fallow counts UI components as untested — Playwright is not in its coverage model — so that number is a metric artefact now, not a hot function. The next web-player hotspot is `refreshOnce`'s IIFE in `engine.ts` (cognitive 29).

### 2026-10-20 · Fallow health pass: probes, drag, store and sheet seams

The project-wide health pass left 62 findings, all `crap` and mostly artefacts of Fallow treating UI as uncovered. This pass took the seams the earlier plans had already named instead of chasing the score. The engine's transport/handoff boundary was not cut: live/staged elements, tokens, `usingNative` and the reconnect flags are read and written together on every transition, so moving them would relocate complexity without concentrating it.

- **Title probe.** `engine.ts` keeps transport, handoff, snapshot publishing and song-history banking. `lib/player/title-probe.ts` now owns the Radiolise socket, its backoff, the BBC adaptive timer, the direct/edge fallback chain and the probe timers. The engine passes a live-play guard, current title, native flag and title sinks through `TitleProbeHooks`; `armIcyProbe` is a thin adapter. The code moved verbatim, including trace messages and the changed-title funnel.
- **Listening aggregation.** `listening-summary.ts` holds the pure buckets, streaks, best day and station totals. `store.ts` keeps the Dexie read and station filter; `summarizeListening` has the same signature and return shape, and the existing listening tests pass unchanged.
- **ICY read.** `fetchIcyTitles` split into stream opening, a mutable read pump and error classification. Read order, byte budget, metaint cap and trace text are unchanged.
- **Drag reorder.** `lib/radio/drag-reorder.ts` owns threshold/hold constants, hit testing, order movement, row styles and drop resolution, with seven unit tests. `SavedStations` keeps the reducer, DOM wiring and rendering; commit maths still runs synchronously while visuals ride rAF.
- **Station sheet.** The 432-line file became `StationDetailSheet` (shell/state/vote) plus `StationSheetTabs`, `StationInfoTab`, `RecentTracks`, `StationSheetHeader`, `StationSheetActions` and `StationSheetFallback`. Classes, labels and DOM nesting are unchanged; `RecentTracks` owns the 30s age tick.
- **Settings and filters.** `SettingsSection` carries the repeated accordion shell, `RadioDataSection` owns backup I/O, and `PickerPanel` carries the shared search + virtualized list. Each picker keeps its own chips, trigger and row rendering. The virtualizer now mounts only on the client, behind the existing skeleton gate.
- **Home and native shell.** `HomeSearchResults`, `HomeSectionTrigger` and `HomeFilterSummary` left `HomePage` with the query calls and section order untouched. `runOtaUpdateCheck` moved to `lib/native-ota.ts`; `NativeShell` only owns the abort signal and restart toast.

The APK check caught the local Vite+ task cache replaying a pre-refactor `dist/client`: the first native build at 12:12 still referenced the old `chunk-RadioHeader-BAcyejPc.js`. Clearing `node_modules/.vite/task-cache` and rebuilding produced `chunk-RadioHeader-Dvv-wmyE.js` (234,811 bytes), all 19 index script references present in the APK, no `sw.js`, and no tracked Android changes. CI caches only pnpm, so this is a local-build trap, not a release one.

Gates at landing: lint 0/0, `tsc -b` clean, format check clean, 460 unit tests, 67 Playwright tests, `vite build` prerendered 9 pages, `fallow audit` clean across 50 changed files, and `gradlew assembleDebug` successful (12,056,739-byte APK). The debug APK was content-verified, not installed on a device; no native Java or plugin code changed.

### 2026-10-20 · APK smoke finds native pause status; device checks become repeatable

The debug APK was installed on an API 34 emulator and driven through one Playwright WebView session. It loaded the live catalogue and played a station, but the first pause left the dock on “Tuning in…”. Native logs showed the pause call arriving and the player still in `STATE_BUFFERING`; `emitStatus` checked buffering before `playWhenReady`, so a paused live stream was reported as loading. `PlaybackStatus` now gives pause intent priority, with six JVM tests covering the precedence.

`scripts/android-smoke.mjs` (run with `pnpm android:smoke`) turns the check into 15 repeatable steps: launch and catalogue, notification permission, native playback, MediaStyle notification, ICY title, pause/resume, the 1% volume keys, mute, settings, detail sheet with Android back, favourites, background playback and stop. It shells out for `dumpsys media_session`, `dumpsys notification` and `dumpsys activity`, so a green run means the system side moved, not just the DOM.

Two practical traps. Use `-gpu host` on the emulator: with `-no-audio` and SwiftShader, the emulator process exited during playback and the failure looked like an app crash until the device was checked. And target `:app:connectedDebugAndroidTest`; the unqualified task also runs the `capacitor-cordova-android-plugins` test variant, which fails on duplicate Kotlin stdlib classes before it reaches the app. The template instrumentation test asserted `com.getcapacitor.app`; it now checks the real package and the app task passes.

This remains a local debug check. It cannot attach to release builds (no devtools socket), the emulator has no audible output here, and lock-screen/car behaviour still needs a physical device or device farm. There is no emulator CI, Maestro/Appium flow or release-runtime gate; the release workflow still builds without running tests.

### 2026-10-20 · Native release gates: fixture smoke, R8, permission fail-open

The debug smoke proved the WebView path but depended on the live radio directory and a pre-granted notification permission. Three gates closed that gap.

**A deterministic stream fixture.** `scripts/android-fixture-server.mjs` serves `tests/fixtures/android/live.mp3` over HTTPS with `icy-metaint: 4096` and a fixed `StreamTitle=Fixture Artist - Local Test Track`. `android-smoke.mjs` routes the radio-browser API to one station whose `url_resolved` is `https://127.0.0.1:8765/live.mp3`, sets `adb reverse tcp:8765 tcp:8765`, and clears the app data before launching. The loopback network-security config lives in `src/debug/res`; the CA and server certificate are generated on demand with `keytool` into gitignored `tests/fixtures/android/.generated/` and Gradle merges the public CA into `debug` and `releaseTest` resources. No fixture private key enters Git, and the shipped release does not trust the CA. This removed the live-directory dependency and made the ICY title assertion exact.

**R8 was not the failure, stale data was.** The first `releaseTest` run (release assets, R8, non-debuggable, debug-signed) stopped at `Tuning in…` with no app session in `dumpsys media_session`, while the ICY title arrived. Disabling minify did not help. Clearing the app data did: a prior run's last station had left the native service bound to an old session, so a fresh data directory was the difference between 11/15 and 15/15. The main smoke now clears data itself. The same investigation produced a second trap: a MediaStyle notification can survive `pm clear`/force-stop on the emulator, so notification absence is not a dependable denial assertion.

**The permission prompt did not survive the release-shaped build.** With data clean, `releaseTest` passed 15/15, but a denial probe found that `POST_NOTIFICATIONS` never prompted there. The debug build did prompt. Capacitor's `@CapacitorPlugin(permissions = @Permission(alias = "notifications", ...))` path did not produce a dialog after shrinking, and playback waited on a callback that never arrived. The exact metadata failure was not isolated further because the fix removes the dependency: `NativeAudioPlugin` now requests `POST_NOTIFICATIONS` directly with `Activity.requestPermissions()` (no alias, no annotation dependency), and it starts playback before the user answers. The prompt is advisory for the notification; it is no longer a gate on audio. `scripts/android-permission-smoke.mjs` revokes the permission before launch, plays with the dialog open, and requires the media session to reach PLAYING. Both smoke scripts leave the permission granted again in cleanup.

**Release-shaped and release checks.** `releaseTest` is the release build type with R8/shrinking, debug signing, non-debuggable, and `BuildConfig.WEBVIEW_DEBUG` set so Playwright can attach. `pnpm build:android:release-like` builds it; `pnpm android:smoke` runs the interactive media gate against it. `scripts/android-release-smoke.mjs` installs the actual release APK, checks the package is non-debuggable, waits for the first UIAutomator screen, and scans logcat for fatal crashes. It passed locally against a debug-signed release build. The actual release has no WebView devtools socket, so the interactive media path stays on `releaseTest`.

**CI.** `.github/workflows/verify.yml` runs lint, format, types, unit, Playwright, build and Fallow; native JVM tests plus `assembleReleaseTest`; and `:app:connectedDebugAndroidTest` on an API 34 emulator. The release workflow calls Verify as a reusable `preflight`, so a tag cannot reach signing or publishing unless all three jobs pass. Device-only smoke is a manual workflow on a self-hosted runner labelled `android`, because standard runners have no audible device: it builds `releaseTest` and release, runs the main and permission smokes on `releaseTest`, then runs the launch smoke on release. The hardware gate is deliberately separate rather than pretending a hosted runner can enforce it.

Gates at landing: 460 web unit tests, 67 Playwright tests, 38 native JVM tests, 4 instrumentation tests, lint/format/`tsc -b` clean, `releaseTest` main smoke 15/15, permission smoke pass, release launch smoke pass. Those device results were recorded before the generated-certificate change; after it, the generated CA chain and the debug/`releaseTest`/release APK resources were rechecked, but the device suite still needs a rerun on the generated certificates. The physical gaps are unchanged and now written down in `docs/plans/ANDROID_DEVICE_CHECKLIST.md`: audible output, lock-screen controls, wired/Bluetooth routing, calls, Android Auto and doze still need a real device.

### 2026-10-20 · Dependabot cooldown matches pnpm's release age

Dependabot's default three-day cooldown opened update pull requests while the new version was still inside `pnpm-workspace.yaml`'s seven-day `minimumReleaseAge`. `pnpm install --frozen-lockfile` then failed with `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` before any check ran; every failing job on the `@capgo/capacitor-updater` pull request stopped at that same install step.

The npm update config now waits seven days before opening a version-update pull request, so the lockfile it generates satisfies the gate. Security updates bypass Dependabot's cooldown; if one lands inside the window, add the package to `minimumReleaseAgeExclude` deliberately rather than lowering the gate. Pull requests created before this change keep their old lockfiles and stay red until their package clears the window.

The same pass moved CI to `pnpm/action-setup@v6` (pnpm 12 and Node 24), pinned hosted jobs to `ubuntu-24.04` instead of `ubuntu-latest` while the latter moves to 26.04, and raised `actions/upload-artifact` to v6 for the Node runtime.

### 2026-10-20 · Native verification follows native changes

Verify ran the native JVM and instrumentation jobs for every pull request because `release-apk.yml` reuses the same workflow as its tag preflight. That is correct for a release gate and wrong for a web dependency bump: Dependabot updates to React, jsdom or TanStack spent an emulator boot on a shell they cannot change.

A `changes` job now classifies the diff before the native jobs start. A release tag and a manual dispatch force the full suite. Pull requests and pushes to main run native checks only when the diff touches `android/`, `capacitor.config.*`, native build scripts, `assets/`, the workflow that runs the gate, or moves a `@capacitor`/`@capgo` package in `package.json` or `pnpm-lock.yaml`. If the range cannot be resolved, the gate runs the suite rather than treating a native change as web-only. Web checks still run on every event.

The trade-off is deliberate: a web-only pull request no longer proves an APK builds. The tag preflight still does, and a native dependency bump counts as native. `@capgo/capacitor-updater` is the reason for the dependency rule; it is a native module even though Dependabot files it under npm.

### 2026-10-20 · Android emulator needs KVM, not a longer timeout

The 0.4.5 release preflight failed with `Timeout waiting for emulator to boot`, and the log carried QEMU's TCG warnings (`CPUID.01H:ECX.avx`). The emulator was not using hardware acceleration because the runner user could not open `/dev/kvm`; the workflow had assumed the action handled permissions on its own. Disabling snapshots, raising the timeout and pinning `ubuntu-24.04` all left the same software-emulation loop.

The job now writes the KVM udev rule, reloads udev, checks that `/dev/kvm` is readable and writable, and passes `-accel on`. If acceleration is missing the job fails with a permission error instead of burning the full boot timeout. The 900-second timeout stays as a safety net, not as the fix. `gradle/actions/setup-gradle` moves to v6 in the same pass to clear the Node 20 deprecation warning.

### 2026-10-20 · Gradle stays on 8.x until AGP 9

`setup-gradle` v6 annotates a job when the wrapper is one major behind the latest release, or more than two minors behind on the current major. Gradle 9.8.1 is out, so the 8.14.3 wrapper drew an "out of date" notice in Verify. The notice is informational; the job stayed green.

Gradle 9 needs Android Gradle Plugin 9, and the project is on AGP 8.13.0. That is a toolchain migration, not a patch bump, so it does not belong in a patch release. The wrapper moves to 8.14.6, the last 8.x patch, which keeps the maintenance line on its latest fixes. The notice stays until AGP 9 lands, and that move gets its own change with the JVM tests, the R8 build and the instrumentation run as its gate.

### 2026-10-20 · Hosted runners do not all expose KVM

The KVM entry above said the emulator job should fail when acceleration is missing. That was wrong. Acceleration is a property of the host, not of the project: one run booted the emulator in five minutes, the next failed the same step in one second on a different runner, and the runner-images maintainers note that nested virtualisation is not guaranteed across the hosted fleet. A hard requirement turned the release preflight into a coin flip.

The suite now lives in its own reusable workflow and treats acceleration as optional. The job installs the udev rule, reports whether `/dev/kvm` is usable, and runs against the ATD system image, which carries no Google services and boots in a fraction of the time of a full image with or without acceleration. The workflow runs the suite a second time when the first attempt fails: the first attempt is tolerated, and only the second one, on another runner, blocks the release.

The cost is a slower boot on a runner without KVM and a suite that no longer runs against a Google services image. The tests read Media3 constants, the manifest and the permission state, none of which depend on Google services, and the device smoke on the self-hosted runner still covers a real device.

Correction, same day: the claim that the ATD image boots "with or without acceleration" was wrong. Measured on a workstation with the emulator forced into software mode, the ATD image was still not booted after 1504 seconds, so the suite does need a runner with hardware acceleration. The ATD image does boot in about 80 seconds on a runner that has it, and the second runner exists for the runners that do not. Acceleration is therefore a requirement of the runner, not of the project, and the second runner is the backstop rather than a fallback.

### 2026-10-20 · Workflow files are checked by actionlint

Two of the release-day failures were workflow syntax that only GitHub could see: a job that calls a reusable workflow carrying `continue-on-error`, and a composite action `run:` step without a `shell`. Both were found by a failed run, not by a check.

Verify now runs actionlint, the standard checker for workflow files, in the web job. The shellcheck and pyflakes integrations stay off because they flag pre-existing style in the F-Droid workflow, and a style gate is not what a release needs. actionlint does not read composite action metadata, so the composite action keeps its own shape and a `shell:` on every `run:` step. The self-hosted `android` label is declared in `.github/actionlint.yaml` so the check knows it is not a typo.

### 2026-10-20 · A composite action shell is not a workflow shell

A composite action step that declares `shell: bash` runs as `bash --noprofile --norc -e -o pipefail`, while a workflow step's default shell is `bash -e`. The extra pipefail turned `yes | sdkmanager --licenses` into a broken pipe: `yes` was killed once sdkmanager had what it needed, and the step died before the emulator ever started. The licence step now tolerates the broken pipe in every workflow, and the composite action treats each acceleration command as optional, because the host may expose no `/dev/kvm` at all.

### 2026-10-21 · Gates run once, at the end of a task

Agents were running lint, format, build and tests between increments of one feature. Nothing in force asked for it. Every gate instruction was worded "before finishing", "after each feature" or "before opening a pull request", and §17 branched only on the size of a change. The drift came from three things.

`pnpm format` sat in build-gate lists even though it writes and belongs to the commit. Run mid-task it reformats files nobody has touched yet, so the diff stops showing the change and the reviewer reads reformatting instead. That is the noise `REFACTOR_ZERO_REGRESSION_GATES.md` names as the reason for the gate in the first place. It is out of the feature stack in `AGENTS.md` and §17 now; the README pull-request list keeps `pnpm format:check`, which is what `verify.yml` runs.

§17's small-change tier pointed at `lint-files`, a script that does not exist. An agent that found a stale pointer took the expensive branch and ran the full `pnpm lint`, then did the same for the next file. The tier now names `pnpm exec vp lint <files>`, which `vp lint --help` confirms takes a path list.

"after each feature" and "as they land gated" read as "per increment" once a feature has increments. §17 opens with the cadence now, and keeps the two exceptions that are real: pulling a UI primitive (one file, and the point is proving no dead exports) and a move-only refactor slice, where a red gate means revert rather than fix-forward.

The cost is that nothing checks a half-built feature, so a mid-task break surfaces at the end with more code to search. That is the trade: one unambiguous red run against the finished change, instead of several green runs against states nobody ships.


### 2026-10-21 · Spectrum wings tap the leveling graph

The desktop visualiser needed a spectrum from the real stream, not a decorative animation. There is only one way to read an `HTMLAudioElement` through Web Audio: `createMediaElementSource` binds once per element and throws on a second call, so the wings either share the leveling graph or build nothing. A parallel graph would have meant a second audio context and a second fetch of the same stream, and the graph already exposes the tap a meter wants — the 60 Hz high-pass and +4 dB presence shelf on the perceptual branch.

Leveling defaults off, which was the crux: `readNormalizeEnabled` accepts only a stored "1", so on a fresh install there is no graph and the wings would have had nothing to read. Two options were on the table. Always route web playback through Web Audio, which removes the user's choice of the direct path and makes every station pay the CORS attempt. Or let the visualiser ask for routing on its own. The second confines the change: the engine now reads `normalizeOn || spectrumTap`, and the tap flag comes from a component that only mounts on the web at `lg` and up, so phones and the APK keep exactly the path they had.

The flag is read at element build. Setting it does not rebuild the playing element, because a rebuild costs a moment of silence and the visualiser is not worth one; a session that starts at phone width and is resized on gets its spectrum at the next station. That limit is deliberate and visible in the source rather than worked around.

The coupling exposed a real bug in the rescue. A routed stream without CORS headers fails its load, and the player rescues to direct playback once per element — but the rescue was gated on `audioRouted && normalizeOn`. Routing for the visualiser with leveling off would have hit that path with the gate closed and broken playback instead of falling back. The gate is now `audioRouted`: routing implies intent, whoever asked. The staged handoff already routed through `canRouteStation`, so it picked up the new flag for free.

The cost is that a desktop now attempts Web Audio on hosts a phone plays direct, so the first play of a non-CORS station on a laptop costs one failed load and a replay. That is bounded by `blockedHosts`, which remembers the host for the session, and it is the only way to get a real spectrum without lying about what the audio is doing.

### 2026-10-21 · Spectrum wings: opt-in, primary tint, dBFS reading

The first cut was wrong in use on three counts. It mounted on every laptop, so every desktop paid the routing attempt the entry above calls bounded but real; it tinted with `--scout-moss`, a fixed green that ignored theme and flavour; and it read `getByteFrequencyData`, which maps −100…−30 dBFS and clamps louder bins, so the loudest bass sat pinned at 255 and the meter barely moved.

The feature now has its own key, `radioscout:visualiser`, off by default and exposed as Settings → Audio on web only. The component reads the key, so a flip mounts the wings and asks the engine for the tap without a reload, and the default install keeps the direct path it had.

The tint is `--primary`, which follows light/dark and every flavour. Only the default light palette pairs a pale mint with pale fog; blending that toward `--foreground` to gain contrast drained the hue into grey, so the pale case is darkened in HSL instead, which keeps the hue at a lightness that reads on the fog. Dark and the flavours already have contrast and pass through untouched.

The reader takes `getFloatFrequencyData` over a −60…−10 dBFS window, so there is headroom above the loudest bin and hits read as hits rather than as a pinned wall. Element volume sits before the graph, so the reader adds it back — the same invariant the leveler enforces — because otherwise the meter shrank with the volume slider. `smoothingTimeConstant` drops to 0 on the shared analyser: the leveler reads time-domain samples, which smoothing never touches, and the wings run their own attack/release.

The wings also only exist while a station plays or loads. Paused, idle and errored states fade the wrapper out and stop the frame loop, rather than resting at a floor that implied audio was still there.

The cost is thirty lines of colour maths that a single `color-mix()` would have covered if canvas resolved one, and a spectrum that still waits for the next element build after the setting is flipped mid-stream.

### 2026-10-22 · AGENTS.md is rules; the decision index moved beside its entries

`AGENTS.md` carried 73 index lines for this log and an eleven-entry `useEffect` inventory. Neither is a rule for the next task: the index is wanted when browsing why, the inventory when adding an effect. Together they were 40% of a file the harness injects on every turn, which sat at 96% of its 12,000-byte budget, so a new rule had to displace something useful.

The index now opens this file, beside the entries it names, and check 6 of `scripts/check-doc-pointers.js` holds it there — the same correspondence, moved with it. The `useEffect` inventory moved to `plans/REFACTOR_PERFORMANCE_USEEFFECT.md` §5 and was re-derived, because the old list had missed thirteen call sites; the rule stays in `standards/CODING_STANDARDS.md` §3.E and in shortened form in `AGENTS.md`. The UI primitive enumeration went entirely: it named `breadcrumb`, `select`, `table` and `tabs`, none of which exist, omitted `segmented-control`, and pointed at a `dialog.tsx` that the same paragraph said did not exist. A rule that enumerates files needs a check or nothing.

The cost is that browsing decisions now opens this file instead of grepping the injected one. The index is still one grep away, `AGENTS.md` is down to 43% of its budget, and a rule added there no longer has to evict a history line to fit.

### 2026-10-22 · Formatter moves to the pre-commit hook; gates scale with the change

Agents were running `vp fmt` and the full gate stack between edits. Formatting is mechanical and belongs to the commit: run mid-task it rewrites files nobody is working on and buries the real diff in reformatting. The gates were the same instinct applied to tests, where a full run after each increment proves nothing about a state that is about to change again.

The repository now uses Vite+'s hook dispatcher. `.vite-hooks/pre-commit` runs `vp staged`, which formats only the staged files through the `staged` block in `vite.config.ts`; `prepare` (`vp config --no-agent`) installs the dispatcher on a fresh clone, and `VP_GIT_HOOKS=0` skips it for one commit. The glob is explicit because `vp fmt` errors when every path it receives is unformattable, which a PNG-only commit would otherwise hit. CI keeps `pnpm format:check`, so a commit made with hooks disabled still fails the gate.

The written rule is now magnitude-based: scoped lint, the failing test, and `tsc -b` only when a type crosses a boundary; the full stack when the change is large or about to be committed, run once at the end of the phase. The two per-step exceptions stay, because each means the next file builds on this one or a red gate means revert. The formatter leaves the gate lists in `AGENTS.md`, `CODING_STANDARDS.md` §17 and the README entirely.

The cost is that a formatter failure now blocks a commit instead of being noticed later, and a commit that stages a large file set pays formatting time it did not before. Both are cheaper than the churn the old habit produced.

### 2026-10-22 · One verify gate, progressive standards, and a lint rule for effects

The workflow had two kinds of drift. `AGENTS.md` told an agent to read four standards before any task, which is cheap to say and expensive to do: most tasks touch one of them, and the instruction competed with the work itself. Separately, the definition of green lived in four places — `AGENTS.md`, `CODING_STANDARDS.md` §17, the README and a CI job that listed the same six commands — so an edit to one could leave the other three stale.

`AGENTS.md` is now the only always-read file. A standard is opened when the task touches its area: `CODING_STANDARDS.md` for code (§15 always, plus the relevant section), `STYLE_GUIDE.md` for UI, `TECH_STACK.md` for the toolchain, `ARCHITECTURE.md` for structure. This is the trigger table the docs argued against, and that argument was right about the failure it saw: the old instruction read all of `docs/`, had no boundary, and stopped being obeyed. The new one is bounded by a folder, gated by `check-doc-pointers.js`, and keeps §15 unconditional for the work that can break the checkout. The evidence points the same way: a 12-line `AGENTS.md` beat a long one on an ambiguous task (27% less wall time, 24% fewer credits, 26% smaller diff), while an arXiv evaluation of context files found human-written ones bought about 4% success at 20% more cost and LLM-generated ones lost 3%.

`pnpm verify` is now the gate: lint, format check, unit tests, the build (with `tsc -b`, prerender and the doc-pointer check) and Fallow. CI calls this script as one step instead of repeating the steps, so its contents cannot drift from CI; actionlint and Playwright stay separate. Scoped commands stay for iteration; the full script is for the end of a phase. The written rules also say to run one test rather than the suite, to change only what the task needs, and to quote evidence rather than claim a pass. A multi-file or behavioural change gets a fresh-context review of its diff, because the agent that wrote it is the worst reader of its own blind spots.

The `useEffect` audit was a table with no enforcement. `scout/no-unjustified-effect`, a local Oxlint plugin in `lint/`, caps each file at its audited count (24 sites across 15 files). A new call fails lint; raising the quota is the mechanical half of adding a site and needs a row in the audit, so the count and the justification move together. The rule counts calls, not quality — it cannot tell a subscription from a state sync — but it makes the default path the one that needs a decision. Test integrity joins the standing prohibitions: never delete, skip, loosen or re-fixture a test to get a green gate.

The cost is maintenance. A legitimate new effect now edits two places, and a file split or rename edits the quota map; the map is small enough to keep in `toolchain.config.ts` beside the rule. Progressive reading can miss a standard when a task's area is misjudged, which is why §15 and the pointer check stay unconditional. The evidence is directional rather than a guarantee: the benchmark that favoured the short file tested one ambiguous task, and the context-file study measured a different setting.

### 2026-10-23 · Spectrum wings: width sets the bands, paint reuses its skin

The review before commit found two things the feature had been hiding. The reader was built once with `MAX_BARS` bands — a fixed 60 Hz–12 kHz axis cut into forty slices — while each wing drew only the bars that fit: nineteen at 1440 px. Drawing a prefix of a fixed axis is not a narrower spectrum, it is a truncated one. A 19-bar wing showed 60–756 Hz and nothing above it, so presence and vocals never appeared, while the comments ("outer bars fade", "the loudest bin owns the bar") described a full-range meter it was not. The reader now takes the drawn band count from the wing, rebuilds its edges when that count changes, and clears the envelopes because the same index would otherwise map to a different frequency. `tests/unit/player-spectrum.test.ts` pins the top band with a single loud bin, which is the assertion the old code would have failed.

The paint path also allocated about a hundred short-lived objects per frame — four gradients, two closures, a lifted colour array and a colour string per spark — for a layer that only changes when the tint or the wing's size does. The tint and gradients now live in a per-wing skin, spark alphas ride `globalAlpha` rather than new colour strings, and the size is read once per frame and shared by both wings and the reader. Only the analyser read allocates nothing; the rest of the loop is now allocation-free.

Spacing follows from the same fix: `barCountFor` caps the run at forty, and the step is `width / bars`, so a wide wing spreads its bars to the full width instead of stopping mid-fade at 41% opacity around 2050 px. The cost is a little more state — a skin per wing and a band count that can change on resize — and a reader that re-derives its edges when the width crosses a bar boundary: a few allocations on resize against a hundred per frame.

### 2026-10-23 · One gate includes e2e, and the hook runs unit tests

`pnpm verify` ran the unit suite and then stopped, so a green run said nothing about the Playwright specs. CI ran them as a second step and the docs told humans to remember `pnpm test:e2e` on their own. That gap was not theoretical: the first run of the widened gate failed nine a11y specs, all `target-size` on the `v{appVersion}` changelog link in the footer and the settings sheet, and no local gate had noticed. The link now carries `inline-flex min-h-6 min-w-6 items-center justify-center`, which clears WCAG 2.5.8 without changing the type.

`verify` now calls `pnpm test` (both suites), CI installs Chromium before it and drops the separate e2e step, and the workflow step name follows. The pre-commit hook runs `pnpm test:unit` before `vp staged` rather than e2e, because the specs need a dev server and a commit should not start one. Docs that described verify as unit-only are updated in the same change, and `CODING_STANDARDS.md` §15's Playwright note now scopes the risk to a scoped `vp test` run.

The cost is time: verify is about two minutes longer and needs port 8081 free, so a running dev server on that port is reused while a stale one is a hang. A commit is also a unit-suite run now. Both are cheaper than shipping a broken accessible name because the gate that would have caught it lived in a separate command.

### 2026-10-23 · Pre-commit runs both test suites

The first version of the hook added only the unit suite because Playwright needs a dev server. That left commits able to skip the E2E suite even though `pnpm test` already runs both suites and Playwright manages its server on port 8081. The hook now runs `pnpm test` before formatting staged files, matching the user's expectation that commit verification covers the full suite. The cost is longer commits and a requirement that port 8081 be available (or have a reusable local server).

### 2026-10-29 · F-Droid review round 3: ask once, overlays own back

Two reviewer observations were real, and both came from the same shape of mistake: a piece of UI assumed it was the only thing that could be happening.

`NativeAudioPlugin.play()` requested `POST_NOTIFICATIONS` on every play while the grant was missing, so answering "Don't allow" bought the same dialog on the next station. The prompt is only worth one ask: after that, the answer belongs to the user, and Android hides the dialog after two denials without saying so. The plugin now records the ask in `radioscout_audio` SharedPreferences and also treats `shouldShowRequestPermissionRationale` as "already answered", which covers installs that denied before the flag existed. The decision stays a static function so JVM tests can pin it, and an in-flight flag stops a burst of plays from queueing two dialogs before the first answer is written. The device smoke still covers the denial path, where playback must start with the dialog open or absent.

The hardware-back listener in `NativeShell` only knew about history and exit, so Back with the Settings flyout open left the app and took the menu with it. Station sheets were fine because they are routes; the flyout is local popover state the shell cannot see. Rather than teach the shell about every overlay, overlays claim the press themselves: `src/lib/native-back.ts` holds a stack of handlers, newest first, and the shell runs it before navigating. `SettingsMenu` registers while mounted and closes the popover when it is open. The registry is deliberately synchronous and small — an overlay that needs async work before closing is a dialog that should have been a route.

The cost is a second, non-routing navigation stack to keep honest: a future overlay that forgets to register will still exit the app on Back, and the unit tests only prove ordering and cleanup, not that every overlay joined. The F-Droid description now also names the three services the reviewer flagged plus the BBC and Radiolise metadata endpoints, which makes the `NonFreeNet` anti-feature concrete instead of implied. None of that reaches the listing until the recipe's pinned commit moves past the description change.

### 2026-11-12 · Dependency refresh: age-gated, PRs superseded

Eleven Dependabot PRs had gone stale, so the whole dependency set was taken to the newest version that clears pnpm's seven-day `minimumReleaseAge` rather than to the version named in each PR. That gate, not Dependabot's cooldown, set the ceiling: `lucide-react` 1.69.0 against the PR's 1.66.0, `fallow` 3.39.0 against 3.38.1, `wrangler` 4.158.0 against 4.152.0, and `vite-plus` 1.6.0 rather than 1.4.0, since that family is already excluded from the gate because it publishes in lockstep with every release.

Two majors went in alongside the minors: `jsdom` 30 → 31, which is the unit-test environment and touches no shipped code, and `@capacitor/assets` 3 → 4, which only launcher artwork runs through (`scripts/generate-native-assets.mjs`). `oxc-transform-react` stops at 0.157.0 because 0.158.0 is still inside the window, so it trails the `@oxc-project/types` pin bundled by `vite-plus` 1.6.0 — the two are separate packages and the React transform loads by name, so the mismatch is harmless. `jsdom` 31 has its own gate problem: it needs `parse5-parser-stream` 8.1.1, which is inside the window, so the lockfile is deduped to a single `parse5@8.1.0` instead — 8.1.0 declared `parse5 ^8.0.0`, resolved 8.0.1, and threw `tokenizer.flushCharacters is not a function` in every worker that built a JSDOM.

The cost is the `vite-plus` 1.3 → 1.6 jump, which carries Vitest, Oxlint and Oxfmt with it: the whole `pnpm verify` chain — lint, both test suites, the prerender build and Fallow — is what judged it, and the lint and format configuration in `toolchain.config.ts` survived unchanged.

### 2026-11-15 · Best of British: Capital swap and a reach-led expansion

The shelf had drifted from live listening: it held the 34 uuids taken from the 2026-09-23 favourites exports and, measured against RAJAR Q3 2026, omitted four of the five biggest commercial networks — Greatest Hits Radio (5.7m), Hits Radio (3.7m), LBC (2.8m) and Virgin Radio (1.0m, 1.9m network) — plus BBC World Service, Times Radio, talkSPORT 2, the BBC networks outside the main six, and every Heart decade. Xtra Hot had also been discontinued, so its row was replaced in place with Capital (`4ad5bdc7-…`, verified live on `media-ssl.musicradio.com/CapitalUK`). Twenty rows were added on reach, which takes the list to 54. The selection rule was deliberately narrow: only rows that resolve to https already, or to http on a host in `HTTPS_UPGRADE_HOSTS`, so the expansion needed no code change. Every uuid was re-resolved through the directory `byuuid` endpoint and its resolved URL range-probed for a `200 audio/*` response before it went in.

Reach is where the curation stops. Greatest Hits Radio has no national row in the directory — the only row named "Greatest Hits Radio" is `net2westmidlands` — so the shelf shows the national name and plays the West Midlands feed; Hits Radio is the same shape (`key.aac`, national-sounding name, `Hits Radio UK` row). LBC, the fifth-biggest network at 2.8m and the most loyal audience on the list at 10.3 hours a week, could not be added at all: every main row is http on `media-sov`/`media-ice.musicradio.com`, only `media-the` is allowlisted, and `filterPlayableStations` drops the rest silently. Unblocking it is an allowlist decision that has to verify the https twin's playlist body (§15), so it belongs in its own change rather than this one. GB News Radio (632k) and Talk (497k) have no GB row to add. Kerrang!'s row still carries unsubstituted `~TEMPLATE~`/`~LSID~` player macros; it serves audio today and is in, but it is the first row to suspect if it dies. Times Radio and Virgin Radio 301 to `*.live.stream.broadcasting.news` over https — harmless because the hop is https, but worth knowing that `filterPlayableStations` only ever judges the initial URL.

The cost is that the list is a reach snapshot, not a ranking: nothing re-derives it from RAJAR, so the next curation pass redoes this research, and the group comments document provenance rather than display order, since `processBritishStations` still dedupes by name and sorts A–Z. Curating by measured reach also means the list now carries commercial networks a listener may not consider "British music radio" at all — talkSPORT 2, Times Radio, Sunrise — which is the intended reading of the shelf title, not a drift.

Re-resolving the whole list turned up an older regression that had nothing to do with the additions: 12 of the 34 original uuids no longer exist in the directory, because radio-browser issues a new uuid when a station is deleted and re-added. The shelf had therefore been rendering 22 of its 34 rows, and the casualties included BBC Radio 4, talkSPORT and Capital FM London. Five had a live drop-in row and were swapped in the same pass (Radio 4 `19621204`, BBC Live News `3f98c448`, talkSPORT `9f5d0645`, Capital FM London `038bfc04`, Capital Dance `bee4aa5e`). The rest cannot be repaired by curation: KISSTORY, KISSTORY R&B, KISS UK, Heart UK and BBC Radio 1 Dance have no playable row at all — the Bauer Kiss rows are http on `stream-kiss.planetradio.co.uk`, Heart UK is http on `media-ice`, and BBC Radio 1 Dance has no row outside a private IP — and Smooth Radio now only exists as regional rows (`SmoothLondon`, `SmoothSuffolk`), so its national row is gone rather than stale, and the BBC Radio 1 alt feed is dead. That is the same allowlist decision as LBC; until it is made, those seven uuids stay in the list as inert documentation of intent, dropping out silently the way the file header says they do.

### 2026-11-16 · Drops are three shapes: loud, silent, and a clean close

Long Capital XTRA and Capital Dance sessions (roughly ten minutes in) reported a disconnect followed by a reconnect that often did not land. The reconnect table and the `online` fast path were never the problem: only one of the three ways a live stream dies ever reached them. `beginReconnect` was called exclusively from an element `error` handled while the snapshot was already `loading`, which assumes the element reports a stall (`waiting`) before it reports the failure. A transport that closes the socket cleanly fires `ended` instead — handled as a user pause, so the dock offered Play over a stream that would never answer — and one that simply stops delivering data fires nothing at all, leaving the dock on `loading` or `playing` over silence with no deadline. On a radio stream there is no buffer worth protecting, so all three now walk the table when `playedThrough` is set.

The new part is a 15s stall deadline on the live element. It is deliberately not in `reconnect.ts`: arming it needs the element identity guard, the play token and the snapshot, all of which live in the engine, and the module's side-effect-free contract is worth more than one `setTimeout`'s worth of symmetry. The cost is another module-level timer beside `incomingWatchdog`, and a threshold that is a judgement call: 15s is long enough to ride out a tunnel and short enough that a listener notices a recovery rather than a hang. A staged incoming element is explicitly excluded, because its handoff watchdog already fails that stage and both deadlines firing would advance the retry counter twice.

Two limits stay. The deadline needs the browser to keep running timers, so a backgrounded WebView that is already frozen reports its drop to the next foreground emit rather than on time. And the APK is covered by the Media3 service's own error path, which this deadline does not touch — if a stream host rather than the transport is closing the connection, automatic recovery is what changed here, and a host that refuses the reconnect still ends at the five-attempt toast.

`brave://media-internals` filled in the clean-close shape afterwards. A House Nation UK response ended with `av_read_frame(): End of file` after roughly 1017s of audio — the host closed it, not the browser — and the element then fired `pause` before `ended`. That ordering is why the reported symptom was a Play button rather than a reconnect: the first fix already recovered from `ended`, but the pause inside the same EOF parked the dock first. The `pause` handler now yields whenever `element.ended` is set. It also settles the origin question: Memory Saver, tab discard and background throttling were never involved, because the page stayed alive and the audio simply ran out of bytes.

The close itself is a normal transport shape rather than a fault: `streaming-london2.radio.co` answers with `Connection: Close`, and Icecast can end a listener through `<max-listener-duration>`, a `client-timeout` trip, or a hosting provider rotating a streaming node. What it does not do is close on a schedule the client can see, and that part was tested: a curl probe of the same URL streamed for 20.8 minutes and 30 MB without being closed, while one browser session had ended at ~17 minutes — so a learned `budget` would have been a fiction, and the pre-emptive re-tune built on it was deleted rather than shipped.

The engine reacts instead of predicting. A clean `ended` takes the first backoff slot immediately, because the host has already completed the response and the element's buffer has drained, leaving nothing for a 2s wait to protect; a failed immediate attempt hands back to the table's second slot. Measurement corrected the rest of it: the first close after that change still left 2.36s between `kEnded` and the replacement player being created, and the silence was not the timer at all — `resolveUrl` was fetching `/json/url/<uuid>` before the new element existed. So the immediate attempt now skips the directory and replays the URL that just worked, and only the retries after it pay for a lookup. That keeps recovery generic — the same path covers a node rotation, a `client-timeout` trip and an unpredicted `<max-listener-duration>`, and nothing in the engine learns or assumes a connection lifetime.

Worth recording that two reference players were checked and neither reconnects at all: Radiolise answers an `error` with a modal and stops, and web-radio's `AudioService` wires no `ended` handler, so there was no prior art to copy — their apparent seamlessness is a session that never hit a close.

The next two closes held the measurement: `kEnded` to the replacement player's creation fell to 27ms and then 20ms, against 2.36s while `resolveUrl` still sat in the immediate path. The same session also showed what the stall deadline is for: two `DEMUXER_UNDERFLOW` dips mid-stream, one 1.9s and one 102ms, that refilled themselves — well under `DROP_STALL_MS`, so no reconnect was armed. A deadline tight enough to catch those would have torn down a stream that was about to recover on its own.

### 2026-11-17 · A silent drop cost 18.7s of audible silence

The clean-close path above was measured end to end; the silent one was not. A Capital XTRA session in dev made it audible. `brave://media-internals` shows player 10 stall at t=1210.5s (`DEMUXER_UNDERFLOW`, `BUFFERING_HAVE_NOTHING`, never refilled), get paused and destroyed at t=1230.5s, and player 11 created at 17:29:31.950 having reached `kPlay` 28ms later. Last decoded audio to first new audio: **18.7s**. The decomposition is entirely self-inflicted: 15s of `DROP_STALL_MS`, then the table's 2s first slot, then a 1.7s `/json/url/<uuid>` lookup. The handoff itself was fine — player 10 was only torn down 1.2s after player 11 was created, inside the crossfade — and the replacement started fast on the URL it was given.

Why one shape measures in milliseconds and the other in seconds is a property of the transport, not of the code. House Nation's host completed the response (`Connection: Close`, `av_read_frame(): End of file`), so the demuxer emitted end-of-stream and the element fired `ended`: a fact to react to, which is why that path contains no deadline at all — 27ms and 20ms are reactions. Capital XTRA's host left the socket open and stopped writing, so there was no EOF, no `error` and no `ended` (player 10 never logs `kEnded`), and the element only reports that its buffer ran dry *after* the audio has already stopped. From that moment the only thing separating "dead" from "slow" is elapsed time, and Chromium's own socket timeouts are minutes away. Any number in that path is a guess about silence length; no amount of measurement turns it into the House Nation case, and only a positive signal from the transport could.

So the deadline was not the only cost; the retry path was the generic one. `error`-shaped drops go through `schedule(1)` and a full re-resolve, which is right when the *station* is in doubt: a rotated URL is exactly what a re-resolve is for. A stall is not that. The socket stopped delivering bytes while the station stayed up, which is the same situation a clean close leaves, so the stall fire now calls `beginReconnect(station, { immediate: true })` and replays the known URL. One path, two shapes, one argument: the silence has already started, so a wait and a directory lookup can only extend it.

`DROP_STALL_MS` fell from 15s to 2s, the direction the 2026-11-16 entry argued against: a tighter deadline, it reasoned, would tear down a stream that was about to recover. That argument priced the false positive as the expensive thing, and it was only expensive then. The retry now replays the URL that was working, the replacement reaches `kPlay` in 28ms, and the outgoing element is silent in this shape anyway, so a wrong guess costs one connection, one toast and a crossfade that lands *before* the dip it misjudged would have healed. What the threshold still has to clear is churn, not audibility: it must sit above an ordinary CDN hiccup, and the longest self-healing dip measured is 1.9s, so 2s is deliberately at the edge rather than comfortably above it. Anything below that needs a different mechanism rather than a smaller number — opening the replacement connection while the stalled one still has its chance, and discarding it if the live element recovers, would buy ~0.3s instead of ~2.3s at the cost of a second connection per stall and its own cancel path. A deadline cannot be shorter than the observation it is waiting on. The 15s figure was a tunnel judgement as well, and the tunnel case does not need it: while a wait is armed an `online` event fires it at once, so a returning network is caught by the fast path rather than by a longer grace period.

A latent trap in the same code was fixed while measuring it: `armDropWatchdog` began with `clearDropWatchdog()`, so every repeat `waiting`/`stalled` restarted the clock. A dead transport keeps re-reporting both for as long as the browser waits on it, which means the one shape the deadline exists for could have postponed its own recovery indefinitely — and a shorter deadline would have made that failure far more likely to matter. It now arms once per episode and is cleared by `playing`, every `play()` and `cancelReconnect`.

The cost is a CDN dip that heals just past 2s spending a station restart, a "Connection lost" toast and a redundant connection where 15s would have waited it out silently. It does not cost extra quiet: the replay fires at the deadline and the replacement reaches `kPlay` tens of ms later, so a listener hears no more silence than the dip itself would have taken — and for any dip longer than that, the restart is what ends the silence, which is the whole point of the lower number — unless the replay itself fails into a path that is still down, where the table's 5s slot is next and a dip that would have healed before then loses those seconds to the restart. The two dips measured (1.9s, 102ms) both fell under the deadline, and 1.9s is close enough to the edge that a re-run could catch one. Rejected: pre-emptive re-tuning on a learned connection lifetime (this session's 25-minute curl probe streamed 1500s / 36 MB without a close, so there is no schedule to learn), and a speculative second connection opened during the stall (it needs its own cancel path and doubles connections on every hiccup, for a gain the 5s deadline already takes). Unchanged: the deadline is blind to a backgrounded WebView whose timers are frozen, and the APK's recovery still belongs to the Media3 service.

### 2026-11-20 · A stall is judged by the playhead, not by the event

Two Chromium reports looked like opposites and had one cause between them: BBC stations over HLS reconnected about every five seconds, while ICY stations reconnected about every twenty minutes. The twenty-minute one was already understood — Icecast ends a listener on its own schedule, and no client-side number makes that faster or slower — so the odd report was the five seconds, which was the player tearing down a stream that was playing. Edge 157 answers `canPlayType("application/vnd.apple.mpegurl")` with `"maybe"`, so `hasNativeHls()` is true, the app assigns the `.m3u8` and never attaches `hls.js`; that demuxer reports `stalled` at every live-edge segment boundary. Measured in the real browser, with a bare `<audio>` on the same page: `stalled` at 4045/11713/17903/24122ms, one per 6.4s segment, while `currentTime` climbed 3.69→23.76s and `play()` never rejected. `noteStall` read each of those as a drop, flipped the dock to `loading`, armed the 2s deadline, and replayed the URL when it expired — once per segment, with a "Connection lost" toast per lap. `hls.js` never shows the shape because MediaSource keeps the element's buffer ahead of the playhead, and ICY has no segment boundaries to show it at.

The tunnel was measured first and exonerated: over the same NordVPN exit, ICY streamed 60.5s with zero gaps and survived an 8s read pause on both a steady read and a raw TLS socket; 45 BBC playlist reloads and 13 segments completed with no failures at p50 78ms / p95 365ms / max 412ms; handshakes were 50–60ms to the Icecast host and 140–153ms to Akamai. One native-HLS attempt did hang outright — `net::ERR_CONNECTION_TIMED_OUT` on a `Media` request, `error` at 21.1s, the playhead never leaving zero — and a replay recovered it, so the media fetch can genuinely die on this path. That is what a deadline should still catch, and it is not what the five-second cadence was. The earlier guess that Chromium was silently swallowing a dead ICY socket, leaving the deadline unarmed, is the wrong way round: it was reporting stalls too eagerly, not too quietly.

So `noteStall` no longer emits `loading`, and `armDropWatchdog` no longer trusts elapsed time on its own: it records `currentTime` when it arms and re-reads it before it fires, and a playhead that advanced by `DROP_PROGRESS_S` (0.25s) drops the deadline and leaves the status on `playing`. The 2s threshold now measures the silence a listener hears rather than the interval since an event, which is what its comment had always claimed it did. A bailed deadline is not a shield — the next `waiting`/`stalled` arms a fresh one, so a socket that really dies after a healthy boundary still reconnects on the following deadline — and the existing underflow evidence is unaffected, since the two self-healing dips measured (1.9s and 102ms) never reach the deadline either way.

Where the latency enters is worth writing down, because the report that started this was "only with the VPN". `stalled` is the spec's *media data has surprisingly not arrived for more than 3 seconds* signal, not a fault, and the native path fetches a single segment at a time at the live edge with barely any lookahead. On a ~20ms path a boundary refill finishes in tens of ms and never approaches 3s; over a tunnel the same fetch runs on a different Akamai edge (handshakes measured 140–153ms to Akamai against 50–60ms to the Icecast host) on a shared exit node, and one refill that idles past 3s emits `stalled` over audio that is still playing. The tunnel was therefore not causing a failure — it was moving a latency knob across a threshold Chromium defines for itself, which is also why the same build behaves differently in Chrome and Firefox rather than differently for the station. It is the same coin as the one `net::ERR_CONNECTION_TIMED_OUT`, the other way that path can genuinely die behind a congested exit node and the case a deadline should still recover.

The cost is two judgements that are now load-bearing. 0.25s is the smallest advance that separates "played through the boundary" from "frozen", and a stall whose playhead creeps forward by a fraction would be left on `playing` until the next stall arms again — tolerable because `currentTime` on a live stream only moves with audio the listener is actually hearing, and the shape this exists for re-stalls immediately. The dock also keeps saying `playing` through up to 2s of a genuine silent drop instead of flipping to tuning on the first report, which is precisely the flicker being removed. Rejected: bridging every Chromium station through `hls.js`. It measured steady — 8 fragments loaded, `currentTime` 14.93→58.93, zero stalls — but adopting it means giving up the platform demuxer to work around one false positive, and the progress guard fixes the class rather than a single transport. Still uncovered: a backgrounded WebView with frozen timers, the APK's Media3 path, and the fact that `playing` resets the attempt counter, so a five-second flap loop could never have exhausted the table on its own.

### 2026-11-21 · Lyrics overlay from LRCLIB (web, opt-in)

The dock already carries the live StreamTitle, so the cheapest lyrics feature is a consumer of it: one LRCLIB search per changed title, a timed LRC cursor, and one ambient line above the player. The lookup runs from the client — LRCLIB sends `Access-Control-Allow-Origin: *`, the preflight allows `lrclib-client` (how a browser identifies itself when `User-Agent` is forbidden), and `connect-src https:` already covers the host. No Pages Function, no key, no header edit. `/api/search` is the route because `/api/get` needs a duration ICY never carries; the picker keeps the first record whose normalized title matches and whose artist agrees, and records without `syncedLyrics` are skipped rather than shown untimed.

The feature has its own switch (`radioscout:lyrics`, off by default, web only) rather than riding the visualiser. The leveller has no bearing on it, and tying it to the visualiser would hide lyrics whenever the wings were off. It mounts from `lg` up like the wings and shows nothing on the APK. Because lyrics consume the same `snapshot.track` the subtitle does, either switch now arms the probe: `refreshTitleProbing` ORs `readTitlesEnabled()` and `readLyricsEnabled()`, and both settings buttons call it, so turning one off no longer stands the probe down while the other still wants it. The cost is that lyrics on with titles off shows songs in the dock subtitle too — the honest consequence of needing a title source.

Sync is approximate by construction, and the overlay is deliberately one current line plus the next rather than a karaoke bar. Elapsed time starts when the title reaches the client; the 20s poll (or the push socket when healthy) and the stream buffer mean the cursor can trail or lead the audio by seconds, and a listener who tunes in mid-song starts at line one. The card remounts per title, so a track change resets it without an anchor; pause hides it, and the query is cached per title so a repeated song costs no request. Left out of this pass: a manual offset control, plain-lyrics display, and any attempt to derive a real position from the stream. Rejected: a Pages Function proxy (unnecessary while CORS works), the beta v2 search plus a second `/api/get` call (two requests for the same payload), and gating on the visualiser (the card is useful without the wings).

### 2026-11-21 · Lyrics timing: anchored cursor, tighter probe, nudge

The first pass timed the cursor from the card's mount, which made part of the desync self-inflicted and unrecoverable by waiting. The card is not the track: a pause unmounts it, the lyrics switch unmounts it, crossing the `lg` breakpoint remounts it, and it first paints only after the LRCLIB round trip. Each of those restarted the count at line one — so a listener who paused mid-song, or toggled the switch to compare, got a cursor minutes behind the vocal with no way back. The anchor is now module-level and keyed by title: stamped when the title reaches the client, held across remounts, and re-stamped on a change, including the A → B → A rotation the probe really does apply twice.

The larger error was the metadata itself. Half the stations measured refuse a direct in-page ICY read, and the browser memo makes that verdict permanent per URL, so those listeners always take the edge function — whose Cache API entry lives for the 20s poll window by design. A 20s poll reading a 20s-old verdict puts the title up to 40s behind the audio, and no cursor is right off that. Lyrics now run the probe at 8s and the edge read carries a cache-busting `_` parameter, so the verdict is read fresh; every other listener keeps the 20s loop and its cache, and BBC stations stay on their own RMS chain. The cost is roughly seven extra upstream probes a minute, paid only by people who turned lyrics on and only on the stations that reach that tier — the same upstream read the app already makes for stations it has not memoised.

What is left is buffer lag, a station's own bookkeeping, and a mid-song tune-in, where no client measurement exists: ICY carries no playback position and the element clock counts connection time, not song time. A persisted ±1s nudge, clamped to ±20s and reset by pressing its readout, lets a listener close that by ear; it is per install rather than per station because the latencies are app-level and the station-to-station difference was not worth a storage map. Rejected: leading the anchor by half the poll interval — it halves the mean error but makes the common case (a title caught on the next poll) wrong by that much in the other direction — and any attempt to derive position from the stream.

### 2026-11-21 · Lyrics without a cursor: the whole song in the station sheet

Two passes of timing work made the overlay honest without making it right, and the remainder is not reachable from a client. The stream carries no playback position, a title arrives up to a poll interval late, the audio sits behind the station's encoder by an unknown amount, and a mid-song tune-in has no measurement at all. A cursor that is always a few seconds off is worse than no cursor: the listener reads the wrong line and cannot tell whether the fault is theirs. So the cursor went — the overlay, the anchor, the nudge, the 1 s clock and the lyrics switch with it.

The Info tab now shows the whole song under a `Lyrics` heading, in a fixed-height scroller so a full lyric sheet does not bury the station facts. Untimed, so a late title, a buffering stream or a mid-song join changes nothing about what is on screen. LRCLIB's plain document is preferred and a synced one falls back to its text with the timestamps stripped — the picker no longer skips plain-only records, which widens the match pool, and a plain document cannot lose the untimed rows an LRC parse drops. The request runs when the tab opens: the same opt-in the switch was asking for, one click closer to the content, and paid only by the tab that reads it.

Consequences. The Titles switch still owns the probe, so the block needs it on and says so when no track is known. The 8 s cadence, the cache-busting edge read and the lyrics-driven arming are reverted: all three existed only to start a cursor on a fresh title, and they cost roughly seven extra upstream probes a minute. `AppLyrics.tsx` and `LyricsSwitch.tsx` are gone, the effect audit loses a row, and the old `radioscout:lyrics` key is simply unread. Rejected: keeping the switch as a gate (it would hide a feature whose fetch is now explicitly on demand) and listing the synced lines with their timestamps (timing nobody can trust invites a karaoke read).

### 2026-11-21 · Lyrics section: collapsed until opened, titles required

Two corrections to the block from the entry above. It fetched as soon as the Info tab mounted, and that tab is usually opened to read the station's own facts — so a listener who never wanted lyrics still handed LRCLIB the track name. The section is now a disclosure row with the current track as its summary: closed by default, with the query disabled until it is opened (`useLyrics(track, open && titlesOn)`). Closing keeps the cached answer, so reopening the same song is instant.

The fetch also now requires the persisted `Show song titles` switch. That switch arms the probe, so with it off there is no track to name anyway — but checking it explicitly lets the section explain itself instead of sitting on "Waiting for a title" forever, and guarantees no request fires behind a listener who turned titles off. The APK is exempt: its switch is hidden and the service reports titles regardless.

This supersedes "the request runs when the tab opens" in the entry above.

### 2026-11-21 · Lyrics moved onto the live row in the Recent tab

Info was the wrong tab for lyrics: it holds the station's own facts, while the Recent tab is already a list of heard songs. The block is now an expansion of the newest row — the song playing now — so the lyrics sit where the song is, and the row reads as the thing you open rather than a second panel in the same tab. Hovering it gives the hand, a mic icon after the title marks lyrics as available, and a click reveals the whole song underneath. Only that row expands: every other row is history whose song has moved on, and each would need its own request.

The gates from the previous entry are unchanged. The query stays disabled until the row is clicked, and only the playing station's newest title can be passed to it, so an untouched tab still names no track to LRCLIB and a listener who turned titles off has no live row to open. `StationLyrics` and its Info-tab wrapper are gone; the panel is inline in `RecentTracks`, where the row it belongs to already lives.

A BBC programme row is excluded even when it is the live one: a show is not a song, so there is no lyric to look up and no mic to promise one. Rejected: making every row expandable (a history entry can disagree with what LRCLIB would find, and each click would be a fresh lookup) and a separate chevron beside the mic (two affordances for one action — the mic is the indicator and the row is the control).

### 2026-11-21 · Lyrics as stanzas, and the row width that overflowed

Dropping the timestamps threw away the one thing they still say honestly: where the singer stops. A synced document now yields stanzas — a gap of eight seconds between consecutive stamps ends one — and the stamps themselves are dropped. Plain documents group by their own blank lines. The block renders one paragraph per stanza with a fixed gap, so verses, choruses and the pause before a bridge read as structure rather than a wall of lines.

Eight seconds, not four, and synced over plain, both came from looking at a real record rather than guessing. In LRCLIB's copy of a current single, consecutive lines of one verse sat 5.3 s, 5.7 s and 6.4 s apart, so a four-second rule split every verse into single lines; only the 10 s and 27 s gaps were real breaks. The same record's plain text had no blank lines at all — one unbroken paragraph — which is why the synced document now wins whenever it has one and plain is only the fallback for records that were never timed. That choice is `recordStanzas`, extracted so a network is not needed to test it.

The live row's button carried `-mx-1.5` with `w-[calc(100%+0.75rem)]`, and `100%` resolves against the list item, not the list — so the row finished six pixels past its right edge and the mic icon surfaced it as horizontal scroll. Both row wrappers are now `w-full` with their own padding, so nothing extends past the sheet's column.

### 2026-11-21 · LRCLIB identification, serial requests, Retry-After honoured

`docs.txt` sets three obligations the client was only partly meeting. Identification wants name, version and a link; ours carried a bare name, so `Lrclib-Client` now reads `Scout v<version> (https://radioscout.pages.dev)`, with the version taken from `package.json` the same way the settings footer does. Requests must go out one at a time with a 200–500 ms gap, so they now pass through a module queue with a 300 ms floor — a listener stepping through songs cannot produce a burst.

A `429` or `503` must be answered with the server's `Retry-After` and jitter, or the client risks a temporary ban. The header (delta-seconds or an HTTP date) sets a client-wide deadline padded by up to 30%, and nothing is sent before it. Reaching that deadline throws instead of returning "no lyrics": a null answer is cached per title for 30 minutes, so a transient throttle would otherwise read as a permanent absence, and TanStack's retry would violate the window — hence `retry: false` and a row that says LRCLIB is busy. The content type is checked before parsing, as the docs advise, because edge rejections are not guaranteed to be JSON.

Not taken: registering for `Lrclib-App-Id`. It is optional and raises the per-IP allowance from about 90 to about 180 requests/min, which a click-only client does not need.

### 2026-11-21 · Bracket lyric lines italic, skeleton while lyrics load

Bracket lines — `[Chorus]`, `(Ooh, yeah)`, a guest singer's interjection — are not the lead vocal, so they are now set in italics and a muted tone while the lead line stays full-strength. That needed one change underneath: a stanza renders one block span per line instead of one joined string with `whitespace-pre-line`, so a single line can carry its own style and the stanza still keeps its spacing.

The loading state is a skeleton now, not prose: five centred bars in the same card shape as the lyrics, `animate-pulse` with `motion-reduce:animate-none`, `aria-busy` and an sr-only "Looking for lyrics…". That is the pattern the sheet's own loading fallback already uses, and it says where the lyrics will appear instead of telling the reader that a request is in flight.

### 2026-11-25 · Listening average rows name the sample, not a time share

The Average sort ranked stations by mean seconds per banked session but captioned each row with the station's share of total listening time, because an average has no share of its own. The two metrics disagree on small samples: one 26-minute listen is 0.3% of 149h of listening, so it topped the chart as "26m avg (0%)" beside a full bar — which reads as a broken number rather than a station that was opened once.

Average rows now append the sample size (`26m avg · 1 session`), while Total and Sessions keep their real shares; the bar was already scaled by the sort's own value, so only the caption was lying. The row model — ranking, captions, the Other row and the unrounded cascade shares — moved out of `ListeningStats.tsx` into `listening-rows.ts` so it is testable without a DOM, and `tests/unit/listening-rows.test.ts` pins the reported case. The cost is that Average mode shows no percentage at all; the time split is one tab away under Total.

Rejected: showing the average as a percentage of the overall mean session (an average of averages, which no listener can compare against) and hiding one-off stations behind a minimum play count (it would drop a station the listener did open, and the sample caption already explains the ranking).

### 2026-11-25 · Listening stats read (station, day) rollups, not the session log

The session cap was the only thing keeping the charts cheap: `summarizeListening` read the whole `listening` table and aggregated it in memory, and the player invalidates `LISTENING_KEY` every time a session banks — on every checkpoint, station switch and native buffering blip. Raising the cap to 100k on that design would have put a full scan on each bank; measured on the real function, 1k rows took 6 ms, 10k took 50 ms and 100k took 479 ms on a desktop, with a low-end phone several times worse.

Sessions now fold into `listeningDaily`, one row per (station, local date) carrying seconds, plays, longest session, the four daypart splits and the newest name, written in the same transaction as the raw row. The charts read only the rollups, so summary cost tracks listening days rather than sessions — a decade of daily listening is a few thousand rows — and pruning the raw log no longer changes a total. There is one aggregation implementation: `summarizeListeningRows` folds in memory and calls the same `summarizeListeningDays` the stored path uses, so reference and rollups cannot drift, and `tests/unit/radio-listening.test.ts` asserts they agree. The raw cap is now 100k (backup detail plus rebuilds), and the envelope is v9 carrying the rollups; a pre-v9 envelope rebuilds them from its sessions on restore. Dates freeze at write time, so a session stays on the local day it happened even if the device changes timezone.

Rejected: capping raw rows at 10k instead of adding rollups (still a 50 ms scan per bank, and totals would truncate), and dropping the raw log entirely (no rebuild path, and the backup would lose per-session detail). The cost that remains is the backup: 100k raw sessions are about 15 MB of JSON, so the export is now the largest file the app writes.

One migration scar: the rollup store was first named `listening_daily` while the code read `listeningDaily`, and a dev database that opened during that window sat at v4 with an empty, wrongly named store — every summary threw and the home section hid itself as if nothing had ever been banked. v5 drops that store, and `summarizeListening` rebuilds the rollups whenever the raw log holds more sessions than they do, so a half-built cache heals on reload instead of needing the cache cleared. A pruned log always holds fewer rows than its rollups, so the repair can't mistake a cap for lost history.

The version change itself reads and writes no user rows — v4 and v5 only declare schema, and the backfill runs on the first summary. That is deliberate: an upgrade that folded inside Dexie's versionchange would take the whole database down with it if a single row tripped the fold, and every table (favourites, history) would be unreadable until a fix shipped. A failed backfill now costs one empty chart and retries on the next read.

### 2026-11-25 · Flavour palettes brought to WCAG AA

Auditing the token blocks found 18 text pairs under 4.5:1 and one focus ring under 3:1, none of them in the default theme. `muted-foreground` was the common offender — it is every caption and secondary label, and it also sits on `muted` in the Clear stats button and the palette keycaps — while Gruvbox dark's `--muted` was literally the card colour, which hid muted hovers and the volume rail along with it.

Each flavour now clears AA for the pairs it renders: Gruvbox light `muted-foreground` #675b50 and `primary` #6e6a0c; Gruvbox dark `muted-foreground` #c9bdae and `destructive-foreground` #1d2021; Nord light `primary` #4c6a94 and `destructive` #a8424c; Nord dark `muted-foreground` #b6c0d4 and `destructive` #d68f97; Sunset `primary-foreground` #2a2024 on the orange (6.3:1), `secondary-foreground` #a34a38, `destructive` #cf2b38, and the light ring #d94f2f; Catppuccin light `muted-foreground` #52556d, dark #b0b8d2. The volume rail moved from `muted` to `border` because the rail is a line, not a surface.

Rejected: leaving the near-misses (4.06–4.46) as close enough — they are all captions at 12–14 px, where 4.5 is the threshold — and lifting every `border` to 3:1, which would turn each card edge into a hard outline; a control boundary that needs 3:1 wants its own stronger token rather than a darker decorative border.

### 2026-11-25 · OTA publish survives a re-run

A failed OTA publish could not be retried. The 0.4.7 run created `ota-production-0.4.7+ota.1` with its bundle, then stopped in the retention loop: the manifest still carried a `0.4.4+ota.1` row whose release and tag had already been deleted, so `gh release delete` exited non-zero, `sh` treated that as fatal, and the manifest was never written. Devices stayed on 0.4.5+ota.1 while both the APK release and the new bundle existed. A re-run would have failed a second time, because `gh release create` refuses a tag that already has a release.

`publish-ota.mjs` now treats retention as best effort. A release that is already gone is the desired end state, so the row is dropped and any leftover tag is deleted through the API. The publish step removes a release carrying its own tag before creating one, so the script is idempotent for a single version. The cost is that "not found" is recognised by matching the message, and a partial publish replaces its release rather than aborting on the collision.
