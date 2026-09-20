/**
 * Lightweight OTA: a static manifest + zips in a public R2 bucket, no server.
 *
 * The Capgo plugin only stages/applies bundles (`download`/`next`/
 * `notifyAppReady`); version selection happens here, client-side, against
 * `<VITE_OTA_URL>/<channel>.json` published by `scripts/publish-ota.mjs`.
 * Unset `VITE_OTA_URL` (or any fetch/parse failure) means "no update" —
 * the updater stays dormant and boot is never blocked.
 */

export interface OtaBundle {
  /** Bundle version, e.g. "0.4.0+ota.2" (package.json core + per-core sequence). */
  version: string;
  /** Native versionCode range this bundle applies to (Android `build`). */
  min_version_code: number;
  max_version_code: number | null;
  /** Absolute https URL of the zip. */
  url: string;
  /** sha256 hex of the zip (verified by the plugin on download). */
  checksum: string;
}

export interface OtaManifest {
  channel: string;
  /** Newest first (publish script maintains the order). */
  versions: OtaBundle[];
}

/** Split "0.4.0+ota.2" into numeric core + ota sequence (missing ota = 0). Null on garbage. */
export function parseOtaVersion(version: string): { core: number[]; ota: number } | null {
  const match = /^(?<core>\d+(?:\.\d+)*)(?:\+ota\.(?<seq>\d+))?$/.exec(version.trim());
  if (!match?.groups) return null;
  return {
    core: (match.groups["core"] ?? "").split(".").map((part) => Math.trunc(Number(part))),
    ota: Number(match.groups["seq"] ?? "0"),
  };
}

/** Negative when a < b, positive when a > b, 0 when equal. Unparseable always loses. */
export function compareOtaVersions(a: string, b: string): number {
  const pa = parseOtaVersion(a);
  const pb = parseOtaVersion(b);
  if (!pa && !pb) return 0;
  if (!pa) return -1;
  if (!pb) return 1;
  const length = Math.max(pa.core.length, pb.core.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (pa.core[index] ?? 0) - (pb.core[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return pa.ota - pb.ota;
}

function isBundle(value: unknown): value is OtaBundle {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row["version"] === "string" &&
    parseOtaVersion(row["version"]) !== null &&
    typeof row["min_version_code"] === "number" &&
    (row["max_version_code"] === null || typeof row["max_version_code"] === "number") &&
    typeof row["url"] === "string" &&
    (row["url"] as string).startsWith("https://") &&
    typeof row["checksum"] === "string" &&
    (row["checksum"] as string) !== ""
  );
}

/**
 * Newest manifest bundle newer than `currentVersion` (the APK's version_name)
 * and compatible with `nativeVersionCode` (the APK's Android build number),
 * or null when there is nothing to stage. Tolerates garbage manifests.
 */
export function pickOtaUpdate(manifest: unknown, currentVersion: string, nativeVersionCode: number): OtaBundle | null {
  if (typeof manifest !== "object" || manifest === null) return null;
  const versions = (manifest as { versions?: unknown }).versions;
  if (!Array.isArray(versions)) return null;
  const code = Math.trunc(nativeVersionCode) || 0;
  const candidates = versions.filter(
    (row): row is OtaBundle =>
      isBundle(row) &&
      row.min_version_code <= code &&
      (row.max_version_code === null || code <= row.max_version_code) &&
      compareOtaVersions(row.version, currentVersion) > 0,
  );
  candidates.sort((a, b) => compareOtaVersions(b.version, a.version));
  return candidates[0] ?? null;
}
