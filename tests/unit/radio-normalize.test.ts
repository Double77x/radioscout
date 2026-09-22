import { afterEach, describe, expect, it } from "vitest";
import {
  adaptGain,
  ATTACK,
  computeRms,
  effectiveRms,
  MAX_GAIN,
  MIN_GAIN,
  normalizeEnabled,
  readNormalizeEnabled,
  RELEASE,
  TARGET_RMS,
  writeNormalizeEnabled,
  NORMALIZE_KEY,
} from "@/lib/radio/normalize";

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
    clear: () => backing.clear(),
    get length() {
      return backing.size;
    },
    key: (index: number) => [...backing.keys()][index] ?? null,
  } as Storage;
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

describe("adaptGain", () => {
  it("pulls down fast when louder than target", () => {
    const next = adaptGain(1, TARGET_RMS * 2);
    expect(next).toBeCloseTo(1 + (0.5 - 1) * ATTACK, 5);
  });

  it("rides up slow when quieter than target", () => {
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

  it("freezes below the analysis floor", () => {
    expect(adaptGain(1.7, 0)).toBe(1.7);
    expect(adaptGain(1.7, 0.005)).toBe(1.7);
    expect(adaptGain(1.7, Number.NaN)).toBe(1.7);
  });

  it("holds near the target", () => {
    expect(adaptGain(1, TARGET_RMS)).toBeCloseTo(1, 5);
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
