import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  adaptGain,
  adaptGainSteady,
  ATTACK,
  computeRms,
  effectiveRms,
  initKFilter,
  initTrimState,
  kFilterSample,
  MAX_GAIN,
  MIN_GAIN,
  normalizeEnabled,
  readNormalizeEnabled,
  RELEASE,
  resetTrimState,
  SETTLE_TICKS,
  STEADY_ATTACK,
  STEADY_RELEASE,
  TARGET_RMS,
  trimAccumulate,
  TRIM_DB,
  trimLinear,
  TRIM_WINDOW,
  writeNormalizeEnabled,
  NORMALIZE_KEY,
} from "@/lib/radio/normalize";

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- mutable record view of a global for stub install/restore
const globalScope = globalThis as unknown as { window?: unknown; localStorage?: Storage };
const backing = new Map<string, string>();

function installStorageStub(): void {
  backing.clear();
  globalScope.window = globalThis;
  globalScope.localStorage = {
    getItem: (key: string) => backing.get(key) ?? null,
    setItem: (key: string, value: string) => {
      backing.set(key, value);
    },
    removeItem: (key: string) => {
      backing.delete(key);
    },
    clear: () => {
      backing.clear();
    },
    get length() {
      return backing.size;
    },
    key: (index: number) => [...backing.keys()][index] ?? null,
  };
}

afterEach(() => {
  delete globalScope.window;
  delete globalScope.localStorage;
});

describe("computeRms", () => {
  it("reads silence as zero", () => {
    expect(computeRms(new Float32Array(2048))).toBe(0);
    expect(computeRms([])).toBe(0);
  });

  it("reads full-scale DC near 0.7", () => {
    expect(computeRms(new Float32Array(1024).fill(1))).toBeCloseTo(1, 5);
    expect(computeRms(new Float32Array(1024).fill(0.5))).toBeCloseTo(0.5, 5);
  });

  it("reads a sine at amplitude over root two", () => {
    const samples = new Float32Array(2048);
    for (let index = 0; index < samples.length; index++) {
      samples[index] = 0.6 * Math.sin((index / samples.length) * Math.PI * 2 * 8);
    }
    expect(computeRms(samples)).toBeCloseTo(0.6 / Math.SQRT2, 3);
  });
});

/**
 * Seconds of settle-phase ticking until a constant-`rms` source sits within
 * 0.5 dB of its own clamped target. Ticks are `timeupdate`-driven at ~4Hz.
 */
function secondsToSettle(rms: number): number {
  let gain = 1;
  const wanted = Math.min(MAX_GAIN, Math.max(MIN_GAIN, TARGET_RMS / rms));
  for (let tick = 0; tick < SETTLE_TICKS * 4; tick += 1) {
    gain = adaptGain(gain, rms);
    if (Math.abs(20 * Math.log10(wanted / gain)) < 0.5) return tick / 4;
  }
  return Number.POSITIVE_INFINITY;
}

describe("adaptGain", () => {
  it("pulls down fast when louder than target", () => {
    const next = adaptGain(1, TARGET_RMS * 2);
    expect(next).toBeCloseTo(1 + (0.5 - 1) * ATTACK, 5);
  });

  it("rides up when quieter than target", () => {
    const next = adaptGain(1, TARGET_RMS / 2);
    expect(next).toBeCloseTo(1 + (2 - 1) * RELEASE, 5);
  });

  it("clamps the target and converges into range", () => {
    expect(adaptGain(MAX_GAIN, TARGET_RMS * 100)).toBeGreaterThanOrEqual(MIN_GAIN);
    expect(adaptGain(1, 1e-3)).toBeLessThanOrEqual(MAX_GAIN);
    let gain = 100;
    for (let index = 0; index < 50; index++) gain = adaptGain(gain, TARGET_RMS);
    expect(gain).toBeLessThanOrEqual(MAX_GAIN);
    expect(gain).toBeCloseTo(1, 1);
  });

  it("converges on the exact correction for a steady source", () => {
    // Pre-gain measurement: a constant 0.07-RMS source needs exactly 2x.
    let gain = 1;
    for (let index = 0; index < 200; index++) gain = adaptGain(gain, 0.07);
    expect(gain).toBeCloseTo(TARGET_RMS / 0.07, 2);
  });

  it("settles a quiet station as fast as a loud one", () => {
    // Regression: RELEASE at 0.05 against ATTACK 0.3 converged a boosted
    // station 80x slower than a ducked one (145s vs 1.8s), so anything
    // needing a lift stayed audibly quiet — the "HLS/speech stations are
    // quieter" report. Both directions must now land inside the window.
    const loud = secondsToSettle(TARGET_RMS * 2);
    const quiet = secondsToSettle(TARGET_RMS / 2);
    expect(loud).toBeLessThan(SETTLE_TICKS / 4);
    // Converges inside the settle window rather than crawling for minutes.
    expect(quiet).toBeLessThanOrEqual(SETTLE_TICKS / 4);
    // And the two directions stay within one settle window of each other.
    expect(Math.abs(quiet - loud)).toBeLessThan(SETTLE_TICKS / 4);
  });

  it("freezes below the analysis floor", () => {
    expect(adaptGain(1.7, 0)).toBe(1.7);
    expect(adaptGain(1.7, 0.005)).toBe(1.7);
    expect(adaptGain(1.7, Number.NaN)).toBe(1.7);
  });

  it("holds near the target", () => {
    expect(adaptGain(1, TARGET_RMS)).toBeCloseTo(1, 5);
  });
});

describe("adaptGainSteady", () => {
  it("crawls where the settle step strides", () => {
    const settle = Math.abs(adaptGain(1, TARGET_RMS * 2) - 1);
    const steady = Math.abs(adaptGainSteady(1, TARGET_RMS * 2) - 1);
    expect(steady).toBeLessThan(settle / 10);
    expect(STEADY_ATTACK).toBeLessThan(ATTACK / 10);
    expect(STEADY_RELEASE).toBeLessThan(RELEASE / 10);
  });

  it("clamps to −9/+9 dB and freezes below the floor", () => {
    expect(adaptGainSteady(1, 1e-4)).toBeLessThanOrEqual(MAX_GAIN);
    expect(adaptGainSteady(MAX_GAIN, TARGET_RMS * 100)).toBeGreaterThanOrEqual(MIN_GAIN);
    expect(MIN_GAIN).toBe(0.35);
    expect(MAX_GAIN).toBe(2.8);
    expect(adaptGainSteady(1.4, 0)).toBe(1.4);
    expect(adaptGainSteady(1.4, Number.NaN)).toBe(1.4);
  });

  it("settles a station jump inside the window, then ignores the song", () => {
    // Station jump: unity gain converges on a 2x-loud station inside the
    // settle window (~8s at ~4Hz), so the jump is short-lived.
    let gain = 1;
    for (let index = 0; index < SETTLE_TICKS; index++) gain = adaptGain(gain, TARGET_RMS * 2);
    expect(gain).toBeCloseTo(0.5, 1);
    // Settled station at target level, then two minutes of ±3 dB
    // verse/chorus: breathing must stay under 1 dB (the old always-fast
    // loop swung ~15 dB here by chasing every section).
    gain = 1;
    for (let index = 0; index < SETTLE_TICKS; index++) gain = adaptGain(gain, TARGET_RMS);
    const settled = gain;
    let peak = 0;
    for (let index = 0; index < 480; index++) {
      const rms = Math.floor(index / 80) % 2 === 0 ? TARGET_RMS / 1.41 : TARGET_RMS * 1.41;
      gain = adaptGainSteady(gain, rms);
      peak = Math.max(peak, Math.abs(20 * Math.log10(gain / settled)));
    }
    expect(peak).toBeLessThan(1);
  });
});

describe("effectiveRms", () => {
  it("divides the slider back out so 0–100 keeps its meaning", () => {
    expect(effectiveRms(0.07, 1)).toBeCloseTo(0.07, 5);
    expect(effectiveRms(0.07, 0.5)).toBeCloseTo(0.14, 5);
  });

  it("freezes when muted, zeroed or unreadable", () => {
    expect(effectiveRms(0.07, 0)).toBeNull();
    expect(effectiveRms(0.07, 0.005)).toBeNull();
    expect(effectiveRms(Number.NaN, 1)).toBeNull();
    expect(effectiveRms(0.07, Number.NaN)).toBeNull();
  });
});

describe("kFilterSample", () => {
  it("blocks DC and passes midband (K-weighting shape)", () => {
    const dc = initKFilter();
    let out = 0;
    for (let index = 0; index < 2000; index += 1) out = kFilterSample(dc, 1);
    expect(Math.abs(out)).toBeLessThan(0.01);
    // 1 kHz sine reads near unity (K is ~+0.7 dB here).
    const tone = initKFilter();
    let peak = 0;
    for (let index = 0; index < 4800; index += 1) {
      const value = kFilterSample(tone, Math.sin((2 * Math.PI * 1000 * index) / 48_000));
      if (index > 2400) peak = Math.max(peak, Math.abs(value));
    }
    expect(peak).toBeGreaterThan(0.9);
    expect(peak).toBeLessThan(1.25);
  });

  it("swallows non-finite input without poisoning state", () => {
    const state = initKFilter();
    expect(kFilterSample(state, Number.NaN)).toBe(0);
    let peak = 0;
    for (let index = 0; index < 4800; index += 1) {
      const value = kFilterSample(state, Math.sin((2 * Math.PI * 1000 * index) / 48_000));
      if (index > 2400) peak = Math.max(peak, Math.abs(value));
    }
    expect(peak).toBeGreaterThan(0.9);
  });
});

/** 1 kHz sine window at the given peak amplitude (48 kHz assumed). */
function sineWindow(amplitude: number, samples: number = TRIM_WINDOW): Float32Array {
  const out = new Float32Array(samples);
  for (let index = 0; index < samples; index += 1) {
    out[index] = amplitude * Math.sin((2 * Math.PI * 1000 * index) / 48_000);
  }
  return out;
}

describe("trimAccumulate", () => {
  it("rides up toward the K target on quiet programme", () => {
    const state = initTrimState();
    // 1 kHz at 0.05 peak ≈ −26 LU momentary: three windows of want ≈ +3 dB.
    for (let window = 0; window < 3; window += 1) trimAccumulate(state, sineWindow(0.05), 1);
    expect(state.anchor).not.toBeNull();
    expect(state.trimDb).toBeGreaterThan(0.2);
    expect(state.trimDb).toBeLessThanOrEqual(TRIM_DB);
    expect(trimLinear(state.trimDb)).toBeGreaterThan(1);
  });

  it("counts stage-1 gain as output loudness", () => {
    // 1 kHz at 0.2 peak ≈ −17 LU: untrimmed it wants the full +3 dB, but the
    // same samples behind a stage-1 gain of 2 read 6 dB hotter and trim down.
    const direct = initTrimState();
    const boosted = initTrimState();
    for (let window = 0; window < 3; window += 1) trimAccumulate(direct, sineWindow(0.2), 1);
    for (let window = 0; window < 3; window += 1) trimAccumulate(boosted, sineWindow(0.2), 2);
    expect(direct.trimDb).toBeGreaterThan(0);
    expect(boosted.trimDb).toBeLessThan(0);
  });

  it("ignores gated blocks: silence and quiet-relative passages don't steer", () => {
    const state = initTrimState();
    for (let window = 0; window < 3; window += 1) trimAccumulate(state, sineWindow(1), 1);
    const loudTrim = state.trimDb;
    expect(loudTrim).toBeLessThan(0);
    // Digital silence: absolute gate, accumulator only.
    for (let window = 0; window < 3; window += 1) trimAccumulate(state, new Float32Array(TRIM_WINDOW), 1);
    expect(state.trimDb).toBe(loudTrim);
    // −60 LU murmur after a loud anchor: relative gate, no steering.
    for (let window = 0; window < 3; window += 1) trimAccumulate(state, sineWindow(0.001), 1);
    expect(state.trimDb).toBe(loudTrim);
  });

  it("never throws on garbage and resets cleanly per station", () => {
    const state = initTrimState();
    for (let window = 0; window < 2; window += 1) trimAccumulate(state, sineWindow(0.05), 1);
    expect(state.trimDb).not.toBe(0);
    expect(() => {
      trimAccumulate(state, sineWindow(0.05), 0);
      trimAccumulate(state, sineWindow(0.05), Number.NaN);
    }).not.toThrow();
    resetTrimState(state);
    expect(state.trimDb).toBe(0);
    expect(state.anchor).toBeNull();
    expect(trimLinear(Number.NaN)).toBe(1);
    expect(trimLinear(TRIM_DB + 10)).toBeCloseTo(10 ** (TRIM_DB / 20), 10);
  });
});

describe("normalize storage", () => {
  it("parses toggle values strictly", () => {
    expect(normalizeEnabled("1")).toBe(true);
    expect(normalizeEnabled("0")).toBe(false);
    expect(normalizeEnabled("true")).toBe(false);
    expect(normalizeEnabled(undefined)).toBe(false);
  });

  it("reads off without a window (SSR)", () => {
    expect(readNormalizeEnabled()).toBe(false);
  });

  it("round-trips the toggle through storage", () => {
    installStorageStub();
    expect(readNormalizeEnabled()).toBe(false);
    writeNormalizeEnabled(true);
    expect(backing.get(NORMALIZE_KEY)).toBe("1");
    expect(readNormalizeEnabled()).toBe(true);
  });
});
