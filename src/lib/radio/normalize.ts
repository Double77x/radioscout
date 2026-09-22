/**
 * Loudness leveling for the web `<audio>` player: a two-phase gain stage
 * that steers each station toward the same reference, so switching stations
 * stops jumping in volume — without riding the music inside a station.
 *
 * Phase 1 (settle, ~8s after tune-in): fast attack/release kills the
 * inter-station jump quickly. Phase 2 (steady): a crawl tracks only slow
 * station drift, so verses, choruses and ads play untouched — no pumping.
 * The player measures K-inspired perceptual RMS on the audio `timeupdate`
 * tick (~4Hz — no timers, no FFT) and eases a GainNode toward the target.
 * Gain freezes during quiet passages (no speech-pause wind-up) and the
 * clamps are deliberately narrow (±6 dB): anything bigger stays the volume
 * slider's job, and a wrong-but-bounded gain can never blast.
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
/** Settle pull-down when louder than target (per tick, ~4Hz — tune-in only). */
export const ATTACK = 0.3;
/** Settle ride-up when quieter (tune-in only). */
export const RELEASE = 0.05;
/** Settle window after tune-in, in ticks (~8s at ~4Hz). */
export const SETTLE_TICKS = 32;
/** Steady crawl once settled: songs play untouched, drift tracked barely. */
export const STEADY_ATTACK = 0.002;
export const STEADY_RELEASE = 0.001;
/** Below this RMS the gain freezes (silence/intros must not wind it up). */
export const FREEZE_FLOOR = 0.01;
/** Element volume below this freezes leveling (muted/zeroed — nothing to steer). */
export const VOLUME_FLOOR = 0.01;
/** Hard gain clamps: ±6 dB (fast settle covers loud resumes). */
export const MIN_GAIN = 0.5;
export const MAX_GAIN = 2;

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
 * Settle-phase step: louder-than-target bites fast, quieter rides up briskly,
 * sub-floor input freezes (returns `current` untouched), and the result never
 * leaves the clamps. Pure — trivially unit-testable, no audio graph required.
 */
export function adaptGain(currentGain: number, rms: number, target: number = TARGET_RMS): number {
  return stepGain(currentGain, rms, target, ATTACK, RELEASE);
}

/**
 * Steady-phase step: same target and clamps, but a crawl — a 3 dB song
 * section moves the gain under 1 dB over its whole duration, so settled
 * playback never breathes. Only slow station drift gets tracked.
 */
export function adaptGainSteady(currentGain: number, rms: number, target: number = TARGET_RMS): number {
  return stepGain(currentGain, rms, target, STEADY_ATTACK, STEADY_RELEASE);
}

function stepGain(currentGain: number, rms: number, target: number, attack: number, release: number): number {
  if (!Number.isFinite(rms) || rms < FREEZE_FLOOR) return currentGain;
  const desired = Math.min(MAX_GAIN, Math.max(MIN_GAIN, target / Math.max(rms, 1e-3)));
  const coefficient = desired < currentGain ? attack : release;
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
