import type { LyricStanza } from "./lyrics";

/**
 * Lazy bridge to the LRCLIB client, so zod and the record matcher stay out of
 * the initial chunk until lyrics are actually read.
 *
 * Separate from `lyrics.ts` because that module is what `lrclib.ts` imports for
 * parsing, and a dynamic import back the other way is a cycle.
 */
export async function requestLyrics(track: string, signal?: AbortSignal): Promise<LyricStanza[] | null> {
  const { fetchLyrics } = await import("./lrclib");
  return fetchLyrics(track, { signal });
}
