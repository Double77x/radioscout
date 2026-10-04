import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { onRequestGet, serviceFromParams } from "../../functions/api/bbc-title";

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

function trackPayload() {
  return {
    total: 1,
    data: [
      {
        titles: { primary: "Lorde", secondary: "Green Light" },
        offset: { label: "Now Playing", now_playing: true },
      },
    ],
  };
}

function programmePayload() {
  return {
    total: 1,
    data: [
      {
        pid: "live",
        start: "2026-10-04T12:00:00Z",
        end: "2026-10-04T15:00:00Z",
        on_air: true,
        programme: { titles: { primary: "Guy Garvey's Finest Hour", display_title: "Guy Garvey's Finest Hour" } },
      },
    ],
  };
}

function jsonResponse(payload: unknown): Response {
  return Response.json(payload);
}

function serviceRequest(): Request {
  return new Request("https://app.test/api/bbc-title?service=bbc_radio_one");
}

describe("bbc-title service param", () => {
  it("accepts ?service= directly and reads the id out of ?url=", () => {
    expect(serviceFromParams(new URLSearchParams("service=bbc_radio_two"))).toBe("bbc_radio_two");
    expect(
      serviceFromParams(
        new URLSearchParams(
          "url=http://as-hls-ww-live.akamaized.net/pool_74208725/live/ww/bbc_radio_two/bbc_radio_two.isml/x.m3u8",
        ),
      ),
    ).toBe("bbc_radio_two");
    expect(serviceFromParams(new URLSearchParams("service=nope"))).toBeNull();
    expect(serviceFromParams(new URLSearchParams(""))).toBeNull();
  });
});

describe("bbc-title function", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects unknown services without fetching", async () => {
    const fetchSpy = vi.fn(() => Promise.resolve(jsonResponse({})));
    vi.stubGlobal("fetch", fetchSpy);
    const response = await onRequestGet({ request: new Request("https://app.test/api/bbc-title?service=nope") });
    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("serves the track and caches repeats without re-probing", async () => {
    let count = 0;
    vi.stubGlobal("fetch", () => {
      count += 1;
      return Promise.resolve(jsonResponse(trackPayload()));
    });
    const { caches } = fakeCaches();
    vi.stubGlobal("caches", caches);
    const first: unknown = await (await onRequestGet({ request: serviceRequest() })).json();
    const second: unknown = await (await onRequestGet({ request: serviceRequest() })).json();
    expect(first).toMatchObject({ ok: true, kind: "track", title: "Lorde - Green Light" });
    expect(second).toMatchObject({ ok: true, kind: "track", title: "Lorde - Green Light" });
    expect(count).toBe(1);
  });

  it("caches BBC verdicts for 30s instead of the 60s ICY ttl", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(jsonResponse(trackPayload())));
    vi.stubGlobal("caches", undefined);
    const response = await onRequestGet({ request: serviceRequest() });
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=30");
  });

  it("falls back to the on-air programme when segments are empty", async () => {
    vi.stubGlobal("fetch", (input: unknown) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : "";
      return Promise.resolve(jsonResponse(url.includes("/segments/") ? { total: 0, data: [] } : programmePayload()));
    });
    vi.stubGlobal("caches", undefined);
    const body: unknown = await (await onRequestGet({ request: serviceRequest() })).json();
    expect(body).toMatchObject({ ok: true, kind: "programme", title: "Guy Garvey's Finest Hour" });
  });

  it("never caches no-data verdicts", async () => {
    let count = 0;
    vi.stubGlobal("fetch", () => {
      count += 1;
      return Promise.resolve(new Response("rms down", { status: 500 }));
    });
    const { caches, store } = fakeCaches();
    vi.stubGlobal("caches", caches);
    await onRequestGet({ request: serviceRequest() });
    await onRequestGet({ request: serviceRequest() });
    // Two upstream attempts per probe (segments, then broadcasts).
    expect(count).toBe(4);
    expect(store.size).toBe(0);
  });
});
