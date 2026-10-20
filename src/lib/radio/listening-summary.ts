import { formatDayOrdinal } from "./format";
import type {
  BestDay,
  DateBucket,
  DayBucket,
  DaypartBucket,
  ListeningRow,
  ListeningStation,
  ListeningSummary,
  WeekBucket,
} from "./store";

/**
 * Pure listening aggregation for the stats views. The Dexie-backed
 * `summarizeListening` wrapper in `store.ts` fetches and filters sessions,
 * then delegates here; keeping it pure lets the buckets, streaks and best day
 * be reasoned about without a database.
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

interface StationAggregate {
  stations: ListeningStation[];
  totalSeconds: number;
  longestSession: number;
}

/** Per-station totals, latest name wins, most-listened first. */
function aggregateStations(rows: readonly ListeningRow[]): StationAggregate {
  const byStation = new Map<string, { name: string; started_at: string; seconds: number; plays: number }>();
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
  }
  const stations: ListeningStation[] = [...byStation.entries()].map(([stationuuid, entry]) => ({
    stationuuid,
    name: entry.name,
    seconds: entry.seconds,
    plays: entry.plays,
  }));
  stations.sort((a, b) => b.seconds - a.seconds);
  return { stations, totalSeconds, longestSession };
}

/** Monday-first buckets; `days` counts distinct local dates behind each weekday. */
function aggregateWeekdays(rows: readonly ListeningRow[]): DayBucket[] {
  const byDay: DayBucket[] = DAY_LABELS.map((label, day) => ({ day, label, seconds: 0, plays: 0, days: 0 }));
  const seenDates = new Map<number, Set<string>>();
  for (const row of rows) {
    const started = new Date(row.started_at);
    const weekday = (started.getDay() + 6) % 7;
    const bucket = byDay[weekday];
    if (!bucket) continue;
    bucket.seconds += row.seconds;
    bucket.plays += 1;
    const key = localDateKey(started);
    let dates = seenDates.get(weekday);
    if (!dates) {
      dates = new Set<string>();
      seenDates.set(weekday, dates);
    }
    dates.add(key);
  }
  for (const [weekday, dates] of seenDates) {
    const bucket = byDay[weekday];
    if (bucket) bucket.days = dates.size;
  }
  return byDay;
}

/** Fill the last-14-days strip; sessions outside the window stay in the totals. */
function aggregateRecent(
  rows: readonly ListeningRow[],
  byRecent: DateBucket[],
  recentIndex: Map<string, number>,
): DateBucket[] {
  for (const row of rows) {
    const recent = recentIndex.get(localDateKey(new Date(row.started_at)));
    if (recent === undefined) continue;
    const bucket = byRecent[recent];
    if (!bucket) continue;
    bucket.seconds += row.seconds;
    bucket.plays += 1;
  }
  return byRecent;
}

/** Fill the last-12-weeks strip; sessions outside the window stay in the totals. */
function aggregateWeeks(
  rows: readonly ListeningRow[],
  byWeek: WeekBucket[],
  weekIndex: Map<string, number>,
): WeekBucket[] {
  for (const row of rows) {
    const started = new Date(row.started_at);
    const week = weekIndex.get(localDateKey(mondayOf(started)));
    if (week === undefined) continue;
    const bucket = byWeek[week];
    if (!bucket) continue;
    bucket.seconds += row.seconds;
    bucket.plays += 1;
  }
  return byWeek;
}

/** Four even six-hour blocks, local time. */
function aggregateDayparts(rows: readonly ListeningRow[]): DaypartBucket[] {
  const byPart: DaypartBucket[] = DAYPART_DEFS.map((def) => ({ ...def, seconds: 0, plays: 0 }));
  for (const row of rows) {
    const hour = new Date(row.started_at).getHours();
    const index = hour < 6 ? 0 : hour < 12 ? 1 : hour < 18 ? 2 : 3;
    const part = byPart[index];
    if (!part) continue;
    part.seconds += row.seconds;
    part.plays += 1;
  }
  return byPart;
}

interface DateTotal {
  midnight: number;
  seconds: number;
  plays: number;
}

/** All-history per-date totals back the streak and best-day records. */
function aggregateDates(rows: readonly ListeningRow[]): Map<string, DateTotal> {
  const perDate = new Map<string, DateTotal>();
  for (const row of rows) {
    const started = new Date(row.started_at);
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
  }
  return perDate;
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

/** Aggregate already-filtered sessions into every listening view. */
export function summarizeListeningRows(rows: readonly ListeningRow[], now: Date): ListeningSummary {
  const { today, byRecent, byWeek, recentIndex, weekIndex } = createListeningWindows(now);
  const byDay = aggregateWeekdays(rows);
  const recent = aggregateRecent(rows, byRecent, recentIndex);
  const weeks = aggregateWeeks(rows, byWeek, weekIndex);
  const byPart = aggregateDayparts(rows);
  const perDate = aggregateDates(rows);
  const { stations, totalSeconds, longestSession } = aggregateStations(rows);
  return {
    totalSeconds,
    plays: rows.length,
    stations,
    byDay,
    byRecent: recent,
    byWeek: weeks,
    byPart,
    streak: { current: computeCurrentStreak(perDate, today), longest: computeLongestStreak(perDate) },
    bestDay: computeBestDay(perDate),
    longestSession,
  };
}
