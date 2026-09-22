import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWebTitle } from "@/lib/radio/now-playing";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(handler: () => Promise<unknown>): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => handler()),
  );
}

describe("fetchWebTitle", () => {
  it("returns the trimmed title on success", async () => {
    stubFetch(() => Promise.resolve(Response.json({ title: "  Artist - Song  " })));
    await expect(fetchWebTitle("https://example.com/stream")).resolves.toBe("Artist - Song");
  });

  it("returns null for empty, missing, or non-string titles", async () => {
    stubFetch(() => Promise.resolve(Response.json({ title: "   " })));
    await expect(fetchWebTitle("https://example.com/a")).resolves.toBeNull();
    stubFetch(() => Promise.resolve(Response.json({ title: null })));
    await expect(fetchWebTitle("https://example.com/b")).resolves.toBeNull();
    stubFetch(() => Promise.resolve(Response.json({})));
    await expect(fetchWebTitle("https://example.com/c")).resolves.toBeNull();
  });

  it("returns null on HTTP errors, bad JSON, and network failure", async () => {
    stubFetch(() => Promise.resolve(new Response("oops", { status: 500 })));
    await expect(fetchWebTitle("https://example.com/a")).resolves.toBeNull();
    stubFetch(() => Promise.resolve(new Response("not-json")));
    await expect(fetchWebTitle("https://example.com/b")).resolves.toBeNull();
    stubFetch(() => Promise.reject(new Error("down")));
    await expect(fetchWebTitle("https://example.com/c")).resolves.toBeNull();
  });
});
