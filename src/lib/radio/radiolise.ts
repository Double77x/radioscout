import { isRecord } from "@/lib/utils";
import { normalizeStreamTitle } from "./icy";

export const RADIOLISE_METADATA_ENDPOINT = "https://backend.radiolise.com/api/v1/metadata";

/** What a Radiolise lookup means for the caller. */
export type RadioliseOutcome = "ok" | "no-title" | "timeout" | "fetch-error" | "http-error";

export interface RadioliseFetchOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * One-shot title lookup against the open Radiolise metadata API
 * (`POST /api/v1/metadata`).
 *
 * Worth a slot at the head of the probe chain because their server holds the
 * upstream ICY connection open across callers: a warm station answers in
 * well under a second with no audio bytes pulled by anyone. Measured
 * 0.3–0.6s for Xtra Hot and Gold. Cold stations hang instead — their REST
 * route only responds on the first published title (measured 60s+ on
 * Capital XTRA) — so callers must cap this well under the poll interval and
 * fall through on anything but `ok`.
 *
 * POST, not GET: their docs warn query parameters land in server logs, which
 * would record who listens to what on every poll. The JSON body carries the
 * same field their route already reads.
 *
 * Returned titles run through the same `normalizeStreamTitle` as in-page
 * reads: their parser ships the raw stuffed value, ad markers included.
 * Never rejects: every failure maps to an outcome the caller can route on.
 */
export async function fetchRadioliseTitle(
  target: string,
  options?: RadioliseFetchOptions,
): Promise<{ outcome: RadioliseOutcome; title?: string }> {
  try {
    // Inside `try` on purpose (see `fetchIcyTitles`): the AbortSignal
    // combinators throw synchronously on older browsers.
    const timeout = AbortSignal.timeout(options?.timeoutMs ?? 5000);
    const signal = options?.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    const response = await fetch(RADIOLISE_METADATA_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: target }),
      signal,
    });
    if (!response.ok) return { outcome: "http-error" };
    const data: unknown = await response.json().catch(() => null);
    if (!isRecord(data) || typeof data.title !== "string") return { outcome: "no-title" };
    const title = normalizeStreamTitle(data.title);
    return title === "" ? { outcome: "no-title" } : { outcome: "ok", title };
  } catch (error) {
    const name =
      typeof error === "object" && error !== null && "name" in error && typeof error.name === "string"
        ? error.name
        : "";
    return { outcome: name === "AbortError" || name === "TimeoutError" ? "timeout" : "fetch-error" };
  }
}
