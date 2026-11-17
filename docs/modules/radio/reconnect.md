# Reconnect policy

`src/lib/radio/reconnect.ts` holds the backoff table and one pending retry timer. It is side-effect free by design — the timer is the only clock in the file and the toasts stay in the player — so the arithmetic is unit-testable without touching playback. Same split as `sleep.ts`.

## The table

2s, 5s, 15s, 30s, 60s. Five attempts, then the player surfaces the error. `reconnectDelayMs()` returns null past the end of the table rather than throwing, so an exhausted counter is an ordinary return value.

## Wiring contract

This module must not import the player, or the dependency cycles. `engine.ts` owns the state machine and calls in like this:

- **A drop** is anything that interrupts output the listener was already hearing. Three shapes wear it, and only one of them is loud: an element `error`; an `ended` on a live stream, which means the server closed the response; and a `waiting`/`stalled` that outlives the 2s stall deadline, which is what a CDN that goes silent without ever erroring produces. `playedThrough` is the discriminator — before the first `playing` the same events are a stillborn tune and belong to the verdict path. Increment the attempt counter, then either give up (`reconnectDelayMs` null → emit `error`, toast once) or toast quietly, emit `loading`, and `schedule()`.
- **A manual transport touch** — play, pause, stop, toggle, resume — and **every `playing` arrival** take over: `cancel()` and reset the counter, which also drops a pending stall deadline. A retry replay keeps its own count, otherwise the loop could never exhaust.
- **The stall deadline lives in the engine, not here.** It needs the live element, its identity guard and the play token, so it is one `setTimeout` in `engine.ts`; this module stays the backoff table and the retry wait. Its fire-time guards re-check ownership because anything may happen during the grace period.
- **A staged incoming element never arms the deadline.** Its own handoff watchdog owns that stage, and two deadlines advancing the same attempt counter would burn the table twice per failure.
- **A clean `ended` and an expired stall deadline both skip the first wait.** In the first the host completed the response and the element's buffer has drained; in the second the socket stopped delivering while the station stayed up. Either way there is nothing for a 2s wait to protect, so the first retry is immediate and replays the known URL; a failed immediate retry walks the rest of the table from its second slot, which re-resolves. Nothing learns or predicts a connection lifetime — Icecast closes carry no schedule the client can see.
- **The `online` fast path** calls `fireNow()`.

## Why `fireNow` exists

A cellular drop usually means the radio left coverage, so the long waits are largely spent on a socket that cannot recover — a 60s wait can outlast the drive back into signal by minutes. When the network genuinely returns there is no reason to sit out the remainder, so `fireNow()` releases an already-armed wait.

It never starts a sequence, and with nothing armed it is a no-op returning false, which is what lets the player wire it straight to `online` without tracking state. The pending callback is cleared *before* it runs, because that callback re-arms a fresh wait as it goes and leaving the old one in place would make the next `fireNow` replay a stale attempt.

## Lineage

`docs/lineage.md` 2026-11-16 covers the drop shapes added after the Capital XTRA / Capital Dance reports: the table and `fireNow` came with the player split, but only the `loading`-then-`error` shape ever reached it.

Tests: `tests/unit/radio-reconnect.test.ts`, `tests/unit/radio-reconnect-wiring.test.ts`.