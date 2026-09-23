/**
 * Leveling wiring: the Web Audio routing predicate, graph-run construction
 * and the per-tick RMS plumbing behind loudness leveling. Pure construction
 * plus parameterized parts — the engine keeps sole ownership of the graph
 * refs (`audioCtx`, `normGain`, `normAnalyser`, `audioRouted`),
 * `settleTicksLeft`, `blockedHosts` and `retriedDirect`, so `setNormalization`
 * (which replays through the handoff and transport) stays there: the state
 * machine stays whole deliberately (see
 * `docs/REFACTOR_PLAYER_ENGINE_PLAN.md` Phase 1e assessment).
 *
 * The gain math itself lives in `lib/radio/normalize` (already unit-tested);
 * this module owns the tick plumbing around it (buffer lifecycle, settle vs
 * steady selection, teardown tolerance). Never throws.
 */
import { hostOf } from "@/lib/player/elements";
import { buildLevelingGraph, type LevelingGraph } from "@/lib/player/leveling-graph";
import { adaptGain, adaptGainSteady, computeRms, effectiveRms, SETTLE_TICKS } from "@/lib/radio/normalize";
import { pickPlayableUrl, type Station } from "@/lib/radio/types";

/**
 * Whether a station's host can be routed through Web Audio (leveling needs
 * CORS headers; remembered-blocked hosts play direct). Pure lookup — the
 * caller decides what to do with a `false`.
 */
export function canRouteLeveling(
  station: Station | null,
  normalizeOn: boolean,
  blockedHosts: ReadonlySet<string>,
): boolean {
  if (!normalizeOn || typeof AudioContext === "undefined") return false;
  if (!station) return true;
  const host = hostOf(pickPlayableUrl(station));
  return host === null || !blockedHosts.has(host);
}

/** Live leveling run for one element: graph parts plus measurement state. */
export interface LevelingRun {
  graph: LevelingGraph;
  buffer: Float32Array<ArrayBuffer>;
  settleTicksLeft: number;
}

/**
 * Build the leveling run for a fresh (sourceless) element. Null when the
 * toggle is off, Web Audio is unavailable, the host proved unanalysable, or
 * the graph build fails — every null plays direct. A fresh run starts at
 * unity in the fast settle phase.
 */
export function routeLevelingAudio(
  element: HTMLAudioElement,
  station: Station | null,
  normalizeOn: boolean,
  blockedHosts: ReadonlySet<string>,
): LevelingRun | null {
  if (!canRouteLeveling(station, normalizeOn, blockedHosts)) return null;
  const graph = buildLevelingGraph(element);
  if (!graph) return null;
  return {
    graph,
    buffer: new Float32Array(graph.analyser.fftSize),
    settleTicksLeft: SETTLE_TICKS,
  };
}

/** Resume a suspended context (autoplay policy parks it until a gesture). */
export function resumeLevelingContext(ctx: AudioContext | null): void {
  if (ctx && ctx.state === "suspended") {
    void ctx.resume().catch(() => {});
  }
}

/** Park the leveling gain at unity (toggle-off path — analysis just stops). */
export function freezeLevelingGain(gain: GainNode | null, ctx: AudioContext | null): void {
  if (gain && ctx) {
    try {
      gain.gain.setTargetAtTime(1, ctx.currentTime, 0.05);
    } catch {
      gain.gain.value = 1;
    }
  }
}

/**
 * Restart leveling for a new station: unity gain plus a fresh fast-settle
 * window, so the previous station's correction never blasts or ducks the
 * next one. Returns the settle budget for the engine to store.
 */
export function resetLevelingGain(gain: GainNode | null): number {
  if (gain) {
    try {
      gain.gain.value = 1;
    } catch {
      // Graph torn down mid-swap — the rebuild starts at unity anyway.
    }
  }
  return SETTLE_TICKS;
}

/** Live parts for one RMS tick (the caller gates on audibility). */
export interface LevelingTick {
  analyser: AnalyserNode | null;
  gain: GainNode | null;
  element: HTMLAudioElement | null;
  buffer: Float32Array<ArrayBuffer> | null;
  settleTicksLeft: number;
}

/** One RMS tick: settle fast after tune-in, then crawl (never throws). */
export function levelingTick(tick: LevelingTick): {
  buffer: Float32Array<ArrayBuffer>;
  settleTicksLeft: number;
} | null {
  const { analyser, gain, element } = tick;
  if (!analyser || !gain || !element) return null;
  let { buffer, settleTicksLeft } = tick;
  try {
    if (!buffer || buffer.length !== analyser.fftSize) {
      buffer = new Float32Array(analyser.fftSize);
    }
    analyser.getFloatTimeDomainData(buffer);
    const effective = effectiveRms(computeRms(buffer), element.volume);
    if (effective === null) return { buffer, settleTicksLeft };
    if (settleTicksLeft > 0) {
      settleTicksLeft -= 1;
      gain.gain.value = adaptGain(gain.gain.value, effective);
    } else {
      gain.gain.value = adaptGainSteady(gain.gain.value, effective);
    }
  } catch {
    // Analysis is progressive enhancement — never break playback.
  }
  // A null buffer here means the input had none and allocation threw —
  // report null so the engine keeps its previous (also null) buffer.
  return buffer ? { buffer, settleTicksLeft } : null;
}
