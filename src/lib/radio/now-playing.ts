/**
 * Web now-playing titles via the same-origin `/api/now-playing` edge route
 * (which reads one ICY block server-side). Best-effort by contract: any
 * failure — proxy down, station sends no metadata, timeout — resolves null
 * and the dock falls back to genre tags. Never throws.
 */
export async function fetchWebTitle(streamUrl: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const response = await fetch(`/api/now-playing?url=${encodeURIComponent(streamUrl)}`, { signal });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    const title =
      typeof data === "object" && data !== null && "title" in data && typeof data.title === "string"
        ? data.title.trim()
        : "";
    return title === "" ? null : title;
  } catch {
    return null;
  }
}
