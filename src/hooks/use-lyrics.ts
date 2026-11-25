import { useQuery } from "@tanstack/react-query";
import type { LyricStanza } from "@/lib/radio/lyrics";
import { requestLyrics } from "@/lib/radio/lyrics-client";

/** Same guard as the query client: an SSR GC timer keeps the build process alive. */
const isServer = globalThis.window === undefined;

/**
 * Full lyrics for the current StreamTitle, timing stripped and grouped into
 * stanzas. `enabled` is the caller's gate: the row that reads them only asks
 * once it is opened (and only while live titles are on), so a closed row costs
 * nothing. The client module is imported lazily so zod and the LRCLIB parser
 * stay out of the initial chunk. Cached per title: a repeated song costs no
 * request, and a miss is not retried beyond TanStack's own retry.
 */
export function useLyrics(track: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["radio", "lyrics", track],
    queryFn: ({ signal }): Promise<LyricStanza[] | null> => {
      if (track === null) return Promise.resolve(null);
      return requestLyrics(track, signal);
    },
    enabled: enabled && track !== null,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: isServer ? 0 : 30 * 60_000,
    // No automatic retry: the only rejection is LRCLIB asking us to wait, and
    // TanStack's own backoff would fire inside the window `Retry-After` named.
    // The answer is not cached as data, so reopening the row tries again.
    retry: false,
    refetchOnWindowFocus: false,
  });
}
