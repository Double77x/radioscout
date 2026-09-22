/**
 * Sleep timer primitives: pure helpers around a wall-clock deadline. The
 * live countdown lives in the player module (`use-player.ts`); this file
 * stays side-effect free so the math is trivially unit-testable.
 *
 * The timer is station-independent (survives station switches) and never
 * persisted — a restored tab must never fall asleep on its own.
 */

/** Preset chips offered in Settings → Audio. */
export const SLEEP_PRESETS_MINUTES = [15, 30, 45, 60, 90] as const;
/** Persisted dropdown choice (string, so the generic string hook fits). */
export const SLEEP_DURATION_KEY = "radioscout:sleep-minutes";
export const SLEEP_DURATION_DEFAULT = "30";
/** Sanity cap for programmatic callers (3h — longer is a typo, not a nap). */
export const SLEEP_MAX_MINUTES = 180;
/** Fade-out length once the deadline hits (shared with transport fades). */
export const SLEEP_FADE_MS = 3000;

/**
 * Coerce caller input to whole minutes: non-finite, zero and negative mean
 * off (`0`); anything above the cap clamps. Never throws.
 */
export function normalizeSleepMinutes(value: unknown): number {
  const minutes = typeof value === "string" ? Number(value) : Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return Math.min(SLEEP_MAX_MINUTES, Math.floor(minutes));
}

/** Milliseconds left on a deadline (`0` when off or expired). Never throws. */
export function sleepRemainingMs(endsAt: number, now: number): number {
  if (!Number.isFinite(endsAt) || !Number.isFinite(now) || endsAt <= 0) return 0;
  return Math.max(0, endsAt - now);
}

/**
 * Countdown label for a deadline (`"45m"`), or null when off/expired.
 * Minute precision is deliberate — the dock ticks at a lazy cadence.
 */
export function formatSleepCountdown(endsAt: number, now: number): string | null {
  const remaining = sleepRemainingMs(endsAt, now);
  if (remaining <= 0) return null;
  return `${Math.max(1, Math.ceil(remaining / 60_000))}m`;
}
