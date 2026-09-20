# RadioScout Roadmap

Tracked workstreams. Checked items are done and gated (lint, tsc, unit, e2e, build).

## Done

- [x] RadioScout rebrand + PWA shell (manifest, icons, theme colors)
- [x] Radio as home (`/`): header + search + genre chips, Most loved / Saved / Recently played
- [x] Radio as home (`/`): header + search + genre chips, Most loved / Saved / Recently played (the old `/radio` tab page was folded back in — one switcher screen)
- [x] PlayerDock transport + volume (persisted prefs), station detail bottom sheet
- [x] Radio backup: versioned JSON envelope (favourites, history, volume, votes) — export via share/download, import via Settings → Data
- [x] Mint primary + pine/coal tokens; dark mode neutral grey, pastels retained
- [x] WCAG AA contrast enforced in CI (light + dark axe runs)
- [x] Local-first radio store (isolated RadioDB: favourites, history; Dexie, `fake-indexeddb` unit tests)
- [x] Settings flyout (radio data + style, no tabs) on logo trigger
- [x] Capacitor Android shell (APK/AAB scripts, NativeShell status/splash/back, SwipeBack gesture, share/keyboard/preferences plugins)
- [x] Client chunk budget (no chunk > 500KB: narrow `codeSplitting.groups` vendor chunks; see `vite.config.ts` constraints)
- [x] Dropped Supabase sync + auth + hosted OTA (2026-09-20, template leftover — local-only app; `SYNC_PLAN.md` deleted)
- [x] Lightweight OTA (zero services: in-repo manifest + GitHub Release zips; pending first `pnpm ota:publish`)
- [x] Purged the Scout home-inventory app (2026-09-20: spaces/shopping/dashboard/household/manuals/alerts, ScoutDB, `@tanstack/react-table`/`react-virtual`) — radio-switcher only
- [x] Card skeletons (`StationCardSkeleton`/`StationListSkeleton`, `aria-busy`, `isFetching`-gated empty states)
- [x] RadioScout mark (glass music note + sparkle across inline logo, public icons, android drawables)
- [x] Prerender filter excludes `#` and `?` crawler traps
- [x] Favicon runtime check (adaptive SVG mark verified per color scheme; `tests/favicon.spec.ts` regression test)
- [x] Dexie split into its own async chunk (`vendor-dexie`)

## Up next (agreed)

- [ ] PWA offline pass (service worker, install prompt)
- [ ] Sleep timer (web-side)
- [ ] Vote counts refresh (wiring done via sheet)
- [ ] Separate Pages domain (canonical now `radioscout.pages.dev` — drop this once DNS is confirmed live)

## Later / ideas

- [ ] Capacitor foreground-service audio plugin (Media3 + MediaSession) — true background, HLS, recording
- [ ] Wake alarms, Android Auto, widgets (RadioDroid parity — only if needed)
