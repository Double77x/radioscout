import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { summarizeListeningRows } from "@/lib/radio/listening-summary";
import {
  clearListening,
  logListening,
  pruneListening,
  RadioDB,
  summarizeListening,
  type ListeningRow,
} from "@/lib/radio/store";
import { EMPTY_STATION } from "@/lib/radio/types";

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

  it("scopes every bucket to one station when filtered", async () => {
    const target = freshDatabase();
    await logListening(session("a", "Alpha", 120, "2026-09-20T10:00:00.000Z"), target);
    await logListening(session("b", "Beta", 60, "2026-09-20T11:00:00.000Z"), target);
    const summary = await summarizeListening(target, new Date("2026-09-21T12:00:00.000Z"), "a");
    expect(summary.totalSeconds).toBe(120);
    expect(summary.plays).toBe(1);
    expect(summary.stations.map((station) => station.stationuuid)).toEqual(["a"]);
  });

  it("returns zeros for a station with no sessions", async () => {
    const target = freshDatabase();
    await logListening(session("a", "Alpha", 120, "2026-09-20T10:00:00.000Z"), target);
    const summary = await summarizeListening(target, new Date("2026-09-21T12:00:00.000Z"), "missing");
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

  it("keeps the day rollups in step with the row-by-row reference", async () => {
    // Two stations across four local dates, dayparts and a renamed station:
    // the stored rollups must reproduce the in-memory fold exactly.
    const now = new Date(2026, 8, 28, 12);
    const target = freshDatabase();
    const rows = [
      session("a", "Alpha", 60, new Date(2026, 8, 21, 2).toISOString()),
      session("a", "Alpha", 120, new Date(2026, 8, 21, 13).toISOString()),
      session("b", "Beta", 300, new Date(2026, 8, 21, 19).toISOString()),
      session("a", "Alpha Renamed", 45, new Date(2026, 8, 27, 7).toISOString()),
      session("c", "Gamma", 900, new Date(2026, 7, 31, 22).toISOString()),
      session("a", "Alpha Renamed", 30, new Date(2026, 8, 28, 11).toISOString()),
    ];
    for (const row of rows) await logListening(row, target);
    const stored = await target.listening.toArray();
    expect(stored).toHaveLength(rows.length);
    expect(await target.listeningDaily.count()).toBe(5);
    expect(await summarizeListening(target, now)).toEqual(summarizeListeningRows(stored, now));
  });

  it("prunes the raw log without losing a total", async () => {
    const target = freshDatabase();
    for (let hour = 10; hour < 15; hour += 1) {
      await logListening(session("a", "Alpha", 60, new Date(2026, 8, 21, hour).toISOString()), target);
    }
    await pruneListening(target, 2);
    expect(await target.listening.count()).toBe(2);
    const summary = await summarizeListening(target);
    expect(summary.totalSeconds).toBe(300);
    expect(summary.plays).toBe(5);
    expect(summary.stations[0]).toMatchObject({ seconds: 300, plays: 5 });
  });

  it("folds a pre-rollup database on upgrade", async () => {
    counter += 1;
    const name = `radioscout-listening-upgrade-${counter}`;
    const legacy = new Dexie(name);
    legacy.version(3).stores({
      favourites: "stationuuid",
      history: "++id, stationuuid",
      listening: "++id, stationuuid, started_at",
      tracks: "++id, stationuuid, played_at",
    });
    await legacy.open();
    await legacy.table<ListeningRow, number>("listening").bulkAdd([
      { stationuuid: "a", name: "Alpha", started_at: new Date(2026, 8, 21, 10).toISOString(), seconds: 120 },
      { stationuuid: "b", name: "Beta", started_at: new Date(2026, 8, 22, 20).toISOString(), seconds: 60 },
    ]);
    legacy.close();

    const upgraded = new RadioDB(name);
    database = upgraded;
    await upgraded.open();
    const summary = await summarizeListening(upgraded);
    expect(summary.totalSeconds).toBe(180);
    expect(summary.plays).toBe(2);
    expect(summary.stations.map((station) => station.stationuuid).toSorted()).toEqual(["a", "b"]);
    // Dayparts survive the upgrade: 10am is morning, 8pm is evening.
    expect(summary.byPart[1]?.seconds).toBe(120);
    expect(summary.byPart[3]?.seconds).toBe(60);
  });

  it("heals a v4 database whose rollups landed in a renamed store", async () => {
    counter += 1;
    const name = `radioscout-listening-renamed-${counter}`;
    const schema = {
      favourites: "stationuuid",
      history: "++id, stationuuid",
      listening: "++id, stationuuid, started_at",
      tracks: "++id, stationuuid, played_at",
    };
    const broken = new Dexie(name);
    broken.version(3).stores(schema);
    broken.version(4).stores({ ...schema, listening_daily: "&key, stationuuid, date" });
    await broken.open();
    await broken
      .table<ListeningRow, number>("listening")
      .bulkAdd([
        { stationuuid: "a", name: "Alpha", started_at: new Date(2026, 8, 21, 10).toISOString(), seconds: 120 },
      ]);
    broken.close();

    const healed = new RadioDB(name);
    database = healed;
    await healed.open();
    expect(await healed.listening.count()).toBe(1);
    const summary = await summarizeListening(healed);
    expect(summary.totalSeconds).toBe(120);
    expect(summary.plays).toBe(1);
    expect(await healed.listeningDaily.count()).toBe(1);
  });

  it("upgrades a production-sized log without touching a row", async () => {
    counter += 1;
    const name = `radioscout-listening-prod-${counter}`;
    const schema = {
      favourites: "stationuuid",
      history: "++id, stationuuid",
      listening: "++id, stationuuid, started_at",
      tracks: "++id, stationuuid, played_at",
    };
    const legacy = new Dexie(name);
    legacy.version(3).stores(schema);
    await legacy.open();
    const rows = Array.from({ length: 1000 }, (_, index) => ({
      stationuuid: `station-${index % 12}`,
      name: `Station ${index % 12}`,
      started_at: new Date(Date.UTC(2026, 0, 1) + index * 5 * 60_000).toISOString(),
      seconds: 60 + (index % 300),
    }));
    const snapshot = { ...EMPTY_STATION, stationuuid: "favourite-1", name: "Favourite FM" };
    await legacy.table<ListeningRow, number>("listening").bulkAdd(rows);
    await legacy
      .table("favourites")
      .put({ stationuuid: "favourite-1", snapshot, saved_at: "2026-01-01T00:00:00.000Z", sort: 0 });
    await legacy.table("history").add({ stationuuid: "favourite-1", snapshot, played_at: "2026-01-01T00:00:00.000Z" });
    legacy.close();

    const upgraded = new RadioDB(name);
    database = upgraded;
    await upgraded.open();
    // The version change is schema-only: every user row is still there.
    expect(await upgraded.listening.count()).toBe(rows.length);
    expect(await upgraded.favourites.count()).toBe(1);
    expect(await upgraded.history.count()).toBe(1);
    expect(await upgraded.listeningDaily.count()).toBe(0);

    const now = new Date(2026, 1, 15, 12);
    const summary = await summarizeListening(upgraded, now);
    // The lazy backfill must reproduce the pre-rollup totals exactly.
    expect(summary).toEqual(summarizeListeningRows(rows, now));
    expect(await upgraded.listening.count()).toBe(rows.length);
    expect(await upgraded.listeningDaily.count()).toBeGreaterThan(0);
  });

  it("rebuilds rollups that went missing instead of reading zero", async () => {
    const target = freshDatabase();
    await logListening(session("a", "Alpha", 60, new Date(2026, 8, 21, 10).toISOString()), target);
    await target.listeningDaily.clear();
    const summary = await summarizeListening(target);
    expect(summary.totalSeconds).toBe(60);
    expect(summary.plays).toBe(1);
    expect(await target.listeningDaily.count()).toBe(1);
  });

  it("folds a raw log that outnumbers a half-built rollup", async () => {
    const target = freshDatabase();
    await logListening(session("a", "Alpha", 60, new Date(2026, 8, 21, 10).toISOString()), target);
    await logListening(session("b", "Beta", 120, new Date(2026, 8, 22, 11).toISOString()), target);
    // Keep one rollup, as an interrupted fold would: the log has more plays.
    const [partial] = await target.listeningDaily.toArray();
    await target.listeningDaily.clear();
    if (partial) await target.listeningDaily.put(partial);
    const summary = await summarizeListening(target);
    expect(summary.totalSeconds).toBe(180);
    expect(summary.plays).toBe(2);
    expect(await target.listeningDaily.count()).toBe(2);
  });
});
