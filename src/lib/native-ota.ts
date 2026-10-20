import { App } from "@capacitor/app";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import { isFdroidDistribution } from "@/lib/distribution";
import { pickOtaUpdate, type OtaBundle } from "@/lib/ota";
import { envString } from "@/lib/utils";

/** Manifest host: explicit override wins, else the site serves its own. */
function resolveOtaBase(): string {
  const override = envString("VITE_OTA_URL")?.replace(/\/+$/, "");
  const canonical = envString("VITE_CANONICAL_URL")?.replace(/\/+$/, "");
  // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- empty env var counts as unset and falls through to the canonical base
  return override || (canonical ? `${canonical}/ota` : "");
}

/**
 * After an OTA applies, `App.getInfo()` still reports the NATIVE versionName.
 * Prefer the live bundle version so the staged bundle is not re-picked every
 * boot. Bundle info unavailable leaves the native version in place.
 */
async function currentBundleVersion(fallback: string): Promise<string> {
  try {
    const current = await CapacitorUpdater.current();
    if (current?.bundle && current.bundle.id !== "builtin" && current.bundle.version) {
      return current.bundle.version;
    }
  } catch {
    // Bundle info unavailable — the native version stands.
  }
  return fallback;
}

/** Fetch the static manifest; aborts are cleanup, not failures. */
function fetchOtaManifest(base: string, signal: AbortSignal): Promise<unknown> {
  return fetch(`${base}/production.json`, { cache: "no-store", signal })
    .then((response) => (response.ok ? response.json() : null))
    .catch((error: unknown) => {
      if (!signal.aborted) console.warn("[ota] check", error instanceof Error ? error.message : error);
      return null;
    });
}

/** Download the selected bundle; a failure is reported and treated as dormant. */
function downloadOtaBundle(update: OtaBundle): Promise<{ id: string } | null> {
  return CapacitorUpdater.download({
    url: update.url,
    version: update.version,
    checksum: update.checksum,
  }).catch((error: unknown) => {
    console.warn("[ota] download", error instanceof Error ? error.message : error);
    return null;
  });
}

/** Stage a downloaded bundle; a failure is reported and still resolves. */
async function stageOtaBundle(bundleId: string): Promise<void> {
  await CapacitorUpdater.next({ id: bundleId }).catch((error: unknown) => {
    console.warn("[ota] stage", error instanceof Error ? error.message : error);
  });
}

/**
 * One-shot OTA check: mark the running bundle healthy, fetch the static
 * manifest, and stage any newer compatible bundle for next launch. Every
 * step is abort-aware and failures resolve null, never throw past the boot
 * path. Returns the staged version, or null when nothing staged.
 */
export async function runOtaUpdateCheck(signal: AbortSignal): Promise<string | null> {
  // Store-managed builds must not contact or stage anything through the
  // sideload updater, including its initial app-ready notification.
  if (isFdroidDistribution()) return null;

  try {
    await CapacitorUpdater.notifyAppReady();
  } catch (error: unknown) {
    console.warn("[ota] app-ready", error instanceof Error ? error.message : error);
  }
  if (signal.aborted) return null;
  const base = resolveOtaBase();
  if (!base) return null;
  const info = await App.getInfo().catch((error: unknown) => {
    console.warn("[ota] app-info", error instanceof Error ? error.message : error);
    return null;
  });
  if (signal.aborted || !info) return null;
  const currentVersion = await currentBundleVersion(info.version);
  if (signal.aborted) return null;
  const manifest = await fetchOtaManifest(base, signal);
  const update = pickOtaUpdate(manifest, currentVersion, Number(info.build) || 0);
  if (signal.aborted || !update) return null;
  const bundle = await downloadOtaBundle(update);
  if (signal.aborted || !bundle) return null;
  await stageOtaBundle(bundle.id);
  console.info(`[ota] staged ${update.version}, applies on next launch`);
  return update.version;
}
