import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useIsClient } from "@/hooks/use-is-client";
import { play } from "@/hooks/use-player";
import { normalizeAlias, resolveAlias } from "@/data/station-aliases";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PlayRequest {
  /** Exact uuid to fetch, or a name/alias to search. Null when no play requested. */
  kind: "uuid" | "search" | "none";
  value: string;
  /** Keep `?station=` in the URL (detail sheet) while stripping `play`. */
  keepStation: boolean;
}

/**
 * Pure `?play=` / `?station=&play=1` parser (unit-tested, no React).
 * `?play=<uuid>` plays exact; `?play=1`/`true` with `?station=<uuid>` plays
 * the sheet station; any other `?play=` value resolves via alias → search.
 */
export function parsePlayRequest(searchStr: string): PlayRequest {
  const params = new URLSearchParams(searchStr);
  const playParam = (params.get("play") ?? "").trim();
  const station = (params.get("station") ?? "").trim();
  if (playParam === "") return { kind: "none", value: "", keepStation: false };
  if ((playParam === "1" || playParam.toLowerCase() === "true") && UUID_PATTERN.test(station)) {
    return { kind: "uuid", value: station, keepStation: true };
  }
  if (UUID_PATTERN.test(playParam)) return { kind: "uuid", value: playParam, keepStation: station !== "" };
  return { kind: "search", value: playParam, keepStation: station !== "" };
}

/** API + alias map stay out of the initial bundle — loaded only for `?play=` resolution. */
const loadApi = () => import("@/lib/radio/api");

/**
 * Agentic autoplay: resolves `?play=` once per value, then strips it with
 * `replace` so refresh never replays. Client-only (SSR no-ops); the dynamic
 * API import keeps the directory client out of the initial bundle.
 * A navigation-driven one-shot with cleanup-by-replace — effect by nature.
 */
export function useAgenticPlay(): void {
  const isClient = useIsClient();
  const searchStr = useLocation({ select: (location) => location.searchStr });
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const handled = useRef<string | null>(null);

  // eslint-disable-next-line react-doctor/effect-needs-cleanup
  useEffect(() => {
    if (!isClient) return;
    const request = parsePlayRequest(searchStr);
    if (request.kind === "none") return;
    const key = `${request.kind}:${request.value}`;
    if (handled.current === key) return;
    handled.current = key;

    const stripPlay = () => {
      void navigate({
        to: pathname,
        search: (prev) => ({ ...prev, play: undefined }),
        replace: true,
        resetScroll: false,
      });
    };

    if (request.kind === "uuid") {
      void loadApi().then(
        (api) => {
          void api
            .stationByUuid(request.value)
            .then((station) => {
              if (station) play(station);
            })
            .finally(stripPlay);
        },
        () => stripPlay(),
      );
      return;
    }

    const aliased = resolveAlias(request.value) ?? request.value;
    const term = aliased.trim() === "" ? normalizeAlias(request.value).replaceAll("-", " ") : aliased;
    void loadApi().then(
      (api) => {
        void api
          .searchStationsIlike(term || request.value, undefined, 5)
          .then((hits) => {
            if (hits.length > 0 && hits[0]) play(hits[0]);
          })
          .finally(stripPlay);
      },
      () => stripPlay(),
    );
  }, [isClient, searchStr, pathname, navigate]);
}
