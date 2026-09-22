import { describe, expect, it } from "vitest";
import {
  formatSleepCountdown,
  normalizeSleepMinutes,
  SLEEP_MAX_MINUTES,
  SLEEP_PRESETS_MINUTES,
  sleepRemainingMs,
} from "@/lib/radio/sleep";

describe("normalizeSleepMinutes", () => {
  it("passes presets through", () => {
    for (const preset of SLEEP_PRESETS_MINUTES) expect(normalizeSleepMinutes(preset)).toBe(preset);
    expect(normalizeSleepMinutes("45")).toBe(45);
  });

  it("floors fractional minutes", () => {
    expect(normalizeSleepMinutes(30.9)).toBe(30);
  });

  it("treats zero, negative and garbage as off", () => {
    expect(normalizeSleepMinutes(0)).toBe(0);
    expect(normalizeSleepMinutes(-15)).toBe(0);
    expect(normalizeSleepMinutes(Number.NaN)).toBe(0);
    expect(normalizeSleepMinutes(undefined)).toBe(0);
    expect(normalizeSleepMinutes("soon")).toBe(0);
  });

  it("clamps absurd values to the cap", () => {
    expect(normalizeSleepMinutes(10_000)).toBe(SLEEP_MAX_MINUTES);
  });
});

describe("sleepRemainingMs", () => {
  it("counts down to zero and never below", () => {
    expect(sleepRemainingMs(1000, 400)).toBe(600);
    expect(sleepRemainingMs(1000, 1000)).toBe(0);
    expect(sleepRemainingMs(1000, 5000)).toBe(0);
  });

  it("reads off as zero", () => {
    expect(sleepRemainingMs(0, 400)).toBe(0);
    expect(sleepRemainingMs(-5, 400)).toBe(0);
    expect(sleepRemainingMs(Number.NaN, 400)).toBe(0);
  });
});

describe("formatSleepCountdown", () => {
  it("labels whole minutes, rounding partial minutes up", () => {
    expect(formatSleepCountdown(45 * 60_000, 0)).toBe("45m");
    expect(formatSleepCountdown(44 * 60_000 + 1, 0)).toBe("45m");
    expect(formatSleepCountdown(30 * 1000, 0)).toBe("1m");
  });

  it("returns null when off or expired", () => {
    expect(formatSleepCountdown(0, 0)).toBeNull();
    expect(formatSleepCountdown(1000, 1000)).toBeNull();
    expect(formatSleepCountdown(1000, 5000)).toBeNull();
  });
});
