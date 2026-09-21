import { useQuery } from "@tanstack/react-query";
import { useLocation, useRouter } from "@tanstack/react-router";
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
 * Rewrite the current URL's `station` param on the history stack, keeping
 * every other param (`q`, `tag`) intact. Raw history, not `navigate`: the
 * update targets whatever route is current (the dock opens details from
 * legal pages too), and untyped `navigate` cannot express a cross-route
 * search change. Same push/replace stack semantics either way.
 */
function pushStationParam(router: ReturnType<typeof useRouter>, uuid: string | null, replace: boolean): void {
  const { pathname, searchStr } = router.state.location;
  const params = new URLSearchParams(searchStr);
  if (uuid === null) params.delete("station");
  else params.set("station", uuid);
  const query = params.toString();
  const href = query === "" ? pathname : `${pathname}?${query}`;
  if (replace) router.history.replace(href);
  else router.history.push(href);
}

/**
 * Open the sheet: seed the detail cache (marked stale, so the live stats
 * still refresh in the background) and push `?station=`. Push, not replace
 * — back then closes the sheet instead of leaving the app.
 */
export function useOpenStationDetail(): (station: Station) => void {
  const router = useRouter();
  return (station: Station) => {
    queryClient.setQueryData(["radio", "detail", station.stationuuid], station, { updatedAt: 0 });
    pushStationParam(router, station.stationuuid, false);
  };
}

/**
 * Close the sheet and strip `?station=`. Replace: closing records nothing,
 * so back never reopens it.
 */
export function useCloseStationDetail(): () => void {
  const router = useRouter();
  return () => {
    pushStationParam(router, null, true);
  };
}
