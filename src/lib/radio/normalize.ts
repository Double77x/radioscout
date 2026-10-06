/**
 * Loudness leveling maths: a two-stage gain servo that steers each station
 * toward the same reference so switching stations stops jumping in volume,
 * without riding the music inside a station.
 *
 * Stage 1 is a fast AGC that kills the inter-station jump inside ~8s. Stage 2
 * is a ±3 dB servo on gated K-weighted momentary loudness, correcting the
 * systematic offsets stage 1 leaves behind over ~1 minute. A brickwall
 * limiter at −1 dBFS catches boosted tips, which is what lets the boost clamp
 * sit at +9 dB without flat-topping.
 *
 * This file is the maths only. The graph, the tick plumbing and the CORS
 * rescue live in the player: docs/modules/player/leveling.md
 */

/** Persisted toggle (`"1"`/`"0"`, so the generic string hook fits). */
export const NORMALIZE_KEY = "radioscout:normalize";

/** Target short-term RMS (~−17 dBFS — typical mastered-radio ballpark). */
export const TARGET_RMS = 0.14;
/** Settle pull-down when louder than target (per tick, ~4Hz — tune-in only). */
export const ATTACK = 0.3;
/**
 * Settle ride-up when quieter (tune-in only). Deliberately tracks `ATTACK`
 * rather than crawling behind it: a 6× slower release converged 80× slower
 * than the pull-down (145s vs 1.8s to within 0.5 dB), so any station needing
 * a boost stayed audibly quiet long after the loud ones were corrected —
 * the "HLS/speech stations are quieter" symptom. Only the steady phase
 * crawls; tune-in is allowed to move ~1.2 dB a tick inside the clamps.
 */
export const RELEASE = 0.15;
/** Settle window after tune-in, in ticks (~8s at ~4Hz). */
export const SETTLE_TICKS = 32;
/** Steady crawl once settled: songs play untouched, drift tracked barely. */
export const STEADY_ATTACK = 0.002;
export const STEADY_RELEASE = 0.001;
/** Below this RMS the gain freezes (silence/intros must not wind it up). */
export const FREEZE_FLOOR = 0.01;
/** Element volume below this freezes leveling (muted/zeroed — nothing to steer). */
export const VOLUME_FLOOR = 0.01;
/**
 * Hard stage-1 gain clamps: −9 dB / +9 dB. The duck floor is deliberately
 * wider than the old −6 dB (ducking can never blast or clip, so the only cost
 * of a misread is a quiet station), and the boost ceiling sits at +9 dB
 * because the graph's safety limiter — not the clamp — now bounds clipping:
 * a wrong-but-limited gain can peak at −1 dBFS and nothing louder.
 */
export const MIN_GAIN = 0.35;
export const MAX_GAIN = 2.8;

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

/**
 * Stage 2 (slow LUFS trim): exact BS.1770 K-weighting biquads (48 kHz table;
 * at other context rates the curve shifts a few percent in frequency, which
 * the servo absorbs — target and measurement share the same filters, so the
 * comparison stays self-consistent). Run per tick over the analyser buffer;
 * filter state lives in the caller and must persist across buffers (resetting
 * per buffer would re-ring the transient every tick).
 */
const K_PRE_B = [1.53512485958697, -2.69169618940638, 1.19839281085285];
const K_PRE_A = [1, -1.69065929318241, 0.73248077421585];
const K_RLB_B = [1, -2, 1];
const K_RLB_A = [1, -1.99004745483398, 0.99007225036621];

/** Continuous biquad state for one channel pair (mono mix — radio is the use). */
export interface KFilterState {
  preX1: number;
  preX2: number;
  preY1: number;
  preY2: number;
  rlbX1: number;
  rlbX2: number;
  rlbY1: number;
  rlbY2: number;
}

export function initKFilter(): KFilterState {
  return { preX1: 0, preX2: 0, preY1: 0, preY2: 0, rlbX1: 0, rlbX2: 0, rlbY1: 0, rlbY2: 0 };
}

/** One K-weighted sample (pre-filter then RLB, direct form I). Never throws. */
export function kFilterSample(state: KFilterState, sample: number): number {
  if (!Number.isFinite(sample)) return 0;
  const pre =
    K_PRE_B[0] * sample +
    K_PRE_B[1] * state.preX1 +
    K_PRE_B[2] * state.preX2 -
    K_PRE_A[1] * state.preY1 -
    K_PRE_A[2] * state.preY2;
  state.preX2 = state.preX1;
  state.preX1 = sample;
  state.preY2 = state.preY1;
  state.preY1 = pre;
  const out =
    K_RLB_B[0] * pre +
    K_RLB_B[1] * state.rlbX1 +
    K_RLB_B[2] * state.rlbX2 -
    K_RLB_A[1] * state.rlbY1 -
    K_RLB_A[2] * state.rlbY2;
  state.rlbX2 = state.rlbX1;
  state.rlbX1 = pre;
  state.rlbY2 = state.rlbY1;
  state.rlbY1 = out;
  return out;
}

/** K-domain programme target: streaming-convention −14 LUFS. */
export const TRIM_TARGET_LU = -14;
/** Trim authority: the slow stage corrects, never leads (±3 dB). */
export const TRIM_DB = 3;
/**
 * Trim easing per evaluated momentary window (~2.3s of tick audio — τ ≈ 3 min,
 * far slower than any song section or talk burst, so the trim only ever
 * corrects sustained station-level offsets and can never ride the programme).
 */
export const TRIM_COEFF = 0.013;
/** Adaptation deadband: content this far from its own slow average freezes
 * the trim (bursts, jingles and tune-in transients included) while the
 * anchor underneath keeps learning. Without it the trim chases every burst
 * and the volume audibly breathes on speech stations. */
export const TRIM_DEADBAND = 3;
/** Anchor easing per evaluated window (τ ≈ 2 min — the anchor is history). */
export const TRIM_ANCHOR_COEFF = 0.02;
/** Momentary window in samples (400 ms at 48 kHz — rate-shift tolerant). */
export const TRIM_WINDOW = 19_200;
/** BS.1770 absolute gate: digital silence carries no loudness information. */
export const TRIM_ABS_GATE = -70;
/** BS.1770 relative gate: blocks this far under the anchor don't steer. */
export const TRIM_REL_GATE = 10;
/** BS.1770 calibration offset (mean-square to LUFS). */
export const TRIM_K_OFFSET = 0.691;

/** Live state for one trim run (owned by the engine alongside the graph). */
export interface TrimState {
  trimDb: number;
  anchor: number | null;
  accE: number;
  accN: number;
  kLeft: KFilterState;
  kRight: KFilterState;
}

/** Fresh trim: 0 dB correction, no anchor, empty window (tune-in state). */
export function initTrimState(): TrimState {
  return { trimDb: 0, anchor: null, accE: 0, accN: 0, kLeft: initKFilter(), kRight: initKFilter() };
}

/** Restart the trim for a new station (previous correction must not carry). */
export function resetTrimState(state: TrimState): void {
  state.trimDb = 0;
  state.anchor = null;
  state.accE = 0;
  state.accN = 0;
  state.kLeft = initKFilter();
  state.kRight = initKFilter();
}

/** Trim correction as a linear multiplier. Never throws. */
export function trimLinear(trimDb: number): number {
  if (!Number.isFinite(trimDb)) return 1;
  return 10 ** (Math.max(-TRIM_DB, Math.min(TRIM_DB, trimDb)) / 20);
}

/**
 * Feed raw analyser-domain samples (one buffer per stereo channel — BS.1770
 * sums channel energies, and mono-mixing first reads correlated stereo ~3 dB
 * cold, which railed the trim fighting stage 1) plus the stage-1 gain behind
 * them. Each completed 400 ms window is evaluated as post-gain K momentary
 * loudness — post-gain deliberately, so the trim servos the *output* onto
 * target instead of double-counting stage 1 (the ~3 min time constant keeps
 * the loop stable where a fast post-gain tap would oscillate). Muted/zeroed
 * windows fall under the absolute gate and only reset the accumulator.
 * The trim steers from the slow anchor, never the live block, and content
 * outside a 3 dB deadband around the anchor freezes adaptation while the
 * anchor keeps learning — so bursts, jingles and tune-in transients cannot
 * yank the volume around. Never throws.
 */
export function trimAccumulate(
  state: TrimState,
  left: ArrayLike<number>,
  right: ArrayLike<number>,
  stage1Gain: number,
  volume = 1,
  settling = false,
): void {
  if (!Number.isFinite(stage1Gain) || stage1Gain <= 0) return;
  if (!Number.isFinite(volume) || volume < VOLUME_FLOOR) return;
  try {
    const frames = Math.min(left.length, right.length);
    for (let index = 0; index < frames; index += 1) {
      const kl = kFilterSample(state.kLeft, left[index] ?? 0);
      const kr = kFilterSample(state.kRight, right[index] ?? 0);
      state.accE += kl * kl + kr * kr;
      state.accN += 1;
      if (state.accN >= TRIM_WINDOW) {
        // Divide out element volume: the Web Audio source tap is pre-attenuated
        // by the volume slider, so divide back out to measure full-scale stream
        // loudness and ensure stage 2 never fights the volume slider.
        const meanSquare = state.accE / state.accN / (volume * volume);
        const lu = 10 * Math.log10(Math.max(meanSquare, 1e-12)) - TRIM_K_OFFSET;
        state.accE = 0;
        state.accN = 0;
        if (!(lu > TRIM_ABS_GATE)) continue;
        const postLu = lu + 20 * Math.log10(stage1Gain);
        if (settling) {
          state.anchor = postLu;
          continue;
        }
        state.anchor = state.anchor === null ? postLu : state.anchor + (postLu - state.anchor) * TRIM_ANCHOR_COEFF;
        if (!(postLu > state.anchor - TRIM_REL_GATE)) continue;
        // Burst freeze: steer only from content near its own average.
        if (Math.abs(postLu - state.anchor) > TRIM_DEADBAND) continue;
        const want = Math.max(-TRIM_DB, Math.min(TRIM_DB, TRIM_TARGET_LU - state.anchor));
        state.trimDb += (want - state.trimDb) * TRIM_COEFF;
      }
    }
  } catch {
    // Analysis is progressive enhancement — never break playback.
  }
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
