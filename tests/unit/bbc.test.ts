import { describe, expect, it, vi } from "vite-plus/test";
import {
  bbcBoundaryDelayMs,
  bbcNextPollDelayMs,
  bbcServiceIdForStation,
  bbcServiceIdFromUrl,
  bbcSoundsUrl,
  fetchBbcNowPlaying,
  formatBbcTrack,
  isBbcServiceId,
  isCurrentSegment,
  parseBbcBroadcasts,
  parseBbcSegments,
} from "@/lib/radio/bbc";
import { EMPTY_STATION } from "@/lib/radio/types";

function station(overrides: Partial<typeof EMPTY_STATION> = {}) {
  return { ...EMPTY_STATION, ...overrides };
}

describe("bbc service id", () => {
  it("reads the id out of Akamai HLS stream urls", () => {
    expect(
      bbcServiceIdFromUrl(
        "http://as-hls-ww-live.akamaized.net/pool_74208725/live/ww/bbc_radio_two/bbc_radio_two.isml/bbc_radio_two-audio%3d128000.norewind.m3u8",
      ),
    ).toBe("bbc_radio_two");
  });

  it("reads the id out of files.bbci.co.uk urls and proxies", () => {
    expect(
      bbcServiceIdFromUrl(
        "http://a.files.bbci.co.uk/ms6/live/3441A116-B12E-4D2F-ACA8-C1984642FA4B/audio/simulcast/hls/nonuk/pc_hd_abr_v2/cf/bbc_radio_one.m3u8",
      ),
    ).toBe("bbc_radio_one");
    expect(bbcServiceIdFromUrl("http://151.80.56.90:8090/bbc_radio_one_dance.aac")).toBe("bbc_radio_one_dance");
  });

  it("reads the id out of Sounds homepages", () => {
    expect(bbcServiceIdFromUrl("https://www.bbc.co.uk/sounds/play/live:bbc_6music")).toBe("bbc_6music");
    expect(bbcServiceIdFromUrl("https://www.bbc.co.uk/sounds/play/live/bbc_radio_one_anthems")).toBe(
      "bbc_radio_one_anthems",
    );
  });

  it("returns null for non-bbc urls and garbage", () => {
    expect(bbcServiceIdFromUrl("https://media-the.musicradio.com/CapitalXTRALondonMP3")).toBeNull();
    expect(bbcServiceIdFromUrl("")).toBeNull();
  });

  it("prefers the homepage, then falls back to the stream urls", () => {
    expect(
      bbcServiceIdForStation(
        station({
          homepage: "https://www.bbc.co.uk/sounds/play/live:bbc_6music",
          url: "http://as-hls-ww-live.akamaized.net/pool_81827798/live/ww/bbc_6music/bbc_6music.isml/x.m3u8",
        }),
      ),
    ).toBe("bbc_6music");
    expect(
      bbcServiceIdForStation(
        station({
          homepage: "https://www.bbc.co.uk/radio2",
          url_resolved:
            "http://as-hls-ww-live.akamaized.net/pool_74208725/live/ww/bbc_radio_two/bbc_radio_two.isml/x.m3u8",
        }),
      ),
    ).toBe("bbc_radio_two");
    expect(
      bbcServiceIdForStation(station({ homepage: "", url: "https://example.com/s.mp3", url_resolved: "" })),
    ).toBeNull();
  });

  it("validates service ids", () => {
    expect(isBbcServiceId("bbc_radio_two")).toBe(true);
    expect(isBbcServiceId("BBC_6MUSIC")).toBe(true);
    expect(isBbcServiceId("radio two")).toBe(false);
    expect(isBbcServiceId("")).toBe(false);
    expect(isBbcServiceId(null)).toBe(false);
  });
});

describe("bbcSoundsUrl", () => {
  it("builds the Sounds live page, rejecting garbage", () => {
    expect(bbcSoundsUrl("bbc_radio_two")).toBe("https://www.bbc.co.uk/sounds/play/live:bbc_radio_two");
    expect(bbcSoundsUrl("BBC_6MUSIC")).toBe("https://www.bbc.co.uk/sounds/play/live:bbc_6music");
    expect(bbcSoundsUrl(null)).toBeNull();
    expect(bbcSoundsUrl("not a service")).toBeNull();
  });
});

describe("formatBbcTrack", () => {
  it("joins artist and track, tolerates one side missing", () => {
    expect(formatBbcTrack("Lorde", "Green Light")).toBe("Lorde - Green Light");
    expect(formatBbcTrack("Lorde", "")).toBe("Lorde");
    expect(formatBbcTrack("", "Green Light")).toBe("Green Light");
    expect(formatBbcTrack("", "")).toBeNull();
    expect(formatBbcTrack(null, undefined)).toBeNull();
  });
});

function segmentPayload() {
  return {
    total: 1,
    data: [
      {
        segment_type: "music",
        titles: { primary: "Lorde", secondary: "Green Light" },
        offset: { start: 1164, end: 1374, label: "Now Playing", now_playing: true },
      },
    ],
  };
}

describe("parseBbcSegments", () => {
  it("parses a music segment", () => {
    expect(parseBbcSegments(segmentPayload())).toMatchObject({
      artist: "Lorde",
      track: "Green Light",
      title: "Lorde - Green Light",
      label: "Now Playing",
      nowPlaying: true,
    });
  });

  it("returns null for empty data and blank titles", () => {
    expect(parseBbcSegments({ total: 0, data: [] })).toBeNull();
    expect(parseBbcSegments({ data: [{ titles: { primary: "", secondary: "" }, offset: {} }] })).toBeNull();
    expect(parseBbcSegments(null)).toBeNull();
    expect(parseBbcSegments({})).toBeNull();
  });
});

function broadcastPayload() {
  return {
    total: 2,
    data: [
      {
        pid: "past",
        start: "2026-10-04T05:00:00Z",
        end: "2026-10-04T08:00:00Z",
        on_air: false,
        programme: { titles: { primary: "Good Morning Sunday", display_title: "Good Morning Sunday - Chat" } },
      },
      {
        pid: "live",
        start: "2026-10-04T12:00:00Z",
        end: "2026-10-04T15:00:00Z",
        on_air: true,
        programme: {
          titles: { primary: "Guy Garvey's Finest Hour", display_title: "Guy Garvey's Finest Hour - Guest" },
        },
      },
    ],
  };
}

describe("parseBbcBroadcasts", () => {
  it("prefers the on-air entry", () => {
    expect(parseBbcBroadcasts(broadcastPayload())?.title).toBe("Guy Garvey's Finest Hour - Guest");
  });

  it("carries the broadcast window for boundary scheduling", () => {
    const programme = parseBbcBroadcasts(broadcastPayload());
    expect(programme?.start).toBe("2026-10-04T12:00:00Z");
    expect(programme?.end).toBe("2026-10-04T15:00:00Z");
  });

  it("falls back to the entry covering now, then the first row", () => {
    const payload = {
      data: [
        {
          start: "2026-10-04T05:00:00Z",
          end: "2026-10-04T08:00:00Z",
          on_air: false,
          programme: { titles: { display_title: "Morning Show" } },
        },
      ],
    };
    expect(parseBbcBroadcasts(payload, Date.parse("2026-10-04T06:00:00Z"))?.title).toBe("Morning Show");
    expect(parseBbcBroadcasts(payload, Date.parse("2026-10-04T20:00:00Z"))?.title).toBe("Morning Show");
    expect(parseBbcBroadcasts({ data: [] })).toBeNull();
    expect(parseBbcBroadcasts(null)).toBeNull();
  });

  it("finds the live entry mid-window when no on_air flag is set", () => {
    // Mirrors the live feed: paged ascending window, flags lagging behind.
    const payload = {
      data: [
        {
          start: "2026-10-04T05:00:00Z",
          end: "2026-10-04T08:00:00Z",
          on_air: false,
          programme: { titles: { display_title: "Good Morning Sunday" } },
        },
        {
          start: "2026-10-04T13:00:00Z",
          end: "2026-10-04T15:00:00Z",
          on_air: false,
          programme: { titles: { display_title: "Elaine Paige on Sunday" } },
        },
      ],
    };
    expect(parseBbcBroadcasts(payload, Date.parse("2026-10-04T13:30:00Z"))?.title).toBe("Elaine Paige on Sunday");
  });

  it("resolves a stale window to its most recent row, not its oldest", () => {
    const payload = {
      data: [
        {
          start: "2026-10-03T00:00:00Z",
          end: "2026-10-03T01:00:00Z",
          on_air: false,
          programme: { titles: { display_title: "Yesterday" } },
        },
        {
          start: "2026-10-04T05:00:00Z",
          end: "2026-10-04T08:00:00Z",
          on_air: false,
          programme: { titles: { display_title: "This Morning" } },
        },
      ],
    };
    // Radio 4 case: the window ends before now, so nothing covers it.
    expect(parseBbcBroadcasts(payload, Date.parse("2026-10-04T14:00:00Z"))?.title).toBe("This Morning");
  });
});

describe("bbcBoundaryDelayMs", () => {
  const now = Date.parse("2026-10-04T13:30:00Z");
  it("fires shortly after the programme end", () => {
    // 30min out + 10s rollover buffer.
    expect(bbcBoundaryDelayMs("2026-10-04T14:00:00Z", now)).toBe(30 * 60_000 + 10_000);
  });

  it("refuses past, garbage and absurdly distant ends", () => {
    expect(bbcBoundaryDelayMs("2026-10-04T13:00:00Z", now)).toBeNull();
    expect(bbcBoundaryDelayMs("not a date", now)).toBeNull();
    expect(bbcBoundaryDelayMs(null, now)).toBeNull();
    expect(bbcBoundaryDelayMs("2027-10-04T14:00:00Z", now)).toBeNull();
  });
});

describe("bbcNextPollDelayMs", () => {
  const now = Date.parse("2026-10-04T13:30:00Z");
  it("polls tracks hot and backs programmes off to their boundary", () => {
    expect(bbcNextPollDelayMs({ kind: "track", end: "" }, now)).toBe(30_000);
    expect(bbcNextPollDelayMs(null, now)).toBe(30_000);
    // Boundary 2min out + 10s buffer, sooner than the 3-minute net.
    expect(bbcNextPollDelayMs({ kind: "programme", end: "2026-10-04T13:32:00Z" }, now)).toBe(2 * 60_000 + 10_000);
    // Far boundary loses to the net; missing end takes the net outright.
    expect(bbcNextPollDelayMs({ kind: "programme", end: "2026-10-04T20:00:00Z" }, now)).toBe(180_000);
    expect(bbcNextPollDelayMs({ kind: "programme", end: "" }, now)).toBe(180_000);
  });
});

describe("isCurrentSegment", () => {
  it("accepts now-playing and just-ended tracks, rejects stale ones", () => {
    const base = { artist: "A", track: "T", title: "A - T" };
    expect(isCurrentSegment({ ...base, label: "Now Playing", nowPlaying: true })).toBe(true);
    expect(isCurrentSegment({ ...base, label: "Less Than a Minute Ago", nowPlaying: false })).toBe(true);
    expect(isCurrentSegment({ ...base, label: "13 Minutes Ago", nowPlaying: false })).toBe(false);
    expect(isCurrentSegment({ ...base, label: "", nowPlaying: false })).toBe(false);
  });
});

function jsonResponse(payload: unknown): Response {
  return Response.json(payload);
}

function broadcastPage(title: string, start: string, end: string) {
  return { start, end, on_air: false, programme: { titles: { display_title: title } } };
}

describe("fetchBbcNowPlaying", () => {
  it("returns the track when the newest segment is current", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(segmentPayload())));
    const result = await fetchBbcNowPlaying("bbc_radio_one", { fetchImpl });
    expect(result?.kind).toBe("track");
    expect(result?.title).toBe("Lorde - Green Light");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("falls back to the on-air programme when segments are stale or empty", async () => {
    const stale = {
      data: [
        {
          titles: { primary: "Queen", secondary: "Don't Stop Me Now" },
          offset: { label: "13 Minutes Ago", now_playing: false },
        },
      ],
    };
    const fetchImpl = vi.fn((input: Parameters<typeof fetch>[0]) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      return Promise.resolve(jsonResponse(url.includes("/segments/") ? stale : broadcastPayload()));
    });
    const result = await fetchBbcNowPlaying("bbc_radio_two", {
      fetchImpl,
      now: Date.parse("2026-10-04T13:00:00Z"),
    });
    expect(result?.kind).toBe("programme");
    expect(result?.title).toBe("Guy Garvey's Finest Hour - Guest");
  });

  it("pages the schedule window when it outgrows one request", async () => {
    const fetchImpl = vi.fn((input: Parameters<typeof fetch>[0]) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("/segments/")) return Promise.resolve(jsonResponse({ total: 0, data: [] }));
      const offset = Number(new URL(url).searchParams.get("offset") ?? 0);
      const data =
        offset === 0
          ? [broadcastPage("Yesterday", "2026-10-03T00:00:00Z", "2026-10-03T01:00:00Z")]
          : [broadcastPage("Today", "2026-10-03T01:00:00Z", "2026-10-03T02:00:00Z")];
      return Promise.resolve(jsonResponse({ total: 2, data }));
    });
    const result = await fetchBbcNowPlaying("bbc_radio_fourfm", {
      fetchImpl,
      now: Date.parse("2026-10-03T01:30:00Z"),
    });
    expect(result).toMatchObject({ kind: "programme", title: "Today" });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("returns null when both feeds fail, and rejects bad service ids", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response("nope", { status: 500 })));
    expect(await fetchBbcNowPlaying("bbc_radio_two", { fetchImpl })).toBeNull();
    expect(await fetchBbcNowPlaying("not a service", { fetchImpl })).toBeNull();
  });
});
