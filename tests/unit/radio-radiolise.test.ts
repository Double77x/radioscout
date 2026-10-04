import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { fetchRadioliseTitle } from "@/lib/radio/radiolise";

function summary(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

describe("fetchRadioliseTitle", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the title for a warm station", async () => {
    vi.stubGlobal("fetch", () => summary({ title: "Dusty Springfield - Some Of Your Lovin'" }));
    const result = await fetchRadioliseTitle("http://example.com/s.mp3");
    expect(result).toEqual({ outcome: "ok", title: "Dusty Springfield - Some Of Your Lovin'" });
  });

  it("normalises a stuffed title from the shared lookup", async () => {
    vi.stubGlobal("fetch", () =>
      summary({ title: 'Bruno Mars - text="Risk It All" song_spot="M" MediaBaseId="3206087"' }),
    );
    const result = await fetchRadioliseTitle("http://example.com/s.mp3");
    expect(result).toEqual({ outcome: "ok", title: "Bruno Mars - Risk It All" });
  });

  it("treats an ad marker as no title so the caller falls through", async () => {
    vi.stubGlobal("fetch", () => summary({ title: ' - text="Spot Block End" length="00:00:00"' }));
    const result = await fetchRadioliseTitle("http://example.com/s.mp3");
    expect(result.outcome).toBe("no-title");
  });

  it("treats a missing title as no title", async () => {
    vi.stubGlobal("fetch", () => summary({ type: "serverUnreachable" }));
    const result = await fetchRadioliseTitle("http://example.com/s.mp3");
    expect(result.outcome).toBe("no-title");
  });

  it("maps HTTP errors without memoising anything", async () => {
    vi.stubGlobal("fetch", () => summary({ type: "serverUnreachable" }, 400));
    const result = await fetchRadioliseTitle("http://example.com/s.mp3");
    expect(result.outcome).toBe("http-error");
  });

  it.each([["AbortError"], ["TimeoutError"]])("maps %s to a timeout", async (name) => {
    vi.stubGlobal("fetch", () => Promise.reject(new DOMException("aborted", name)));
    const result = await fetchRadioliseTitle("http://example.com/s.mp3");
    expect(result.outcome).toBe("timeout");
  });

  it("maps network failures to fetch-error", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("Failed to fetch")));
    const result = await fetchRadioliseTitle("http://example.com/s.mp3");
    expect(result.outcome).toBe("fetch-error");
  });

  it("never rejects, even on unparsable bodies", async () => {
    vi.stubGlobal("fetch", () => new Response("not-json", { headers: { "content-type": "application/json" } }));
    const result = await fetchRadioliseTitle("http://example.com/s.mp3");
    expect(result.outcome).toBe("no-title");
  });
});
