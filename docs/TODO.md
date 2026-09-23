# RadioScout TODO

Radio switcher (`radioscout`). The Scout home-inventory app was purged
2026-09-20 — radio only. Check items off as they land gated (lint, tsc, unit, e2e, build).

## Landed (verify after each batch)

- [x] Radio scaffold: `lib/radio/{types,api,store,genres}`, `use-radio`, `use-player`, `/radio` route
- [x] Rebrand to RadioScout (`io.github.double77x.radioscout`, strings, manifest, OTA channel split)
- [x] Radio as home (`/`): header + search + genre chips, Most loved / Saved / Recently played
- [x] PlayerDock replaces BottomNav (transport + volume, persisted)
- [x] Home accordion sections (Saved first), tile tap-to-toggle play/stop
- [x] Radio backup: versioned JSON envelope (favourites, history, volume, votes) — export via share/download, import via Settings → Data; forward-compatible by design (new keys only, newer versions fail loudly)

## Now

- [x] ILIKE global search: multi-term matching ("BBC anthem" → BBC RADIO 1 ANTHEMS)
- [x] Station detail bottom sheet: location, genre, language, codec/bitrate, votes/clicks/trend, homepage, last-checked, Play + Favourite + Vote
- [x] Parse extra API fields: `geo_lat/geo_long`, `languagecodes`, `iso_3166_2`, `ssl_error`, `lastchangetime_iso8601`
- [x] Header directory total (`/json/stats`, "81.2K stations · N saved")
- [x] Genre chips return highest-rated top 50 (`order=votes`); added Rap (Pop, Rock, Rap…)
- [x] Central `formatCount` (825,088) used for votes/clicks everywhere
- [x] `StationArt` lucide fallback + `CountryFlag` (`flag-icons`, on-demand SVGs) replace bare country names
- [x] VERIFY EVERYTHING: lint, unit, e2e, build (several batches landed unverified)
- [x] Transport icons unified (Lucide Play/Pause/Square, all size-5)
- [x] PlayerDock volume-open layout polish (shape morph — applied, needs eyes-on)
- [x] Volume overlay: slides out from the volume icon (clip wipe), 3s auto-retreat
- [x] Section icon chips (Saved amber, Most loved blush, Recently played sky); Stations page logo-home header
- [x] Saved reorder (custom pointer engine, zero deps): grip handle plus drag-from-anywhere on the row (threshold-gated taps, button guard, touch long-press with scroll lock), lift + slide-aside CSS transitions, optimistic commit with release-point settle animation
- [x] Chip rail drag-to-scroll on desktop (pointer capture past 6px, click suppression; touch keeps native momentum)
- [x] History deduped (latest play wins), shows last 10
- [x] Footer directory credit is a hyperlink (no trailing period)
- [x] Title bitrate parser ("BBC Radio 1 128K" → clean title + `128k` subtitle)
- [x] Old-snapshot schema hardening (`withStationDefaults` — fixes BBC `toFixed` crash)
- [x] Listening stats: session clock on player transitions (5s tap threshold, pagehide/hide + native background checkpoints), `listening` table capped at 1000 sessions, Total/Daily SVG charts under Recently played, v4 backup envelope
- [x] Loudness leveling: Settings → Audio switch (adaptive K-weighted RMS gain via Web Audio, volume-relative so 0–100 stays master; CORS-blocked hosts rescued to direct playback once per element and remembered for the session, v5 backup envelope)
- [x] Native leveling: `LevelingAudioProcessor` in the Media3 pipeline (same DSP, JVM-tested), `setLeveling` bridge + per-play flag, one switch drives both players
- [x] Vote counts refresh (optimistic +1 on the cached detail + list invalidation behind the sheet)

## Next

- [x] Sleep timer with fade-out (wall-clock deadline in `use-player` + service-side arm `setSleepTimer` surviving screen-off throttle, 3s fade, countdown in dock + Settings → Audio, `sleep.ts` unit-tested, never persisted)
- [x] Play/pause/station-switch fades (900ms sweep in from silence on every start, 250ms fade on pause/stop; shared token-guarded ramp, manual volume cancels)
- [x] Station-switch gapless handoff (old plays until the new stream is ready, then a 1s crossfade; web staged element + native playlist advance; failures keep the old station with a toast)
- [x] Auto-reconnect dropped streams (backoff retry + quiet toast)
- [x] Recent searches (history chips under search)
- [ ] Now-playing track titles on APK (ExoPlayer ICY StreamTitle → dock + notification)
- [x] Player engine split (2026-09-23, zero-regression, move-gate-prove per phase): `lib/player/{fades,sleep-timer,native-bridge,leveling}.ts` unit-tested leaves extracted, state machine relocated verbatim to `lib/player/engine.ts`, `hooks/use-player.ts` left a 48-line facade (`usePlayer` + explicit re-exports, consumer paths untouched). Handoff/transport seam deliberately NOT cut — one state machine sharing live/staged elements, tokens, `usingNative`, leveling refs and reconnect flags (splitting moves complexity without concentrating it); see `docs/REFACTOR_PLAYER_ENGINE_PLAN.md`
- [x] Station card skeletons (`StationCardSkeleton`/`StationListSkeleton` mirror row geometry — Saved, history, top, search swap with no shift; `aria-busy` on sections; `isFetching`-gated so empty states never flash)
- [x] RadioScout mark (glass music note + sparkle): inline `Logo.tsx` (per-instance IDs, dark-scheme silver note), `generate-icons.mjs` + full regen (public SVGs/PNGs/ICO, `assets/`, 123 android drawables)
- [x] Settings redo (no tabs): Data (radio export/import) + Style stacked in one scroll view; household/backup sections gone with the purge
- [x] Scout purge (radio-switcher only): spaces/shopping/dashboard/household/manuals/alerts routes, components, hooks, Dexie ScoutDB, docs and tests removed; radio keeps its own RadioDB; `@tanstack/react-table`/`react-virtual` dropped (zero imports)
- [x] Drop Supabase entirely (template leftover): sync engine, auth/invites, OTA backend, config, migrations and docs removed — app is local-only
- [x] Lightweight OTA (zero services: in-repo manifest + GitHub Release zips, client-side pick in `src/lib/ota.ts`, `pnpm ota:publish`; first publish still yours — see script header)
- [ ] Separate Pages domain (canonical now `radioscout.pages.dev` — drop this once DNS is confirmed live)

## Backlog (native)

- [ ] Capacitor foreground-service audio plugin (Media3 + MediaSession) — true background, HLS, recording
- [ ] Wake alarms, Android Auto, widgets

## Gotchas

- `page.route` with glob `**/api.radio-browser.info/**` silently missed in smoke tests — use regex `/https:\/\/.*\.api\.radio-browser\.info\/.*/`.
- Bottom-sheet dialogs: Base UI `Dialog` direct (no wrapper), same tokens as `CommandPalette`.
- radio-browser is single-maintainer (segler-alex) free infra — keep mirror failover, no hard dependency at boot.
