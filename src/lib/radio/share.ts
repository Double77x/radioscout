import { toast } from "sonner";
import { isNative } from "@/lib/capacitor";
import { siteConfig } from "@/lib/site";
import type { Station } from "./types";

/**
 * Shareable link for a station. Clean by design: just `?station=<uuid>`,
 * no search state. Native WebViews run on `capacitor://`/`localhost`
 * origins, so those fall back to the canonical site URL.
 */
export function stationShareUrl(stationuuid: string): string {
  const origin = globalThis.window?.location?.origin ?? siteConfig.url;
  const base = origin.includes("localhost") || origin.startsWith("capacitor:") ? siteConfig.url : origin;
  return `${base}/?station=${encodeURIComponent(stationuuid)}`;
}

/**
 * Share a station: native sheet on the APK, Web Share on mobile web,
 * clipboard + toast everywhere else.
 */
export async function shareStation(station: Station): Promise<void> {
  const url = stationShareUrl(station.stationuuid);
  const title = station.name;
  const text = `${station.name} — listen on RadioScout`;
  if (isNative()) {
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share({ title, text, url, dialogTitle: title });
      return;
    } catch {
      // Fall through to the clipboard below.
    }
  } else if (typeof navigator !== "undefined" && "share" in navigator) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (error: unknown) {
      // Dismissals stay quiet; real failures try the clipboard.
      if (error instanceof Error && error.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast("Link copied", { description: "Share it anywhere — it opens this station." });
  } catch {
    toast("Copy this link to share", { description: url });
  }
}
