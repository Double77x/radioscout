import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { directIcyRoute, fetchIcyTitles, normalizeStreamTitle, parseIcyBlock } from "@/lib/radio/icy";

function blockOf(text: string): Uint8Array {
  const bytes = new TextEncoder().encode(text);
  const padded = new Uint8Array(Math.ceil(bytes.length / 16) * 16);
  padded.set(bytes, 0);
  return padded;
}

describe("parseIcyBlock", () => {
  it("decodes StreamTitle and StreamUrl pairs", () => {
    const pairs = parseIcyBlock(blockOf("StreamTitle='SomaFM - Groove Salad';StreamUrl='https://somafm.com';"));
    expect(pairs.StreamTitle).toBe("SomaFM - Groove Salad");
    expect(pairs.StreamUrl).toBe("https://somafm.com");
  });

  it("tolerates padding nulls and empty blocks", () => {
    expect(parseIcyBlock(new Uint8Array(64))).toEqual({});
    expect(parseIcyBlock(blockOf("StreamTitle='';"))).toEqual({ StreamTitle: "" });
  });

  it("keeps = and ; inside quoted values", () => {
    const pairs = parseIcyBlock(blockOf("StreamTitle='a=b;c';"));
    expect(pairs.StreamTitle).toBe("a=b;c");
  });
});

// Captured live from stream.revma.ihrhls.com (see docs/STREAM_TITLES.md).
const IHEART_Z100 =
  'Bruno Mars - text="Risk It All" song_spot="M" MediaBaseId="3206087" itunesTrackId="0" amgTrackId="-1" amgArtistId="0" TAID="0" TPID="383258012" cartcutId="0445994001" amgArtworkURL="http://img.iheart.com/sca/imscale?w=195&img=http%3A//assets.iheart.com/default/Default-PlayerAlbumArt.png" length="00:03:18" unsID="-1" spotInstanceId="-1"';

const IHEART_1037 =
  'Nelly / Kelly Rowland - text="Dilemma" song_spot="M" spotInstanceId="-1" length="00:03:54" MediaBaseId="1238217" TAID="0" TPID="743773" cartcutId="774177" amgArtworkURL="http://image.iheart.com/ihr-ingestion-pipeline-production-umg/redelivery/NEW_CONTENT_RADIO/00044001774829_20180623173031953/00044001774829_T1_cvrart.jpg" spEventID="53f2b266-07b7-f111-83de-02b040bf0b97" ';

// The same station also emits a `title=`/`artist=` shape whose `url=` value is
// never closed, so it runs on to the end of the block.
const IHEART_KEYED =
  'title="Shoop",artist="SALT-N-PEPA",url="song_spot="F" MediaBaseId="0" itunesTrackId="0" amgTrackId="-1" TAID="0" TPID="60391374" cartcutId="0" amgArtworkURL="https://i.iheart.com/v3/catalog/track/60391374?ops=fit(200,200),format(%22jpeg%22)" length="00:04:06" unsID="-1" spotInstanceId="6a2db668-d25e-4a01-aaac-6fde4f7583c8""';

describe("normalizeStreamTitle", () => {
  it("lifts the song out of a stuffed iHeart StreamTitle", () => {
    expect(normalizeStreamTitle(IHEART_Z100)).toBe("Bruno Mars - Risk It All");
    expect(normalizeStreamTitle(IHEART_1037)).toBe("Nelly / Kelly Rowland - Dilemma");
  });

  it("reads the keyed shape, whose unterminated url value swallows the tail", () => {
    expect(normalizeStreamTitle(IHEART_KEYED)).toBe("SALT-N-PEPA - Shoop");
    expect(normalizeStreamTitle('title="Suga Suga",artist="BABY BASH / FRANKIE J",url="x""')).toBe(
      "BABY BASH / FRANKIE J - Suga Suga",
    );
  });

  it("keeps whichever half of a keyed pair is present", () => {
    expect(normalizeStreamTitle('title="Ramp",artist=""')).toBe("Ramp");
    expect(normalizeStreamTitle('title="",artist="Nova"')).toBe("Nova");
  });

  it("drops a zero-length spot in the keyed shape too", () => {
    expect(normalizeStreamTitle('title="Spot Block End",artist="",url="x" length="00:00:00"')).toBe("");
  });

  it("leaves clean titles untouched", () => {
    for (const clean of [
      "Madonna - Live To Tell",
      "Phil Bailey & Phil Collins - Easy Lover",
      "PolyGroovers - Desoulate",
      "Northcape - Mackerel Sky",
    ]) {
      expect(normalizeStreamTitle(clean)).toBe(clean);
    }
  });

  it("drops the ad-break marker so the last song stays up", () => {
    expect(normalizeStreamTitle(' - text="Spot Block End" amgTrackId="9876543" length="00:00:00"')).toBe("");
  });

  it("drops the bare sentinel, which carries no zero length", () => {
    expect(normalizeStreamTitle('Nova - text="Spot Block" song_spot="M" length="00:00:30"')).toBe("");
    expect(normalizeStreamTitle('title="Spot Block",artist=""')).toBe("");
  });

  it("keeps a real track that carries a duration", () => {
    expect(normalizeStreamTitle('Nova - text="Ramp" song_spot="M" length="00:04:02"')).toBe("Nova - Ramp");
  });

  it("falls back to the head when text is empty", () => {
    expect(normalizeStreamTitle('Nova - Ramp text="" song_spot="M"')).toBe("Nova - Ramp");
    expect(normalizeStreamTitle('text="Ramp" song_spot="M"')).toBe("Ramp");
  });

  it("takes the first text= and ignores keys merely ending in it", () => {
    expect(normalizeStreamTitle('A - text="One" albumtext="Two"')).toBe("A - One");
  });

  it("only reads the keyed shape at the start of the value", () => {
    expect(normalizeStreamTitle('Nova - title="Ramp" artist="Nova"')).toBe('Nova - title="Ramp" artist="Nova"');
  });

  it("collapses whitespace and empty input", () => {
    expect(normalizeStreamTitle("  Madonna - Live To Tell  ")).toBe("Madonna - Live To Tell");
    expect(normalizeStreamTitle("   ")).toBe("");
  });
});

function icyStream(metaint: number, blocks: string[]): Response {
  const parts: Uint8Array[] = [new Uint8Array(metaint)];
  for (const text of blocks) {
    const payload = new TextEncoder().encode(text);
    const length = Math.ceil(payload.length / 16);
    const block = new Uint8Array(1 + 16 * length);
    block[0] = length;
    block.set(payload, 1);
    parts.push(block, new Uint8Array(metaint));
  }
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  });
  return new Response(stream, { headers: { "icy-metaint": String(metaint), "content-type": "audio/mpeg" } });
}

describe("fetchIcyTitles", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("decodes the first title and stops (complete)", async () => {
    vi.stubGlobal("fetch", () =>
      icyStream(32, ["StreamTitle='Northcape - Mackerel Sky';", "StreamTitle='Second Song';"]),
    );
    const { outcome, titles } = await fetchIcyTitles("http://example.com/s.mp3", { maxTitles: 1 });
    expect(outcome).toBe("complete");
    expect(titles).toHaveLength(1);
    expect(titles[0].title).toBe("Northcape - Mackerel Sky");
  });

  it("reports no-metaint when the server sends none", async () => {
    vi.stubGlobal("fetch", () => new Response("audio-bytes", { headers: { "content-type": "audio/mpeg" } }));
    const { outcome, titles } = await fetchIcyTitles("http://example.com/s.mp3", { maxTitles: 1 });
    expect(outcome).toBe("no-metaint");
    expect(titles).toHaveLength(0);
  });

  it("cleans a stuffed title and skips an ad-break marker", async () => {
    vi.stubGlobal("fetch", () =>
      icyStream(32, [
        'StreamTitle=\' - text="Spot Block End" amgTrackId="9876543" length="00:00:00"\';',
        `StreamTitle='${IHEART_Z100}';`,
      ]),
    );
    const { outcome, titles } = await fetchIcyTitles("http://example.com/s.mp3", { maxTitles: 1 });
    expect(outcome).toBe("complete");
    expect(titles).toHaveLength(1);
    expect(titles[0].title).toBe("Bruno Mars - Risk It All");
  });

  it.each([["AbortError"], ["TimeoutError"]])("maps %s to a timeout, not a fetch-error", async (name) => {
    // Node aborts `AbortSignal.timeout()` with `TimeoutError`; a manual
    // abort gives `AbortError`. Both mean the window ended — the caller
    // retries direct next poll instead of memoising the URL to the edge.
    vi.stubGlobal("fetch", () => Promise.reject(new DOMException("aborted", name)));
    const { outcome, titles } = await fetchIcyTitles("http://example.com/s.mp3", { maxTitles: 1 });
    expect(outcome).toBe("timeout");
    expect(titles).toHaveLength(0);
  });
});

describe("directIcyRoute", () => {
  const found = { at: 0, title: "Nova - Ramp" };

  it("publishes the title when the in-page read worked", () => {
    expect(directIcyRoute("complete", [found])).toEqual({ kind: "apply", title: "Nova - Ramp" });
  });

  it("stops without spending a Worker when the station has no ICY", () => {
    expect(directIcyRoute("no-metaint", [])).toEqual({ kind: "stop" });
    expect(directIcyRoute("http-error", [])).toEqual({ kind: "stop" });
  });

  it("memoises an unreadable body so the preflight is not retried", () => {
    expect(directIcyRoute("fetch-error", [])).toEqual({ kind: "edge", memo: true });
  });

  it("retries direct after a timeout, which only means the station was slow", () => {
    expect(directIcyRoute("timeout", [])).toEqual({ kind: "edge", memo: false });
    expect(directIcyRoute("complete", [])).toEqual({ kind: "edge", memo: false });
  });

  it("ignores a blank title rather than publishing it", () => {
    expect(directIcyRoute("complete", [{ at: 0, title: "   " }])).toEqual({ kind: "edge", memo: false });
  });
});
