/**
 * Auto-reconnect policy for dropped streams. Side-effect free by design — the
 * timer is the only clock here and the toasts stay in the player — so the
 * backoff math is unit-testable without touching playback.
 *
 * The wiring contract the player must honour, and why `fireNow` exists:
 * docs/modules/radio/reconnect.md
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
   * Fire an armed wait immediately instead of waiting out its delay. False
   * when nothing is pending, which is the common case — the caller wires this
   * to `online` without tracking state. The callback is cleared before it runs
   * because it re-arms a fresh wait as it goes.
   */
  fireNow(): boolean {
    const retry = this.pendingRetry;
    if (this.handle === null || retry === null) return false;
    this.cancel();
    retry();
    return true;
  }
}
