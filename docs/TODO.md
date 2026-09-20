# RadioScout TODO

Radio switcher (`radioscout`). The Scout home-inventory app was purged
2026-09-20 — radio only. Check items off as they land gated (lint, tsc, unit, e2e, build).

## Landed (verify after each batch)

- [x] Radio scaffold: `lib/radio/{types,api,store,genres}`, `use-radio`, `use-player`, `/radio` route
- [x] Rebrand to RadioScout (`gq.danread.radioscout`, strings, manifest, OTA channel split)
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

## Next

- [ ] Vote wiring done via sheet; consider vote counts refresh
- [ ] Sleep timer (web-side, ~30 lines)
- [x] Station card skeletons (`StationCardSkeleton`/`StationListSkeleton` mirror row geometry — Saved, history, top, search swap with no shift; `aria-busy` on sections; `isFetching`-gated so empty states never flash)
- [x] RadioScout mark (glass music note + sparkle): inline `Logo.tsx` (per-instance IDs, dark-scheme silver note), `generate-icons.mjs` + full regen (public SVGs/PNGs/ICO, `assets/`, 123 android drawables)
- [x] Settings redo (no tabs): Data (radio export/import) + Style stacked in one scroll view; household/backup sections gone with the purge
- [x] Scout purge (radio-switcher only): spaces/shopping/dashboard/household/manuals/alerts routes, components, hooks, Dexie ScoutDB, docs and tests removed; radio keeps its own RadioDB; `@tanstack/react-table`/`react-virtual` dropped (zero imports)
- [x] Drop Supabase entirely (template leftover): sync engine, auth/invites, OTA backend, config, migrations and docs removed — app is local-only
- [x] Lightweight OTA (zero services: in-repo manifest + GitHub Release zips, client-side pick in `src/lib/ota.ts`, `pnpm ota:publish`; first publish still yours — see script header)
- [ ] Separate Pages domain (canonical now `radioscout.pages.dev` — drop this once DNS is confirmed live)

## Backlog (native)

- [ ] Capacitor foreground-service audio plugin (Media3 + MediaSession) — true background, HLS, recording
- [ ] Wake alarms, Android Auto, widgets (RadioDroid parity — only if needed)

## Gotchas

- `page.route` with glob `**/api.radio-browser.info/**` silently missed in smoke tests — use regex `/https:\/\/.*\.api\.radio-browser\.info\/.*/`.
- Bottom-sheet dialogs: Base UI `Dialog` direct (no wrapper), same tokens as `CommandPalette`.
- radio-browser is single-maintainer (segler-alex) free infra — keep mirror failover, no hard dependency at boot.
