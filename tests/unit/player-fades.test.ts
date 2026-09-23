import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FADE_STEPS, PLAY_FADE_MS, TRANSPORT_FADE_MS, fadeLevelAt, rampElement, runFadeRamp } from "@/lib/player/fades";

describe("fade constants", () => {
  it("keeps the transport/play shape the engine documents", () => {
    expect(FADE_STEPS).toBe(20);
    expect(TRANSPORT_FADE_MS).toBe(250);
    expect(PLAY_FADE_MS).toBe(900);
  });
});

describe("fadeLevelAt", () => {
  it("starts at from and lands exactly on to", () => {
    expect(fadeLevelAt(0, 1, 0)).toBe(0);
    expect(fadeLevelAt(0, 1, FADE_STEPS)).toBe(1);
    expect(fadeLevelAt(0.2, 0.8, FADE_STEPS)).toBeCloseTo(0.8, 10);
  });

  it("clamps past-the-end steps instead of overshooting", () => {
    expect(fadeLevelAt(1, 0, FADE_STEPS + 5)).toBe(0);
  });

  it("is linear at the midpoint", () => {
    expect(fadeLevelAt(0, 1, FADE_STEPS / 2)).toBeCloseTo(0.5, 10);
  });
});

describe("runFadeRamp", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes from immediately, then steps to to and calls onDone", () => {
    const writes: number[] = [];
    let done = 0;
    runFadeRamp(
      0,
      1,
      200,
      (level) => void writes.push(level),
      () => false,
      () => void (done += 1),
    );
    expect(writes).toEqual([0]);
    vi.advanceTimersByTime(201);
    expect(writes.length).toBe(FADE_STEPS + 1);
    expect(writes.at(-1)).toBeCloseTo(1, 10);
    expect(done).toBe(1);
  });

  it("resolves synchronously when ms is zero", () => {
    const writes: number[] = [];
    let done = 0;
    runFadeRamp(
      0,
      1,
      0,
      (level) => void writes.push(level),
      () => false,
      () => void (done += 1),
    );
    expect(writes).toEqual([0, 1]);
    expect(done).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops silently once cancelled (superseding action owns output)", () => {
    const writes: number[] = [];
    let done = 0;
    let cancelled = false;
    runFadeRamp(
      0,
      1,
      200,
      (level) => void writes.push(level),
      () => cancelled,
      () => void (done += 1),
    );
    vi.advanceTimersByTime(50);
    const frozen = writes.length;
    expect(frozen).toBeGreaterThan(1);
    cancelled = true;
    vi.advanceTimersByTime(500);
    expect(writes.length).toBe(frozen);
    expect(done).toBe(0);
  });
});

function stubElement(): HTMLAudioElement & { writes: number[] } {
  const writes: number[] = [];
  let volume = 0;
  const element = {
    writes,
    get volume(): number {
      return volume;
    },
    set volume(next: number) {
      volume = next;
      writes.push(next);
    },
  } as unknown as HTMLAudioElement & { writes: number[] };
  return element;
}

describe("rampElement", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("blends an element from from to to over the full step count", () => {
    const element = stubElement();
    let done = 0;
    rampElement(
      element,
      1,
      0,
      1000,
      () => false,
      () => void (done += 1),
    );
    expect(element.writes).toEqual([1]);
    vi.advanceTimersByTime(1001);
    expect(element.writes.length).toBe(FADE_STEPS + 1);
    expect(element.writes.at(-1)).toBeCloseTo(0, 10);
    expect(done).toBe(1);
  });

  it("parks the retiring side via onCancel when superseded", () => {
    const element = stubElement();
    let cancelled = 0;
    let done = 0;
    let live = true;
    rampElement(
      element,
      1,
      0,
      1000,
      () => !live,
      () => void (done += 1),
      () => void (cancelled += 1),
    );
    vi.advanceTimersByTime(100);
    live = false;
    vi.advanceTimersByTime(2000);
    expect(cancelled).toBe(1);
    expect(done).toBe(0);
  });

  it("resolves via onDone when the element is torn down", () => {
    const volume = 0;
    const element = {
      get volume(): number {
        return volume;
      },
      set volume(_next: number) {
        throw new Error("gone");
      },
    } as unknown as HTMLAudioElement;
    let done = 0;
    expect(() =>
      rampElement(
        element,
        1,
        0,
        1000,
        () => false,
        () => void (done += 1),
      ),
    ).not.toThrow();
    expect(done).toBe(1);
  });
});
