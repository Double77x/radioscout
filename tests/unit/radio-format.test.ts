import { describe, expect, it } from "vitest";
import { formatCount } from "@/lib/format";
import { formatDayOrdinal, formatListeningTime, formatStationCount } from "@/lib/radio/format";

describe("formatCount", () => {
  it("groups thousands with commas", () => {
    expect(formatCount(825_088)).toBe("825,088");
    expect(formatCount(42)).toBe("42");
    expect(formatCount(1000)).toBe("1,000");
  });

  it("renders non-finite input as zero", () => {
    expect(formatCount(Number.NaN)).toBe("0");
  });
});

describe("formatStationCount", () => {
  it("compacts directory totals to K", () => {
    expect(formatStationCount(81_234)).toBe("81.2K");
    expect(formatStationCount(80_012)).toBe("80K");
    expect(formatStationCount(42)).toBe("42");
  });
});

describe("formatListeningTime", () => {
  it("compacts session totals", () => {
    expect(formatListeningTime(0)).toBe("0s");
    expect(formatListeningTime(45)).toBe("45s");
    expect(formatListeningTime(90)).toBe("1m");
    expect(formatListeningTime(2700)).toBe("45m");
    expect(formatListeningTime(3600)).toBe("1h");
    expect(formatListeningTime(7380)).toBe("2h 3m");
  });

  it("renders bad input as zero", () => {
    expect(formatListeningTime(Number.NaN)).toBe("0s");
    expect(formatListeningTime(-30)).toBe("0s");
  });
});

describe("formatDayOrdinal", () => {
  it("renders ordinal day-of-month labels", () => {
    expect(formatDayOrdinal(1)).toBe("1st");
    expect(formatDayOrdinal(2)).toBe("2nd");
    expect(formatDayOrdinal(3)).toBe("3rd");
    expect(formatDayOrdinal(4)).toBe("4th");
    expect(formatDayOrdinal(10)).toBe("10th");
    expect(formatDayOrdinal(11)).toBe("11th");
    expect(formatDayOrdinal(12)).toBe("12th");
    expect(formatDayOrdinal(13)).toBe("13th");
    expect(formatDayOrdinal(21)).toBe("21st");
    expect(formatDayOrdinal(22)).toBe("22nd");
    expect(formatDayOrdinal(23)).toBe("23rd");
    expect(formatDayOrdinal(28)).toBe("28th");
  });
});
