/**
 * Spectrum band reader behind the desktop spectrum wings. Turns an
 * AnalyserNode's frequency data into bar levels on a log frequency axis,
 * with a fast attack, a slower release and peak caps that fall at a constant
 * rate. Free of React and of player state — the caller owns the frame loop,
 * the canvas and the tint.
 */

/**
 * Band edges. The analysis tap already rolls off below 60 Hz, so a lower edge
 * would only read the filter's skirt; radio codecs carry little above 12 kHz
 * but hiss.
 */
const MIN_HZ = 60;
const MAX_HZ = 12_000;
/**
 * dBFS window. The byte API maps −100…−30 dB and clamps anything louder,
 * which pins loud bass bins at full scale and kills the movement. The
 * strongest bins of a normal master sit around −25…−10 dB, so this window
 * keeps headroom at the top and still shows quiet detail.
 */
const FLOOR_DB = -60;
const CEIL_DB = -10;
/** Drive, so a hot master reaches the ceiling without flattening quiet parts. */
const GAIN = 1.25;
/** Headroom, so peaks read as peaks rather than a pinned wall. */
const CEILING = 0.95;
/** Near-instant rise, then a quick fall — the meter pumps with the track. */
const ATTACK = 0.95;
const RELEASE = 0.18;
/** Peak caps fall per frame — visible for about a second, then gone. */
const PEAK_FALL = 0.025;

export interface SpectrumReader {
  readonly levels: Float32Array;
  readonly peaks: Float32Array;
  /**
   * `bands` is how many of the log-spaced bands this reading should cover.
   * The wing passes its drawn bar count, so the whole 60 Hz–12 kHz range fits
   * however wide the wing is, rather than the first N bands of a fixed axis.
   */
  read: (analyser: AnalyserNode, volume: number, bands?: number) => void;
}

/**
 * Log-spaced band boundaries as bin indices, `bars + 1` entries. Every band
 * spans at least one bin, so a narrow wing never repeats a reading.
 */
export function bandEdges(binCount: number, sampleRate: number, bars: number): Uint16Array {
  const hzPerBin = sampleRate / 2 / binCount;
  const top = Math.min(MAX_HZ, sampleRate / 2);
  const low = Math.log(MIN_HZ);
  const high = Math.log(top);
  const edges = new Uint16Array(bars + 1);
  for (let index = 0; index <= bars; index += 1) {
    const hz = Math.exp(low + ((high - low) * index) / bars);
    edges[index] = Math.min(binCount - 1, Math.max(0, Math.round(hz / hzPerBin)));
  }
  for (let index = 1; index <= bars; index += 1) {
    edges[index] = Math.min(binCount - 1, Math.max(edges[index], edges[index - 1] + 1));
  }
  return edges;
}

export function createSpectrumReader(bars: number): SpectrumReader {
  const levels = new Float32Array(bars);
  const peaks = new Float32Array(bars);
  let data: Float32Array<ArrayBuffer> | null = null;
  let edges: Uint16Array | null = null;
  let bins = 0;
  let sourceRate = 0;
  let span = 0;

  return {
    levels,
    peaks,
    read: (analyser: AnalyserNode, volume: number, bands = bars): void => {
      const binCount = analyser.frequencyBinCount;
      const sampleRate = analyser.context.sampleRate;
      // Numeric comparison rather than a key string: this runs every frame.
      if (binCount !== bins || sampleRate !== sourceRate || bands !== span) {
        bins = binCount;
        sourceRate = sampleRate;
        if (bands !== span) {
          span = bands;
          // The bands re-map, so old levels would glide from the wrong shape.
          levels.fill(0);
          peaks.fill(0);
        }
        data = new Float32Array(binCount);
        edges = bandEdges(binCount, sampleRate, bands);
      }
      if (!data || !edges) return;
      analyser.getFloatFrequencyData(data);
      // Element volume sits before the graph; add it back so the meter tracks
      // the track rather than the slider. Clamped so mute cannot read as loud.
      const lift = -20 * Math.log10(Math.max(0.02, Math.min(1, volume)));
      for (let index = 0; index < bands; index += 1) {
        const start = edges[index];
        const end = Math.max(start + 1, edges[index + 1]);
        // The loudest bin owns the bar: an average over a log band buries the
        // hits that make the wing read as live.
        let raw = FLOOR_DB;
        for (let bin = start; bin < end; bin += 1) {
          if (data[bin] > raw) raw = data[bin];
        }
        const ratio = Math.min(1, Math.max(0, (raw + lift - FLOOR_DB) / (CEIL_DB - FLOOR_DB)));
        const target = Math.min(CEILING, ratio * GAIN);
        const level = levels[index];
        const rate = target > level ? ATTACK : RELEASE;
        levels[index] = level + (target - level) * rate;
        peaks[index] = Math.max(peaks[index] - PEAK_FALL, levels[index]);
      }
    },
  };
}
