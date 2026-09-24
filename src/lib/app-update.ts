import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { isNative } from "@/lib/capacitor";
import { isFdroidDistribution } from "@/lib/distribution";
import { compareOtaVersions } from "@/lib/ota";

/**
 * APK update check for sideloaded installs (no Play Store to do it).
 * OTA bundles can never carry native changes, so a full release still
 * needs a human tap: compare the installed versionName against the latest
 * GitHub release (prereleases excluded by the API, so `ota-*` tags can
 * never leak in) and offer the APK asset.
 */

const LATEST_RELEASE_URL = "https://api.github.com/repos/Double77x/radioscout/releases/latest";
const CHECK_KEY = "radioscout:apk-update-checked";
/** One check per day — unauthenticated API quota is 60/hr per IP. */
const CHECK_INTERVAL_MS = 1000 * 60 * 60 * 24;
const FETCH_TIMEOUT_MS = 10_000;

export interface ApkUpdate {
  installed: string;
  latest: string;
  url: string;
}

/** Release tags are `v0.1.6`; versionNames are `0.1.6`. */
export function stripReleasePrefix(tag: string): string {
  return tag.trim().replace(/^v/i, "");
}

/** True when the release tag is strictly newer than the installed version. Never throws. */
export function isUpgradeAvailable(tag: string, installed: string): boolean {
  const latest = stripReleasePrefix(tag);
  const current = installed.trim();
  if (latest === "" || current === "") return false;
  try {
    return compareOtaVersions(latest, current) > 0;
  } catch {
    return false;
  }
}

interface ReleaseAsset {
  name?: unknown;
  browser_download_url?: unknown;
}

/** APK asset wins; the release page is the fallback. Null when neither exists. */
export function pickDownloadUrl(payload: { assets?: unknown; html_url?: unknown }): string | null {
  if (Array.isArray(payload.assets)) {
    for (const row of payload.assets as ReleaseAsset[]) {
      const url = typeof row.browser_download_url === "string" ? row.browser_download_url : "";
      const name = typeof row.name === "string" ? row.name : "";
      if (url !== "" && /\.apk$/i.test(name)) return url;
    }
  }
  return typeof payload.html_url === "string" && payload.html_url !== "" ? payload.html_url : null;
}

/**
 * Newer APK on GitHub, or null (web, checked today, unreachable, current).
 * Marks the check date only on a successful fetch so failures retry next boot.
 */
export async function checkApkUpdate(): Promise<ApkUpdate | null> {
  if (!isNative() || isFdroidDistribution()) return null;
  try {
    const last = Number(globalThis.localStorage?.getItem(CHECK_KEY));
    if (Number.isFinite(last) && Date.now() - last < CHECK_INTERVAL_MS) return null;
  } catch {
    // Private mode etc — check anyway, once per boot at most.
  }
  const info = await App.getInfo().catch(() => null);
  if (!info) return null;
  const payload = await fetch(LATEST_RELEASE_URL, {
    headers: { Accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
    .then((response) =>
      response.ok ? (response.json() as Promise<{ tag_name?: unknown; assets?: unknown; html_url?: unknown }>) : null,
    )
    .catch(() => null);
  if (!payload) return null;
  try {
    globalThis.localStorage?.setItem(CHECK_KEY, String(Date.now()));
  } catch {
    // Non-persisted check just runs again next boot.
  }
  const tag = typeof payload.tag_name === "string" ? payload.tag_name : "";
  if (!isUpgradeAvailable(tag, info.version ?? "")) return null;
  const url = pickDownloadUrl(payload);
  if (!url) return null;
  return { installed: info.version, latest: stripReleasePrefix(tag), url };
}

/** Hand the APK URL to the system browser (never the WebView). */
export function openApkDownload(url: string): Promise<void> {
  return Browser.open({ url });
}
