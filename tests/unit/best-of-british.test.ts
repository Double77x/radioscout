import { describe, expect, it } from "vitest";
import { canonicalStreamUrl, withStationDefaults } from "@/lib/radio/types";
import { processBritishStations } from "@/hooks/use-best-of-british";

const row = (stationuuid: string, name: string, url: string, votes = 0) =>
  withStationDefaults({ stationuuid, name, url, url_resolved: url, votes });

describe("processBritishStations", () => {
  it("sorts playable stations A–Z", () => {
    const out = processBritishStations([
      row("3", "TalkSPORT", "https://example.com/talk.mp3"),
      row("1", "Absolute Radio", "https://example.com/absolute.mp3"),
      row("2", "Gold", "https://example.com/gold.mp3"),
    ]);
    expect(out.map((s) => s.name)).toEqual(["Absolute Radio", "Gold", "TalkSPORT"]);
  });

  it("drops http-only rows like the discovery lists do", () => {
    const out = processBritishStations([
      row("1", "Smooth Radio", "http://example.com/smooth"),
      row("2", "Gold", "https://example.com/gold.mp3"),
    ]);
    expect(out.map((s) => s.name)).toEqual(["Gold"]);
  });

  it("dedupes alt feeds by name keeping the highest votes", () => {
    const out = processBritishStations([
      row("1", "BBC Radio 6 Music", "https://example.com/6music-a.mp3", 100),
      row("2", "BBC Radio 6 Music", "https://example.com/6music-b.mp3", 3000),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.stationuuid).toBe("2");
  });

  it("skips blank names", () => {
    expect(processBritishStations([row("1", "", "https://example.com/x.mp3")])).toEqual([]);
  });

  it("keeps Smooth Radio via the https-upgrade allowlist", () => {
    const smooth = row("9", "Smooth Radio", "http://media-the.musicradio.com/SmoothEastMids");
    expect(canonicalStreamUrl(smooth.url)).toBe("https://media-the.musicradio.com/SmoothEastMids");
    expect(processBritishStations([smooth]).map((s) => s.name)).toEqual(["Smooth Radio"]);
  });
});
