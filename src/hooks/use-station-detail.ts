import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useIsClient } from "@/hooks/use-is-client";
import { queryClient } from "@/lib/query-client";
import type { Station } from "@/lib/radio/types";

/** API stays out of the initial bundle — loaded for shared-link resolution. */
const loadDetailApi = () => import("@/lib/radio/api");

/**
 * Route-agnostic `?station=` reader. Parses the raw search string instead of
 * the route schema so the sheet resolves on every page (only `/` declares
 * the param — legal pages pass search through untouched).
 */
export function useStationParam(): string | null {
  const searchStr = useLocation({ select: (location) => location.searchStr });
  const uuid = new URLSearchParams(searchStr).get("station");
  return uuid && uuid.trim() !== "" ? uuid : null;
}

/**
 * The sheet's station, derived — never synced. Row taps seed the cache
 * (instant paint), shared links fetch by uuid, and the URL alone decides
 * open vs closed, so browser/Android back closes the sheet with no effect.
 */
export function useDetailStation() {
  const isClient = useIsClient();
  const uuid = useStationParam();
  const detail = useQuery({
    queryKey: ["radio", "detail", uuid],
    queryFn: () =>
      loadDetailApi().then(async (api) => {
        if (!uuid) return null;
        const fresh = await api.stationByUuid(uuid);
        if (fresh) return fresh;
        // A null refresh never blanks a station already on screen (tapped
        // rows seed the cache; a flaky directory still shows last-known).
        return queryClient.getQueryData<Station>(["radio", "detail", uuid]) ?? null;
      }),
    enabled: isClient && uuid !== null,
    staleTime: 1000 * 60,
  });
  return { uuid, ...detail };
}

/**
 * Open the sheet: seed the detail cache (marked stale, so the live stats
 * still refresh in the background) and push `?station=`. Push, not replace
 * — back then closes the sheet instead of leaving the app. `resetScroll`
 * keeps the list exactly where it was: opening details must never move the
 * page (previously no navigation happened at all).
 */
export function useOpenStationDetail(): (station: Station) => void {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (station: Station) => {
    queryClient.setQueryData(["radio", "detail", station.stationuuid], station, { updatedAt: 0 });
    void navigate({
      to: pathname,
      search: (prev) => ({ ...prev, station: station.stationuuid }),
      resetScroll: false,
    });
  };
}

/**
 * Close the sheet and strip `?station=`. Replace: closing records nothing,
 * so back never reopens it. `resetScroll` for the same reason as open.
 */
export function useCloseStationDetail(): () => void {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return () => {
    void navigate({
      to: pathname,
      search: (prev) => ({ ...prev, station: undefined }),
      replace: true,
      resetScroll: false,
    });
  };
}
