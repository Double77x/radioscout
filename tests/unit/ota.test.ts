import { describe, expect, it } from "vitest";
import { compareOtaVersions, parseOtaVersion, pickOtaUpdate, type OtaManifest } from "@/lib/ota";

function manifest(versions: unknown[]): OtaManifest {
  return { channel: "production", versions: versions as OtaManifest["versions"] };
}

function bundle(version: string, min = 400, max: number | null = null) {
  return {
    version,
    min_version_code: min,
    max_version_code: max,
    url: `https://ota.example/${version}.zip`,
    checksum: "abc123",
  };
}

describe("parseOtaVersion", () => {
  it("splits core and sequence", () => {
    expect(parseOtaVersion("0.4.0+ota.2")).toEqual({ core: [0, 4, 0], ota: 2 });
    expect(parseOtaVersion("0.4.0")).toEqual({ core: [0, 4, 0], ota: 0 });
  });

  it("rejects garbage", () => {
    expect(parseOtaVersion("")).toBeNull();
    expect(parseOtaVersion("latest")).toBeNull();
    expect(parseOtaVersion("0.4.0+ota.x")).toBeNull();
  });
});

describe("compareOtaVersions", () => {
  it("orders by core first, then ota sequence", () => {
    expect(compareOtaVersions("0.4.0+ota.2", "0.4.0+ota.1")).toBeGreaterThan(0);
    expect(compareOtaVersions("0.4.0", "0.4.0+ota.1")).toBeLessThan(0);
    expect(compareOtaVersions("0.5.0", "0.4.0+ota.9")).toBeGreaterThan(0);
    expect(compareOtaVersions("0.4.0+ota.1", "0.4.0+ota.1")).toBe(0);
  });
});

describe("pickOtaUpdate", () => {
  it("picks the newest bundle above the current version", () => {
    const two = manifest([bundle("0.4.0+ota.2"), bundle("0.4.0+ota.1")]);
    expect(pickOtaUpdate(two, "0.4.0", 400)?.version).toBe("0.4.0+ota.2");
  });

  it("returns null when already current", () => {
    const single = manifest([bundle("0.4.0+ota.1")]);
    expect(pickOtaUpdate(single, "0.4.0+ota.1", 400)).toBeNull();
    expect(pickOtaUpdate(single, "0.5.0", 500)).toBeNull();
  });

  it("gates on the native versionCode range", () => {
    const tooNew = manifest([bundle("0.4.0+ota.1", 401)]);
    expect(pickOtaUpdate(tooNew, "0.4.0", 400)).toBeNull();
    const tooOld = manifest([bundle("0.4.0+ota.1", 0, 399)]);
    expect(pickOtaUpdate(tooOld, "0.4.0", 400)).toBeNull();
    const fitting = manifest([bundle("0.4.0+ota.1", 0, 400)]);
    expect(pickOtaUpdate(fitting, "0.4.0", 400)?.version).toBe("0.4.0+ota.1");
  });

  it("skips malformed entries and garbage manifests", () => {
    const mixed = manifest([{ version: "nope" }, bundle("0.4.0+ota.1")]);
    expect(pickOtaUpdate(mixed, "0.4.0", 400)?.version).toBe("0.4.0+ota.1");
    expect(pickOtaUpdate(null, "0.4.0", 400)).toBeNull();
    expect(pickOtaUpdate({ channel: "production" }, "0.4.0", 400)).toBeNull();
    expect(pickOtaUpdate({ channel: "production", versions: "nope" }, "0.4.0", 400)).toBeNull();
  });
});
