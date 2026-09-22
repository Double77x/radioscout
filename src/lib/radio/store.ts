import Dexie, { type EntityTable } from "dexie";
import { splitQualityFromName, withStationDefaults, type Station } from "./types";

const HISTORY_LIMIT = 50;
const FAVOURITE_LIMIT = 500;
/** Completed listening sessions — enough for years of top-station charts. */
const LISTENING_LIMIT = 1000;

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
 * One completed listening session. Slim on purpose (no full snapshot) —
 * names refresh from the latest session, so renamed stations relabel
 * themselves in the charts.
 */
export interface ListeningRow {
  id?: number;
  stationuuid: string;
  name: string;
  started_at: string;
  /** Whole seconds actually audible (`playing` → pause/stop/switch/error). */
  seconds: number;
}

export interface ListeningStation {
  stationuuid: string;
  name: string;
  seconds: number;
  plays: number;
}

/** Monday-first weekday bucket for the daily-average chart. */
export interface DayBucket {
  /** 0 = Monday … 6 = Sunday. */
  day: number;
  label: string;
  seconds: number;
  plays: number;
  /** Distinct calendar dates behind the bucket (local time). */
  days: number;
}

export interface ListeningSummary {
  totalSeconds: number;
  /** Sessions recorded (after the short-tap threshold — see use-player). */
  plays: number;
  /** Every station with time banked, most-listened first. */
  stations: ListeningStation[];
  /** Seven buckets, Monday first (zeros included so the chart never shifts). */
  byDay: DayBucket[];
}

/** Weekday labels, Monday first (matches `(getDay() + 6) % 7`). */
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/**
 * Isolated radio database — deliberately NOT part of ScoutDB, so the
 * household sync engine never sees favourites/history and version bumps
 * here can't disturb scout data. Local-only, like RadioDroid's
 * `StationSaveManager` JSON files.
 */
export class RadioDB extends Dexie {
  favourites!: EntityTable<FavouriteRow, "stationuuid">;
  history!: EntityTable<HistoryRow, "id">;
  listening!: EntityTable<ListeningRow, "id">;

  constructor(name = "scout-radio") {
    super(name);
    this.version(1).stores({
      favourites: "stationuuid",
      history: "++id, stationuuid",
    });
    this.version(2).stores({
      favourites: "stationuuid",
      history: "++id, stationuuid",
      listening: "++id, stationuuid, started_at",
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

/**
 * Bank one completed session. Callers enforce the audibility threshold
 * (short taps never reach here) — the store just appends and caps.
 */
export async function logListening(row: Omit<ListeningRow, "id">, database: RadioDB = radioDb): Promise<void> {
  await database.listening.add(row);
  const count = await database.listening.count();
  if (count > LISTENING_LIMIT) {
    const oldest = await database.listening
      .orderBy("id")
      .limit(count - LISTENING_LIMIT)
      .primaryKeys();
    await database.listening.bulkDelete(oldest);
  }
}

/** Aggregate sessions per station/day/genre for the charts (latest name wins). */
export async function summarizeListening(database: RadioDB = radioDb): Promise<ListeningSummary> {
  const rows = await database.listening.toArray();
  const byStation = new Map<string, { name: string; started_at: string; seconds: number; plays: number }>();
  const byDay: DayBucket[] = DAY_LABELS.map((label, day) => ({ day, label, seconds: 0, plays: 0, days: 0 }));
  const seenDates = new Map<number, Set<string>>();
  let totalSeconds = 0;
  for (const row of rows) {
    totalSeconds += row.seconds;
    const current = byStation.get(row.stationuuid);
    if (current) {
      current.seconds += row.seconds;
      current.plays += 1;
      if (row.started_at > current.started_at) {
        current.name = row.name;
        current.started_at = row.started_at;
      }
    } else {
      byStation.set(row.stationuuid, { name: row.name, started_at: row.started_at, seconds: row.seconds, plays: 1 });
    }
    const started = new Date(row.started_at);
    const weekday = (started.getDay() + 6) % 7;
    const bucket = byDay[weekday];
    if (bucket) {
      bucket.seconds += row.seconds;
      bucket.plays += 1;
      // Distinct local dates: two Mondays average against each other.
      const key = `${started.getFullYear()}-${started.getMonth()}-${started.getDate()}`;
      let dates = seenDates.get(weekday);
      if (!dates) {
        dates = new Set<string>();
        seenDates.set(weekday, dates);
      }
      dates.add(key);
      bucket.days = dates.size;
    }
  }
  const stations: ListeningStation[] = [...byStation.entries()].map(([stationuuid, entry]) => ({
    stationuuid,
    name: entry.name,
    seconds: entry.seconds,
    plays: entry.plays,
  }));
  stations.sort((a, b) => b.seconds - a.seconds);
  return { totalSeconds, plays: rows.length, stations, byDay };
}

export function clearListening(database: RadioDB = radioDb): Promise<void> {
  return database.listening.clear();
}
