import { useQuery } from "@tanstack/react-query";
import { isNative } from "@/lib/capacitor";
import { useIsClient } from "@/hooks/use-is-client";
import { pickPlayableUrl, type Station } from "@/lib/radio/types";
import { fetchWebTitle } from "@/lib/radio/now-playing";

/** Re-poll cadence for stream titles (songs change on minute scales). */
const TITLE_POLL_MS = 45_000;

/**
 * Web now-playing title for the live station. Query-driven polling (no
 * effects): disabled on the APK (the service parses metadata directly),
 * during prerender, and whenever nothing is audible. Null while loading or
 * when the station/edge sends nothing — the dock falls back to genre tags.
 */
export function useNowPlaying(station: Station | null, playing: boolean): string | null {
  const isClient = useIsClient();
  const streamUrl = station ? pickPlayableUrl(station) : "";
  const { data } = useQuery({
    queryKey: ["radio", "now-playing", station?.stationuuid],
    queryFn: ({ signal }) => fetchWebTitle(streamUrl, signal),
    enabled: isClient && playing && !isNative() && streamUrl !== "",
    refetchInterval: TITLE_POLL_MS,
    staleTime: TITLE_POLL_MS / 2,
    retry: false,
    refetchOnWindowFocus: false,
  });
  return data ?? null;
}
