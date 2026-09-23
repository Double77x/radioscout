import Dexie, { type EntityTable } from "dexie";
import { formatDayOrdinal } from "./format";
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

/** One calendar date in the recent-activity strip (local time). */
export interface DateBucket {
  /** Local `YYYY-M-D` key (no padding — map key only). */
  date: string;
  /** Ordinal day-of-month label ("22nd") — the column caption, first line. */
  label: string;
  /** Month short ("Sep") — the column caption, second line. */
  month: string;
  /** Weekday label ("Mon") — for titles, Monday first. */
  weekday: string;
  seconds: number;
  plays: number;
}

/** Six-hour daypart bucket for the rhythm chart (local time). */
export interface DaypartBucket {
  id: string;
  label: string;
  /** Clock range caption ("6am–12pm"). */
  range: string;
  seconds: number;
  plays: number;
}

/** One calendar week in the weekly strip (local time, Monday first). */
export interface WeekBucket {
  /** Local `YYYY-M-D` key of the Monday (map key only). */
  start: string;
  /** Ordinal Monday label ("22nd") — the column caption, first line. */
  label: string;
  /** Monday's month short ("Sep") — the column caption, second line. */
  month: string;
  /** Week range caption ("22nd – 28th Sep") — for titles. */
  range: string;
  seconds: number;
  plays: number;
}

/** Consecutive active-day runs (local calendar dates). */
export interface Streak {
  /** Run ending today — or yesterday when today is still quiet. */
  current: number;
  /** Longest run across all history. */
  longest: number;
}

/** Best single calendar date across all history. */
export interface BestDay {
  /** Local `YYYY-M-D` key (map key only). */
  date: string;
  /** Ordinal day-of-month label ("22nd"). */
  label: string;
  /** Month short ("Sep"). */
  month: string;
  /** Weekday label ("Mon"). */
  weekday: string;
  seconds: number;
  plays: number;
}

export interface ListeningSummary {
  totalSeconds: number;
  /** Sessions recorded (after the short-tap threshold — see use-player). */
  plays: number;
  /** Every station with time banked, most-listened first. */
  stations: ListeningStation[];
  /** Seven buckets, Monday first (zeros included so the chart never shifts). */
  byDay: DayBucket[];
  /** Last 14 days, oldest first, today last (zeros included). */
  byRecent: DateBucket[];
  /** Last 12 weeks, oldest first, current week last (zeros included). */
  byWeek: WeekBucket[];
  /** Four six-hour blocks: Night, Morning, Afternoon, Evening. */
  byPart: DaypartBucket[];
  streak: Streak;
  /** Best single date, or null when nothing is banked yet. */
  bestDay: BestDay | null;
  /** Longest single session banked. */
  longestSession: number;
}

/** Weekday labels, Monday first (matches `(getDay() + 6) % 7`). */
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Recent-activity window (days, today included). */
export const RECENT_DAYS = 14;

/** Weekly-strip window (weeks, current week included). */
export const RECENT_WEEKS = 12;

/** Six-hour dayparts: even clock blocks, local time. */
const DAYPART_DEFS = [
  { id: "night", label: "Night", range: "12–6am" },
  { id: "morning", label: "Morning", range: "6am–12pm" },
  { id: "afternoon", label: "Afternoon", range: "12–6pm" },
  { id: "evening", label: "Evening", range: "6pm–12am" },
] as const;

/** Local calendar key: `2026-8-21` (no padding — map key only). */
function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Short month labels for week-range captions. */
const MONTH_SHORTS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** Midnight local time at the start of the date's week (Monday first). */
function mondayOf(date: Date): Date {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return day;
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

/** Aggregate sessions per station/day/date/week/daypart for the charts (latest name wins). */
export async function summarizeListening(
  database: RadioDB = radioDb,
  now: Date = new Date(),
): Promise<ListeningSummary> {
  const rows = await database.listening.toArray();
  const byStation = new Map<string, { name: string; started_at: string; seconds: number; plays: number }>();
  const byDay: DayBucket[] = DAY_LABELS.map((label, day) => ({ day, label, seconds: 0, plays: 0, days: 0 }));
  const seenDates = new Map<number, Set<string>>();
  // Recent strip: last 14 local dates, oldest first, today last.
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const byRecent: DateBucket[] = Array.from({ length: RECENT_DAYS }, (_, offset) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (RECENT_DAYS - 1 - offset));
    return {
      date: localDateKey(date),
      label: formatDayOrdinal(date.getDate()),
      month: MONTH_SHORTS[date.getMonth()] ?? "",
      weekday: DAY_LABELS[(date.getDay() + 6) % 7] ?? "",
      seconds: 0,
      plays: 0,
    };
  });
  const recentIndex = new Map(byRecent.map((bucket, index) => [bucket.date, index]));
  // Weekly strip: last 12 local weeks (Monday first), oldest first.
  const thisMonday = mondayOf(now);
  const byWeek: WeekBucket[] = Array.from({ length: RECENT_WEEKS }, (_, offset) => {
    const start = new Date(thisMonday);
    start.setDate(thisMonday.getDate() - 7 * (RECENT_WEEKS - 1 - offset));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const sameMonth = start.getMonth() === end.getMonth();
    const startLabel = `${formatDayOrdinal(start.getDate())}${sameMonth ? "" : ` ${MONTH_SHORTS[start.getMonth()] ?? ""}`}`;
    const range = `${startLabel} – ${formatDayOrdinal(end.getDate())} ${MONTH_SHORTS[end.getMonth()] ?? ""}`;
    return {
      start: localDateKey(start),
      label: formatDayOrdinal(start.getDate()),
      month: MONTH_SHORTS[start.getMonth()] ?? "",
      range,
      seconds: 0,
      plays: 0,
    };
  });
  const weekIndex = new Map(byWeek.map((bucket, index) => [bucket.start, index]));
  const byPart: DaypartBucket[] = DAYPART_DEFS.map((def) => ({ ...def, seconds: 0, plays: 0 }));
  // All-history per-date totals back the streak and best-day records.
  const perDate = new Map<string, { midnight: number; seconds: number; plays: number }>();
  let totalSeconds = 0;
  let longestSession = 0;
  for (const row of rows) {
    totalSeconds += row.seconds;
    if (row.seconds > longestSession) longestSession = row.seconds;
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
      const key = localDateKey(started);
      let dates = seenDates.get(weekday);
      if (!dates) {
        dates = new Set<string>();
        seenDates.set(weekday, dates);
      }
      dates.add(key);
      bucket.days = dates.size;
    }
    const recent = recentIndex.get(localDateKey(started));
    if (recent !== undefined) {
      const day = byRecent[recent];
      if (day) {
        day.seconds += row.seconds;
        day.plays += 1;
      }
    }
    const week = weekIndex.get(localDateKey(mondayOf(started)));
    if (week !== undefined) {
      const span = byWeek[week];
      if (span) {
        span.seconds += row.seconds;
        span.plays += 1;
      }
    }
    const midnight = new Date(started);
    midnight.setHours(0, 0, 0, 0);
    const dateKey = localDateKey(started);
    const day = perDate.get(dateKey);
    if (day) {
      day.seconds += row.seconds;
      day.plays += 1;
    } else {
      perDate.set(dateKey, { midnight: midnight.getTime(), seconds: row.seconds, plays: 1 });
    }
    const hour = started.getHours();
    const part = hour < 6 ? byPart[0] : hour < 12 ? byPart[1] : hour < 18 ? byPart[2] : byPart[3];
    if (part) {
      part.seconds += row.seconds;
      part.plays += 1;
    }
  }
  const stations: ListeningStation[] = [...byStation.entries()].map(([stationuuid, entry]) => ({
    stationuuid,
    name: entry.name,
    seconds: entry.seconds,
    plays: entry.plays,
  }));
  stations.sort((a, b) => b.seconds - a.seconds);
  // Streaks run on distinct active dates: the current run stays alive when
  // today is still quiet but yesterday played.
  const active = new Set(perDate.keys());
  const dayMs = 24 * 60 * 60 * 1000;
  const cursor = new Date(today);
  if (!active.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let current = 0;
  while (active.has(localDateKey(cursor))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  const midnights = [...perDate.values()].map((entry) => entry.midnight).toSorted((a, b) => a - b);
  let longest = 0;
  let run = 0;
  let previous: number | null = null;
  for (const midnight of midnights) {
    run = previous !== null && Math.round((midnight - previous) / dayMs) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
    previous = midnight;
  }
  let bestDay: BestDay | null = null;
  for (const [date, entry] of perDate) {
    if (bestDay === null || entry.seconds > bestDay.seconds) {
      const day = new Date(entry.midnight);
      bestDay = {
        date,
        label: formatDayOrdinal(day.getDate()),
        month: MONTH_SHORTS[day.getMonth()] ?? "",
        weekday: DAY_LABELS[(day.getDay() + 6) % 7] ?? "",
        seconds: entry.seconds,
        plays: entry.plays,
      };
    }
  }
  return {
    totalSeconds,
    plays: rows.length,
    stations,
    byDay,
    byRecent,
    byWeek,
    byPart,
    streak: { current, longest },
    bestDay,
    longestSession,
  };
}

export function clearListening(database: RadioDB = radioDb): Promise<void> {
  return database.listening.clear();
}
