import { describe, expect, it, vi } from "vite-plus/test";
import { EMPTY_STATION, type Station } from "@/lib/radio/types";
import { initTrimState, SETTLE_TICKS } from "@/lib/radio/normalize";
import {
  canRouteLeveling,
  freezeLevelingGain,
  levelingTick,
  type LevelingTick,
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
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- partial test double: unexercised members are intentionally absent
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
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- partial test double: unexercised members are intentionally absent
  } as unknown as GainNode & { targetCalls: [number, number, number][] };
  return stub;
}

function stubElement(volume = 1): HTMLAudioElement {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- partial test double: unexercised members are intentionally absent
  return { volume } as unknown as HTMLAudioElement;
}

/** Full tick with quiet defaults (no trim taps unless the test opts in). */
function tick(overrides: Partial<LevelingTick> = {}): LevelingTick {
  return {
    analyser: stubAnalyser([0.5]),
    gain: stubGain(1),
    element: stubElement(1),
    buffer: null,
    kAnalyserL: null,
    kAnalyserR: null,
    kBufferL: null,
    kBufferR: null,
    trim: null,
    settleTicksLeft: 8,
    ...overrides,
  };
}

describe("canRouteLeveling", () => {
  it("is false when the toggle is off", () => {
    expect(canRouteLeveling(station(), false, new Set())).toBe(false);
  });

  it("routes null stations and unparseable hosts when on (nothing to block)", () => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- mutable record view of a global for stub install/restore
    const holder = globalThis as unknown as Record<string, unknown>;
    const saved = holder.AudioContext;
    holder.AudioContext = FakeAudioContext;
    try {
      expect(canRouteLeveling(null, true, new Set())).toBe(true);
      expect(canRouteLeveling(station({ url: "https://example.com/live", url_resolved: "" }), true, new Set())).toBe(
        true,
      );
      expect(canRouteLeveling(station({ url: "not a url", url_resolved: "" }), true, new Set())).toBe(true);
    } finally {
      holder.AudioContext = saved;
    }
  });

  it("remembers session-blocked hosts", () => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- mutable record view of a global for stub install/restore
    const holder = globalThis as unknown as Record<string, unknown>;
    const saved = holder.AudioContext;
    holder.AudioContext = FakeAudioContext;
    try {
      const item = station({ url: "https://blocked.example/live", url_resolved: "" });
      expect(canRouteLeveling(item, true, new Set())).toBe(true);
      expect(canRouteLeveling(item, true, new Set(["blocked.example"]))).toBe(false);
    } finally {
      holder.AudioContext = saved;
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
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- partial test double: unexercised members are intentionally absent
    resumeLevelingContext({ state: "suspended", resume } as unknown as AudioContext);
    expect(resume).toHaveBeenCalledTimes(1);
    const running = vi.fn(() => Promise.resolve());
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- partial test double: unexercised members are intentionally absent
    resumeLevelingContext({ state: "running", resume: running } as unknown as AudioContext);
    expect(running).not.toHaveBeenCalled();
    expect(() => {
      resumeLevelingContext(null);
    }).not.toThrow();
  });
});

describe("freezeLevelingGain", () => {
  it("eases to unity via setTargetAtTime, or snaps when unavailable", () => {
    const gain = stubGain(0.7);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- partial test double: unexercised members are intentionally absent
    freezeLevelingGain(gain, { currentTime: 12 } as unknown as AudioContext);
    expect(gain.targetCalls).toEqual([[1, 12, 0.05]]);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- partial test double: unexercised members are intentionally absent
    const direct = { gain: { value: 0.7 } } as unknown as GainNode;
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- partial test double: unexercised members are intentionally absent
    freezeLevelingGain(direct, { currentTime: 0 } as unknown as AudioContext);
    expect(direct.gain.value).toBe(1);
  });

  it("tolerates missing parts", () => {
    const gain = stubGain();
    expect(() => {
      freezeLevelingGain(null, null);
    }).not.toThrow();
    expect(() => {
      freezeLevelingGain(gain, null);
    }).not.toThrow();
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
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- partial test double: unexercised members are intentionally absent
    } as unknown as GainNode;
    expect(() => resetLevelingGain(torn)).not.toThrow();
    expect(resetLevelingGain(null)).toBe(SETTLE_TICKS);
  });
});

describe("levelingTick", () => {
  it("returns null when any live part is missing (never allocates)", () => {
    const analyser = stubAnalyser([0.5]);
    const gain = stubGain();
    expect(levelingTick(tick({ analyser: null, gain }))).toBeNull();
    expect(levelingTick(tick({ analyser, gain: null }))).toBeNull();
    expect(levelingTick(tick({ analyser, gain, element: null }))).toBeNull();
    expect(analyser.calls).toBe(0);
  });

  it("settles fast after tune-in, then crawls once steady", () => {
    const loud = stubAnalyser([0.28, 0.28, 0.28, 0.28, 0.28, 0.28, 0.28, 0.28]);
    const settlingGain = stubGain(1);
    const settling = levelingTick(tick({ analyser: loud, gain: settlingGain }));
    expect(settling?.settleTicksLeft).toBe(7);
    expect(settling?.buffer.length).toBe(8);
    const steadyGain = stubGain(1);
    const steady = levelingTick(
      tick({ analyser: loud, gain: steadyGain, buffer: new Float32Array(8), settleTicksLeft: 0 }),
    );
    expect(steady?.settleTicksLeft).toBe(0);
    // Same reading: settle bites (0.85), steady crawls (0.999).
    expect(settlingGain.gain.value).toBeCloseTo(0.85, 5);
    expect(steadyGain.gain.value).toBeCloseTo(0.999, 5);
  });

  it("freezes on silence and muted output (no wind-up)", () => {
    const silent = stubAnalyser([0, 0, 0, 0, 0, 0, 0, 0]);
    const gain = stubGain(1.2);
    const frozen = levelingTick(tick({ analyser: silent, gain }));
    expect(gain.gain.value).toBe(1.2);
    // Silence must not spend the settle budget, or a speech station whose
    // first 8s are mostly pauses reaches the steady crawl uncorrected.
    expect(frozen?.settleTicksLeft).toBe(8);
    const mutedGain = stubGain(1.2);
    const muted = levelingTick(
      tick({
        analyser: stubAnalyser([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]),
        gain: mutedGain,
        element: stubElement(0),
      }),
    );
    expect(mutedGain.gain.value).toBe(1.2);
    expect(muted?.settleTicksLeft).toBe(8);
  });

  it("keeps the settle budget alive across quiet ticks, then converges", () => {
    // A quiet station (speech, rms ~0.045) needs the full +9 dB clamp. Burn
    // half the window on sub-floor ticks, then play real audio: the gain must
    // still reach up instead of falling into the steady crawl.
    const gain = stubGain(1);
    let settleTicksLeft = 8;
    // rms 0.004 < FREEZE_FLOOR — a pause, contributes nothing.
    for (let index = 0; index < 4; index += 1) {
      settleTicksLeft =
        levelingTick(tick({ analyser: stubAnalyser([0.004, 0.004, 0.004, 0.004]), gain, settleTicksLeft }))
          ?.settleTicksLeft ?? 0;
    }
    expect(settleTicksLeft).toBe(8);
    // Real audio now: 8 loud ticks against the untouched budget.
    for (let index = 0; index < 8; index += 1) {
      settleTicksLeft =
        levelingTick(tick({ analyser: stubAnalyser([0.045, 0.045, 0.045, 0.045]), gain, settleTicksLeft }))
          ?.settleTicksLeft ?? 0;
    }
    expect(settleTicksLeft).toBe(0);
    // Converged well up the clamp (was ~1.03 — 0.27 dB — before the fix).
    expect(20 * Math.log10(gain.gain.value)).toBeGreaterThan(6);
  });

  it("folds the slow trim in on top of stage 1", () => {
    // Pre-seeded +1 dB trim, K taps live but far below a full window: stage 1
    // holds unity at target RMS while the node carries the trim product.
    const trim = initTrimState();
    trim.trimDb = 1;
    const gain = stubGain(1);
    const kTap = stubAnalyser([0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05]);
    const result = levelingTick(
      tick({
        analyser: stubAnalyser([0.14, 0.14, 0.14, 0.14, 0.14, 0.14, 0.14, 0.14]),
        gain,
        kAnalyserL: kTap,
        kAnalyserR: kTap,
        kBufferL: null,
        kBufferR: null,
        trim,
      }),
    );
    expect(result?.kBufferL?.length).toBe(8);
    expect(result?.kBufferR?.length).toBe(8);
    expect(gain.gain.value).toBeCloseTo(10 ** (1 / 20), 5);
  });

  it("skips the trim when the K taps are absent and survives their failure", () => {
    const gain = stubGain(1);
    levelingTick(
      tick({ analyser: stubAnalyser([0.14, 0.14, 0.14, 0.14, 0.14, 0.14, 0.14, 0.14]), gain, trim: initTrimState() }),
    );
    // Stage 1 at target RMS holds unity; with no K tap nothing multiplies it.
    expect(gain.gain.value).toBeCloseTo(1, 5);
    const failing = {
      fftSize: 8,
      getFloatTimeDomainData: () => {
        throw new Error("gone");
      },
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- partial test double: unexercised members are intentionally absent
    } as unknown as AnalyserNode;
    const survivedGain = stubGain(1);
    expect(() => {
      levelingTick(
        tick({
          analyser: stubAnalyser([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]),
          gain: survivedGain,
          kAnalyserL: failing,
          kAnalyserR: failing,
          kBufferL: null,
          kBufferR: null,
          trim: initTrimState(),
        }),
      );
    }).not.toThrow();
    expect(survivedGain.gain.value).toBeCloseTo(0.805, 5);
  });

  it("reallocates a stale buffer and survives analyser failure", () => {
    const analyser = stubAnalyser([0.5]);
    const gain = stubGain(1);
    const stale = levelingTick(tick({ analyser, gain, buffer: new Float32Array(4) }));
    expect(stale?.buffer.length).toBe(8);
    const failing = {
      fftSize: 8,
      getFloatTimeDomainData: () => {
        throw new Error("gone");
      },
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- partial test double: unexercised members are intentionally absent
    } as unknown as AnalyserNode;
    const survived = levelingTick(tick({ analyser: failing, gain }));
    expect(survived?.settleTicksLeft).toBe(8);
  });

  it("does not compound trim across multiple ticks (volume never climbs)", () => {
    // 40 consecutive ticks (~10s of steady playback) with +1 dB trim must hold
    // unity * trim product stably without compounding exponentially into runaway volume.
    const trim = initTrimState();
    trim.trimDb = 1;
    const gain = stubGain(1);
    const kTap = stubAnalyser([0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05]);
    let stageGain = 1;
    let settleTicksLeft = 0;
    let buffer: Float32Array<ArrayBuffer> | null = null;
    let kBufferL: Float32Array<ArrayBuffer> | null = null;
    let kBufferR: Float32Array<ArrayBuffer> | null = null;

    for (let i = 0; i < 40; i += 1) {
      const res = levelingTick(
        tick({
          analyser: stubAnalyser([0.14, 0.14, 0.14, 0.14, 0.14, 0.14, 0.14, 0.14]),
          gain,
          kAnalyserL: kTap,
          kAnalyserR: kTap,
          buffer,
          kBufferL,
          kBufferR,
          trim,
          settleTicksLeft,
          stageGain,
        }),
      );
      if (!res) throw new Error("tick returned null");
      buffer = res.buffer;
      kBufferL = res.kBufferL;
      kBufferR = res.kBufferR;
      settleTicksLeft = res.settleTicksLeft;
      stageGain = res.stageGain;
    }

    // Steady state stage-1 gain is 1.0, total node gain carries +1 dB trim product (~1.122), NOT 1.122^40.
    expect(stageGain).toBeCloseTo(1, 4);
    expect(gain.gain.value).toBeCloseTo(10 ** (1 / 20), 4);
  });
});
