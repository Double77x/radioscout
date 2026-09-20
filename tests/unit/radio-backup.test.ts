import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { collectRadioBackup, radioBackupFilename, restoreRadioBackup, RADIO_BACKUP_VERSION } from "@/lib/radio/backup";
import { RadioDB, toggleFavourite } from "@/lib/radio/store";
import { EMPTY_STATION } from "@/lib/radio/types";

let counter = 0;
let database = new RadioDB(`radioscout-backup-test-${counter}`);

function freshDatabase(): RadioDB {
  counter += 1;
  database = new RadioDB(`radioscout-backup-test-${counter}`);
  return database;
}

afterEach(async () => {
  await database.delete();
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

  it("round-trips favourites, prefs and votes", async () => {
    const source = freshDatabase();
    await toggleFavourite(STATION, source);
    const payload = await collectRadioBackup(source);
    expect(payload.app).toBe("radioscout");
    expect(payload.version).toBe(RADIO_BACKUP_VERSION);
    expect(payload.favourites).toHaveLength(1);

    const target = freshDatabase();
    const prefs = await restoreRadioBackup(structuredClone(payload), target);
    expect(prefs.volume).toBeGreaterThan(0);
    const rows = await target.favourites.toArray();
    expect(rows.map((row) => row.stationuuid)).toEqual(["backup-1"]);
    expect(rows[0]?.snapshot.name).toBe("Backup FM");
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
