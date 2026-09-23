# Player Engine Refactor — LANDED 2026-09-23 (was `src/hooks/use-player.ts`, 1402 lines)

> Status: complete. All five slices landed with zero regressions (see landing
> notes under §3). `TODO.md:48` is checked off. What follows is the original
> plan preserved as the audit trail, with landed outcomes noted inline.
>
> TODO source: `docs/TODO.md:48` (now done).

## 1. Baseline inventory (pre-refactor, measured 2026-09-23)

Only one file exceeded 1000 lines:

| Lines | File | Verdict |
|---:|---|---|
| 1402 | `src/hooks/use-player.ts` | **Split target (this plan)** |
| 635 | `src/lib/radio/language-all.ts` | Generated 2026-09-21 from `/json/languages` — **do not touch** |
| 505 | `src/styles/index.css` | Token sheet, not logic — out of scope |
| 487 | `src/components/radio/SavedStations.tsx` | Phase 2 candidate (drag engine extract, no behaviour change) |
| 385 | `src/components/radio/PlayerDock.tsx` | Phase 3 candidate (VolumeSlider + overlay extract) |
| 337 | `src/lib/radio/api.ts` | Healthy; chart/search/ILIKE sections already commented — leave alone |
| 197 | `src/lib/player/store.ts` | Already extracted — snapshot singleton + listening clock |
| 42/53/66/44 | `src/lib/player/elements.ts`, `leveling-graph.ts`, `src/lib/radio/reconnect.ts`, `sleep.ts` | Already extracted pure leaves |

`use-player.ts` owns the entire stateful orchestration that the pure leaves deliberately do not:

1. **Live output** — `<audio>` singleton (`ensureAudio`, `rebuildAudio`, `attachLiveListeners`), `usingNative` flag, `parkWebAudio`.
2. **Staged handoff** — `incoming` element + `incomingGraph`, `handoffPrev`, `handoffToken`, `incomingWatchdog` (20s), `buildIncoming` / `buildIncomingDirect` / `handoffToIncoming` / `killIncoming` / `revertToPrevious` / `failIncomingSwitch`.
3. **Fades** — `fadeToken`, `fadeRamp`, `rampElement`, constants `PLAY_FADE_MS=900`, `TRANSPORT_FADE_MS=250`, `SLEEP_FADE_MS=3000`, `CROSSFADE_MS=1000`, `FADE_STEPS=20`.
4. **Leveling wiring** — `normalizeOn`, `blockedHosts`, `audioCtx/normGain/normAnalyser/audioRouted`, `settleTicksLeft`, `maybeRouteAudio`, `adaptTick` (on `timeupdate`, ~4 Hz), `resetLevelingForStation`, `freezeGain`, `setNormalization`.
5. **Sleep timer** — `sleepTimeout`, `setSleepTimer` / `cancelSleepTimer` / `clearSleepTimer` / `fireSleepTimer` (+ native `nativeSetSleepTimer` arm).
6. **Reconnect** — `reconnectTimer`, `retryingReconnect`, `reconnectAttempt`, `playedThrough`, `beginReconnect` / `continueReconnect` / `retryStation` / `cancelReconnect`.
7. **Native bridge + MediaSession** — `playViaNative`, `ensureNativeListener`, `parkWebAudio`, `updateMediaSession`, `warnedFallback`, `lastLoadInsecure` / `INSECURE_HTTP_MESSAGE`.
8. **Public surface** — `usePlayer`, `play`, `pause`, `pauseNow`, `resume`, `toggle`, `togglePlay`, `stop`, `stopNow`, `setVolume`, `toggleMute`, `applyPlayerPrefs`, `resolveUrl`, `logPlay`.

Shared singletons that make a naive split dangerous (all module-scoped in `use-player.ts:55-119,386-408`): `audio`, `playToken`, `fadeToken`, `handoffToken`, `audioCtx`, `blockedHosts`, `incoming`, `handoffPrev`, `reconnectTimer`, `usingNative`. Any extraction that duplicates or re-orders these breaks token guards and strands audio.

## 2. Target shape (state-container pass, not a rewrite) — landed with adjustments

Keep the public export surface byte-identical. Introduce one internal container; move code into it without changing call order:

```
src/lib/player/
  store.ts            # UNCHANGED — snapshot + listening clock (single owner of `snapshot`)
  elements.ts         # UNCHANGED — hostOf + parkRecord
  leveling-graph.ts   # UNCHANGED — buildLevelingGraph
  engine.ts           # LANDED (1e, pure relocation) — owns ALL remaining singletons
  fades.ts            # LANDED (1a) — drivers + constants, token-agnostic via isCancelled
  sleep-timer.ts      # LANDED (1b) — arm/disarm + both arms + sleepEndsAt (onFire injected)
  leveling.ts         # LANDED (1d) — predicate + run construction + tick plumbing (flags stay in engine)
  native-bridge.ts    # LANDED (1c) — verdict copy + artist + park + MediaSession (handlers injected)
  transport.ts        # NOT CREATED — assessed in 1e: transport shares ~15 bindings with
  handoff.ts          #   handoff on every transition; a seam moves complexity without
                      #   concentrating it (deletion test). Engine stays whole deliberately.
  reconnect.ts        # ALREADY EXISTS (pure) — engine imports it, no new file
src/hooks/use-player.ts  # LANDED (1e) — 48-line facade: usePlayer + explicit 12-name re-export
```

Rules (held for all landed slices):

- `engine.ts` owns the playback singletons; `store.ts` stays the single owner of `snapshot`/`emit` and never imports the engine (cycle guard — same contract `reconnect.ts` already documents). Leaves take state via function args, never re-declare.
- No new `useEffect`, no new timers, no new subscriptions. Time-driven chains keep their existing token guards (`playToken`, `fadeToken`, `handoffToken`).
- The `incomingCurrent` guard stays in the engine with the handoff staging it protects (no handoff module was cut — see 1e assessment).

## 3. Sequencing (smallest safe slices, in order)

1. **Phase 0 — freeze + baseline** (see `REFACTOR_ZERO_REGRESSION_GATES.md`). Record gate outputs on a clean tree before any move.
2. **Phase 1a — fades first** (lowest risk, no element access except via injected sink). Move `FADE_STEPS`, transport constants, `fadeRamp`, `rampElement`, `userLevel`, `setFadeLevel` into `lib/player/fades.ts`. Facade re-exports. Gate + prove.
3. **Phase 1b — sleep timer** (one timeout + one native call). Move `setSleepTimer/cancelSleepTimer/clearSleepTimer/fireSleepTimer/fadeOutAndPause` into `lib/player/sleep-timer.ts`. Gate + prove.
4. **Phase 1c — native bridge + MediaSession** (pure bridge wrappers + `updateMediaSession`). Move into `lib/player/native-bridge.ts`. Gate + prove.
5. **Phase 1d — leveling wiring** (touches live + incoming graphs). Move `maybeRouteAudio/adaptTick/resetLevelingForStation/freezeGain/setNormalization` + `blockedHosts`/graph refs into the engine context. Gate + prove with leveling unit tests + manual CORS-blocked station check.
6. **Phase 1e — handoff staging** (highest risk — staged element lifecycle). Move `buildIncoming/buildIncomingDirect/handoffToIncoming/killIncoming/revertToPrevious/failIncomingSwitch/incomingCurrent` last, verbatim. Gate + prove with `handoff.spec.ts` (blend + failed-switch revert) run in isolation.
7. **Phase 1f — transport** (`play/pause/resume/toggle/stop` + `ensureAudio/rebuildAudio/attachLiveListeners`). Moves last; facade shrinks to re-exports. Full gate suite.
8. **Phase 2 (separate change)** — `SavedStations.tsx:487`: extract drag engine (`arrayMoveId`, `topOfOrder`, `rowOuterStyle`, threshold/hold constants, pointer state machine) into `lib/radio/drag-reorder.ts` + unit tests. Component keeps render + reducer only.
9. **Phase 3 (separate change)** — `PlayerDock.tsx:385`: extract `VolumeSlider` + overlay + autohide into `components/radio/VolumeControl.tsx`. No logic change.

Each phase is one commit / one review. Never combine 1d+1e+1f.

> Phase 1a landed 2026-09-23 as a reduced slice: `src/lib/player/fades.ts`
> (constants + `fadeLevelAt` + `runFadeRamp` + `rampElement`, token-agnostic
> via `isCancelled` closures) with `tests/unit/player-fades.test.ts` (10
> tests). `fadeToken`/`handoffToken` ownership, `userLevel`/`setFadeLevel`
> and all `emit` sites stay in `use-player.ts` (1402 → 1338 lines) until the
> transport slice (1f) — moving the live-output sink now would have pulled
> `snapshot`/native/`audio` into the new module for no behavioural gain.
> Gates at landing: lint 0/0, `tsc -b` clean, vitest 168/168, handoff (2) +
> resume (1) e2e pass, `vite build` prerenders 9 pages, `fallow audit` pass
> with 0 introduced, `oxfmt --check` clean on touched files.
>
> Phase 1b landed 2026-09-23 as a reduced slice: `src/lib/player/sleep-timer.ts`
> (deadline ownership — `armSleepTimer(minutes, onFire)` + `disarmSleepTimer()`,
> timeout handle + both native/web arms + `sleepEndsAt` + toasts) with
> `tests/unit/player-sleep-timer.test.ts` (4 tests: fire-once, off-input,
> cancel, re-arm). The audible continuation (playing-check + `fadeOutAndPause`)
> is injected per-arm by the engine, so the module never imports transport
> (cycle guard); `fadeOutAndPause` stays until the transport slice (1f).
> Public names stay on the facade — the module uses `arm`/`disarm` vocabulary
> (matching `armListeningFlush`) after `fallow audit` flagged same-named
> exports as `duplicate_exports` (fixed, 0 introduced). `use-player.ts`
> 1338 → 1308 lines.
> Gates at landing: lint 0/0, `tsc -b` clean (after regenerating stale
> git-ignored `.tsbuildinfo` — phantom incremental errors in untouched files,
> `--force` was already clean), vitest 172/172, handoff (2) + resume (1) e2e
> pass, `vite build` prerenders 9 pages, `fallow audit` pass with 0
> introduced, `oxfmt --check` clean on touched files.
>
> Phase 1c landed 2026-09-23 as a reduced slice: `src/lib/player/native-bridge.ts`
> (`INSECURE_HTTP_MESSAGE`, pure `nativeTrackArtist` single-sourcing the
> MediaSession/takeover artist line, `parkWebAudioElement(element)`,
> `updateMediaSession(station, handlers)` with injected transport handlers)
> with `tests/unit/player-native-bridge.test.ts` (7 tests: verdict copy,
> artist fallback chain, park order/teardown tolerance, session-absent no-op +
> metadata/handlers wired). `ensureNativeListener` (drives the reconnect loop:
> `cancelReconnect`/`beginReconnect`, `playedThrough`, `retryingReconnect`)
> and `playViaNative` (writes `usingNative`, reads `normalizeOn`) stay until
> the handoff (1e) / state-container (1f) passes rather than crossing on
> injected callbacks 1f would unwind; `logPlay`/`resolveUrl` stay with
> transport (1f, dynamic-import chunk boundary). `use-player.ts` 1308 → 1290.
> Gates at landing: lint 0/0, `tsc -b` clean, vitest 179/179, handoff (2) +
> resume (1) e2e pass, `vite build` prerenders 9 pages, `fallow audit` pass
> with 0 introduced, `oxfmt --check` clean on touched files. Incidental:
> `use-navbar-scroll.ts` deleted upstream (effect inventory in
> `REFACTOR_PERFORMANCE_USEEFFECT.md` corrected 10 → 9 sites).
>
> Phase 1d landed 2026-09-23 as a reduced slice: `src/lib/player/leveling.ts`
> (routing predicate `canRouteLeveling`, run construction
> `routeLevelingAudio`, `resumeLevelingContext`, `freezeLevelingGain`,
> `resetLevelingGain` returning the settle budget, and the per-tick plumbing
> `levelingTick` — all parameterized, flags stay in the engine) with
> `tests/unit/player-leveling.test.ts` (13 tests: routing predicate incl.
> session-blocked hosts, null-on-unavailable run construction, context resume,
> gain freeze paths, unity reset, settle-vs-steady ticks, silence/mute freeze,
> stale-buffer realloc, analyser failure). Engine keeps same-named thin
> wrappers (`canRouteStation`, `maybeRouteAudio`, `ensureLiveContext`,
> `freezeGain`, `adaptTick`, `resetLevelingForStation`) — zero call-site
> churn. `setNormalization` (replays through handoff + transport) stays until
> the state-container pass (1f). `use-player.ts` 1290 → 1259.
> Gates at landing: lint 0/0, `tsc -b` clean (one real error caught and fixed
> pre-gate: un-narrowed nullable buffer at the tick return), vitest 192/192,
> handoff (2) + resume (1) e2e pass, `vite build` prerenders 9 pages,
> `fallow audit` pass with 0 introduced, `oxfmt --check` clean on touched
> files.
>
> Function-level proof (2026-09-23, script-compared HEAD vs landed tree):
> 33 functions byte-identical — incl. `play`, `pause`, `resume`, `stop`,
> `toggle`, `ensureNativeListener`, `ensureAudio`, `rebuildAudio`,
> `attachLiveListeners`, `buildIncoming`/`buildIncomingDirect`,
> `killIncoming`, `revertToPrevious`, `failIncomingSwitch`, the full
> reconnect loop, `setNormalization`, and `usePlayer` (facade). The 11
> changed functions differ only by parameter substitution (`token` →
> `isCancelled` closure, `onFire`/handlers injection, pure `artist` helper,
> explicit element arg) with identical semantics; the 5 moved functions
> (`rampElement`, `parkWebAudio`, `updateMediaSession`, `clearSleepTimer`,
> `fireSleepTimer`) are line-identical apart from signatures. Nothing added.
>
> Phase 1e landed 2026-09-23 as a pure relocation (no logic edits):
> `src/lib/player/engine.ts` (1250 lines) now owns the state machine verbatim
> — all singletons, live lifecycle, handoff staging, reconnect loop,
> transport — and `src/hooks/use-player.ts` (48 lines) is the thin facade:
> `usePlayer` plus an explicit 12-name re-export of the engine surface, so
> all 9 consumer import sites keep working untouched. Verified by
> `git diff --no-index` against the pre-move file: the only delta is the
> removed hook, narrowed store import, and header comment. A handoff-vs-
> transport file seam was assessed and deliberately NOT cut: the two read and
> write ~15 shared bindings on every transition (live/staged elements, three
> token generations, `usingNative`, leveling refs, reconnect flags), so a
> boundary there moves complexity without concentrating it (deletion test).
> The seam that paid off was engine-vs-leaves (1a–1d, all extracted +
> unit-tested) and engine-vs-React (this phase). `fallow.toml` gains a scoped
> `ignoreExports` exception for exactly the 12 facade names (intentional
> barrel, documented at the call site).
> Gates at landing: lint 0/0, `tsc -b` clean, vitest 192/192 (incl.
> `radio-reconnect-wiring`, which drives transport through the facade),
> Playwright 40/40 (handoff 2 + resume 1 + smoke + smoke-routes + settings
> incl. leveling toggle and backup restore through the facade), `vite build`
> prerenders 9 pages with an unchanged chunk graph (dynamic Dexie/api imports
> intact; the pre-existing `INEFFECTIVE_DYNAMIC_IMPORT` notice is untouched),
> `fallow audit` pass with 0 introduced, `oxfmt --check` clean.

## 4. Non-goals

- No behaviour change: fade lengths, backoff table (`RECONNECT_DELAYS_MS`), watchdog (20 s), settle ticks (32), gain clamps (±6 dB), toast copy, HLS/insecure verdicts, quick-resume semantics.
- No dependency changes, no new state library, no context provider (the `useSyncExternalStore` singleton stays — see performance doc).
- No touching `language-all.ts` (generated), `index.css`, `api.ts`, `store.ts` snapshot shape, or the Android `NativeAudioPlugin` bridge contract.
- No `useEffect` additions anywhere in the engine (it currently has zero — keep it that way).

## 5. Acceptance per phase

- Public export list of `use-player.ts` unchanged (`grep` diff empty).
- All gates green per `REFACTOR_ZERO_REGRESSION_GATES.md` (lint, `tsc -b`, vitest, Playwright handoff + resume + smoke, `vite build` prerender 9 pages, `fallow audit` no new issues).
- Bundle size does not regress (`bundle-analysis-client.html` — engine split must not duplicate Dexie/api chunks; dynamic imports stay dynamic).
