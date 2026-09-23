import { describe, expect, it, afterEach } from "vitest";
import {
  canonicalStreamUrl,
  filterPlayableStations,
  hostOfUrl,
  isHlsUrl,
  isHttpsUpgradeHost,
  isInsecureHttpStream,
  isPlayableStreamUrl,
  parseStation,
  parseStations,
  pickPlayableUrl,
  sanitizeStreamUrl,
  splitQualityFromName,
  upgradeInsecureUrl,
} from "@/lib/radio/types";

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

  it("sanitizes upstream playlist junk", () => {
    const station = parseStation({
      ...row,
      url_resolved:
        "http://stream-ar.planetradio.co.uk/absoluteradiohigh.aac??direct=true&aw_0_1st.playerid=BMUK_Airable%20#EXTINF:0,Absolute%2080s",
    });
    expect(station ? pickPlayableUrl(station) : null).toBe(
      "http://stream-ar.planetradio.co.uk/absoluteradiohigh.aac?direct=true&aw_0_1st.playerid=BMUK_Airable",
    );
  });

  it("upgrades verified hosts even when the directory stays http", () => {
    const station = parseStation({ ...row, stationuuid: "bbc-r2", url: BBC_HTTP, url_resolved: BBC_HTTP });
    const picked = station ? pickPlayableUrl(station) : null;
    expect(picked).toBe(BBC_HTTP.replace("http://", "https://"));
    expect(picked ? isHlsUrl(picked) : false).toBe(true);
  });
});

const BBC_HTTP =
  "http://as-hls-ww-live.akamaized.net/pool_74208725/live/ww/bbc_radio_two/bbc_radio_two.isml/bbc_radio_two-audio%3d128000.norewind.m3u8";

describe("https upgrade hosts", () => {
  it("parses upgrade hostnames, lowercased", () => {
    expect(hostOfUrl(BBC_HTTP)).toBe("as-hls-ww-live.akamaized.net");
    expect(hostOfUrl("HTTP://AS-HLS-WW-LIVE.AKAMAIZED.NET/x")).toBe("as-hls-ww-live.akamaized.net");
    expect(hostOfUrl("not a url")).toBe("");
    expect(hostOfUrl("")).toBe("");
  });

  it("flags verified upgrade hosts only", () => {
    expect(isHttpsUpgradeHost(BBC_HTTP)).toBe(true);
    expect(isHttpsUpgradeHost("http://stream-kiss.planetradio.co.uk/x.mp3")).toBe(false);
    expect(isHttpsUpgradeHost("")).toBe(false);
  });

  it("canonicalizes verified http to https, leaves the rest alone", () => {
    expect(canonicalStreamUrl(BBC_HTTP)).toBe(BBC_HTTP.replace("http://", "https://"));
    expect(canonicalStreamUrl("https://example.com/x")).toBe("https://example.com/x");
    expect(canonicalStreamUrl("http://stream-kiss.planetradio.co.uk/x.mp3")).toBe(
      "http://stream-kiss.planetradio.co.uk/x.mp3",
    );
    expect(canonicalStreamUrl("")).toBe("");
  });
});

describe("sanitizeStreamUrl", () => {
  it("collapses doubled question marks", () => {
    expect(sanitizeStreamUrl("http://example.com/live.aac??direct=true&x=1")).toBe(
      "http://example.com/live.aac?direct=true&x=1",
    );
  });

  it("strips fused #EXTINF playlist lines (encoded and literal)", () => {
    expect(sanitizeStreamUrl("http://example.com/a.aac?direct=true%20#EXTINF:0,Absolute%2080s")).toBe(
      "http://example.com/a.aac?direct=true",
    );
    expect(sanitizeStreamUrl("http://example.com/a.aac?direct=true #EXTINF:-1,Name")).toBe(
      "http://example.com/a.aac?direct=true",
    );
  });

  it("drops fragments, whitespace and newlines", () => {
    expect(sanitizeStreamUrl("https://example.com/live.mp3#icy-meta")).toBe("https://example.com/live.mp3");
    expect(sanitizeStreamUrl("https://example.com/live.mp3\n#EXTM3U")).toBe("https://example.com/live.mp3");
    expect(sanitizeStreamUrl("  https://example.com/live.mp3  ")).toBe("https://example.com/live.mp3");
  });

  it("leaves clean URLs (including queries) untouched", () => {
    const clean = "https://live-bauerkiss.sharp-stream.com/kisstory.aac?direct=true&aw_0_1st.playerid=BMUK_Airable";
    expect(sanitizeStreamUrl(clean)).toBe(clean);
    expect(sanitizeStreamUrl("")).toBe("");
  });
});

describe("isInsecureHttpStream", () => {
  it("flags http streams even through upstream junk", () => {
    expect(isInsecureHttpStream("http://example.com/live.mp3")).toBe(true);
    expect(isInsecureHttpStream("HTTP://example.com/live.mp3")).toBe(true);
    expect(isInsecureHttpStream("http://example.com/a.aac??direct=true%20#EXTINF:0,X")).toBe(true);
    expect(isInsecureHttpStream("https://example.com/live.mp3")).toBe(false);
    expect(isInsecureHttpStream("")).toBe(false);
  });
});

describe("isPlayableStreamUrl", () => {
  it("keeps https, drops http and empty", () => {
    expect(isPlayableStreamUrl("https://example.com/live.aac?direct=true")).toBe(true);
    expect(isPlayableStreamUrl("http://example.com/live.mp3")).toBe(false);
    expect(isPlayableStreamUrl("HTTP://example.com/live.mp3")).toBe(false);
    expect(isPlayableStreamUrl("http://example.com/a.aac??direct=true%20#EXTINF:0,X")).toBe(false);
    expect(isPlayableStreamUrl("")).toBe(false);
    expect(isPlayableStreamUrl("   ")).toBe(false);
  });
});

describe("filterPlayableStations", () => {
  const https = (uuid: string, url: string) => parseStation({ ...row, stationuuid: uuid, url, url_resolved: url });
  it("drops HTTP-only and URL-less rows, keeps order of survivors", () => {
    const httpOld = https("http-old", "http://stream-kiss.planetradio.co.uk/kisstory.mp3?direct=true");
    const httpJunk = https(
      "http-junk",
      "http://stream-ar.planetradio.co.uk/absoluteradiohigh.aac??direct=true%20#EXTINF:0,X",
    );
    const noUrl = https("no-url", "");
    const tlsA = https("tls-a", "https://live-bauerkiss.sharp-stream.com/kisstory.aac?direct=true");
    const tlsB = https("tls-b", "https://stream-ar.hellorayo.co.uk/absolute80shigh.aac?direct=true");
    const filtered = filterPlayableStations([httpOld, tlsA, httpJunk, noUrl, tlsB].filter((s) => s !== null));
    expect(filtered.map((s) => s.stationuuid)).toEqual(["tls-a", "tls-b"]);
  });

  it("keeps http rows on verified upgrade hosts", () => {
    const bbc = https("bbc-r2", BBC_HTTP);
    const planet = https("planet", "http://stream-kiss.planetradio.co.uk/kisstory.mp3?direct=true");
    const filtered = filterPlayableStations([planet, bbc].filter((s) => s !== null));
    expect(filtered.map((s) => s.stationuuid)).toEqual(["bbc-r2"]);
  });
});

/** Point `globalThis.window` at a fake page protocol (or remove it for SSR). */
function setPage(protocol: string | undefined) {
  if (protocol === undefined) {
    delete (globalThis as { window?: unknown }).window;
  } else {
    (globalThis as { window?: unknown }).window = { location: { protocol } };
  }
}

describe("upgradeInsecureUrl", () => {
  const hadWindow = "window" in globalThis;
  const realWindow = (globalThis as { window?: unknown }).window;

  afterEach(() => {
    if (hadWindow) (globalThis as { window?: unknown }).window = realWindow;
    else delete (globalThis as { window?: unknown }).window;
  });

  it("leaves non-http URLs alone on any page", () => {
    setPage("https:");
    expect(upgradeInsecureUrl("https://example.com/a.png")).toBe("https://example.com/a.png");
    expect(upgradeInsecureUrl("data:image/png;base64,AAA")).toBe("data:image/png;base64,AAA");
    expect(upgradeInsecureUrl("")).toBe("");
  });

  it("is a no-op without a window (SSR) or on http pages", () => {
    setPage(undefined);
    expect(upgradeInsecureUrl("http://example.com/a.png")).toBe("http://example.com/a.png");
    setPage("http:");
    expect(upgradeInsecureUrl("http://example.com/a.png")).toBe("http://example.com/a.png");
    setPage("capacitor:");
    expect(upgradeInsecureUrl("http://example.com/live.mp3")).toBe("http://example.com/live.mp3");
  });

  it("rewrites http to https on secure pages, keeping the rest byte-identical", () => {
    setPage("https:");
    expect(upgradeInsecureUrl("http://example.com/a.png")).toBe("https://example.com/a.png");
    expect(upgradeInsecureUrl("HTTP://example.com/live.m3u8?token=1")).toBe("https://example.com/live.m3u8?token=1");
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
