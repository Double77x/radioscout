import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useIsClient } from "@/hooks/use-is-client";
import { queryClient } from "@/lib/query-client";
import type { StationSearch } from "@/lib/radio/api";
import type { Station } from "@/lib/radio/types";

const RADIO_KEY = ["radio"] as const;
export const FAVOURITES_KEY = [...RADIO_KEY, "favourites"] as const;
const HISTORY_KEY = [...RADIO_KEY, "history"] as const;

const STALE_MS = 1000 * 60 * 5;

const loadTopVoted = () => import("@/lib/radio/api").then((api) => api.topVotedStations());
const loadTopClicked = () => import("@/lib/radio/api").then((api) => api.topClickedStations());
const loadSearch = (search: StationSearch) =>
  import("@/lib/radio/api").then((api) => {
    if ((search.name ?? "").trim() !== "") {
      return api.searchStationsIlike(search.name ?? "", search.tag, search.limit);
    }
    // Genre chips: highest-rated top 50 for the tag, not most-clicked.
    return api.searchStations({ ...search, order: "votes" });
  });
const loadStats = () => import("@/lib/radio/api").then((api) => api.serverStats());
const loadFavourites = () => import("@/lib/radio/store").then((store) => store.listFavourites());
const loadHistory = () => import("@/lib/radio/store").then((store) => store.listHistory());
const saveFavourite = (station: Station) => import("@/lib/radio/store").then((store) => store.toggleFavourite(station));
const wipeHistory = () => import("@/lib/radio/store").then((store) => store.clearHistory());

export function useTopStations(sort: "votes" | "clicks" = "votes") {
  const isClient = useIsClient();
  return useQuery({
    queryKey: [...RADIO_KEY, "top", sort],
    queryFn: sort === "votes" ? loadTopVoted : loadTopClicked,
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
