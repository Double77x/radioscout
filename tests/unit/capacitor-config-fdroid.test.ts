import { afterEach, describe, expect, it, vi } from "vitest";

async function loadCapacitorConfig(distribution?: string) {
  vi.resetModules();
  if (distribution === undefined) {
    vi.stubEnv("VITE_DISTRIBUTION", "");
  } else {
    vi.stubEnv("VITE_DISTRIBUTION", distribution);
  }
  return (await import("../../capacitor.config")).default;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Capacitor Updater distribution config", () => {
  it("disables native auto-update and stats for F-Droid", async () => {
    const config = await loadCapacitorConfig("fdroid");

    expect(config.plugins?.CapacitorUpdater).toEqual({
      autoUpdate: false,
      statsUrl: "",
    });
  });

  it("keeps native auto-update enabled for other distributions", async () => {
    const config = await loadCapacitorConfig("sideload");

    expect(config.plugins?.CapacitorUpdater).toEqual({
      autoUpdate: true,
    });
  });
});
