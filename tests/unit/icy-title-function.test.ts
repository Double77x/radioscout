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

function requestFor(target: string): Request {
  return new Request(`https://app.test/api/icy-title?url=${encodeURIComponent(target)}&titles=1`);
}

function probeRequest(): Request {
  return requestFor("http://example.com/s.mp3");
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

describe("icy-title target gate", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["a file URL", "file:///etc/passwd"],
    ["a data URL", "data:text/plain,hello"],
    ["credentials", "https://user:pass@example.com/stream"],
    ["loopback", "http://127.0.0.1:8000/stream"],
    ["a private literal", "http://192.168.1.10:8000/stream"],
    ["localhost", "http://localhost:8000/stream"],
  ])("rejects %s without fetching", async (_label, target) => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("caches", undefined);
    const response = await onRequestGet({ request: requestFor(target) });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, reason: "invalid-target", titles: [] });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("lets a public station URL through to the probe", async () => {
    const fetchSpy = vi.fn(() => new Response("", { status: 404 }));
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("caches", undefined);
    const response = await onRequestGet({ request: requestFor("https://stream.example.com/live.mp3") });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(await response.json()).toMatchObject({ ok: false, reason: "http-404" });
  });
});
