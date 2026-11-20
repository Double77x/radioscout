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

`playedThrough` is the discriminator: a failure **after** the stream has played once is a drop and walks the backoff table, while one before it is a stillborn tune and goes to the verdict path. Fresh `play()` replays reset the flag; `playing` sets it.

Three shapes count as a drop, because only the first is guaranteed to be reported: an element `error` (while `loading` *or* `playing`), an `ended` on a live stream, and a `waiting`/`stalled` that outlives `DROP_STALL_MS`. The third is what a transport that goes quiet without erroring produces — without it the dock would sit on `loading` or `playing` over silence and no retry would ever be armed. `noteStall`/`armDropWatchdog` own it, the deadline is cleared by `cancelReconnect` and by every new `play()`, and only the live element may arm it: the staged incoming element has its own handoff watchdog, and two deadlines would advance the retry counter twice per failure. Dropping a deadline on playhead progress is not a shield: the next `waiting`/`stalled` arms afresh, so a socket that really dies after a healthy boundary still reconnects on the following deadline.

**The deadline is gated on the playhead, not on the event.** `armDropWatchdog` records `currentTime` when it arms and re-reads it before it fires; a playhead that advanced by `DROP_PROGRESS_S` (0.25s) means the element was waiting on its next segment rather than on a dead socket, so the deadline is dropped and nothing else happens. Chromium's native HLS path needs this: Edge answers `canPlayType("application/vnd.apple.mpegurl")` with `"maybe"`, so the app assigns the `.m3u8` and never attaches `hls.js`, and that demuxer fires `stalled` at **every** live-edge segment boundary — measured at 4045/11713/17903/24122ms, one per 6.4s segment, with `currentTime` advancing 3.69→23.76s throughout. Under the event-time rule those healthy waits reconnected the BBC stations about once per segment, each with a "Connection lost" toast. `noteStall` therefore does **not** emit `loading` either: only an expired deadline does, through `beginReconnect`, so a boundary stall never flickers the dock to tuning over audio that never stopped.

**Why latency surfaces it, and why only Chromium.** `stalled` is the spec's *media data has surprisingly not arrived for more than 3 seconds* signal, not a fault report, and the native path fetches one segment at a time at the live edge with almost no lookahead. On a ~20ms path a boundary refill finishes in tens of ms, so 3s never accumulates; route the same stream through a VPN, a distant edge or a congested link and one refill can idle past it, which turns a segment boundary into a `stalled` over audio that is still playing. That is the whole difference between a Chromium session that is rock solid and one that reconnects every five seconds — the events differ, the playback does not. Firefox and `hls.js` never meet it, because MediaSource keeps several segments buffered ahead so the element is not the thing waiting; ICY has no boundary to wait at.

`DROP_STALL_MS` is 2s, and it arms **once per stall episode**: a dead transport keeps re-reporting `waiting`/`stalled` for as long as the browser waits on it, so re-arming on each report would let a stream that never returns hold its own recovery off indefinitely. This shape has no positive signal — the host leaves the socket open and stops writing, so there is no EOF, no `error` and no `ended`, and the buffer only reports that it ran dry *after* the audio stopped — so the value is the whole of the guess. It sits just above the longest self-healing `DEMUXER_UNDERFLOW` dip measured (1.9s) rather than far above it, because guessing wrong is cheap: the retry replays the URL that was working and the replacement reaches `kPlay` in tens of ms, so a restart lands before the dip it guessed wrong about would have healed. At 15s the same Capital XTRA drop cost 18.7s of silence: the deadline, then the table's first slot, then a `/json/url` round trip.

An EOF is two element events, not one: the spec sets ended playback, then `paused`, then fires `ended` — so `pause` always arrives first. The `pause` handler returns early while `element.ended` is set, because that pause is the server's close and belongs to the `ended` handler's reconnect, not to the dock's Play button.

### Clean closes

A live stream can end with no error at all: the host completes the response (`FFmpegDemuxer: av_read_frame(): End of file` in `brave://media-internals`), the element drains its last second of buffered audio, then fires `pause` and `ended`. That is a drop, so it walks the table — but it takes the first slot immediately (`beginReconnect(station, { immediate: true })` from the `ended` handler) rather than waiting out `RECONNECT_DELAYS_MS[0]`: the response is already gone and the buffer has drained, so there is nothing left for a wait to protect. That attempt also skips `resolveUrl` (`skipResolve`) and loads the station's own URL: a `/json/url/<uuid>` round trip ran 2.36s in a measured close, which is longer than the wait it was replacing. A failed immediate attempt hands back to the table's second slot, which does re-resolve, so a rotated URL still gets picked up. Two closes measured after that shipped left 27ms and then 20ms between `kEnded` and the replacement player's creation, against 2.36s while the lookup was still in the path.

A silent stall takes the same path once its deadline expires, for the same reason: the socket died, not the station, so there is nothing for a wait or a directory lookup to find. Measured on Capital XTRA London, the gap from the last decoded audio to the replacement player starting was 18.7s under the old 15s deadline with a full re-resolve (15s + 2s first slot + 1.7s lookup), while the replacement itself reached `kPlay` 28ms after it was created and the outgoing player was only torn down 1.2s later, inside the crossfade.

This shape is expected rather than exceptional. Icecast can end a listener through `<max-listener-duration>`, a `client-timeout` trip, or a hosting provider rotating a streaming node, and none of those carries a schedule the client can see: a curl probe against House Nation UK streamed for 20.8 minutes and 30 MB without being closed, while one browser session had ended at ~17 minutes. So nothing here predicts a lifetime or reconnects on a timer — it reacts to the close and makes the gap as short as the transport allows.

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

`armIcyProbe` in `engine.ts` is a thin adapter: it supplies the play-token guard and title sinks to `lib/player/title-probe.ts`, which owns the subtitle chain — Radiolise, direct in-page read, then the edge function, with a push subscription standing the poll loop down while healthy. BBC stations take a different, RMS-backed route — see `docs/plans/STREAM_TITLES.md` for that subsystem and `modules/radio/radiolise.md` for the first tier.

Probing is skipped for HLS and bridged elements: playlists carry no ICY blocks, so it would burn a request per play and per poll for a title that cannot be there.

## Lineage

The two long entries worth reading are 2026-10-02 (Native favourites loop, including why the service owns a real multi-item playlist rather than a single item) and 2026-10-04 (Car displays that freeze on the first song, which explains the opt-in car-display refresh). The full list is in `docs/lineage.md`.

Tests: `tests/unit/player-*.test.ts`, `radio-player-sessions.test.ts`, `radio-reconnect-wiring.test.ts`.