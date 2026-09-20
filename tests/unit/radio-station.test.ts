import { describe, expect, it } from "vitest";
import { isHlsUrl, parseStation, parseStations, pickPlayableUrl, splitQualityFromName } from "@/lib/radio/types";

const row = {
  stationuuid: "9617a7a2-0601-11e8-ae97-52543be04c81",
  name: "Jazz FM",
  url: "http://example.com/stream",
  url_resolved: "https://example.com/stream",
  homepage: "https://example.com",
  favicon: "",
  tags: "jazz",
  country: "United Kingdom",
  countrycode: "GB",
  state: "",
  language: "english",
  codec: "MP3",
  bitrate: "128",
  hls: 0,
  votes: 42,
  clickcount: 100,
  clicktrend: 5,
  lastcheckok: 1,
};

describe("parseStation", () => {
  it("coerces numeric strings from the API", () => {
    expect(parseStation(row)?.bitrate).toBe(128);
  });

  it("rejects rows without a uuid", () => {
    expect(parseStation({ ...row, stationuuid: "" })).toBeNull();
  });

  it("fills defaults for missing fields", () => {
    expect(parseStation({ stationuuid: "abc" })?.name).toBe("Unknown station");
  });
});

describe("parseStations", () => {
  it("drops malformed rows like DecodeJson #2", () => {
    expect(parseStations([row, { nope: true }, null])).toHaveLength(1);
  });

  it("returns empty for non-arrays", () => {
    expect(parseStations(null)).toEqual([]);
  });
});

describe("isHlsUrl", () => {
  it("matches .m3u8 playlist URLs with query strings", () => {
    expect(isHlsUrl("https://example.com/live.m3u8?token=1")).toBe(true);
    expect(isHlsUrl("https://example.com/stream.mp3")).toBe(false);
  });
});

describe("pickPlayableUrl", () => {
  it("prefers the resolved URL", () => {
    const station = parseStation(row);
    expect(station ? pickPlayableUrl(station) : null).toBe("https://example.com/stream");
  });
});

describe("splitQualityFromName", () => {
  it("moves a trailing bitrate token into the bitrate slot", () => {
    expect(splitQualityFromName("BBC Radio 1 128K")).toEqual({ name: "BBC Radio 1", bitrate: 128, codec: "" });
    expect(splitQualityFromName("Classic Vinyl HD 320k AAC")).toEqual({
      name: "Classic Vinyl HD AAC",
      bitrate: 320,
      codec: "",
    });
  });

  it("strips bracketed quality and codec tokens", () => {
    expect(splitQualityFromName("Jazz FM (128kbps MP3)")).toEqual({ name: "Jazz FM", bitrate: 128, codec: "MP3" });
    expect(splitQualityFromName("News [AAC+ 64k]")).toEqual({ name: "News", bitrate: 64, codec: "AAC+" });
  });

  it("keeps meaningful bracket content", () => {
    expect(splitQualityFromName("Jazz FM (Live 128k)")).toEqual({ name: "Jazz FM (Live)", bitrate: 128, codec: "" });
  });

  it("leaves callsigns and plain names alone", () => {
    expect(splitQualityFromName("102.5 KZOK")).toEqual({ name: "102.5 KZOK", bitrate: 0, codec: "" });
    expect(splitQualityFromName("Jazz FM")).toEqual({ name: "Jazz FM", bitrate: 0, codec: "" });
    expect(splitQualityFromName("MP3 Radio")).toEqual({ name: "MP3 Radio", bitrate: 0, codec: "" });
  });
});

describe("parseStation quality backfill", () => {
  it("fills unknown bitrate from the title", () => {
    const station = parseStation({ ...row, name: "BBC Radio 1 128K", bitrate: 0 });
    expect(station?.name).toBe("BBC Radio 1");
    expect(station?.bitrate).toBe(128);
  });

  it("never overrides a measured bitrate", () => {
    const station = parseStation({ ...row, name: "BBC Radio 1 128K", bitrate: "64" });
    expect(station?.name).toBe("BBC Radio 1");
    expect(station?.bitrate).toBe(64);
  });
});
