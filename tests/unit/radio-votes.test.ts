import { describe, expect, it } from "vite-plus/test";
import { QueryClient } from "@tanstack/react-query";
import { bumpCachedVotes } from "@/lib/radio/votes";
import { EMPTY_STATION, type Station } from "@/lib/radio/types";
import type { FavouriteRow, HistoryRow } from "@/lib/radio/store";

const ALPHA: Station = { ...EMPTY_STATION, stationuuid: "a", name: "Alpha", votes: 10 };
const BETA: Station = { ...EMPTY_STATION, stationuuid: "b", name: "Beta", votes: 5 };

function seedClient(): QueryClient {
  const client = new QueryClient();
  client.setQueryData(["radio", "detail", "a"], ALPHA);
  client.setQueryData(["radio", "top", "votes"], [ALPHA, BETA]);
  client.setQueryData(["radio", "search", { name: "a" }], [ALPHA]);
  const favourite: FavouriteRow = { stationuuid: "a", snapshot: ALPHA, saved_at: "2026-10-05T10:00:00.000Z", sort: 0 };
  client.setQueryData(["radio", "favourites"], [favourite]);
  const played: HistoryRow = { stationuuid: "a", snapshot: ALPHA, played_at: "2026-10-05T11:00:00.000Z" };
  client.setQueryData(["radio", "history"], [played]);
  return client;
}

describe("bumpCachedVotes", () => {
  it("bumps the sheet, the lists and the snapshots together", () => {
    const client = seedClient();
    bumpCachedVotes(client, "a");
    expect(client.getQueryData<Station>(["radio", "detail", "a"])?.votes).toBe(11);
    expect(client.getQueryData<Station[]>(["radio", "top", "votes"])?.map((row) => row.votes)).toEqual([11, 5]);
    expect(client.getQueryData<Station[]>(["radio", "search", { name: "a" }])?.[0]?.votes).toBe(11);
    expect(client.getQueryData<FavouriteRow[]>(["radio", "favourites"])?.[0]?.snapshot.votes).toBe(11);
    expect(client.getQueryData<HistoryRow[]>(["radio", "history"])?.[0]?.snapshot.votes).toBe(11);
    client.clear();
  });

  it("leaves other stations and empty caches alone", () => {
    const client = seedClient();
    bumpCachedVotes(client, "missing");
    expect(client.getQueryData<Station>(["radio", "detail", "a"])?.votes).toBe(10);
    expect(client.getQueryData<Station[]>(["radio", "top", "votes"])?.map((row) => row.votes)).toEqual([10, 5]);
    const bare = new QueryClient();
    expect(() => {
      bumpCachedVotes(bare, "a");
    }).not.toThrow();
    bare.clear();
    client.clear();
  });
});
