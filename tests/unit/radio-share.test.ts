import { describe, expect, it, afterEach } from "vitest";
import { stationShareUrl } from "@/lib/radio/share";
import { siteConfig } from "@/lib/site";

const UUID = "9617a7a2-0601-11e8-ae97-52543be04c81";

function stubOrigin(origin: string): void {
  (globalThis as Record<string, unknown>).window = { location: { origin } };
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
});

describe("stationShareUrl", () => {
  it("builds a clean station link on the page origin", () => {
    stubOrigin("https://example.com");
    expect(stationShareUrl(UUID)).toBe(`https://example.com/?station=${UUID}`);
  });

  it("falls back to the canonical site on native webview origins", () => {
    stubOrigin("capacitor://localhost");
    expect(stationShareUrl(UUID)).toBe(`${siteConfig.url}/?station=${UUID}`);
  });

  it("falls back to the canonical site on localhost", () => {
    stubOrigin("http://localhost:8080");
    expect(stationShareUrl(UUID)).toBe(`${siteConfig.url}/?station=${UUID}`);
  });

  it("falls back to the canonical site without a window (SSR)", () => {
    expect(stationShareUrl(UUID)).toBe(`${siteConfig.url}/?station=${UUID}`);
  });
});
