import { afterEach, describe, expect, it, vi } from "vitest";
import { isFdroidDistribution } from "@/lib/distribution";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isFdroidDistribution", () => {
  it("is false when no distribution is set", () => {
    expect(isFdroidDistribution()).toBe(false);
  });

  it("recognizes the F-Droid flavor case-insensitively", () => {
    vi.stubEnv("VITE_DISTRIBUTION", "fdroid");
    expect(isFdroidDistribution()).toBe(true);

    vi.stubEnv("VITE_DISTRIBUTION", " FDROID ");
    expect(isFdroidDistribution()).toBe(true);
  });

  it("leaves other distribution flavors unchanged", () => {
    vi.stubEnv("VITE_DISTRIBUTION", "sideload");
    expect(isFdroidDistribution()).toBe(false);
  });
});
