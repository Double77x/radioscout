/**
 * Auto-reconnect policy for dropped streams. Side-effect free (the timer
 * below is the only clock, UI toasts stay in the player) so the math is
 * trivially unit-testable — same split as `sleep.ts`.
 *
 * Wiring contract (for `use-player`, after the fade work lands — this file
 * must not import the player, or the dependency cycles):
 * - element `error` while `playing` (not `loading`): next attempt = counter+1.
 *   `reconnectDelayMs(next)` null → emit `error` + toast (give up). Else
 *   quiet toast ("Connection lost — retrying…"), emit `loading`, and
 *   `schedule(next, () => play(station))`.
 * - any manual transport touch (play/pause/stop/toggle/resume) and every
 *   `playing` arrival: `cancel()` + reset the attempt counter.
 * - optional fast path: a one-shot `online` listener that fires the pending
 *   wait early (the delays already cover offline stretches on their own).
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
    this.handle = globalThis.setTimeout(() => {
      this.handle = null;
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
  }
}
