import { describe, expect, it } from "vitest";
import { formatCount } from "@/lib/format";
import { formatStationCount } from "@/lib/radio/format";

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
