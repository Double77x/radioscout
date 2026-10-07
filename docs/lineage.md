# Lineage

Append-only decision log, oldest first. One entry per decision: what was chosen,
why, and what it cost.

Read it when you need to know *why* something ended up the way it is. Do not
read it to learn what the code currently does. Current behaviour lives in the
code and in the module contracts under [`modules/`](modules/), and this file
never describes the present, which is exactly what stops the two from
contradicting each other.

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
### 2026-10-07 - The Capgo registry strip is a script, not a shell one-liner

Second pass on the same maintainer objection (`!49999`): the inline `node -e` that filtered `capacitor.plugins.json` is now `scripts/strip-capgo-plugin.mjs`. The recipe and the reference workflow both call it, because they must apply the same transform or the F-Droid build stops reproducing the signed reference APK.

`sed` was ruled out on evidence, not taste: the registry is JSON, the updater entry is the *last* array element, and a range delete leaves a trailing comma — invalid JSON that Capacitor's bridge reads at startup. Verified for the updater in first, middle and last position. `jq` would work but adds a build-env dependency the recipe does not otherwise need, and could not be verified byte-identical to the existing output here, which is the one thing that must not change: the registry ships inside the APK, so any whitespace difference invalidates the reference APK.

The script deliberately reproduces the previous output byte for byte (two-space JSON, no trailing newline). Re-serialising rather than editing in place also means the emitted bytes are fixed by this file and do not depend on whichever formatter produced the input. Covered by `tests/unit/strip-capgo-plugin.test.mjs`, including the updater-in-last-position case that the shell approach got wrong. Test include widened to `.mjs` because build scripts run under bare Node in CI and in the recipe and so cannot be TypeScript.
### 2026-10-07 - Reference publishing uses gh, not softprops/action-gh-release

Found by the first real run of the reworked reference workflow, and it is a bug the `v*` trigger introduced. `softprops/action-gh-release` reconciles an *existing* release against the **current git ref**. That only ever worked because the old trigger was an `fdroid-reference-*` tag push, where ref == `tag_name`. Once the workflow runs from a `v*` tag (or a dispatch branch) the two differ, and republishing an existing reference fails with `Unexpected error fetching GitHub release for tag <ref>: HttpError` — after the APK has already been built and signed, so the whole run reports failure and no asset is updated.

Replaced with explicit `gh release view` / `edit` / `upload --clobber`, addressing the release by name rather than by ref. The step also stops force-moving the reference tag: on republish it edits the existing release and clobbers the asset, and only creates a tag at `$GITHUB_SHA` when the release is genuinely new. The lesson is that "the tag the workflow runs from" and "the tag the release is published under" are two different things, and an action that conflates them breaks the moment the trigger changes.