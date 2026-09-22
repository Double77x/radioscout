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
});
