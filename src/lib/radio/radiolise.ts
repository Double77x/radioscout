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
 * One-shot title lookup against the open Radiolise metadata API.
 *
 * Warm stations answer almost immediately because their server holds the
 * upstream ICY connection open across callers; cold ones hang until their
 * first published title, so callers cap this well under the poll interval and
 * fall through on anything but `ok`.
 *
 * POST, not GET: query parameters land in their server logs, which would
 * record who listens to what on every poll. The JSON body carries the same
 * field their route already reads.
 *
 * Chain order, the timeout cap and the outcome table: docs/modules/radio/radiolise.md
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
