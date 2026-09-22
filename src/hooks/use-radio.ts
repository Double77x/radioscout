import { useCallback, useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useIsClient } from "@/hooks/use-is-client";
import { LISTENING_KEY, play } from "@/hooks/use-player";
import { queryClient } from "@/lib/query-client";
import type { StationSearch } from "@/lib/radio/api";
import { readLanguages } from "@/lib/radio/languages";
import { readMinBitrate } from "@/lib/radio/quality";
import { pickSurpriseStation } from "@/lib/radio/surprise";
import type { DayBucket, ListeningSummary } from "@/lib/radio/store";
import type { Station } from "@/lib/radio/types";

const RADIO_KEY = ["radio"] as const;
export const FAVOURITES_KEY = [...RADIO_KEY, "favourites"] as const;
const HISTORY_KEY = [...RADIO_KEY, "history"] as const;

const STALE_MS = 1000 * 60 * 5;

const loadTopVoted = (languages: string[], minBitrate: number) => () =>
  import("@/lib/radio/api").then((api) => api.topVotedStations(50, languages, minBitrate));
const loadTopClicked = (languages: string[], minBitrate: number) => () =>
  import("@/lib/radio/api").then((api) => api.topClickedStations(50, languages, minBitrate));
const loadSearch = (search: StationSearch) =>
  import("@/lib/radio/api").then((api) => {
    if ((search.name ?? "").trim() !== "") {
      return api.searchStationsIlike(search.name ?? "", search.tag, search.limit, search.languages, search.minBitrate);
    }
    // Genre chips: highest-rated top 50 for the tag, not most-clicked.
    return api.searchStations({ ...search, order: "votes" });
  });
const loadStats = () => import("@/lib/radio/api").then((api) => api.serverStats());
const loadSurpriseFallback = (languages: string[], minBitrate: number) => () =>
  import("@/lib/radio/api").then((api) => api.topVotedStations(50, languages, minBitrate));
const loadFavourites = () => import("@/lib/radio/store").then((store) => store.listFavourites());
const loadHistory = () => import("@/lib/radio/store").then((store) => store.listHistory());
const loadListening = () => import("@/lib/radio/store").then((store) => store.summarizeListening());
const saveFavourite = (station: Station) => import("@/lib/radio/store").then((store) => store.toggleFavourite(station));
const wipeHistory = () => import("@/lib/radio/store").then((store) => store.clearHistory());
const wipeListening = () => import("@/lib/radio/store").then((store) => store.clearListening());

export function useTopStations(sort: "votes" | "clicks" = "votes", languages: string[] = [], minBitrate = 0) {
  const isClient = useIsClient();
  return useQuery({
    queryKey: [...RADIO_KEY, "top", sort, languages, minBitrate],
    queryFn: sort === "votes" ? loadTopVoted(languages, minBitrate) : loadTopClicked(languages, minBitrate),
    enabled: isClient,
    staleTime: STALE_MS,
    placeholderData: keepPreviousData,
  });
}

export function useStationSearch(search: StationSearch, active: boolean) {
  const isClient = useIsClient();
  const hasQuery = (search.name ?? "").trim().length > 0 || (search.tag ?? "").trim().length > 0;
  return useQuery({
    queryKey: [...RADIO_KEY, "search", search],
    queryFn: () => loadSearch(search),
    enabled: isClient && active && hasQuery,
    staleTime: STALE_MS,
    placeholderData: keepPreviousData,
  });
}

/** Directory totals for the header. Changes slowly — cached an hour. */
export function useServerStats() {
  const isClient = useIsClient();
  return useQuery({
    queryKey: [...RADIO_KEY, "stats"],
    queryFn: loadStats,
    enabled: isClient,
    staleTime: 1000 * 60 * 60,
  });
}

export function useFavourites() {
  const isClient = useIsClient();
  return useQuery({
    queryKey: FAVOURITES_KEY,
    queryFn: loadFavourites,
    initialData: [],
    enabled: isClient,
    staleTime: 0,
  });
}

export function useToggleFavourite() {
  return useMutation({
    mutationFn: (station: Station) => saveFavourite(station),
    onSuccess: (nowFavourite, station) => {
      queryClient.invalidateQueries({ queryKey: FAVOURITES_KEY });
      toast(nowFavourite ? "Saved to favourites" : "Removed from favourites", {
        description: station.name,
      });
    },
    onError: () => {
      toast("Couldn't save that", { description: "Try again in a moment." });
    },
  });
}

export function useHistory() {
  const isClient = useIsClient();
  return useQuery({
    queryKey: HISTORY_KEY,
    queryFn: loadHistory,
    initialData: [],
    enabled: isClient,
    staleTime: 0,
  });
}

export function useClearHistory() {
  return useMutation({
    mutationFn: wipeHistory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HISTORY_KEY });
      toast("History cleared");
    },
  });
}

/** Stable empty stats (referentially stable initial data — never flashes). */
const LISTENING_EMPTY_WEEK: DayBucket[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, day) => ({
  day,
  label,
  seconds: 0,
  plays: 0,
  days: 0,
}));
const LISTENING_EMPTY: ListeningSummary = {
  totalSeconds: 0,
  plays: 0,
  stations: [],
  byDay: LISTENING_EMPTY_WEEK,
};

/** Aggregated listening time, most-listened station first. Local-first, instant. */
export function useListeningStats() {
  const isClient = useIsClient();
  return useQuery({
    queryKey: LISTENING_KEY,
    queryFn: loadListening,
    initialData: LISTENING_EMPTY,
    enabled: isClient,
    staleTime: 0,
  });
}

export function useClearListening() {
  return useMutation({
    mutationFn: wipeListening,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LISTENING_KEY });
      toast("Listening stats cleared");
    },
  });
}

/**
 * "Surprise me": play a random station. Prefers the already-cached Top
 * charts (instant, offline-capable, language-aware via the cached queries)
 * and falls back to one network fetch when nothing is cached yet. Promise
 * chains (not try/finally) so the hooks lint stays green.
 */
export function useSurpriseMe() {
  const [isSurprising, setIsSurprising] = useState(false);

  const surprise = useCallback((excludeUuid?: string | null) => {
    setIsSurprising(true);
    const seen = new Set<string>();
    const cached: Station[] = [];
    for (const [, data] of queryClient.getQueriesData<Station[]>({ queryKey: [...RADIO_KEY, "top"] })) {
      if (!Array.isArray(data)) continue;
      for (const station of data) {
        if (!seen.has(station.stationuuid)) {
          seen.add(station.stationuuid);
          cached.push(station);
        }
      }
    }
    const fromCache = pickSurpriseStation(cached, excludeUuid);
    const pending: Promise<Station | null> =
      fromCache === null
        ? loadSurpriseFallback(readLanguages(), readMinBitrate())().then((fresh) =>
            pickSurpriseStation(fresh, excludeUuid),
          )
        : Promise.resolve(fromCache);
    pending
      .then(
        (pick) => {
          if (!pick) {
            toast("Nothing to shuffle yet", { description: "The station directory looks empty." });
            return;
          }
          play(pick);
        },
        () => {
          toast("Couldn't reach the station directory", { description: "Check your connection and try again." });
        },
      )
      .finally(() => {
        setIsSurprising(false);
      });
  }, []);

  return { surprise, isSurprising };
}
