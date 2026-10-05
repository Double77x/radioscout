import { describe, expect, it } from "vite-plus/test";
import { formatCount, formatRelativeTime } from "@/lib/format";

describe("formatCount", () => {
  it("groups thousands en-GB", () => {
    expect(formatCount(825_088)).toBe("825,088");
    expect(formatCount(999)).toBe("999");
    expect(formatCount(0)).toBe("0");
  });

  it("renders non-finite input as zero", () => {
    expect(formatCount(Number.NaN)).toBe("0");
    expect(formatCount(Number.POSITIVE_INFINITY)).toBe("0");
  });
});

describe("formatRelativeTime", () => {
  const NOW = Date.parse("2026-10-05T12:00:00.000Z");

  it("compacts ages to short units", () => {
    expect(formatRelativeTime("2026-10-05T11:59:15.000Z", NOW)).toBe("45s");
    expect(formatRelativeTime("2026-10-05T11:55:00.000Z", NOW)).toBe("5m");
    expect(formatRelativeTime("2026-10-05T10:00:00.000Z", NOW)).toBe("2h");
    expect(formatRelativeTime("2026-10-04T12:00:00.000Z", NOW)).toBe("1d");
  });

  it("returns empty for unparseable input", () => {
    expect(formatRelativeTime("not-a-date", NOW)).toBe("");
  });
});
