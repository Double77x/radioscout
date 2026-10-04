import { isRecord } from "@/lib/utils";

/**
 * Session-persistent memory of stream URLs this browser could not read
 * directly (refused `icy-metadata` preflight, no `Access-Control-Allow-Origin`).
 * A refusal is logged by the browser and cannot be caught, so without this
 * every visit replays one console error per station. Entries expire after a
 * week: a station fixing its CORS headers should be retried, and the worst
 * a stale entry costs is the edge hop, never the titles.
 */

const STORAGE_KEY = "radioscout:icy-direct-unsupported";
const MAX_ENTRIES = 200;
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/** Stored map URL → first-seen timestamp; empty when absent or corrupt. Never throws. */
function readStored(): Record<string, number> {
  try {
    if (globalThis.window === undefined) return {};
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (typeof raw !== "string" || raw === "") return {};
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    const out: Record<string, number> = {};
    for (const [url, at] of Object.entries(parsed)) {
      if (typeof at === "number" && Number.isFinite(at)) out[url] = at;
    }
    return out;
  } catch {
    return {};
  }
}

/** URLs to skip the in-page read for. Never throws. */
export function loadDirectUnsupported(): Set<string> {
  const now = Date.now();
  const out = new Set<string>();
  for (const [url, at] of Object.entries(readStored())) {
    if (now - at < EXPIRY_MS) out.add(url);
  }
  return out;
}

/** Remember a URL the in-page read could not use. Never throws. */
export function recordDirectUnsupported(url: string): void {
  try {
    if (globalThis.window === undefined || url === "") return;
    const stored = readStored();
    stored[url] = Date.now();
    const freshest = Object.entries(stored)
      .toSorted(([, a], [, b]) => a - b)
      .slice(-MAX_ENTRIES);
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(freshest)));
  } catch {
    // Private mode etc — the session memo still bounds it to one attempt.
  }
}
