/**
 * Auto-reconnect policy for dropped streams. Side-effect free (the timer
 * below is the only clock, UI toasts stay in the player) so the math is
 * trivially unit-testable — same split as `sleep.ts`.
 *
 * Wiring contract (for `use-player` — this file must not import the player, or
 * the dependency cycles):
 * - element `error` while `playing` (not `loading`): next attempt = counter+1.
 *   `reconnectDelayMs(next)` null → emit `error` + toast (give up). Else
 *   quiet toast ("Connection lost — retrying…"), emit `loading`, and
 *   `schedule(next, () => play(station))`.
 * - any manual transport touch (play/pause/stop/toggle/resume) and every
 *   `playing` arrival: `cancel()` + reset the attempt counter.
 * - the `online` fast path: `fireNow()` on the timer, driven by the player's
 *   connectivity listener. A cellular drop usually means the radio moved out
 *   of coverage, so the long waits are mostly spent on a socket that cannot
 *   recover; when the network genuinely comes back, there is no reason to sit
 *   out the remainder of a 60s wait. It only ever fires a wait that is already
 *   armed — it never starts a sequence, and a wait with nothing to arm is a
 *   no-op, so a listener firing with nothing pending is harmless.
 */

/** Wait before each 1-based retry. Past the last entry the player gives up. */
export const RECONNECT_DELAYS_MS = [2000, 5000, 15_000, 30_000, 60_000] as const;
/** Attempts before the player surfaces the error. */
export const MAX_RECONNECT_ATTEMPTS = RECONNECT_DELAYS_MS.length;

/** Delay before 1-based `attempt`, or null when attempts are exhausted. Never throws. */
export function reconnectDelayMs(attempt: number): number | null {
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > RECONNECT_DELAYS_MS.length) return null;
  return RECONNECT_DELAYS_MS[attempt - 1] ?? null;
}

/**
 * One pending retry wait. Dumb by design: the player owns the attempt
 * counter, the toasts, and the `play()` re-entry — this just fires late.
 */
export class ReconnectTimer {
  private handle: ReturnType<typeof globalThis.setTimeout> | null = null;
  /** Kept so `fireNow` can run it early; dropped by `cancel`. */
  private pendingRetry: (() => void) | null = null;

  /** True while a retry wait is armed. */
  get pending(): boolean {
    return this.handle !== null;
  }

  /**
   * Arm the wait for 1-based `attempt` (replaces any pending wait).
   * Exhausted attempts arm nothing — the caller surfaces the error.
   */
  schedule(attempt: number, onRetry: () => void): void {
    this.cancel();
    const delay = reconnectDelayMs(attempt);
    if (delay === null) return;
    this.pendingRetry = onRetry;
    this.handle = globalThis.setTimeout(() => {
      this.handle = null;
      this.pendingRetry = null;
      onRetry();
    }, delay);
  }

  /** Drop any pending wait (manual transport takes over). Never throws. */
  cancel(): void {
    if (this.handle !== null) {
      try {
        globalThis.clearTimeout(this.handle);
      } catch {
        // Timer already fired mid-cancel — the flag below still clears.
      }
      this.handle = null;
    }
    this.pendingRetry = null;
  }

  /**
   * Fire an armed wait immediately instead of waiting out its delay (the
   * network came back). False when nothing is pending, which is the common
   * case — the caller wires this to `online` without tracking state.
   *
   * <p>The callback runs synchronously here, so it is cleared first: it
   * re-arms a fresh wait as it goes, and leaving the old one in place would
   * have the next `fireNow` replay a stale attempt.
   */
  fireNow(): boolean {
    const retry = this.pendingRetry;
    if (this.handle === null || retry === null) return false;
    this.cancel();
    retry();
    return true;
  }
}
