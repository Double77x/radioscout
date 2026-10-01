import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { fetchIcyTitles, parseIcyBlock } from "@/lib/radio/icy";

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
});
