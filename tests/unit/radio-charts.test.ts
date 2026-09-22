import { afterEach, describe, expect, it } from "vitest";
import { searchStations, topClickedStations, topVotedStations } from "@/lib/radio/api";

function row(uuid: string, playable: boolean, bitrate = 0): Record<string, unknown> {
  return {
    stationuuid: uuid,
    name: `Station ${uuid}`,
    url_resolved: playable ? `https://stream.example.com/${uuid}` : `http://stream.example.com/${uuid}`,
    bitrate,
  };
}

function stubFetch(rows: Record<string, unknown>[], seen: string[]): void {
  (globalThis as Record<string, unknown>).fetch = ((url: unknown) => {
    seen.push(String(url));
    return Promise.resolve({ ok: true, json: () => Promise.resolve(rows) });
  }) as typeof fetch;
}

/** Param-honoring stub: slices the directory like the server's limit/offset. */
function stubPaged(rows: Record<string, unknown>[], seen: string[]): void {
  (globalThis as Record<string, unknown>).fetch = ((url: unknown) => {
    const urlString = String(url);
    seen.push(urlString);
    const params = new URL(urlString).searchParams;
    const limit = Number(params.get("limit") ?? "0");
    const offset = Number(params.get("offset") ?? "0");
    return Promise.resolve({ ok: true, json: () => Promise.resolve(rows.slice(offset, offset + limit)) });
  }) as typeof fetch;
}

function offsetOf(url: string): number {
  return Number(new URL(url).searchParams.get("offset") ?? "0");
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).fetch;
});

describe("chart over-fetch", () => {
  it("fills 50 playable stations behind a language filter", async () => {
    // 150 server rows, every third unplayable -> 100 playable, sliced to 50.
    const rows = Array.from({ length: 150 }, (_, i) => row(`uuid-${i}`, i % 3 !== 0));
    const seen: string[] = [];
    stubFetch(rows, seen);
    const stations = await searchStations({ order: "votes", limit: 50, languages: ["english"] });
    expect(stations).toHaveLength(50);
    expect(seen[0]).toContain("limit=200");
    expect(seen[0]).toContain("offset=0");
    expect(seen[0]).toContain("language=english");
  });

  it("walks offset pages until the filtered list is full", async () => {
    // 800 rows, every 20th playable at 128k -> 10 matches per page, 40 total.
    const rows = Array.from({ length: 800 }, (_, i) =>
      i % 20 === 0 ? row(`uuid-${i}`, true, 128) : row(`uuid-${i}`, false),
    );
    const seen: string[] = [];
    stubPaged(rows, seen);
    const stations = await searchStations({ order: "votes", limit: 50, languages: ["english"], minBitrate: 128 });
    expect(stations).toHaveLength(40);
    expect(stations.every((station) => station.bitrate >= 128)).toBe(true);
    expect(seen).toHaveLength(4);
    expect(seen.map((url) => offsetOf(url))).toEqual([0, 200, 400, 600]);
  });

  it("stops paging once the first page fills the list", async () => {
    const rows = Array.from({ length: 200 }, (_, i) => row(`uuid-${i}`, true, 128));
    const seen: string[] = [];
    stubPaged(rows, seen);
    const stations = await searchStations({ order: "votes", limit: 50, minBitrate: 128 });
    expect(stations).toHaveLength(50);
    expect(seen).toHaveLength(1);
  });

  it("leaves free-text limits alone (ILIKE manages its own pool)", async () => {
    const rows = Array.from({ length: 100 }, (_, i) => row(`uuid-${i}`, true));
    const seen: string[] = [];
    stubFetch(rows, seen);
    await searchStations({ name: "jazz", limit: 100 });
    expect(seen[0]).toContain("limit=100");
  });

  it("over-fetches the topvote endpoint and slices to the limit", async () => {
    const rows = Array.from({ length: 150 }, (_, i) => row(`uuid-${i}`, i % 3 !== 0));
    const seen: string[] = [];
    stubFetch(rows, seen);
    const stations = await topVotedStations(50);
    expect(stations).toHaveLength(50);
    expect(seen[0]).toContain("/json/stations/topvote/150");
  });

  it("over-fetches the topclick endpoint and slices to the limit", async () => {
    const rows = Array.from({ length: 150 }, (_, i) => row(`uuid-${i}`, true));
    const seen: string[] = [];
    stubFetch(rows, seen);
    const stations = await topClickedStations(50);
    expect(stations).toHaveLength(50);
    expect(seen[0]).toContain("/json/stations/topclick/150");
  });

  it("applies the quality minimum behind a language filter and fetches deeper", async () => {
    // 250 server rows alternating 128/64 kbps -> 125 playable at 128+, sliced to 50.
    const rows = Array.from({ length: 250 }, (_, i) => row(`uuid-${i}`, true, i % 2 === 0 ? 128 : 64));
    const seen: string[] = [];
    stubFetch(rows, seen);
    const stations = await searchStations({ order: "votes", limit: 50, languages: ["english"], minBitrate: 128 });
    expect(stations).toHaveLength(50);
    expect(stations.every((station) => station.bitrate >= 128)).toBe(true);
    expect(seen[0]).toContain("limit=200");
  });

  it("routes the quality-filtered topvote chart through paged search", async () => {
    const rows = Array.from({ length: 250 }, (_, i) => row(`uuid-${i}`, true, i % 2 === 0 ? 192 : 32));
    const seen: string[] = [];
    stubFetch(rows, seen);
    const stations = await topVotedStations(50, [], 128);
    expect(stations).toHaveLength(50);
    expect(stations.every((station) => station.bitrate >= 128)).toBe(true);
    expect(seen[0]).toContain("/json/stations/search?");
    expect(seen[0]).toContain("order=votes");
  });

  it("hides unknown bitrates when a minimum is set", async () => {
    const rows = [row("known", true, 128), row("unknown", true, 0)];
    const seen: string[] = [];
    stubFetch(rows, seen);
    const stations = await searchStations({ order: "votes", limit: 50, minBitrate: 128 });
    expect(stations.map((station) => station.stationuuid)).toEqual(["known"]);
  });
});
