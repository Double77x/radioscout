# Playback engine

`src/lib/player/engine.ts` is the playback state machine and the app's largest module. It owns every shared singleton involved in playing audio: the live and staged elements, the play/handoff/fade generation tokens, `usingNative`, the leveling references and the reconnect loop. `hooks/use-player.ts` is a thin `useSyncExternalStore` facade over it.

Two output paths exist. On the APK the Media3 foreground service is the player. Everywhere else one shared `<audio>` element is, plus one staged incoming element during a switch.

## Why the leaves stop where they do

`fades`, `sleep-timer`, `native-bridge`, `leveling` and `hls` are extracted and independently unit-tested. The reconnect loop and transport are **not**, and that is deliberate rather than unfinished: handoff and transport read and write the same bindings on every transition, so a file seam between them would move complexity around without concentrating it. The assessment behind that decision is in `docs/plans/REFACTOR_PLAYER_ENGINE_PLAN.md`.

If you are tempted to split this file, read that first.

## Generation tokens

Three independent counters, each cancelling a different kind of in-flight work. They are the reason overlapping transport actions are safe rather than a source of bugs:

| Token | Cancels |
| :---- | :---- |
| `playToken` | A play superseded by a newer one |
| `handoffToken` | A staged switch, including its crossfade chains |
| `fadeToken` | An in-flight volume ramp, so a manual touch aborts it |

Every transport action bumps the ones it invalidates. Nothing waits on a previous action finishing.

## Handoff

Switching stations must not produce silence, so the incoming station is staged rather than swapped in cold:

1. `buildIncoming` creates a fresh element, muted at zero for gesture safety, preloads the new stream, and routes it for leveling at build time (`crossOrigin` is load-time state, so it cannot happen later).
2. `handoffToIncoming` fires on the staged element's `playing`, swaps the module references, and blends predecessor out over `CROSSFADE_MS` while sweeping the successor in.
3. A watchdog fires `failIncomingSwitch` at `HANDOFF_WATCHDOG_MS`, and failure reverts the snapshot to the still-playing predecessor with a toast — the old station never stopped.

`incomingCurrent(token, handoff, element)` is the identity guard. **Every staged callback goes through it**, and a superseded callback that still owns a staged element cleans that element up, otherwise a muted preload would linger with no owner.

`handoffPrev` is the revert target, and it is preserved *across* `killIncoming()` in both build paths. That is not an oversight — the cleanup must not eat the predecessor captured at play time.

## Reconnect

`playedThrough` is the discriminator: a `loading` error **after** the stream has played once is a drop and walks the backoff table, while one before it is a stillborn tune and goes to the verdict path. Fresh `play()` replays reset the flag; `playing` sets it.

Any manual transport action cancels an in-flight retry sequence, except a retry replay itself, which keeps its count — otherwise the loop could never exhaust. `fireNow()` releases an armed wait when the network returns; see `modules/radio/reconnect.md` for why that is worth having.

## Native takeover

`playViaNative` hands the resolved URL to the Media3 service. Three things are load-bearing:

- **`wantHandoff` is precomputed by the caller**, before status flips to `loading`. Reading audibility inside the call would always observe this play's own loading state, which is what once made every switch a cold cutover.
- **The playlist is only read when the path is actually native.** The web path skips the IndexedDB round-trip entirely.
- **A failed takeover stops the stray session** before returning, so the previous station is never left audible behind an error snapshot.

Cold starts enter the service silent and the caller sweeps up, so a station switch never blasts. A handoff leaves the service level untouched.

## Stream loading

`startLoad` funnels the native `src` assignment and the asynchronous `hls.js` bridge into **one** failure callback, so both shapes fail identically. `isActive` is checked before `onFail`, meaning a superseded load never fails a switch that has already moved on.

## Invariants

- **Every element listener opens with an identity guard** (`if (audio !== element) return;`) and the whole set detaches atomically through the owner's `AbortController` on swap or teardown. A retired element can never clobber the live snapshot.
- **`preload="none"` on the live element.** Quick resume points it at the restored station without fetching until play.
- **Leveling is routed before any `src` assignment**, in both the live and staged paths, for the same load-time reason.
- **`resume()` re-enters `play()`** rather than calling `element.play()` when the restored row needs a URL resolved or a bridge attached.

## Title probing

`armIcyProbe` owns the subtitle chain: Radiolise, direct in-page read, then the edge function, with a push subscription standing the poll loop down while healthy. BBC stations take a different, RMS-backed route — see `docs/plans/STREAM_TITLES.md` for that subsystem and `modules/radio/radiolise.md` for the first tier.

Probing is skipped for HLS and bridged elements: playlists carry no ICY blocks, so it would burn a request per play and per poll for a title that cannot be there.

## Lineage

The two long entries worth reading are 2026-10-02 (Native favourites loop, including why the service owns a real multi-item playlist rather than a single item) and 2026-10-04 (Car displays that freeze on the first song, which explains the opt-in car-display refresh). The full list is in `docs/lineage.md`.

Tests: `tests/unit/player-*.test.ts`, `radio-player-sessions.test.ts`, `radio-reconnect-wiring.test.ts`.