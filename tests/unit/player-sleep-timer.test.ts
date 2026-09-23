// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSnapshot } from "@/lib/player/store";
import { armSleepTimer, disarmSleepTimer } from "@/lib/player/sleep-timer";

const MINUTE_MS = 60_000;

describe("sleep timer deadlines", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    disarmSleepTimer();
    vi.useRealTimers();
  });

  it("arms a deadline and fires the engine continuation once", () => {
    let fired = 0;
    armSleepTimer(30, () => void (fired += 1));
    const endsAt = getSnapshot().sleepEndsAt;
    expect(endsAt).toBeGreaterThan(Date.now());
    expect(fired).toBe(0);
    vi.advanceTimersByTime(endsAt - Date.now() + 100);
    expect(fired).toBe(1);
    expect(getSnapshot().sleepEndsAt).toBe(0);
  });

  it("treats zero and negative input as off (no timer, no fire)", () => {
    let fired = 0;
    const onFire = (): void => void (fired += 1);
    armSleepTimer(0, onFire);
    expect(getSnapshot().sleepEndsAt).toBe(0);
    armSleepTimer(-5, onFire);
    expect(getSnapshot().sleepEndsAt).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(3 * MINUTE_MS);
    expect(fired).toBe(0);
  });

  it("cancel drops the pending fire and clears the deadline", () => {
    let fired = 0;
    armSleepTimer(15, () => void (fired += 1));
    expect(getSnapshot().sleepEndsAt).toBeGreaterThan(0);
    disarmSleepTimer();
    expect(getSnapshot().sleepEndsAt).toBe(0);
    vi.advanceTimersByTime(60 * MINUTE_MS);
    expect(fired).toBe(0);
  });

  it("re-arming replaces the pending deadline (only the latest fires)", () => {
    let fired = 0;
    const onFire = (): void => void (fired += 1);
    armSleepTimer(60, onFire);
    armSleepTimer(15, onFire);
    const endsAt = getSnapshot().sleepEndsAt;
    vi.advanceTimersByTime(endsAt - Date.now() + 100);
    expect(fired).toBe(1);
    vi.advanceTimersByTime(60 * MINUTE_MS);
    expect(fired).toBe(1);
  });
});
