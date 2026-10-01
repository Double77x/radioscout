import { describe, expect, it, vi } from "vite-plus/test";
import { hostOf, parkRecord, type RetiredOutput } from "@/lib/player/elements";

describe("hostOf", () => {
  it("lowercases hostnames", () => {
    expect(hostOf("https://Stream-01.Example.COM/live")).toBe("stream-01.example.com");
  });

  it("returns null for garbage and empty hosts", () => {
    expect(hostOf("not a url")).toBeNull();
    expect(hostOf("")).toBeNull();
    expect(hostOf("file:///tmp/x.mp3")).toBeNull();
  });
});

function stubRecord(overrides: Partial<RetiredOutput> = {}): RetiredOutput & {
  calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- partial test double: unexercised members are intentionally absent
    abort: { abort: () => void calls.push("abort") } as unknown as AbortController,
    element: {
      pause: () => void calls.push("pause"),
      removeAttribute: () => void calls.push("removeAttribute"),
      load: () => void calls.push("load"),
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- partial test double: unexercised members are intentionally absent
    } as unknown as HTMLAudioElement,
    ctx: {
      close: () => {
        calls.push("close");
        return Promise.resolve();
      },
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- partial test double: unexercised members are intentionally absent
    } as unknown as AudioContext,
    ...overrides,
  };
}

describe("parkRecord", () => {
  it("detaches, silences, clears and closes in order", () => {
    const record = stubRecord();
    parkRecord(record);
    expect(record.calls).toEqual(["abort", "pause", "removeAttribute", "load", "close"]);
  });

  it("tolerates missing abort and context", () => {
    const record = stubRecord({ abort: null, ctx: null });
    expect(() => {
      parkRecord(record);
    }).not.toThrow();
    expect(record.calls).toEqual(["pause", "removeAttribute", "load"]);
  });

  it("keeps tearing down when a step throws", () => {
    const record = stubRecord({
      element: {
        pause: () => {
          throw new Error("gone");
        },
        removeAttribute: vi.fn(),
        load: vi.fn(),
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- partial test double: unexercised members are intentionally absent
      } as unknown as HTMLAudioElement,
    });
    expect(() => {
      parkRecord(record);
    }).not.toThrow();
    expect(record.calls).toContain("close");
  });
});
