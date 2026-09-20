import Dexie, { type EntityTable } from "dexie";
import { splitQualityFromName, withStationDefaults, type Station } from "./types";

const HISTORY_LIMIT = 50;
const FAVOURITE_LIMIT = 500;

export interface FavouriteRow {
  stationuuid: string;
  snapshot: Station;
  saved_at: string;
  /** Manual order (Saved list drag-reorder). Backfilled from save time. */
  sort: number;
}

export interface HistoryRow {
  id?: number;
  stationuuid: string;
  snapshot: Station;
  played_at: string;
}

/**
 * Isolated radio database — deliberately NOT part of ScoutDB, so the
 * household sync engine never sees favourites/history and version bumps
 * here can't disturb scout data. Local-only, like RadioDroid's
 * `StationSaveManager` JSON files.
 */
export class RadioDB extends Dexie {
  favourites!: EntityTable<FavouriteRow, "stationuuid">;
  history!: EntityTable<HistoryRow, "id">;

  constructor(name = "scout-radio") {
    super(name);
    this.version(1).stores({
      favourites: "stationuuid",
      history: "++id, stationuuid",
    });
  }
}

export const radioDb = new RadioDB();

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Heal snapshots saved before the title parser existed ("BBC Radio 1
 * (128k)", codec "UNKNOWN"): clean the title, backfill bitrate/codec
 * from it, and blank UNKNOWN codecs so rows render nothing instead.
 */
function healSnapshot(snapshot: Station): { healed: Station; changed: boolean } {
  const whole = withStationDefaults(snapshot);
  const quality = splitQualityFromName(whole.name);
  const codec = /^unknown$/i.test(whole.codec) ? "" : whole.codec;
  const healed: Station = {
    ...whole,
    name: quality.name,
    bitrate: whole.bitrate > 0 ? whole.bitrate : quality.bitrate,
    codec: codec === "" ? quality.codec : codec,
  };
  const changed =
    healed.name !== snapshot.name ||
    healed.bitrate !== snapshot.bitrate ||
    healed.codec !== snapshot.codec ||
    healed.geo_lat !== snapshot.geo_lat;
  return { healed, changed };
}

export async function listFavourites(database: RadioDB = radioDb): Promise<FavouriteRow[]> {
  const rows = await database.favourites.toArray();
  // Heal pre-parser snapshots once, then persist the cleaned rows.
  let dirty = false;
  const whole = rows.map((row) => {
    const { healed, changed } = healSnapshot(row.snapshot);
    if (changed) dirty = true;
    return { ...row, snapshot: healed };
  });
  // Backfill sort once for pre-reorder rows (newest first, matching old display).
  const missing = whole.filter((row) => row.sort === undefined);
  if (missing.length > 0) {
    const bySaved = whole.toSorted((a, b) => b.saved_at.localeCompare(a.saved_at));
    const rank = new Map(bySaved.map((row, index) => [row.stationuuid, index]));
    const ranked = whole.map((row) => ({ ...row, sort: rank.get(row.stationuuid) ?? 0 }));
    await database.favourites.bulkPut(ranked);
    return ranked.toSorted((a, b) => a.sort - b.sort);
  }
  if (dirty) {
    await database.favourites.bulkPut(whole);
  }
  return whole.toSorted((a, b) => a.sort - b.sort);
}

export async function isFavourite(stationuuid: string, database: RadioDB = radioDb): Promise<boolean> {
  return (await database.favourites.get(stationuuid)) !== undefined;
}

/** Toggle; returns true when the station is now a favourite. */
export async function toggleFavourite(station: Station, database: RadioDB = radioDb): Promise<boolean> {
  const existing = await database.favourites.get(station.stationuuid);
  if (existing) {
    await database.favourites.delete(station.stationuuid);
    return false;
  }
  const rows = await database.favourites.toArray();
  const minSort = rows.reduce((min, row) => Math.min(min, row.sort ?? 0), 0);
  await database.favourites.put({
    stationuuid: station.stationuuid,
    snapshot: station,
    saved_at: nowIso(),
    sort: minSort - 1,
  });
  const count = await database.favourites.count();
  if (count > FAVOURITE_LIMIT) {
    const oldest = await database.favourites
      .orderBy("saved_at")
      .limit(count - FAVOURITE_LIMIT)
      .primaryKeys();
    await database.favourites.bulkDelete(oldest);
  }
  return true;
}

/** Persist a drag-reordered uuid sequence (Saved list). Unknown ids are ignored. */
export async function reorderFavourites(uuids: string[], database: RadioDB = radioDb): Promise<void> {
  await database.transaction("rw", database.favourites, async () => {
    await Promise.all(
      uuids.map((uuid, index) =>
        database.favourites
          .where("stationuuid")
          .equals(uuid)
          .modify({ sort: index })
          .catch(() => {}),
      ),
    );
  });
}

/** Append a play; capped so history can't grow without bound. */
export async function logPlay(station: Station, database: RadioDB = radioDb): Promise<void> {
  await database.history.add({ stationuuid: station.stationuuid, snapshot: station, played_at: nowIso() });
  const count = await database.history.count();
  if (count > HISTORY_LIMIT) {
    const oldest = await database.history
      .orderBy("id")
      .limit(count - HISTORY_LIMIT)
      .primaryKeys();
    await database.history.bulkDelete(oldest);
  }
}

export function listHistory(database: RadioDB = radioDb): Promise<HistoryRow[]> {
  return database.history
    .toArray()
    .then((rows) => rows.toSorted((a, b) => b.played_at.localeCompare(a.played_at)))
    .then((rows) => {
      // One entry per station (latest play wins) — repeats collapse.
      // Snapshots also heal pre-parser titles/codecs (not persisted: history
      // is append-only, favourites persist via listFavourites).
      const seen = new Set<string>();
      const unique: typeof rows = [];
      for (const row of rows) {
        if (seen.has(row.stationuuid)) continue;
        seen.add(row.stationuuid);
        unique.push({ ...row, snapshot: healSnapshot(row.snapshot).healed });
      }
      return unique;
    });
}

export async function clearHistory(database: RadioDB = radioDb): Promise<void> {
  await database.history.clear();
}
