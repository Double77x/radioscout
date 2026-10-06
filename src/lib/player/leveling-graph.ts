/**
 * Leveling graph construction: the Web Audio measurement branch behind the
 * loudness leveler. Pure construction — no player state read or written —
 * so both the live path (promotes the parts) and the handoff path (stages
 * them on the incoming element first) share it.
 *
 * Graph shape, the two tap invariants and the CORS requirement:
 * docs/modules/player/leveling.md
 */

/** Leveling graph parts for one element (null when Web Audio is unavailable). */
export interface LevelingGraph {
  ctx: AudioContext;
  gain: GainNode;
  analyser: AnalyserNode;
  /** Raw-source tap for the stage-2 LUFS trim (K biquads run JS-side per tick). */
  kAnalyser: AnalyserNode;
  /** Safety limiter: brickwall at −1 dBFS so boosted peaks shave, never clip. */
  comp: DynamicsCompressorNode;
}

/**
 * Build the measurement graph for an element. `crossOrigin` is load-time
 * state, so the caller sets src only after this returns non-null (or skips
 * routing and plays direct). Never throws.
 */
export function buildLevelingGraph(element: HTMLAudioElement): LevelingGraph | null {
  try {
    element.crossOrigin = "anonymous";
    const ctx = new AudioContext();
    const source = ctx.createMediaElementSource(element);
    const gain = ctx.createGain();
    gain.gain.value = 1;
    // Final safety limiter: transparent below threshold (linear region passes
    // bit-exact), brickwall above — boosted transient tips shave instead of
    // flat-topping at the DAC. Threshold −1 dBFS keeps broadcast headroom.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -1;
    comp.knee.value = 0;
    comp.ratio.value = 20;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    source.connect(gain);
    gain.connect(comp);
    comp.connect(ctx.destination);
    // Perceptual tap (K-inspired, measurement only): rumble high-pass plus
    // presence shelf feed a dedicated analyser, whose whisper-quiet tail
    // keeps the branch pulled without touching the audible mix.
    const rumble = ctx.createBiquadFilter();
    rumble.type = "highpass";
    rumble.frequency.value = 60;
    const presence = ctx.createBiquadFilter();
    presence.type = "highshelf";
    presence.frequency.value = 1500;
    presence.gain.value = 4;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    const whisper = ctx.createGain();
    whisper.gain.value = 0.001;
    source.connect(rumble);
    rumble.connect(presence);
    presence.connect(analyser);
    analyser.connect(whisper);
    whisper.connect(ctx.destination);
    // Raw-source tap for the stage-2 trim: the K biquads run JS-side per tick
    // over this buffer, so the graph only hosts the tap. Joins the whisper
    // tail (still −50 dB down summed — fully masked).
    const kAnalyser = ctx.createAnalyser();
    kAnalyser.fftSize = 2048;
    source.connect(kAnalyser);
    kAnalyser.connect(whisper);
    return { ctx, gain, analyser, kAnalyser, comp };
  } catch {
    // Graph unavailable — the element plays directly, leveling skipped.
    return null;
  }
}
