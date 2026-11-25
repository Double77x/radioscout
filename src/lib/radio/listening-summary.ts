import { formatDayOrdinal } from "./format";
import type {
  BestDay,
  DateBucket,
  DayBucket,
  DaypartBucket,
  ListeningDayRow,
  ListeningRow,
  ListeningStation,
  ListeningSummary,
  WeekBucket,
} from "./store";

/**
 * Pure listening aggregation for the stats views.
 *
 * Sessions are folded into one row per (station, local date) as they are
 * banked, and the charts read those rollups — a decade of listening stays a
 * few thousand rows, so a summary never scans the session log. The Dexie
 * wrapper in `store.ts` keeps the read; `summarizeListeningRows` keeps the
 * row-in reference path for rebuilds and tests.
 */

/** Weekday labels, Monday first (matches `(getDay() + 6) % 7`). */
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Recent-activity window (days, today included). */
const RECENT_DAYS = 14;

/** Weekly-strip window (weeks, current week included). */
const RECENT_WEEKS = 12;

/** Six-hour dayparts: even clock blocks, local time. */
const DAYPART_DEFS = [
  { id: "night", label: "Night", range: "12–6am" },
  { id: "morning", label: "Morning", range: "6am–12pm" },
  { id: "afternoon", label: "Afternoon", range: "12–6pm" },
  { id: "evening", label: "Evening", range: "6pm–12am" },
] as const;

/** Short month labels for week-range captions. */
const MONTH_SHORTS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** Local calendar key: `2026-8-21` (no padding — map key only). */
function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Midnight local time at the start of the date's week (Monday first). */
function mondayOf(date: Date): Date {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return day;
}

/** Six-hour daypart slot for a local hour: night, morning, afternoon, evening. */
function daypartIndex(hour: number): number {
  return hour < 6 ? 0 : hour < 12 ? 1 : hour < 18 ? 2 : 3;
}

/** The local date, its midnight and its daypart for a session start. */
export function listeningRowBucket(startedAt: string): { date: string; midnight: number; part: number } {
  const started = new Date(startedAt);
  const midnight = new Date(started);
  midnight.setHours(0, 0, 0, 0);
  return { date: localDateKey(started), midnight: midnight.getTime(), part: daypartIndex(started.getHours()) };
}

/**
 * Fold sessions into one row per (station, local date) — the write model
 * behind the charts. A session crossing midnight counts to its start date.
 */
export function foldListeningRows(rows: readonly ListeningRow[]): ListeningDayRow[] {
  const byKey = new Map<string, ListeningDayRow>();
  for (const row of rows) {
    const { date, midnight, part } = listeningRowBucket(row.started_at);
    const key = `${row.stationuuid}|${date}`;
    const current = byKey.get(key);
    if (!current) {
      const partSeconds = DAYPART_DEFS.map(() => 0);
      const partPlays = DAYPART_DEFS.map(() => 0);
      partSeconds[part] = row.seconds;
      partPlays[part] = 1;
      byKey.set(key, {
        key,
        stationuuid: row.stationuuid,
        name: row.name,
        date,
        midnight,
        seconds: row.seconds,
        plays: 1,
        longest: row.seconds,
        partSeconds,
        partPlays,
        latestAt: row.started_at,
      });
      continue;
    }
    current.seconds += row.seconds;
    current.plays += 1;
    if (row.seconds > current.longest) current.longest = row.seconds;
    current.partSeconds[part] = (current.partSeconds[part] ?? 0) + row.seconds;
    current.partPlays[part] = (current.partPlays[part] ?? 0) + 1;
    if (row.started_at > current.latestAt) {
      current.latestAt = row.started_at;
      current.name = row.name;
    }
  }
  return [...byKey.values()];
}

interface ListeningWindows {
  today: Date;
  byRecent: DateBucket[];
  byWeek: WeekBucket[];
  recentIndex: Map<string, number>;
  weekIndex: Map<string, number>;
}

/** Build the empty date strips and their lookup maps. */
function createListeningWindows(now: Date): ListeningWindows {
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
  return { today, byRecent, byWeek, recentIndex, weekIndex };
}

interface DateTotal {
  midnight: number;
  seconds: number;
  plays: number;
}

/** Run ending today — or yesterday when today is still quiet. */
function computeCurrentStreak(perDate: ReadonlyMap<string, DateTotal>, today: Date): number {
  const active = new Set(perDate.keys());
  const cursor = new Date(today);
  if (!active.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let current = 0;
  while (active.has(localDateKey(cursor))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return current;
}

/** Longest run of consecutive active local dates across all history. */
function computeLongestStreak(perDate: ReadonlyMap<string, DateTotal>): number {
  const dayMs = 24 * 60 * 60 * 1000;
  const midnights = [...perDate.values()].map((entry) => entry.midnight).toSorted((a, b) => a - b);
  let longest = 0;
  let run = 0;
  let previous: number | null = null;
  for (const midnight of midnights) {
    run = previous !== null && Math.round((midnight - previous) / dayMs) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
    previous = midnight;
  }
  return longest;
}

/** Best single date, or null when nothing is banked yet. */
function computeBestDay(perDate: ReadonlyMap<string, DateTotal>): BestDay | null {
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
  return bestDay;
}

/**
 * Aggregate stored day rollups into every listening view. Chronological
 * order keeps station and best-day tie-breaks identical to the row-in
 * reference path (first appearance wins).
 */
export function summarizeListeningDays(days: readonly ListeningDayRow[], now: Date): ListeningSummary {
  const { today, byRecent, byWeek, recentIndex, weekIndex } = createListeningWindows(now);
  const byDay: DayBucket[] = DAY_LABELS.map((label, day) => ({ day, label, seconds: 0, plays: 0, days: 0 }));
  const byPart: DaypartBucket[] = DAYPART_DEFS.map((def) => ({ ...def, seconds: 0, plays: 0 }));
  const perDate = new Map<string, DateTotal>();
  const byStation = new Map<string, { name: string; latestAt: string; seconds: number; plays: number }>();
  const datesByWeekday = new Map<number, Set<string>>();
  let totalSeconds = 0;
  let plays = 0;
  let longestSession = 0;

  for (const day of days.toSorted((a, b) => a.midnight - b.midnight)) {
    totalSeconds += day.seconds;
    plays += day.plays;
    if (day.longest > longestSession) longestSession = day.longest;

    const weekday = (new Date(day.midnight).getDay() + 6) % 7;
    const weekdayBucket = byDay[weekday];
    if (weekdayBucket) {
      weekdayBucket.seconds += day.seconds;
      weekdayBucket.plays += day.plays;
      let dates = datesByWeekday.get(weekday);
      if (!dates) {
        dates = new Set<string>();
        datesByWeekday.set(weekday, dates);
      }
      dates.add(day.date);
    }

    for (let slot = 0; slot < byPart.length; slot += 1) {
      const part = byPart[slot];
      if (!part) continue;
      part.seconds += day.partSeconds[slot] ?? 0;
      part.plays += day.partPlays[slot] ?? 0;
    }

    const date = perDate.get(day.date);
    if (date) {
      date.seconds += day.seconds;
      date.plays += day.plays;
    } else {
      perDate.set(day.date, { midnight: day.midnight, seconds: day.seconds, plays: day.plays });
    }

    const station = byStation.get(day.stationuuid);
    if (station) {
      station.seconds += day.seconds;
      station.plays += day.plays;
      if (day.latestAt > station.latestAt) {
        station.name = day.name;
        station.latestAt = day.latestAt;
      }
    } else {
      byStation.set(day.stationuuid, {
        name: day.name,
        latestAt: day.latestAt,
        seconds: day.seconds,
        plays: day.plays,
      });
    }

    const recent = recentIndex.get(day.date);
    const recentBucket = recent === undefined ? undefined : byRecent[recent];
    if (recentBucket) {
      recentBucket.seconds += day.seconds;
      recentBucket.plays += day.plays;
    }

    const dayStart = new Date(day.midnight);
    const week = weekIndex.get(localDateKey(mondayOf(dayStart)));
    const weekBucket = week === undefined ? undefined : byWeek[week];
    if (weekBucket) {
      weekBucket.seconds += day.seconds;
      weekBucket.plays += day.plays;
    }
  }

  for (const [weekday, dates] of datesByWeekday) {
    const bucket = byDay[weekday];
    if (bucket) bucket.days = dates.size;
  }

  const stations: ListeningStation[] = [...byStation.entries()].map(([stationuuid, entry]) => ({
    stationuuid,
    name: entry.name,
    seconds: entry.seconds,
    plays: entry.plays,
  }));
  stations.sort((a, b) => b.seconds - a.seconds);

  return {
    totalSeconds,
    plays,
    stations,
    byDay,
    byRecent,
    byWeek,
    byPart,
    streak: { current: computeCurrentStreak(perDate, today), longest: computeLongestStreak(perDate) },
    bestDay: computeBestDay(perDate),
    longestSession,
  };
}

/** Reference path: fold sessions in memory, then aggregate the same way. */
export function summarizeListeningRows(rows: readonly ListeningRow[], now: Date): ListeningSummary {
  return summarizeListeningDays(foldListeningRows(rows), now);
}
