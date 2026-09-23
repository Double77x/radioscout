import { describe, expect, it, vi } from "vitest";
import { EMPTY_STATION, type Station } from "@/lib/radio/types";
import { SETTLE_TICKS } from "@/lib/radio/normalize";
import {
  canRouteLeveling,
  freezeLevelingGain,
  levelingTick,
  resetLevelingGain,
  resumeLevelingContext,
  routeLevelingAudio,
} from "@/lib/player/leveling";

function station(overrides: Partial<Station> = {}): Station {
  return { ...EMPTY_STATION, ...overrides };
}

/** Stand-in so `typeof AudioContext` reads defined (Web Audio itself stays stubbed per test). */
function FakeAudioContext(): void {}

function stubAnalyser(samples: number[], fftSize = 8): AnalyserNode & { calls: number } {
  let calls = 0;
  const stub = {
    fftSize,
    get calls(): number {
      return calls;
    },
    getFloatTimeDomainData: (output: Float32Array) => {
      calls += 1;
      output.set(samples.slice(0, output.length));
    },
  } as unknown as AnalyserNode & { calls: number };
  return stub;
}

function stubGain(value = 1): GainNode & { targetCalls: [number, number, number][] } {
  const targetCalls: [number, number, number][] = [];
  const stub = {
    gain: {
      value,
      setTargetAtTime: (target: number, startTime: number, timeConstant: number) => {
        targetCalls.push([target, startTime, timeConstant]);
      },
    },
    targetCalls,
  } as unknown as GainNode & { targetCalls: [number, number, number][] };
  return stub;
}

function stubElement(volume = 1): HTMLAudioElement {
  return { volume } as unknown as HTMLAudioElement;
}

describe("canRouteLeveling", () => {
  it("is false when the toggle is off", () => {
    expect(canRouteLeveling(station(), false, new Set())).toBe(false);
  });

  it("routes null stations and unparseable hosts when on (nothing to block)", () => {
    const holder = globalThis as unknown as Record<string, unknown>;
    const saved = holder["AudioContext"];
    holder["AudioContext"] = FakeAudioContext;
    try {
      expect(canRouteLeveling(null, true, new Set())).toBe(true);
      expect(canRouteLeveling(station({ url: "https://example.com/live", url_resolved: "" }), true, new Set())).toBe(
        true,
      );
      expect(canRouteLeveling(station({ url: "not a url", url_resolved: "" }), true, new Set())).toBe(true);
    } finally {
      holder["AudioContext"] = saved;
    }
  });

  it("remembers session-blocked hosts", () => {
    const holder = globalThis as unknown as Record<string, unknown>;
    const saved = holder["AudioContext"];
    holder["AudioContext"] = FakeAudioContext;
    try {
      const item = station({ url: "https://blocked.example/live", url_resolved: "" });
      expect(canRouteLeveling(item, true, new Set())).toBe(true);
      expect(canRouteLeveling(item, true, new Set(["blocked.example"]))).toBe(false);
    } finally {
      holder["AudioContext"] = saved;
    }
  });
});

describe("routeLevelingAudio", () => {
  it("returns null when off, blocked, or Web Audio is unavailable", () => {
    const element = stubElement();
    const item = station({ url: "https://example.com/live", url_resolved: "" });
    expect(routeLevelingAudio(element, item, false, new Set())).toBeNull();
    expect(routeLevelingAudio(element, item, true, new Set(["example.com"]))).toBeNull();
    expect(routeLevelingAudio(element, item, true, new Set())).toBeNull();
  });
});

describe("resumeLevelingContext", () => {
  it("resumes a policy-suspended context and ignores the rest", () => {
    const resume = vi.fn(() => Promise.resolve());
    resumeLevelingContext({ state: "suspended", resume } as unknown as AudioContext);
    expect(resume).toHaveBeenCalledTimes(1);
    const running = vi.fn(() => Promise.resolve());
    resumeLevelingContext({ state: "running", resume: running } as unknown as AudioContext);
    expect(running).not.toHaveBeenCalled();
    expect(() => resumeLevelingContext(null)).not.toThrow();
  });
});

describe("freezeLevelingGain", () => {
  it("eases to unity via setTargetAtTime, or snaps when unavailable", () => {
    const gain = stubGain(0.7);
    freezeLevelingGain(gain, { currentTime: 12 } as unknown as AudioContext);
    expect(gain.targetCalls).toEqual([[1, 12, 0.05]]);
    const direct = { gain: { value: 0.7 } } as unknown as GainNode;
    freezeLevelingGain(direct, { currentTime: 0 } as unknown as AudioContext);
    expect(direct.gain.value).toBe(1);
  });

  it("tolerates missing parts", () => {
    const gain = stubGain();
    expect(() => freezeLevelingGain(null, null)).not.toThrow();
    expect(() => freezeLevelingGain(gain, null)).not.toThrow();
    expect(gain.targetCalls).toEqual([]);
  });
});

describe("resetLevelingGain", () => {
  it("restores unity and returns a fresh settle budget", () => {
    const gain = stubGain(0.4);
    expect(resetLevelingGain(gain)).toBe(SETTLE_TICKS);
    expect(gain.gain.value).toBe(1);
  });

  it("tolerates teardown races and missing graphs", () => {
    const torn = {
      get gain(): { value: number } {
        throw new Error("gone");
      },
    } as unknown as GainNode;
    expect(() => resetLevelingGain(torn)).not.toThrow();
    expect(resetLevelingGain(null)).toBe(SETTLE_TICKS);
  });
});

describe("levelingTick", () => {
  it("returns null when any live part is missing (never allocates)", () => {
    const analyser = stubAnalyser([0.5]);
    const gain = stubGain();
    expect(levelingTick({ analyser: null, gain, element: stubElement(), buffer: null, settleTicksLeft: 8 })).toBeNull();
    expect(levelingTick({ analyser, gain: null, element: stubElement(), buffer: null, settleTicksLeft: 8 })).toBeNull();
    expect(levelingTick({ analyser, gain, element: null, buffer: null, settleTicksLeft: 8 })).toBeNull();
    expect(analyser.calls).toBe(0);
  });

  it("settles fast after tune-in, then crawls once steady", () => {
    const loud = stubAnalyser([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
    const settlingGain = stubGain(1);
    const settling = levelingTick({
      analyser: loud,
      gain: settlingGain,
      element: stubElement(1),
      buffer: null,
      settleTicksLeft: 8,
    });
    expect(settling?.settleTicksLeft).toBe(7);
    expect(settling?.buffer.length).toBe(8);
    const steadyGain = stubGain(1);
    const steady = levelingTick({
      analyser: loud,
      gain: steadyGain,
      element: stubElement(1),
      buffer: new Float32Array(8),
      settleTicksLeft: 0,
    });
    expect(steady?.settleTicksLeft).toBe(0);
    // Same reading: settle bites (0.85), steady crawls (0.999).
    expect(settlingGain.gain.value).toBeCloseTo(0.85, 10);
    expect(steadyGain.gain.value).toBeCloseTo(0.999, 10);
  });

  it("freezes on silence and muted output (no wind-up)", () => {
    const silent = stubAnalyser([0, 0, 0, 0, 0, 0, 0, 0]);
    const gain = stubGain(1.2);
    const frozen = levelingTick({
      analyser: silent,
      gain,
      element: stubElement(1),
      buffer: null,
      settleTicksLeft: 8,
    });
    expect(gain.gain.value).toBe(1.2);
    expect(frozen?.settleTicksLeft).toBe(7);
    const mutedGain = stubGain(1.2);
    const muted = levelingTick({
      analyser: stubAnalyser([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]),
      gain: mutedGain,
      element: stubElement(0),
      buffer: null,
      settleTicksLeft: 8,
    });
    expect(mutedGain.gain.value).toBe(1.2);
    expect(muted?.settleTicksLeft).toBe(8);
  });

  it("reallocates a stale buffer and survives analyser failure", () => {
    const analyser = stubAnalyser([0.5]);
    const gain = stubGain(1);
    const stale = levelingTick({
      analyser,
      gain,
      element: stubElement(1),
      buffer: new Float32Array(4),
      settleTicksLeft: 8,
    });
    expect(stale?.buffer.length).toBe(8);
    const failing = {
      fftSize: 8,
      getFloatTimeDomainData: () => {
        throw new Error("gone");
      },
    } as unknown as AnalyserNode;
    const survived = levelingTick({
      analyser: failing,
      gain,
      element: stubElement(1),
      buffer: null,
      settleTicksLeft: 8,
    });
    expect(survived?.settleTicksLeft).toBe(8);
  });
});
