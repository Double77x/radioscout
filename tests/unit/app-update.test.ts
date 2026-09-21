import { describe, expect, it } from "vitest";
import { isUpgradeAvailable, pickDownloadUrl, stripReleasePrefix } from "@/lib/app-update";

describe("stripReleasePrefix", () => {
  it("strips the v tag prefix", () => {
    expect(stripReleasePrefix("v0.1.6")).toBe("0.1.6");
    expect(stripReleasePrefix("0.1.6")).toBe("0.1.6");
    expect(stripReleasePrefix("  v0.1.6  ")).toBe("0.1.6");
  });
});

describe("isUpgradeAvailable", () => {
  it("flags strictly newer releases", () => {
    expect(isUpgradeAvailable("v0.1.7", "0.1.6")).toBe(true);
    expect(isUpgradeAvailable("v0.2.0", "0.1.6+ota.3")).toBe(true);
  });

  it("stays quiet when current, older or undecidable", () => {
    expect(isUpgradeAvailable("v0.1.6", "0.1.6")).toBe(false);
    expect(isUpgradeAvailable("v0.1.5", "0.1.6")).toBe(false);
    expect(isUpgradeAvailable("", "0.1.6")).toBe(false);
    expect(isUpgradeAvailable("v0.1.7", "")).toBe(false);
    expect(isUpgradeAvailable("latest", "0.1.6")).toBe(false);
  });
});

describe("pickDownloadUrl", () => {
  it("prefers the APK asset, falls back to the release page", () => {
    const apk = "https://github.com/x/y/releases/download/v0.1.7/radioscout-v0.1.7.apk";
    expect(
      pickDownloadUrl({
        assets: [{ name: "notes.txt", browser_download_url: "https://example.com/notes" }],
        html_url: "https://github.com/x/y/releases/tag/v0.1.7",
      }),
    ).toBe("https://github.com/x/y/releases/tag/v0.1.7");
    expect(
      pickDownloadUrl({
        assets: [
          { name: "notes.txt", browser_download_url: "https://example.com/notes" },
          { name: "radioscout-v0.1.7.apk", browser_download_url: apk },
        ],
        html_url: "https://github.com/x/y/releases/tag/v0.1.7",
      }),
    ).toBe(apk);
  });

  it("returns null when nothing downloadable exists", () => {
    expect(pickDownloadUrl({})).toBeNull();
    expect(pickDownloadUrl({ assets: [{ name: "notes.txt" }] })).toBeNull();
  });
});
