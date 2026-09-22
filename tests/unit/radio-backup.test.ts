import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { collectRadioBackup, radioBackupFilename, restoreRadioBackup, RADIO_BACKUP_VERSION } from "@/lib/radio/backup";
import { RadioDB, toggleFavourite } from "@/lib/radio/store";
import { EMPTY_STATION } from "@/lib/radio/types";

let counter = 0;
let database = new RadioDB(`radioscout-backup-test-${counter}`);

/**
 * Node has no DOM storage — stub the two globals the radio state touches.
 * Seeded with the app defaults so untouched prefs read exactly as in prod.
 */
const globalScope = globalThis as unknown as { window?: unknown; localStorage?: Storage };
const backing = new Map<string, string>();

function installStorageStub(): void {
  backing.clear();
  backing.set("radioscout:volume", "0.9");
  backing.set("radioscout:muted", "0");
  globalScope.window = globalThis;
  globalScope.localStorage = {
    getItem: (key: string) => backing.get(key) ?? null,
    setItem: (key: string, value: string) => {
      backing.set(key, value);
    },
    removeItem: (key: string) => {
      backing.delete(key);
    },
    clear: () => backing.clear(),
    get length() {
      return backing.size;
    },
    key: (index: number) => [...backing.keys()][index] ?? null,
  } as Storage;
}

function uninstallStorageStub(): void {
  delete globalScope.window;
  delete globalScope.localStorage;
}

function freshDatabase(): RadioDB {
  counter += 1;
  database = new RadioDB(`radioscout-backup-test-${counter}`);
  return database;
}

afterEach(async () => {
  await database.delete();
  uninstallStorageStub();
});

beforeEach(() => {
  installStorageStub();
});

const STATION = {
  ...EMPTY_STATION,
  stationuuid: "backup-1",
  name: "Backup FM",
  url: "https://example.com/backup.mp3",
};

describe("radio backup", () => {
  it("names files by date", () => {
    expect(radioBackupFilename(new Date("2026-09-20T12:00:00Z"))).toBe("radioscout-backup-2026-09-20.json");
  });

  it("round-trips favourites, prefs, votes, languages and quality", async () => {
    const source = freshDatabase();
    await toggleFavourite(STATION, source);
    const { writeMinBitrate } = await import("@/lib/radio/quality");
    writeMinBitrate(128);
    const payload = await collectRadioBackup(source);
    expect(payload.app).toBe("radioscout");
    expect(payload.version).toBe(RADIO_BACKUP_VERSION);
    expect(payload.favourites).toHaveLength(1);
    expect(payload.languages).toEqual([]);
    expect(payload.quality).toBe(128);
    expect(payload.listening).toEqual([]);

    const target = freshDatabase();
    const prefs = await restoreRadioBackup(structuredClone({ ...payload, languages: ["english", "German "] }), target);
    expect(prefs.volume).toBeGreaterThan(0);
    const rows = await target.favourites.toArray();
    expect(rows.map((row) => row.stationuuid)).toEqual(["backup-1"]);
    expect(rows[0]?.snapshot.name).toBe("Backup FM");
    const { readLanguages } = await import("@/lib/radio/languages");
    expect(readLanguages()).toEqual(["english", "german"]);
    const { readMinBitrate } = await import("@/lib/radio/quality");
    expect(readMinBitrate()).toBe(128);
  });

  it("round-trips listening sessions", async () => {
    const source = freshDatabase();
    const { logListening, summarizeListening } = await import("@/lib/radio/store");
    await logListening(
      { stationuuid: "stats-1", name: "Stats FM", started_at: "2026-09-21T10:00:00.000Z", seconds: 600 },
      source,
    );
    const payload = await collectRadioBackup(source);
    expect(payload.listening).toHaveLength(1);
    expect(payload.listening[0]).toMatchObject({ stationuuid: "stats-1", seconds: 600 });

    const target = freshDatabase();
    await restoreRadioBackup(structuredClone(payload), target);
    const summary = await summarizeListening(target);
    expect(summary.totalSeconds).toBe(600);
    expect(summary.stations.map((station) => station.stationuuid)).toEqual(["stats-1"]);
  });

  it("restores v1 backups without languages as worldwide", async () => {
    const target = freshDatabase();
    const { writeLanguages, readLanguages } = await import("@/lib/radio/languages");
    const { writeMinBitrate, readMinBitrate } = await import("@/lib/radio/quality");
    writeLanguages(["french"]);
    writeMinBitrate(192);
    await restoreRadioBackup(
      {
        app: "radioscout",
        version: 1,
        exportedAt: "",
        favourites: [],
        history: [],
        prefs: { volume: 1, muted: false },
        voted: [],
      },
      target,
    );
    expect(readLanguages()).toEqual([]);
    expect(readMinBitrate()).toBe(0);
    const { summarizeListening } = await import("@/lib/radio/store");
    const summary = await summarizeListening(target);
    expect(summary.totalSeconds).toBe(0);
    expect(summary.plays).toBe(0);
  });

  it("rejects foreign files and newer envelopes", async () => {
    const target = freshDatabase();
    await expect(restoreRadioBackup({ app: "nope" }, target)).rejects.toThrow(/isn't a RadioScout backup/);
    await expect(
      restoreRadioBackup(
        {
          app: "radioscout",
          version: 999,
          exportedAt: "",
          favourites: [],
          history: [],
          prefs: { volume: 1, muted: false },
          voted: [],
        },
        target,
      ),
    ).rejects.toThrow(/newer RadioScout/);
  });
});
