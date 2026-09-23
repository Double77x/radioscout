// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_STATION, type Station } from "@/lib/radio/types";
import {
  INSECURE_HTTP_MESSAGE,
  nativeTrackArtist,
  parkWebAudioElement,
  updateMediaSession,
} from "@/lib/player/native-bridge";

function FakeMediaMetadata(this: Record<string, unknown>, init: Record<string, unknown>): void {
  Object.assign(this, init);
}

function station(overrides: Partial<Station> = {}): Station {
  return { ...EMPTY_STATION, ...overrides };
}

describe("INSECURE_HTTP_MESSAGE", () => {
  it("names the HTTP-only failure (not a generic offline error)", () => {
    expect(INSECURE_HTTP_MESSAGE).toContain("HTTP");
    expect(INSECURE_HTTP_MESSAGE.length).toBeGreaterThan(20);
  });
});

describe("nativeTrackArtist", () => {
  it("prefers tidied tags", () => {
    expect(nativeTrackArtist(station({ tags: "jazz", country: "Testland", countrycode: "" }))).toBe("Jazz");
  });

  it("falls back to the country, then to generic Radio", () => {
    expect(nativeTrackArtist(station({ tags: "", country: "Testland", countrycode: "" }))).toBe("Testland");
    expect(nativeTrackArtist(station({ tags: "", country: "", countrycode: "" }))).toBe("Radio");
  });
});

describe("parkWebAudioElement", () => {
  it("pauses, clears and reloads in order", () => {
    const calls: string[] = [];
    const element = {
      pause: () => void calls.push("pause"),
      removeAttribute: () => void calls.push("removeAttribute"),
      load: () => void calls.push("load"),
    } as unknown as HTMLAudioElement;
    parkWebAudioElement(element);
    expect(calls).toEqual(["pause", "removeAttribute", "load"]);
  });

  it("tolerates a missing element and a teardown race on pause", () => {
    expect(() => parkWebAudioElement(null)).not.toThrow();
    const calls: string[] = [];
    const element = {
      pause: () => {
        throw new Error("gone");
      },
      removeAttribute: () => void calls.push("removeAttribute"),
      load: () => void calls.push("load"),
    } as unknown as HTMLAudioElement;
    expect(() => parkWebAudioElement(element)).not.toThrow();
    expect(calls).toEqual(["removeAttribute", "load"]);
  });
});

describe("updateMediaSession", () => {
  const navigatorHolder = globalThis.navigator as unknown as Record<string, unknown>;
  const globalHolder = globalThis as unknown as Record<string, unknown>;
  const savedSession = navigatorHolder["mediaSession"];
  const savedMetadata = globalHolder["MediaMetadata"];

  afterEach(() => {
    navigatorHolder["mediaSession"] = savedSession;
    globalHolder["MediaMetadata"] = savedMetadata;
  });

  it("is a no-op without a session (never breaks playback)", () => {
    navigatorHolder["mediaSession"] = undefined;
    const handlers = { onPlay: vi.fn(), onPause: vi.fn(), onStop: vi.fn() };
    expect(() => updateMediaSession(station({ name: "No Session FM" }), handlers)).not.toThrow();
    expect(handlers.onPlay).not.toHaveBeenCalled();
  });

  it("publishes metadata and wires transport actions", () => {
    const actions = new Map<string, () => void>();
    const seen: { title?: string; artist?: string; album?: string; artwork?: unknown[] } = {};
    const holder: { current?: Record<string, unknown> } = {};
    navigatorHolder["mediaSession"] = {
      get metadata(): Record<string, unknown> | undefined {
        return holder.current;
      },
      set metadata(value: { title: string; artist: string; album: string; artwork: unknown[] }) {
        holder.current = { ...value };
        seen.title = value.title;
        seen.artist = value.artist;
        seen.album = value.album;
        seen.artwork = value.artwork;
      },
      setActionHandler: (action: string, handler: () => void) => void actions.set(action, handler),
    };
    globalHolder["MediaMetadata"] = FakeMediaMetadata;
    const handlers = { onPlay: vi.fn(), onPause: vi.fn(), onStop: vi.fn() };
    const item = station({ name: "Session FM", tags: "rock", favicon: "" });
    expect(() => updateMediaSession(item, handlers)).not.toThrow();
    expect(seen.title).toBe("Session FM");
    expect(seen.artist).toBe("Rock");
    expect(seen.album).toBe("RadioScout");
    expect(seen.artwork).toEqual([]);
    actions.get("play")?.();
    actions.get("pause")?.();
    actions.get("stop")?.();
    expect(handlers.onPlay).toHaveBeenCalledTimes(1);
    expect(handlers.onPause).toHaveBeenCalledTimes(1);
    expect(handlers.onStop).toHaveBeenCalledTimes(1);
  });
});
