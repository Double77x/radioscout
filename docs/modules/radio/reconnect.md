# Reconnect policy

`src/lib/radio/reconnect.ts` holds the backoff table and one pending retry timer. It is side-effect free by design — the timer is the only clock in the file and the toasts stay in the player — so the arithmetic is unit-testable without touching playback. Same split as `sleep.ts`.

## The table

2s, 5s, 15s, 30s, 60s. Five attempts, then the player surfaces the error. `reconnectDelayMs()` returns null past the end of the table rather than throwing, so an exhausted counter is an ordinary return value.

## Wiring contract

This module must not import the player, or the dependency cycles. `engine.ts` owns the state machine and calls in like this:

- **A drop** is an element `error` while `playing`, not while `loading`. `loading` means stillborn and belongs to the verdict path. Increment the attempt counter, then either give up (`reconnectDelayMs` null → emit `error`, toast once) or toast quietly, emit `loading`, and `schedule()`.
- **A manual transport touch** — play, pause, stop, toggle, resume — and **every `playing` arrival** take over: `cancel()` and reset the counter. A retry replay keeps its own count, otherwise the loop could never exhaust.
- **The `online` fast path** calls `fireNow()`.

## Why `fireNow` exists

A cellular drop usually means the radio left coverage, so the long waits are largely spent on a socket that cannot recover — a 60s wait can outlast the drive back into signal by minutes. When the network genuinely returns there is no reason to sit out the remainder, so `fireNow()` releases an already-armed wait.

It never starts a sequence, and with nothing armed it is a no-op returning false, which is what lets the player wire it straight to `online` without tracking state. The pending callback is cleared *before* it runs, because that callback re-arms a fresh wait as it goes and leaving the old one in place would make the next `fireNow` replay a stale attempt.

## Lineage

No dated entry in `docs/lineage.md` covers this module — the backoff table and the `fireNow` fast path were introduced with the player split and never revisited. Treat that as "no recorded history", not "no history".

Tests: `tests/unit/radio-reconnect.test.ts`, `tests/unit/radio-reconnect-wiring.test.ts`.