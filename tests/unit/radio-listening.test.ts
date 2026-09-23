import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { clearListening, logListening, RadioDB, summarizeListening, type ListeningRow } from "@/lib/radio/store";

let counter = 0;
let database = new RadioDB(`radioscout-listening-test-${counter}`);

function freshDatabase(): RadioDB {
  counter += 1;
  database = new RadioDB(`radioscout-listening-test-${counter}`);
  return database;
}

afterEach(async () => {
  await database.delete();
});

function session(uuid: string, name: string, seconds: number, started_at: string): Omit<ListeningRow, "id"> {
  return { stationuuid: uuid, name, started_at, seconds };
}

describe("listening stats", () => {
  it("starts empty", async () => {
    const summary = await summarizeListening(freshDatabase());
    expect(summary.totalSeconds).toBe(0);
    expect(summary.plays).toBe(0);
    expect(summary.stations).toEqual([]);
    expect(summary.byDay).toHaveLength(7);
    expect(summary.byDay.every((bucket) => bucket.seconds === 0 && bucket.plays === 0)).toBe(true);
    expect(summary.byRecent).toHaveLength(14);
    expect(summary.byRecent.every((bucket) => bucket.seconds === 0 && bucket.plays === 0)).toBe(true);
    expect(summary.byPart.map((bucket) => bucket.id)).toEqual(["night", "morning", "afternoon", "evening"]);
    expect(summary.byPart.every((bucket) => bucket.seconds === 0 && bucket.plays === 0)).toBe(true);
    expect(summary.byWeek).toHaveLength(12);
    expect(summary.byWeek.every((bucket) => bucket.seconds === 0 && bucket.plays === 0)).toBe(true);
    expect(summary.streak).toEqual({ current: 0, longest: 0 });
    expect(summary.bestDay).toBeNull();
    expect(summary.longestSession).toBe(0);
  });

  it("aggregates sessions per station, most-listened first", async () => {
    const target = freshDatabase();
    await logListening(session("a", "Alpha", 60, "2026-09-20T10:00:00.000Z"), target);
    await logListening(session("b", "Beta", 300, "2026-09-20T11:00:00.000Z"), target);
    await logListening(session("a", "Alpha", 120, "2026-09-20T12:00:00.000Z"), target);
    const summary = await summarizeListening(target);
    expect(summary.totalSeconds).toBe(480);
    expect(summary.plays).toBe(3);
    expect(summary.stations.map((station) => station.stationuuid)).toEqual(["b", "a"]);
    expect(summary.stations[1]).toMatchObject({ name: "Alpha", seconds: 180, plays: 2 });
  });

  it("prefers the latest session name for renamed stations", async () => {
    const target = freshDatabase();
    await logListening(session("a", "Old Name", 60, "2026-09-20T10:00:00.000Z"), target);
    await logListening(session("a", "New Name", 60, "2026-09-21T10:00:00.000Z"), target);
    const summary = await summarizeListening(target);
    expect(summary.stations).toHaveLength(1);
    expect(summary.stations[0]?.name).toBe("New Name");
  });

  it("clears everything", async () => {
    const target = freshDatabase();
    await logListening(session("a", "Alpha", 60, "2026-09-20T10:00:00.000Z"), target);
    await clearListening(target);
    const summary = await summarizeListening(target);
    expect(summary.totalSeconds).toBe(0);
    expect(summary.plays).toBe(0);
    expect(summary.stations).toEqual([]);
  });

  it("buckets sessions Monday-first with per-day averages", async () => {
    // Local noon (never a midnight edge): 2026-09-21 and 2026-09-28 are
    // Mondays, 2026-09-27 a Sunday.
    const mondayNoon = new Date(2026, 8, 21, 12).toISOString();
    const mondayLate = new Date(2026, 8, 21, 13).toISOString();
    const nextMonday = new Date(2026, 8, 28, 12).toISOString();
    const sundayNoon = new Date(2026, 8, 27, 12).toISOString();
    const target = freshDatabase();
    await logListening(session("a", "Alpha", 60, mondayNoon), target);
    await logListening(session("a", "Alpha", 120, mondayLate), target);
    await logListening(session("a", "Alpha", 60, nextMonday), target);
    await logListening(session("b", "Beta", 300, sundayNoon), target);
    const summary = await summarizeListening(target);
    expect(summary.byDay.map((bucket) => bucket.label)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    const monday = summary.byDay[0];
    const sunday = summary.byDay[6];
    expect(monday?.seconds).toBe(240);
    expect(monday?.plays).toBe(3);
    // Two distinct Mondays: the daily chart averages 240s across 2 days.
    expect(monday?.days).toBe(2);
    expect(sunday?.seconds).toBe(300);
    expect(sunday?.plays).toBe(1);
    expect(sunday?.days).toBe(1);
    expect(summary.byDay[2]?.plays).toBe(0);
    expect(summary.byDay[2]?.days).toBe(0);
  });

  it("buckets the last 14 days oldest-first, dropping sessions outside the window", async () => {
    // Local noon (never a midnight edge); now is Mon 2026-09-28.
    const now = new Date(2026, 8, 28, 12);
    const target = freshDatabase();
    await logListening(session("a", "Alpha", 60, new Date(2026, 8, 28, 10).toISOString()), target);
    await logListening(session("a", "Alpha", 120, new Date(2026, 8, 27, 10).toISOString()), target);
    await logListening(session("b", "Beta", 300, new Date(2026, 8, 1, 10).toISOString()), target);
    const summary = await summarizeListening(target, now);
    expect(summary.byRecent).toHaveLength(14);
    // Oldest first, today last — ordinal labels read as dates.
    expect(summary.byRecent[13]?.seconds).toBe(60);
    expect(summary.byRecent[13]?.plays).toBe(1);
    expect(summary.byRecent[13]?.label).toBe("28th");
    expect(summary.byRecent[13]?.month).toBe("Sep");
    expect(summary.byRecent[12]?.seconds).toBe(120);
    expect(summary.byRecent[12]?.label).toBe("27th");
    expect(summary.byRecent[12]?.month).toBe("Sep");
    expect(summary.byRecent[0]?.seconds).toBe(0);
    // Outside the window: still in the totals, never in the strip.
    expect(summary.totalSeconds).toBe(480);
    expect(summary.byRecent.reduce((sum, bucket) => sum + bucket.seconds, 0)).toBe(180);
  });

  it("labels recent days with ordinal plus month across month boundaries", async () => {
    // Now is Fri 2026-10-02: the 14-day window opens Mon 2026-09-19.
    const now = new Date(2026, 9, 2, 12);
    const target = freshDatabase();
    const summary = await summarizeListening(target, now);
    expect(summary.byRecent).toHaveLength(14);
    expect(summary.byRecent[0]).toMatchObject({ label: "19th", month: "Sep", weekday: "Sat" });
    expect(summary.byRecent[13]).toMatchObject({ label: "2nd", month: "Oct", weekday: "Fri" });
  });

  it("buckets sessions into six-hour dayparts", async () => {
    const now = new Date(2026, 8, 28, 12);
    const target = freshDatabase();
    await logListening(session("a", "Alpha", 60, new Date(2026, 8, 28, 2).toISOString()), target);
    await logListening(session("a", "Alpha", 60, new Date(2026, 8, 28, 7).toISOString()), target);
    await logListening(session("a", "Alpha", 60, new Date(2026, 8, 28, 13).toISOString()), target);
    await logListening(session("a", "Alpha", 60, new Date(2026, 8, 28, 19).toISOString()), target);
    const summary = await summarizeListening(target, now);
    expect(summary.byPart.map((bucket) => bucket.seconds)).toEqual([60, 60, 60, 60]);
  });

  it("tracks streaks, best day and longest session", async () => {
    // Now is Mon 2026-09-28; active 28/27/26, a gap on 25th, then 24–21.
    const now = new Date(2026, 8, 28, 12);
    const target = freshDatabase();
    for (const day of [28, 27, 26, 24, 23, 22, 21]) {
      await logListening(session("a", "Alpha", 60, new Date(2026, 8, day, 10).toISOString()), target);
    }
    await logListening(session("b", "Beta", 300, new Date(2026, 8, 22, 11).toISOString()), target);
    const summary = await summarizeListening(target, now);
    expect(summary.streak).toEqual({ current: 3, longest: 4 });
    expect(summary.bestDay).toMatchObject({ label: "22nd", weekday: "Tue", seconds: 360, plays: 2 });
    expect(summary.longestSession).toBe(300);
  });

  it("keeps the streak alive when today is still quiet", async () => {
    const now = new Date(2026, 8, 28, 12);
    const target = freshDatabase();
    await logListening(session("a", "Alpha", 60, new Date(2026, 8, 27, 10).toISOString()), target);
    await logListening(session("a", "Alpha", 60, new Date(2026, 8, 26, 10).toISOString()), target);
    const summary = await summarizeListening(target, now);
    expect(summary.streak).toEqual({ current: 2, longest: 2 });
  });

  it("buckets the last 12 weeks oldest-first with Monday ranges", async () => {
    // Now is Mon 2026-09-28: current week starts 28th, prior weeks the 21st/14th.
    const now = new Date(2026, 8, 28, 12);
    const target = freshDatabase();
    await logListening(session("a", "Alpha", 60, new Date(2026, 8, 28, 10).toISOString()), target);
    await logListening(session("a", "Alpha", 120, new Date(2026, 8, 27, 10).toISOString()), target);
    await logListening(session("a", "Alpha", 60, new Date(2026, 8, 21, 10).toISOString()), target);
    await logListening(session("b", "Beta", 300, new Date(2026, 8, 14, 10).toISOString()), target);
    await logListening(session("c", "Gamma", 300, new Date(2026, 7, 31, 10).toISOString()), target);
    const summary = await summarizeListening(target, now);
    expect(summary.byWeek).toHaveLength(12);
    const current = summary.byWeek[11];
    const prior = summary.byWeek[10];
    const older = summary.byWeek[9];
    expect(current).toMatchObject({ label: "28th", month: "Sep", seconds: 60, plays: 1 });
    expect(prior).toMatchObject({ label: "21st", month: "Sep", seconds: 180, plays: 2, range: "21st – 27th Sep" });
    expect(older).toMatchObject({ label: "14th", month: "Sep", seconds: 300, plays: 1 });
    // Cross-month week: Monday 31st Aug carries August as its caption month.
    expect(summary.byWeek[7]).toMatchObject({
      label: "31st",
      month: "Aug",
      range: "31st Aug – 6th Sep",
      seconds: 300,
      plays: 1,
    });
    expect(summary.byWeek.slice(0, 7).every((bucket) => bucket.seconds === 0)).toBe(true);
  });
});
