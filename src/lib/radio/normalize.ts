/**
 * Loudness leveling for the web `<audio>` player: an adaptive gain stage
 * that steers each station toward the same reference, so switching stations
 * stops jumping in volume. The player measures K-inspired perceptual RMS on
 * the audio `timeupdate` tick (~4Hz — no timers, no FFT) and eases a GainNode
 * toward the target. Deliberately gentle: slow release, frozen during quiet
 * passages (no speech-pause pumping), hard clamps against blasts.
 *
 * Graph shape (measurement never touches the mix):
 *   audible:     source → gain → destination (gain is the only coloration)
 *   measurement: source → highpass → presence shelf → analyser → whisper
 *                (a −60 dB tail keeps the branch pulled; fully masked)
 *
 * Two invariants keep the slider the master control: the measurement taps
 * the SOURCE (post-gain tapping would feed the correction back into itself
 * and settle at half of it), and the reading is divided by the element
 * volume (element volume applies pre-graph — without that, any slider
 * setting under 100% would get boosted straight back up).
 *
 * One hard requirement shapes everything downstream: pulling a stream
 * through Web Audio needs CORS headers, and many stations don't send them.
 * A CORS-blocked stream routed into a graph fails its load — so the player
 * rescues once per element (error event → direct rebuild + replay) and
 * remembers the host for the session, keeping CORS-clean stations leveled.
 */

/** Persisted toggle (`"1"`/`"0"`, so the generic string hook fits). */
export const NORMALIZE_KEY = "radioscout:normalize";

/** Target short-term RMS (~−17 dBFS — typical mastered-radio ballpark). */
export const TARGET_RMS = 0.14;
/** Fast pull-down when louder than target (per tick, ~4Hz). */
export const ATTACK = 0.3;
/** Slow ride-up when quieter (no pumping on speech pauses). */
export const RELEASE = 0.05;
/** Below this RMS the gain freezes (silence/intros must not wind it up). */
export const FREEZE_FLOOR = 0.01;
/** Element volume below this freezes leveling (muted/zeroed — nothing to steer). */
export const VOLUME_FLOOR = 0.01;
/** Hard gain clamps: −12 dB … +18 dB (fast attack covers loud resumes). */
export const MIN_GAIN = 0.25;
export const MAX_GAIN = 8;

/** Short-term RMS of time-domain samples (0 for silence, ~1 for full-scale DC). */
export function computeRms(samples: ArrayLike<number> & Iterable<number>): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / samples.length);
}

/**
 * Volume-relative reading: the element volume applies pre-graph, so divide
 * it back out — the gain then targets the same reference at every slider
 * position and 0–100 keeps its meaning (100 = reference, lower =
 * proportionally quieter for all stations alike). Null when there is
 * nothing to steer (muted, zeroed, or non-finite input).
 */
export function effectiveRms(measuredRms: number, volume: number): number | null {
  if (!Number.isFinite(measuredRms) || !Number.isFinite(volume) || volume < VOLUME_FLOOR) return null;
  return measuredRms / volume;
}

/**
 * One easing step toward the gain that would hit the target (`target / rms`).
 * Louder-than-target bites fast, quieter rides up slow, sub-floor input
 * freezes (returns `current` untouched), and the result never leaves the
 * clamps. Pure — trivially unit-testable, no audio graph required.
 */
export function adaptGain(currentGain: number, rms: number, target: number = TARGET_RMS): number {
  if (!Number.isFinite(rms) || rms < FREEZE_FLOOR) return currentGain;
  const desired = Math.min(MAX_GAIN, Math.max(MIN_GAIN, target / Math.max(rms, 1e-3)));
  const coefficient = desired < currentGain ? ATTACK : RELEASE;
  return currentGain + (desired - currentGain) * coefficient;
}

/** Stored value → on/off, collapsing garbage to off. Never throws. */
export function normalizeEnabled(value: unknown): boolean {
  return value === "1" || value === 1 || value === true;
}

/** Toggle state, off during prerender. Never throws. */
export function readNormalizeEnabled(): boolean {
  if (globalThis.window === undefined) return false;
  try {
    return normalizeEnabled(globalThis.localStorage?.getItem(NORMALIZE_KEY));
  } catch {
    return false;
  }
}

/** Replace the selection (settings switch, backup restore). Never throws. */
export function writeNormalizeEnabled(enabled: boolean): void {
  try {
    globalThis.localStorage?.setItem(NORMALIZE_KEY, enabled ? "1" : "0");
  } catch {
    // Private mode etc — the toggle just won't survive reloads.
  }
}
