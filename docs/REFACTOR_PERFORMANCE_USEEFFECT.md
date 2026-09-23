# Performance + useEffect Policy — player engine refactor (holds at landing 2026-09-23)

`useEffect` is a last resort (see `AGENTS.md` useEffect discipline + `docs/CODING_STANDARDS.md:58-65`). This doc records the current audit and the rules every refactor slice must follow so the split makes the app faster or neutral — never slower.

## 1. Current useEffect audit (12 occurrences across 8 files, `grep useEffect src`)

| File | Lines | Verdict |
|------|-------|---------|
| `src/lib/player/engine.ts` + `src/hooks/use-player.ts` (facade) | — | **Zero `useEffect`.** Correct: module singletons in the engine, React binding in the facade via `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)`. No context re-renders, SSR-safe static snapshot. **Keep zero.** |
| `src/lib/player/store.ts` | `armListeningFlush` / `disarmListeningFlush` (`store.ts:167-186`) | Keep. External page-lifecycle subscription (`pagehide`, `visibilitychange`) owned from `AppShell` — no declarative alternative. |
| `src/hooks/use-sleep-countdown.ts:17` | 20 s `setInterval` while `sleepEndsAt > 0` | Keep. Lazy minute-precision tick; no re-render storm (dock would otherwise tick every second). Do not "modernise" into per-second state. |
| `src/components/radio/PlayerDock.tsx:162` | Autohide timeout cleanup | Keep. Imperative timeout handle owned with cleanup (`VOLUME_AUTOHIDE_MS=3000`). No declarative alternative. |
| `src/components/radio/SavedStations.tsx:161` | Unmount abort (drag listeners, rAF, pending timer) | Keep. Gesture-listener teardown; owns no state. Drag visuals themselves are already `useReducer` + refs (`SavedStations.tsx:75-104`), not effect-synced — do not regress this. |
| `src/components/CommandPalette.tsx:147,157` | Input-focus timer, `open-command-palette` subscription | Keep (audited 2026-09-10). |
| `src/components/NativeShell.tsx` (4x), `RadioHeader.tsx:68`, `SwipeBack.tsx:81` | Bridge subscriptions, focus events, animator registration | Keep (audited 2026-09-10). (`use-navbar-scroll.ts` + its IntersectionObserver effect deleted upstream.) |

No data fetching in any effect (TanStack Query owns it: `use-radio.ts` with `enabled: isClient`, `keepPreviousData`, `initialData: []`). No state-sync effects (derived values computed in render, e.g. `SavedStations.tsx:180-187` override convergence). The refactor added no new call site (12 occurrences before and after, engine still zero).

## 2. Rules for every slice (held for all landed slices)

1. **No new `useEffect`.** Engine leaves (`fades`, `sleep-timer`, `native-bridge`, `leveling`) are plain TS modules taking state via function args; singletons live in `engine.ts` / `store.ts` only. Any proposal needing an effect must use, in order: render/`useMemo` derivation → `on*` props on the owning element → existing TanStack Query/Router state → element events (`playing`/`pause`/`waiting`/`ended`/`error`/`timeupdate`, already wired in `attachLiveListeners`) → only then a justified effect with a comment + an entry in this doc.
2. **No new timers except the ones that exist.** Allowed clocks after the split: fade ramps (`ms / FADE_STEPS` chains, token-guarded), handoff watchdog (20 s), sleep deadline, reconnect backoff table, sleep-countdown 20 s tick, volume autohide 3 s. In particular: leveling stays on the element `timeupdate` tick (~4 Hz, `engine.ts` `attachLiveListeners`) — never convert to `setInterval`/rAF polling.
3. **Token guards move with the code.** `playToken` (superseded `play()`), `fadeToken` (manual volume cancels fades, bumped in `applyPlayerPrefs`), `handoffToken` (new transport action cancels blends) are lifetime owners, not cleanup effects. Moving `fadeRamp`/`rampElement` without their token parameters strands audio — the signature moves verbatim.
4. **No extra re-renders.** `emit()` call sites stay exactly where they are (one snapshot write per transition). Do not split `emit({station, status})` into two emits, do not add per-tick emits (leveling writes `GainNode.gain.value` directly, never the snapshot).
5. **Keep the SSR/prerender fast path.** `ensureAudio` null-on-server, `getServerSnapshot` static idle, `enabled: isClient` on all directory queries, skeletons (`StationCardSkeleton`/`StationListSkeleton`) with `isFetching` gating. The engine split must not import Dexie, `api.ts`, or `AudioContext` at module top level — today's dynamic `import("@/lib/radio/store")` / `import("@/lib/radio/api")` inside `logPlay`/`resolveUrl` stay dynamic so the initial chunk and the prerender stay lean.
6. **Bundle budget.** `use-radio.ts` already code-splits `api.ts` behind dynamic imports per query (`loadTopVoted`, `loadSearch`, …). The engine preserves that: no static `import api from …` in engine modules — dynamic `import("@/lib/radio/store")` / `import("@/lib/radio/api")` inside `logPlay`/`resolveUrl` stay dynamic. Verified per phase via the build chunk list.

## 3. What "more performant" means here (concrete, not aspirational — all held)

- Fewer modules in the hot path import graph (facade re-exports only; pages import the facade, never engine internals) — same or fewer bytes in the initial chunk.
- Same event-driven clocking (element events + existing timeouts), zero polling additions.
- Same render count: `useSyncExternalStore` subscribers re-render only on `emit`, and `emit` frequency does not change.
- Drag path (`SavedStations`) untouched in Phase 1: pointer events + single rAF for visuals + synchronous commit math (never rAF-gated drops). Phase 2 extraction must preserve the "commit computes synchronously, visuals ride rAF" split (`SavedStations.tsx:337-361`).

## 4. Reviewer checklist (held for all landed slices)

- [x] `grep -rn useEffect src/lib/player src/hooks/use-player.ts` returns nothing new (engine still zero).
- [x] `grep -rn "setInterval\|setTimeout" src/lib/player` diff shows only moved lines (no new clocks).
- [x] No static import of `@/lib/radio/store` (Dexie) or `@/lib/radio/api` added to engine modules — dynamic imports intact.
- [x] `emit()` call count per user gesture unchanged (play/pause/switch/sleep-fire paths).
- [x] Prerender still emits skeletons only; `pnpm build` prints `Prerendered 9 pages` with no hang (the `query-client.ts:19` `gcTime: 0` server guard stays intact).
