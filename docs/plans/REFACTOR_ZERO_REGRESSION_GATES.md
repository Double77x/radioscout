# Zero-Regression Gates — player engine refactor (all green at landing 2026-09-23)

How we prove "no regressions" for every slice of `REFACTOR_PLAYER_ENGINE_PLAN.md`. No phase lands without all gates green on the same machine state.

## 1. Move–gate–prove discipline (per phase)

1. **Move** — pure code motion only. No renames beyond the import path, no logic edits, no comment "improvements" in the same diff. If a line must change to compile after the move, split it into a second commit with a `BEHAVIOUR-CHANGE:` trailer explaining why.
2. **Gate** — run the full verification stack below. Any red gate = revert, not fix-forward.
3. **Prove** — targeted regression proof for what moved (section 3). Reviewer checks the proof output, not just "tests pass".

## 2. Gate stack (commands + expected baseline)

Run in this order; each is cheap except Playwright and build:

| # | Gate | Command | What it catches |
|---|------|---------|-----------------|
| 1 | Lint | `pnpm lint` (`oxlint .`) | Moved-file import/cycle mistakes |
| 2 | Types | `npx tsc -b` | Singleton/context type drift after extraction |
| 3 | Unit | `pnpm test:unit` (`vitest run`) | Pure-leaf + wiring regressions |
| 4 | E2E (player) | `npx playwright test tests/handoff.spec.ts tests/resume.spec.ts` | Blend, failed-switch revert, quick-resume paused, hydration #418 |
| 5 | E2E (app) | `npx playwright test tests/smoke.spec.ts tests/smoke-routes.spec.ts tests/settings.spec.ts` | Prerender/route/backup breakage from facade changes |
| 6 | Build | `pnpm build` (`vite build` + `tsc -b` + sitemap/headers) | SSG prerender hang (must print `Prerendered 9 pages`), chunk duplication |
| 7 | Dead code | `npx fallow audit --format json --quiet 2>$null` (exit 0/1 = pass, 2 = error) | Orphaned exports, new duplicates from the split (`fallow.toml:54` mild, ≥40 lines/≥50 tokens) |
| 8 | Format | `pnpm format` (oxfmt check) | Diff noise that hides real changes |

Baseline to record on the clean tree **before Phase 1a** (paste outputs into the phase PR):

- `pnpm lint` output (expect clean).
- `npx tsc -b` output (expect clean).
- `pnpm test:unit` pass count (unit suite lives in `tests/unit/`: `radio-sleep`, `radio-reconnect`, `radio-reconnect-wiring`, `radio-normalize`, `radio-player-sessions`, `player-elements`, `radio-listening`, `radio-track`, `radio-backup`, `radio-share`, `radio-format`, `radio-charts`, etc.).
- Playwright handoff (2 tests) + resume (1 test) pass.
- `pnpm build` prerenders 9 pages with no hang.
- `fallow audit` issue count (`regression.baseline` in `fallow.toml:80` is currently 0 — the split must not add any).

## 3. Targeted proof per slice

| Slice | Proof (in addition to full gates) |
|-------|-----------------------------------|
| 1a fades | `radio-sleep` unit + manual dock check: play sweep 900 ms, pause/stop 250 ms fade, manual volume cancels in-flight fade (token bump in `applyPlayerPrefs`) |
| 1b sleep timer | `radio-sleep` unit + e2e countdown via `useSleepCountdown` (dock `Sleep Nm` suffix, 3 s fade, no persistence across reload) |
| 1c native bridge | Type-only move; proof is `tsc` + full build (bridge contract with `NativeAudioPlugin.java` unchanged — no Java diff in the same PR) |
| 1d leveling | `radio-normalize` unit + CORS-blocked host rescue (routed error → direct rebuild + replay once per element, host remembered in `blockedHosts` for the session) |
| 1e handoff | `tests/handoff.spec.ts` in isolation, both tests: blend to new station with no error; failed switch keeps old station + toast. Plus `radio-reconnect-wiring` unit |
| 1f transport | `tests/resume.spec.ts` in isolation (quick-resume paused, no hydration errors) + `radio-player-sessions` + `radio-listening` unit (session clock banks on `emit` transitions) |
| Facade | `grep -rn "from \"@/hooks/use-player\"" src` before/after identical; public export list diff empty |

## 4. Safety rails

- **Export freeze**: the facade's export list (`usePlayer`, `play`, `pause`, `resume`, `toggle`, `togglePlay`, `stop`, `setVolume`, `toggleMute`, `setSleepTimer`, `cancelSleepTimer`, `setNormalization`, `applyPlayerPrefs`) held for all landed slices — verified by grep at every gate. New helpers stay module-private to the engine.
- **No test edits in move commits**: if a test must change, the old behaviour was load-bearing — stop and write it up instead of "fixing" the test.
- **One slice per commit/PR**: never combine handoff + transport moves. Rollback is `git revert` of one commit.
- **Flaky-network isolation**: `handoff`/`resume` specs mock the directory (`/https:\/\/.*\.api\.radio-browser\.info\/.*/`) and stream bytes via `tests/fixtures/silence-30s.wav` — they never hit live servers. A failure there is real, not flakes.
- **Prerender guard**: the engine must stay SSR-safe (`ensureAudio` returns null on server, `getServerSnapshot` stays static idle). Any slice that breaks `vite build` prerender is reverted even if unit tests pass.
- **Hydration guard**: `resume.spec.ts` asserts zero hydration errors (`hydrat|Minified React|418`). The stored-station-as-`paused` post-hydration update path (`lib/player/store.ts:52-65`) must not change.

## 5. Rollback triggers (revert, don't patch)

- Any gate red after the move with no trivial import-path explanation.
- New `fallow audit` finding (duplicate block ≥40 lines from copy-paste instead of move).
- Playwright timing change (fade/crossfade/watchdog durations differ from 900/250/3000/1000 ms / 20 s).
- Bundle analysis shows `use-player` chunk duplicated (dynamic `import("@/lib/radio/store")` / `import("@/lib/radio/api")` converted to static imports during the move).
