/**
 * Fade ramp drivers: the time-driven volume chains behind transport fades,
 * the sleep fade-out and the station-switch crossfade. Pure construction —
 * no player state read or written — so the engine keeps sole ownership of
 * the generation tokens (`fadeToken`, `handoffToken`) and the live output.
 *
 * Both drivers share one shape (`FADE_STEPS` linear ticks over `ms`): the
 * caller passes an `isCancelled` closure over its own token, so a
 * superseding transport action aborts the chain. Time-driven chains are the
 * only declarative-free option here (no unmount owns their lifetime); the
 * token owns it instead. Never throws.
 */

/** Step count for every volume ramp (sleep + transport + crossfade share it). */
export const FADE_STEPS = 20;
/** Pause/stop fade-out length — felt, not heard as delay. */
export const TRANSPORT_FADE_MS = 250;
/** Play/resume fade-in length — kills start-up blasts without feeling slow. */
export const PLAY_FADE_MS = 900;

/**
 * Interpolated level at 1-based `step` of a `from` → `to` ramp. Pure —
 * both drivers below step through this so the shape can never drift.
 */
export function fadeLevelAt(from: number, to: number, step: number): number {
  return from + (to - from) * Math.min(1, step / FADE_STEPS);
}

/**
 * Generic live-output ramp (never touches persisted prefs — the caller
 * passes a `write` sink such as `setFadeLevel`). Starts at `from`
 * immediately, then steps to `to`. A cancelled chain stops silently (the
 * superseding action owns the output from there); completion calls `onDone`.
 */
export function runFadeRamp(
  from: number,
  to: number,
  ms: number,
  write: (level: number) => void,
  isCancelled: () => boolean,
  onDone?: () => void,
): void {
  write(from);
  if (!(ms > 0)) {
    write(to);
    onDone?.();
    return;
  }
  let step = 0;
  const tick = (): void => {
    if (isCancelled()) return;
    step += 1;
    write(fadeLevelAt(from, to, step));
    if (step >= FADE_STEPS) {
      onDone?.();
      return;
    }
    globalThis.setTimeout(tick, ms / FADE_STEPS);
  };
  globalThis.setTimeout(tick, ms / FADE_STEPS);
}

/**
 * Per-element ramp for the crossfade pair. Guarded by the caller's
 * `isCancelled` (a newer handoff parks the retiring side via `onCancel`).
 * A torn-down element resolves via `onDone` — teardown races are harmless.
 */
export function rampElement(
  element: HTMLAudioElement,
  from: number,
  to: number,
  ms: number,
  isCancelled: () => boolean,
  onDone?: () => void,
  onCancel?: () => void,
): void {
  try {
    element.volume = from;
  } catch {
    onDone?.();
    return;
  }
  if (!(ms > 0)) {
    try {
      element.volume = to;
    } catch {
      // Torn down mid-ramp — the done path still applies.
    }
    onDone?.();
    return;
  }
  let step = 0;
  const tick = (): void => {
    if (isCancelled()) {
      onCancel?.();
      return;
    }
    step += 1;
    try {
      element.volume = fadeLevelAt(from, to, step);
    } catch {
      onDone?.();
      return;
    }
    if (step >= FADE_STEPS) {
      onDone?.();
      return;
    }
    globalThis.setTimeout(tick, ms / FADE_STEPS);
  };
  globalThis.setTimeout(tick, ms / FADE_STEPS);
}
