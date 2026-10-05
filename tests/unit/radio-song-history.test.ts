import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { collectRadioBackup, restoreRadioBackup } from "@/lib/radio/backup";
import {
  clearHistory,
  clearStationTracks,
  listLatestTracks,
  listRecentTracks,
  logPlay,
  logTrack,
  RadioDB,
  TRACKS_KEY,
} from "@/lib/radio/store";
import { normaliseTrackTitle } from "@/lib/radio/titles";
import { EMPTY_STATION } from "@/lib/radio/types";

let counter = 0;
let database = new RadioDB(`radioscout-song-history-test-${counter}`);

function freshDatabase(): RadioDB {
  counter += 1;
  database = new RadioDB(`radioscout-song-history-test-${counter}`);
  return database;
}

afterEach(async () => {
  await database.delete();
});

const STATION = { ...EMPTY_STATION, stationuuid: "song-fm", name: "Song FM", url: "https://example.com/song.mp3" };

describe("song history", () => {
  it("lists heard titles newest first, per station only", async () => {
    const target = freshDatabase();
    await logTrack({ stationuuid: "song-fm", title: "First", kind: "icy" }, target);
    await logTrack({ stationuuid: "other", title: "Elsewhere", kind: "icy" }, target);
    await logTrack({ stationuuid: "song-fm", title: "Second", kind: "track" }, target);
    const rows = await listRecentTracks("song-fm", 8, target);
    expect(rows.map((row) => row.title)).toEqual(["Second", "First"]);
    expect(rows[0]?.kind).toBe("track");
  });

  it("respects the limit", async () => {
    const target = freshDatabase();
    await logTrack({ stationuuid: "song-fm", title: "One", kind: "icy" }, target);
    await logTrack({ stationuuid: "song-fm", title: "Two", kind: "icy" }, target);
    await logTrack({ stationuuid: "song-fm", title: "Three", kind: "icy" }, target);
    const rows = await listRecentTracks("song-fm", 2, target);
    expect(rows.map((row) => row.title)).toEqual(["Three", "Two"]);
  });

  it("caps each station at the newest fifty", async () => {
    const target = freshDatabase();
    for (let index = 0; index < 55; index += 1) {
      await logTrack({ stationuuid: "song-fm", title: `Song ${index}`, kind: "icy" }, target);
    }
    const rows = await listRecentTracks("song-fm", 60, target);
    expect(rows).toHaveLength(50);
    expect(rows[0]?.title).toBe("Song 54");
    expect(rows[49]?.title).toBe("Song 5");
  });

  it("clears with the recently played list", async () => {
    const target = freshDatabase();
    await logPlay(STATION, target);
    await logTrack({ stationuuid: "song-fm", title: "Heard", kind: "icy" }, target);
    await clearHistory(target);
    expect(await listRecentTracks("song-fm", 8, target)).toEqual([]);
  });

  it("shares the radio tracks query-key base", () => {
    expect(TRACKS_KEY).toEqual(["radio", "tracks"]);
  });
});

// Node has no DOM storage — stub the globals the backup restore touches.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- mutable record view of a global for stub install/restore
const globalScope = globalThis as unknown as { window?: unknown; localStorage?: Storage };
const backing = new Map<string, string>();

function installStorageStub(): void {
  backing.clear();
  globalScope.window = globalThis;
  globalScope.localStorage = {
    getItem: (key: string) => backing.get(key) ?? null,
    setItem: (key: string, value: string) => {
      backing.set(key, value);
    },
    removeItem: (key: string) => {
      backing.delete(key);
    },
    clear: () => {
      backing.clear();
    },
    get length() {
      return backing.size;
    },
    key: (index: number) => [...backing.keys()][index] ?? null,
  };
}

function uninstallStorageStub(): void {
  delete globalScope.window;
  delete globalScope.localStorage;
}

describe("song history backup (v7)", () => {
  it("round-trips banked tracks", async () => {
    installStorageStub();
    try {
      const source = freshDatabase();
      await logTrack({ stationuuid: "song-fm", title: "Heard Song", kind: "track" }, source);
      const payload = await collectRadioBackup(source);
      expect(payload.tracks.map((row) => row.title)).toEqual(["Heard Song"]);
      const target = freshDatabase();
      await restoreRadioBackup(payload, target);
      const rows = await listRecentTracks("song-fm", 8, target);
      expect(rows.map((row) => row.title)).toEqual(["Heard Song"]);
      expect(rows[0]?.kind).toBe("track");
    } finally {
      uninstallStorageStub();
    }
  });

  it("restores v6 backups without tracks as empty", async () => {
    installStorageStub();
    try {
      const source = freshDatabase();
      const payload = await collectRadioBackup(source);
      const { tracks: _dropped, ...v6 } = payload;
      const target = freshDatabase();
      await restoreRadioBackup({ ...v6, version: 6 }, target);
      expect(await listRecentTracks("song-fm", 8, target)).toEqual([]);
    } finally {
      uninstallStorageStub();
    }
  });
});

describe("normaliseTrackTitle", () => {
  it("trims and collapses padding variants to one form", () => {
    expect(normaliseTrackTitle("Song")).toBe("Song");
    expect(normaliseTrackTitle("  Song  ")).toBe("Song");
    expect(normaliseTrackTitle("Somebody   That I Used\r\nTo Know")).toBe("Somebody That I Used To Know");
    expect(normaliseTrackTitle("   ")).toBe("");
  });
});

describe("song history duplicates", () => {
  it("drops a repeat of the latest banked title but keeps returning songs", async () => {
    const target = freshDatabase();
    await logTrack({ stationuuid: "song-fm", title: "A", kind: "icy" }, target);
    await logTrack({ stationuuid: "song-fm", title: "A", kind: "icy" }, target);
    expect(await listRecentTracks("song-fm", 8, target)).toHaveLength(1);
    await logTrack({ stationuuid: "song-fm", title: "B", kind: "icy" }, target);
    await logTrack({ stationuuid: "song-fm", title: "A", kind: "icy" }, target);
    expect((await listRecentTracks("song-fm", 8, target)).map((row) => row.title)).toEqual(["A", "B", "A"]);
  });

  it("reads legacy padding variants as one row", async () => {
    const target = freshDatabase();
    await target.tracks.add({
      stationuuid: "song-fm",
      title: "Heard Song",
      kind: "icy",
      played_at: "2026-10-05T10:00:00.000Z",
    });
    await target.tracks.add({
      stationuuid: "song-fm",
      title: "Heard Song ",
      kind: "icy",
      played_at: "2026-10-05T10:01:00.000Z",
    });
    await target.tracks.add({
      stationuuid: "song-fm",
      title: "Heard  Song",
      kind: "icy",
      played_at: "2026-10-05T10:02:00.000Z",
    });
    const rows = await listRecentTracks("song-fm", 8, target);
    expect(rows.map((row) => row.title)).toEqual(["Heard  Song"]);
  });
});

describe("song history rollup and per-station clear", () => {
  it("returns the newest title per station", async () => {
    const target = freshDatabase();
    await logTrack({ stationuuid: "song-fm", title: "First", kind: "icy" }, target);
    await logTrack({ stationuuid: "other", title: "Elsewhere", kind: "track" }, target);
    await logTrack({ stationuuid: "song-fm", title: "Second", kind: "icy" }, target);
    const latest = await listLatestTracks(["song-fm", "other", "missing"], target);
    expect(latest.get("song-fm")?.title).toBe("Second");
    expect(latest.get("other")?.title).toBe("Elsewhere");
    expect(latest.has("missing")).toBe(false);
    expect(await listLatestTracks([], target)).toEqual(new Map());
  });

  it("clears one station while leaving the other", async () => {
    const target = freshDatabase();
    await logTrack({ stationuuid: "song-fm", title: "Kept Song", kind: "icy" }, target);
    await logTrack({ stationuuid: "other", title: "Gone Song", kind: "icy" }, target);
    await clearStationTracks("other", target);
    expect((await listRecentTracks("song-fm", 8, target)).map((row) => row.title)).toEqual(["Kept Song"]);
    expect(await listRecentTracks("other", 8, target)).toEqual([]);
  });
});
