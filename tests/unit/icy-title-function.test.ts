import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { onRequestGet } from "../../functions/api/icy-title";
import { isRecord } from "@/lib/utils";

/** Single-title ICY byte stream, fresh per call (bodies read once). */
function icyResponse(): Response {
  const metaint = 32;
  const payload = new TextEncoder().encode("StreamTitle='Cached Song';");
  const length = Math.ceil(payload.length / 16);
  const block = new Uint8Array(1 + 16 * length);
  block[0] = length;
  block.set(payload, 1);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(metaint));
      controller.enqueue(block);
      controller.enqueue(new Uint8Array(metaint));
      controller.close();
    },
  });
  return new Response(stream, { headers: { "icy-metaint": String(metaint), "content-type": "audio/mpeg" } });
}

/** In-memory CacheStorage stand-in; clones on match like the edge does. */
function fakeCaches(): { store: Map<string, Response>; caches: unknown } {
  const store = new Map<string, Response>();
  const caches = {
    default: {
      match: (key: string): Promise<Response | undefined> => {
        const hit = store.get(key);
        return Promise.resolve(hit?.clone());
      },
      put: (key: string, response: Response): Promise<void> => {
        store.set(key, response);
        return Promise.resolve();
      },
    },
  };
  return { store, caches };
}

function probeRequest(): Request {
  return new Request(`https://app.test/api/icy-title?url=${encodeURIComponent("http://example.com/s.mp3")}&titles=1`);
}

function titleOf(body: unknown): string {
  if (!isRecord(body)) return "";
  const titles: unknown = body.titles;
  if (!Array.isArray(titles)) return "";
  const first: unknown = titles[0];
  if (!isRecord(first)) return "";
  const title: unknown = first.title;
  return typeof title === "string" ? title : "";
}

describe("icy-title function cache", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("serves repeats from the edge cache without re-probing", async () => {
    let count = 0;
    vi.stubGlobal("fetch", () => {
      count += 1;
      return icyResponse();
    });
    const { caches } = fakeCaches();
    vi.stubGlobal("caches", caches);
    const first: unknown = await (await onRequestGet({ request: probeRequest() })).json();
    const second: unknown = await (await onRequestGet({ request: probeRequest() })).json();
    expect(titleOf(first)).toBe("Cached Song");
    expect(titleOf(second)).toBe("Cached Song");
    expect(count).toBe(1);
  });

  it("never caches error verdicts", async () => {
    let count = 0;
    vi.stubGlobal("fetch", () => {
      count += 1;
      return new Response("audio-bytes", { headers: { "content-type": "audio/mpeg" } });
    });
    const { caches, store } = fakeCaches();
    vi.stubGlobal("caches", caches);
    await onRequestGet({ request: probeRequest() });
    await onRequestGet({ request: probeRequest() });
    expect(count).toBe(2);
    expect(store.size).toBe(0);
  });

  it("probes directly when no cache API exists", async () => {
    let count = 0;
    vi.stubGlobal("fetch", () => {
      count += 1;
      return icyResponse();
    });
    vi.stubGlobal("caches", undefined);
    const response = await onRequestGet({ request: probeRequest() });
    const body: unknown = await response.json();
    expect(titleOf(body)).toBe("Cached Song");
    expect(count).toBe(1);
  });

  it("caches for the client's poll interval", async () => {
    vi.stubGlobal("fetch", () => icyResponse());
    const { caches } = fakeCaches();
    vi.stubGlobal("caches", caches);
    const response = await onRequestGet({ request: probeRequest() });
    expect(response.headers.get("cache-control")).toBe("public, max-age=20");
  });
});
