/**
 * Audio element utilities: hostname parsing plus retired-output parking.
 * Pure DOM helpers — no player state read or written — shared by the live
 * element lifecycle and the handoff staging path.
 */

/** Lowercased hostname of a URL, null when unparseable. Never throws. */
export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

/** Retired output: element + listeners + graph, parked exactly once. */
export interface RetiredOutput {
  element: HTMLAudioElement;
  abort: AbortController | null;
  ctx: AudioContext | null;
}

/** Park a retired element: detach, silence, clear, close graph. Idempotent. */
export function parkRecord(record: RetiredOutput): void {
  try {
    record.abort?.abort();
  } catch {
    // Already detached — teardown below still applies.
  }
  try {
    record.element.pause();
  } catch {
    // Already paused — clearing still applies.
  }
  try {
    record.element.removeAttribute("src");
    record.element.load();
  } catch {
    // Detached regardless; the graph close still applies.
  }
  if (record.ctx) void record.ctx.close().catch(() => {});
}
