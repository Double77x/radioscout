// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { EMPTY_STATION, type Station } from "@/lib/radio/types";
import {
  INSECURE_HTTP_MESSAGE,
  buildSkipPlaylist,
  favouriteLoopTarget,
  nativeTrackArtist,
  parkWebAudioElement,
  playlistItems,
  updateMediaSession,
} from "@/lib/player/native-bridge";

function FakeMediaMetadata(this: Record<string, unknown>, init: Record<string, unknown>): void {
  Object.assign(this, init);
}

/** Shared void implementation so handler mocks satisfy `() => void`. */
function nothing(): void {
  return undefined;
}

function handlers() {
  return {
    onPlay: vi.fn(nothing),
    onPause: vi.fn(nothing),
    onStop: vi.fn(nothing),
    onNext: vi.fn(nothing),
    onPrevious: vi.fn(nothing),
  };
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
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- partial test double: unexercised members are intentionally absent
    } as unknown as HTMLAudioElement;
    parkWebAudioElement(element);
    expect(calls).toEqual(["pause", "removeAttribute", "load"]);
  });

  it("tolerates a missing element and a teardown race on pause", () => {
    expect(() => {
      parkWebAudioElement(null);
    }).not.toThrow();
    const calls: string[] = [];
    const element = {
      pause: () => {
        throw new Error("gone");
      },
      removeAttribute: () => void calls.push("removeAttribute"),
      load: () => void calls.push("load"),
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- partial test double: unexercised members are intentionally absent
    } as unknown as HTMLAudioElement;
    expect(() => {
      parkWebAudioElement(element);
    }).not.toThrow();
    expect(calls).toEqual(["removeAttribute", "load"]);
  });
});

describe("updateMediaSession", () => {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- mutable record view of a global for stub install/restore
  const navigatorHolder = globalThis.navigator as unknown as Record<string, unknown>;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- mutable record view of a global for stub install/restore
  const globalHolder = globalThis as unknown as Record<string, unknown>;
  const savedSession = navigatorHolder.mediaSession;
  const savedMetadata = globalHolder.MediaMetadata;

  afterEach(() => {
    navigatorHolder.mediaSession = savedSession;
    globalHolder.MediaMetadata = savedMetadata;
  });

  /** Published metadata fields plus the wired transport actions. */
  function installSession(): {
    seen: { title?: string; artist?: string; album?: string; artwork?: unknown[] };
    actions: Map<string, () => void>;
  } {
    const actions = new Map<string, () => void>();
    const seen: { title?: string; artist?: string; album?: string; artwork?: unknown[] } = {};
    const holder: { current?: Record<string, unknown> } = {};
    navigatorHolder.mediaSession = {
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
    globalHolder.MediaMetadata = FakeMediaMetadata;
    return { seen, actions };
  }

  it("is a no-op without a session (never breaks playback)", () => {
    navigatorHolder.mediaSession = undefined;
    const itemHandlers = handlers();
    expect(() => {
      updateMediaSession(station({ name: "No Session FM" }), itemHandlers);
    }).not.toThrow();
    expect(itemHandlers.onPlay).not.toHaveBeenCalled();
  });

  it("publishes metadata and wires transport actions", () => {
    const { seen, actions } = installSession();
    const itemHandlers = handlers();
    const item = station({ name: "Session FM", tags: "rock", favicon: "" });
    expect(() => {
      updateMediaSession(item, itemHandlers);
    }).not.toThrow();
    expect(seen.title).toBe("Session FM");
    expect(seen.artist).toBe("Rock");
    expect(seen.album).toBe("RadioScout");
    expect(seen.artwork).toEqual([]);
    actions.get("play")?.();
    actions.get("pause")?.();
    actions.get("stop")?.();
    actions.get("nexttrack")?.();
    actions.get("previoustrack")?.();
    expect(itemHandlers.onPlay).toHaveBeenCalledTimes(1);
    expect(itemHandlers.onPause).toHaveBeenCalledTimes(1);
    expect(itemHandlers.onStop).toHaveBeenCalledTimes(1);
    expect(itemHandlers.onNext).toHaveBeenCalledTimes(1);
    expect(itemHandlers.onPrevious).toHaveBeenCalledTimes(1);
  });

  it("gives the song the title slot and the station the artist slot", () => {
    // What a car, lock screen or Android Auto renders: the station alone
    // would show the same line twice and never name the track.
    const { seen, actions } = installSession();
    const itemHandlers = handlers();
    const item = station({ name: "Session FM", tags: "rock", favicon: "" });
    updateMediaSession(item, itemHandlers, "Wanderer - Song Two");
    expect(seen.title).toBe("Wanderer - Song Two");
    expect(seen.artist).toBe("Session FM");
    expect(seen.album).toBe("RadioScout");
    // Transport survives a title republish — the dock and the car share one.
    actions.get("pause")?.();
    expect(itemHandlers.onPause).toHaveBeenCalledTimes(1);
  });
});

describe("favouriteLoopTarget", () => {
  const uuids = ["a", "b", "c"];

  it("steps forward and back through Saved order, wrapping both ends", () => {
    expect(favouriteLoopTarget("a", uuids, 1)).toBe("b");
    expect(favouriteLoopTarget("c", uuids, 1)).toBe("a");
    expect(favouriteLoopTarget("a", uuids, -1)).toBe("c");
    expect(favouriteLoopTarget("c", uuids, -1)).toBe("b");
  });

  it("stays silent with fewer than two saved", () => {
    expect(favouriteLoopTarget("a", ["a"], 1)).toBeNull();
    expect(favouriteLoopTarget(null, [], 1)).toBeNull();
  });

  it("starts at the head from idle or from outside Saved", () => {
    expect(favouriteLoopTarget(null, uuids, 1)).toBe("a");
    expect(favouriteLoopTarget(null, uuids, -1)).toBe("a");
    expect(favouriteLoopTarget("elsewhere", uuids, 1)).toBe("a");
  });
});

describe("buildSkipPlaylist", () => {
  it("keeps full Saved order with the current station at its index", () => {
    const rows = [playlistRow("a", "A FM"), playlistRow("b", "B FM"), playlistRow("c", "C FM")];
    const { items, index } = buildSkipPlaylist(rows[1].snapshot, "https://fresh-b.fm/live", rows);
    expect(items.map((item) => item.stationuuid)).toEqual(["a", "b", "c"]);
    expect(index).toBe(1);
    // The resolving station carries its fresh URL and display fields.
    expect(items[1]).toMatchObject({ url: "https://fresh-b.fm/live", title: "B FM" });
    expect(items[0]).toMatchObject({ stationuuid: "a", title: "A FM" });
  });

  it("prepends a current station played from outside Saved", () => {
    const rows = [playlistRow("a", "A FM"), playlistRow("b", "B FM")];
    const outsider = station({ stationuuid: "z", name: "Z FM", url: "https://z.fm/s" });
    const { items, index } = buildSkipPlaylist(outsider, "https://z.fm/s", rows);
    expect(items.map((item) => item.stationuuid)).toEqual(["z", "a", "b"]);
    expect(index).toBe(0);
  });

  it("yields the lone audible item when nothing is saved", () => {
    const solo = station({ stationuuid: "z", name: "Z FM", url: "https://z.fm/s" });
    const { items, index } = buildSkipPlaylist(solo, "https://z.fm/s", []);
    expect(items).toHaveLength(1);
    expect(index).toBe(0);
  });

  it("maps rows to entries without network", () => {
    const items = playlistItems([playlistRow("a", "A FM", "http://a.fm/s")]);
    expect(items).toHaveLength(1);
    // Directory URL as stored — the service resolves nothing itself.
    expect(items[0]).toMatchObject({ stationuuid: "a", url: "http://a.fm/s", title: "A FM" });
  });
});

function playlistRow(
  uuid: string,
  name: string,
  url = `https://${uuid}.fm/stream`,
): {
  stationuuid: string;
  snapshot: Station;
} {
  return { stationuuid: uuid, snapshot: station({ stationuuid: uuid, name, url, url_resolved: url }) };
}
