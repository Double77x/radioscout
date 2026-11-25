import { describe, expect, it } from "vite-plus/test";
import { averageSession, topStationRows } from "@/lib/radio/listening-rows";
import type { ListeningStation, ListeningSummary } from "@/lib/radio/store";

function station(stationuuid: string, seconds: number, plays: number, name = stationuuid): ListeningStation {
  return { stationuuid, name, seconds, plays };
}

/** Minimal summary: the row model only reads station totals and the play count. */
function summary(stations: ListeningStation[]): ListeningSummary {
  return {
    totalSeconds: stations.reduce((sum, entry) => sum + entry.seconds, 0),
    plays: stations.reduce((sum, entry) => sum + entry.plays, 0),
    stations,
    byDay: [],
    byRecent: [],
    byWeek: [],
    byPart: [],
    streak: { current: 0, longest: 0 },
    bestDay: null,
    longestSession: 0,
  };
}

const LIBRARY = [
  station("alpha", 3600, 2, "Alpha"),
  station("beta", 1800, 1, "Beta"),
  station("gamma", 600, 3, "Gamma"),
];

describe("top station rows", () => {
  it("returns no rows for an empty summary", () => {
    expect(topStationRows(summary([]), "average", 5)).toEqual([]);
  });

  it("ranks by total time and captions each row's share", () => {
    const rows = topStationRows(summary(LIBRARY), "total", 5);
    expect(rows.map((row) => row.name)).toEqual(["Alpha", "Beta", "Gamma"]);
    expect(rows.map((row) => row.label)).toEqual(["1h (60%)", "30m (30%)", "10m (10%)"]);
    expect(rows.map((row) => row.display)).toEqual([3600, 1800, 600]);
    expect(rows.every((row) => !row.isOther)).toBe(true);
  });

  it("ranks by session count and captions the play share", () => {
    const rows = topStationRows(summary(LIBRARY), "sessions", 5);
    expect(rows.map((row) => row.name)).toEqual(["Gamma", "Alpha", "Beta"]);
    expect(rows.map((row) => row.label)).toEqual(["3 sessions (50%)", "2 sessions (33%)", "1 session (17%)"]);
  });

  it("ranks by mean session and names the sample instead of a time share", () => {
    // The reported case: one 26-minute listen tops the average chart while
    // owning 0% of listening time. The caption names the sample, never a
    // percentage that contradicts the bar.
    const rows = topStationRows(
      summary([
        station("hot", 1560, 1, "Hot Radio"),
        station("dance", 9000, 10, "Dance Wave!"),
        station("bbc", 2000, 4, "BBC Radio 1"),
        station("x", 600, 2, "X"),
        station("y", 300, 2, "Y"),
      ]),
      "average",
      3,
    );
    expect(rows.map((row) => row.name)).toEqual(["Hot Radio", "Dance Wave!", "BBC Radio 1", "Other stations"]);
    expect(rows.map((row) => row.label)).toEqual([
      "26m avg · 1 session",
      "15m avg · 10 sessions",
      "8m avg · 4 sessions",
      "3m avg · 4 sessions",
    ]);
    expect(rows.some((row) => row.label.includes("%"))).toBe(false);
    // The bar follows the caption: mean session seconds, not a time share.
    expect(rows.map((row) => row.display)).toEqual([1560, 900, 500, 225]);
  });

  it("folds the stations outside the top into the Other row", () => {
    const rows = topStationRows(summary(LIBRARY), "total", 2);
    expect(rows.map((row) => row.name)).toEqual(["Alpha", "Beta", "Other stations"]);
    expect(rows[2]).toMatchObject({ isOther: true, display: 600, label: "10m (10%)" });
  });

  it("labels the Other row for the sessions sort", () => {
    const rows = topStationRows(summary(LIBRARY), "sessions", 2);
    expect(rows.map((row) => row.label)).toEqual(["3 sessions (50%)", "2 sessions (33%)", "1 session (17%)"]);
    expect(rows[2]).toMatchObject({ isOther: true, display: 1 });
  });

  it("omits the Other row when the top covers every station", () => {
    const rows = topStationRows(summary(LIBRARY), "total", 3);
    expect(rows).toHaveLength(3);
    expect(rows.some((row) => row.isOther)).toBe(false);
  });

  it("keeps cascade shares unrounded so the tiles join up", () => {
    const rows = topStationRows(summary([station("a", 1, 1), station("b", 1, 1), station("c", 1, 1)]), "total", 5);
    for (const row of rows) expect(row.share).toBeCloseTo(100 / 3, 10);
    expect(rows.reduce((sum, row) => sum + row.share, 0)).toBeCloseTo(100, 10);
  });

  it("guards the mean against a zero play count", () => {
    expect(averageSession(station("a", 0, 0))).toBe(0);
    expect(averageSession(station("b", 120, 0))).toBe(120);
  });
});
