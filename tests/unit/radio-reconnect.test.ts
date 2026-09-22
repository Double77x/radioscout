import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_RECONNECT_ATTEMPTS, RECONNECT_DELAYS_MS, ReconnectTimer, reconnectDelayMs } from "@/lib/radio/reconnect";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("reconnectDelayMs", () => {
  it("walks the backoff table, then gives up", () => {
    expect(MAX_RECONNECT_ATTEMPTS).toBe(RECONNECT_DELAYS_MS.length);
    for (const [index, delay] of RECONNECT_DELAYS_MS.entries()) {
      expect(reconnectDelayMs(index + 1)).toBe(delay);
    }
    expect(reconnectDelayMs(MAX_RECONNECT_ATTEMPTS + 1)).toBeNull();
  });

  it("rejects non-attempts without throwing", () => {
    expect(reconnectDelayMs(0)).toBeNull();
    expect(reconnectDelayMs(-1)).toBeNull();
    expect(reconnectDelayMs(1.5)).toBeNull();
    expect(reconnectDelayMs(Number.NaN)).toBeNull();
  });
});

describe("ReconnectTimer", () => {
  it("fires once after the attempt's delay", () => {
    const timer = new ReconnectTimer();
    const onRetry = vi.fn();
    timer.schedule(1, onRetry);
    expect(timer.pending).toBe(true);
    vi.advanceTimersByTime(RECONNECT_DELAYS_MS[0] - 1);
    expect(onRetry).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(timer.pending).toBe(false);
  });

  it("cancel drops the wait", () => {
    const timer = new ReconnectTimer();
    const onRetry = vi.fn();
    timer.schedule(2, onRetry);
    timer.cancel();
    expect(timer.pending).toBe(false);
    vi.advanceTimersByTime(RECONNECT_DELAYS_MS[1]);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("rescheduling replaces the pending wait", () => {
    const timer = new ReconnectTimer();
    const first = vi.fn();
    const second = vi.fn();
    timer.schedule(1, first);
    timer.schedule(3, second);
    vi.advanceTimersByTime(RECONNECT_DELAYS_MS[2]);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("exhausted attempts arm nothing", () => {
    const timer = new ReconnectTimer();
    const onRetry = vi.fn();
    timer.schedule(MAX_RECONNECT_ATTEMPTS + 1, onRetry);
    expect(timer.pending).toBe(false);
    vi.advanceTimersByTime(60_000);
    expect(onRetry).not.toHaveBeenCalled();
  });
});
