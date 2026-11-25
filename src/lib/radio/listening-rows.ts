import { formatListeningTime } from "./format";
import type { ListeningStation, ListeningSummary } from "./store";

/**
 * Top-station row model for the Total, Sessions and Average sorts. Pure so
 * the ranking, captions and cascade shares can be tested without a DOM; the
 * chart only adds tones and pixel geometry on top.
 */

/** Sort mode for the top-stations chart. */
export type StationSort = "total" | "sessions" | "average";

/** Row key for the aggregated remainder (never a station uuid). */
const OTHER_KEY = "__other__";

/** One rendered row: a ranked station, or the aggregated remainder. */
export interface StationRow {
  /** Station uuid, or `__other__` for the remainder row. */
  key: string;
  name: string;
  /** Caption under the active sort. */
  label: string;
  /** Bar magnitude in display units (seconds, plays, or mean seconds). */
  display: number;
  /** Unrounded percent of the sort's composition metric (time or plays) —
   * cascade offsets tile on it, so rounding here would leave gaps. */
  share: number;
  /** True for the aggregated "Other" row. */
  isOther: boolean;
}

/** Mean seconds per banked session (0 plays can't happen — every station has ≥1). */
export function averageSession(station: ListeningStation): number {
  return station.seconds / Math.max(1, station.plays);
}

/** Bar value for the active sort: time, session count, or mean session. */
function sortValue(station: ListeningStation, sort: StationSort): number {
  return sort === "sessions"
    ? station.plays
    : sort === "average"
      ? Math.round(averageSession(station))
      : station.seconds;
}

/** Rounded share percent for captions, guarded against empty totals. */
function sharePct(value: number, total: number): number {
  return total <= 0 ? 0 : Math.round((value / total) * 100);
}

/** Unrounded share percent for bar geometry. */
function shareValue(value: number, total: number): number {
  return total <= 0 ? 0 : (value / total) * 100;
}

/** Session count with its noun ("1 session", "3 sessions"). */
function sessions(count: number): string {
  return `${count} ${count === 1 ? "session" : "sessions"}`;
}

/**
 * Caption for one station under the active sort. Time and session sorts
 * append the row's share of the chart; an average has no share of its own, so
 * it appends the sample size instead — a lone 26m listen must not read
 * "26m avg (0%)" beside a full bar.
 */
function modeLabel(station: ListeningStation, total: number, sort: StationSort): string {
  if (sort === "sessions") return `${sessions(station.plays)} (${sharePct(station.plays, total)}%)`;
  if (sort === "average") return `${formatListeningTime(sortValue(station, sort))} avg · ${sessions(station.plays)}`;
  return `${formatListeningTime(station.seconds)} (${sharePct(station.seconds, total)}%)`;
}

/** Muted remainder row for everything outside the ranked top. Null when the
 * top accounts for every session. It always sits last: it is a remainder, not
 * a ranking entry, even when its bar is longer. */
function otherRow(top: ListeningStation[], stats: ListeningSummary, sort: StationSort): StationRow | null {
  const topPlays = top.reduce((sum, station) => sum + station.plays, 0);
  const topSeconds = top.reduce((sum, station) => sum + station.seconds, 0);
  const plays = stats.plays - topPlays;
  const seconds = stats.totalSeconds - topSeconds;
  if (sort === "sessions") {
    if (plays <= 0) return null;
    return {
      key: OTHER_KEY,
      name: "Other sessions",
      label: `${sessions(plays)} (${sharePct(plays, stats.plays)}%)`,
      display: plays,
      share: shareValue(plays, stats.plays),
      isOther: true,
    };
  }
  if (seconds <= 0) return null;
  if (sort === "average") {
    const mean = Math.round(seconds / Math.max(1, plays));
    return {
      key: OTHER_KEY,
      name: "Other stations",
      label: `${formatListeningTime(mean)} avg · ${sessions(plays)}`,
      display: mean,
      share: shareValue(seconds, stats.totalSeconds),
      isOther: true,
    };
  }
  return {
    key: OTHER_KEY,
    name: "Other stations",
    label: `${formatListeningTime(seconds)} (${sharePct(seconds, stats.totalSeconds)}%)`,
    display: seconds,
    share: shareValue(seconds, stats.totalSeconds),
    isOther: true,
  };
}

/** Ranked top rows plus the remainder row for the active sort. */
export function topStationRows(stats: ListeningSummary, sort: StationSort, limit: number): StationRow[] {
  const ranked = stats.stations.toSorted((a, b) =>
    sort === "sessions"
      ? b.plays - a.plays || b.seconds - a.seconds
      : sort === "average"
        ? averageSession(b) - averageSession(a) || b.seconds - a.seconds
        : b.seconds - a.seconds,
  );
  const top = ranked.slice(0, limit);
  const total = sort === "sessions" ? stats.plays : stats.totalSeconds;
  const rows: StationRow[] = top.map((station) => ({
    key: station.stationuuid,
    name: station.name,
    label: modeLabel(station, total, sort),
    display: sortValue(station, sort),
    share: shareValue(sort === "sessions" ? station.plays : station.seconds, total),
    isOther: false,
  }));
  const other = otherRow(top, stats, sort);
  if (other) rows.push(other);
  return rows;
}
