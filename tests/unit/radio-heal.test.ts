import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { listFavourites, RadioDB } from "@/lib/radio/store";
import { EMPTY_STATION } from "@/lib/radio/types";

let counter = 0;
let sharedDatabase = new RadioDB(`radioscout-heal-test-${counter}`);

function freshDatabase(): RadioDB {
  counter += 1;
  sharedDatabase = new RadioDB(`radioscout-heal-test-${counter}`);
  return sharedDatabase;
}

afterEach(async () => {
  await sharedDatabase.delete();
});

describe("listFavourites healing", () => {
  it("cleans pre-parser snapshots and persists the fix", async () => {
    const database = freshDatabase();
    await database.favourites.put({
      stationuuid: "bbc-1",
      snapshot: { ...EMPTY_STATION, stationuuid: "bbc-1", name: "BBC Radio 1 (128k)", bitrate: 0, codec: "UNKNOWN" },
      saved_at: "2026-01-01T00:00:00.000Z",
      sort: 0,
    });

    const [row] = await listFavourites(database);
    expect(row?.snapshot.name).toBe("BBC Radio 1");
    expect(row?.snapshot.bitrate).toBe(128);
    expect(row?.snapshot.codec).toBe("");

    const raw = await database.favourites.get("bbc-1");
    expect(raw?.snapshot.name).toBe("BBC Radio 1");
    expect(raw?.snapshot.codec).toBe("");
  });
});
