import { describe, expect, it } from "vite-plus/test";
import { bandEdges, createSpectrumReader } from "@/lib/player/spectrum";

const SAMPLE_RATE = 44_100;
const BIN_COUNT = 512;

/** Analyser double: every bin reports the same dBFS, -Infinity for silence. */
function stubAnalyser(db: number): AnalyserNode {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- partial test double: unexercised members are intentionally absent
  return {
    frequencyBinCount: BIN_COUNT,
    context: { sampleRate: SAMPLE_RATE },
    getFloatFrequencyData: (output: Float32Array) => {
      output.fill(db);
    },
  } as unknown as AnalyserNode;
}

/** Analyser double with one loud bin, everything else silent. */
function stubBin(db: number, bin: number): AnalyserNode {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- partial test double: unexercised members are intentionally absent
  return {
    frequencyBinCount: BIN_COUNT,
    context: { sampleRate: SAMPLE_RATE },
    getFloatFrequencyData: (output: Float32Array) => {
      output.fill(Number.NEGATIVE_INFINITY);
      output[bin] = db;
    },
  } as unknown as AnalyserNode;
}

/** Let the attack envelope settle: 0.95^n leaves a negligible gap by n = 200. */
function settle(
  reader: ReturnType<typeof createSpectrumReader>,
  analyser: AnalyserNode,
  volume = 1,
  bands?: number,
): void {
  for (let index = 0; index < 200; index += 1) reader.read(analyser, volume, bands);
}

describe("bandEdges", () => {
  it("spans the audible range with at least one bin per band", () => {
    const edges = bandEdges(BIN_COUNT, SAMPLE_RATE, 24);
    expect(edges).toHaveLength(25);
    expect(edges[0]).toBeGreaterThanOrEqual(0);
    expect(edges[24]).toBeLessThan(BIN_COUNT);
    for (let index = 1; index < edges.length; index += 1) {
      expect(edges[index]).toBeGreaterThan(edges[index - 1]);
    }
  });

  it("starts at the 60 Hz rumble edge and ends near 12 kHz", () => {
    const hzPerBin = SAMPLE_RATE / 2 / BIN_COUNT;
    const edges = bandEdges(BIN_COUNT, SAMPLE_RATE, 8);
    expect(edges[0] * hzPerBin).toBeGreaterThan(40);
    expect(edges[0] * hzPerBin).toBeLessThan(90);
    expect(edges[8] * hzPerBin).toBeGreaterThan(11_000);
  });
});

describe("createSpectrumReader", () => {
  it("maps a mid-level bin to the middle of the wing", () => {
    const reader = createSpectrumReader(1);
    settle(reader, stubAnalyser(-30));
    // (-30 + 60) / 50 = 0.6, times GAIN 1.25, under the 0.95 ceiling.
    expect(reader.levels[0]).toBeCloseTo(0.75, 2);
  });

  it("drives loud bins to the ceiling without exceeding it", () => {
    const reader = createSpectrumReader(1);
    settle(reader, stubAnalyser(-12));
    expect(reader.levels[0]).toBeCloseTo(0.95, 3);
  });

  it("reads silence and the floor as zero", () => {
    const silent = createSpectrumReader(1);
    settle(silent, stubAnalyser(Number.NEGATIVE_INFINITY));
    expect(silent.levels[0]).toBe(0);

    const quiet = createSpectrumReader(1);
    settle(quiet, stubAnalyser(-60));
    expect(quiet.levels[0]).toBe(0);
  });

  it("adds element volume back, so the slider cannot shrink the meter", () => {
    const quietSlider = createSpectrumReader(1);
    settle(quietSlider, stubAnalyser(-45), 0.25);
    // 25% volume is −12.04 dB; the same reading must land on a −32.96 dB bin.
    const equivalent = createSpectrumReader(1);
    settle(equivalent, stubAnalyser(-32.96));
    expect(quietSlider.levels[0]).toBeCloseTo(equivalent.levels[0], 3);
  });

  it("falls quickly and leaves peak caps behind at a constant rate", () => {
    const reader = createSpectrumReader(1);
    settle(reader, stubAnalyser(-30));
    const peak = reader.peaks[0];
    expect(peak).toBeCloseTo(0.75, 2);

    for (let index = 0; index < 10; index += 1) reader.read(stubAnalyser(-60), 1);
    expect(reader.levels[0]).toBeLessThan(0.2);
    // 10 frames of PEAK_FALL (0.025) below the old peak, still above the bar.
    expect(reader.peaks[0]).toBeCloseTo(peak - 0.25, 2);
    expect(reader.peaks[0]).toBeGreaterThan(reader.levels[0]);
  });

  it("spreads the whole range across the bands the wing actually draws", () => {
    // A 19-bar wing used to draw bands 0–18 of a fixed 40-band axis, which
    // stopped at ~756 Hz and ignored everything above it.
    const edges = bandEdges(BIN_COUNT, SAMPLE_RATE, 19);
    const reader = createSpectrumReader(40);
    settle(reader, stubBin(-12, edges[19] - 1), 1, 19);
    expect(reader.levels[18]).toBeGreaterThan(0.8);
    expect(reader.levels[0]).toBe(0);
  });
});
