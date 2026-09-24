import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { App } from "@capacitor/app";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { isNative, getPlatform } from "@/lib/capacitor";
import { isFdroidDistribution } from "@/lib/distribution";
import { pickOtaUpdate } from "@/lib/ota";
import { playBackTransition } from "@/lib/animated-back";
import { checkpointListeningSession } from "@/lib/player/store";

/**
 * Native-shell bootstrap (Capacitor only — no-op on web).
 * Client-only by construction: effects never run during SSG prerender.
 * Static imports are deliberate: the oxlint hooks plugin cannot parse
 * dynamic `import()` inside effects, and these packages are SSR-safe
 * (no DOM access at import time) plus tiny enough for the shared bundle.
 */
/**
 * One-shot OTA check: mark the running bundle healthy, fetch the static
 * manifest, and stage any newer compatible bundle for next launch.
 * Module-level (not inline) so the effect below stays a thin subscription;
 * every step is abort-aware and failures resolve null, never throw past
 * the boot path. Returns the staged version, or null when nothing staged.
 */
async function runOtaUpdateCheck(signal: AbortSignal): Promise<string | null> {
  // Store-managed builds must not contact or stage anything through the
  // sideload updater, including its initial app-ready notification.
  if (isFdroidDistribution()) return null;

  try {
    await CapacitorUpdater.notifyAppReady();
  } catch (error: unknown) {
    console.warn("[ota] app-ready", error instanceof Error ? error.message : error);
  }
  if (signal.aborted) return null;
  // Manifest host: explicit override wins, else the site serves its own
  // manifest (`public/ota/` in this repo). Unresolvable base (or a 404
  // before the first publish) means dormant — never an error.
  const override = (import.meta.env.VITE_OTA_URL as string | undefined)?.replace(/\/+$/, "");
  const canonical = (import.meta.env.VITE_CANONICAL_URL as string | undefined)?.replace(/\/+$/, "");
  const base = override || (canonical ? `${canonical}/ota` : "");
  if (!base) return null;
  const info = await App.getInfo().catch((error: unknown) => {
    console.warn("[ota] app-info", error instanceof Error ? error.message : error);
    return null;
  });
  if (signal.aborted || !info) return null;
  // Version basis: after an OTA applies, App.getInfo() still reports the
  // NATIVE versionName — comparing against it would re-pick the staged
  // bundle every boot. Prefer the live bundle version instead.
  let currentVersion = info.version;
  try {
    const current = await CapacitorUpdater.current();
    if (current?.bundle && current.bundle.id !== "builtin" && current.bundle.version) {
      currentVersion = current.bundle.version;
    }
  } catch {
    // Bundle info unavailable — the native version stands.
  }
  if (signal.aborted) return null;
  const manifest = await fetch(`${base}/production.json`, { cache: "no-store", signal })
    .then((response) => (response.ok ? response.json() : null))
    .catch((error: unknown) => {
      // Aborts are cleanup, not failures — stay quiet on unmount.
      if (!signal.aborted) console.warn("[ota] check", error instanceof Error ? error.message : error);
      return null;
    });
  const update = pickOtaUpdate(manifest, currentVersion, Number(info.build) || 0);
  if (signal.aborted || !update) return null;
  const bundle = await CapacitorUpdater.download({
    url: update.url,
    version: update.version,
    checksum: update.checksum,
  }).catch((error: unknown) => {
    console.warn("[ota] download", error instanceof Error ? error.message : error);
    return null;
  });
  if (signal.aborted || !bundle) return null;
  await CapacitorUpdater.next({ id: bundle.id }).catch((error: unknown) => {
    console.warn("[ota] stage", error instanceof Error ? error.message : error);
  });
  console.info(`[ota] staged ${update.version}, applies on next launch`);
  return update.version;
}

export function NativeShell() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();

  // Status bar follows the resolved theme (re-runs on theme change).
  useEffect(() => {
    if (!isNative()) return;
    let cancelled = false;
    (async () => {
      await StatusBar.setOverlaysWebView({ overlay: false });
      if (cancelled) return;
      await StatusBar.setStyle({ style: resolvedTheme === "dark" ? Style.Dark : Style.Light });
    })().catch((error: unknown) => console.error("[native] status-bar", error));
    return () => {
      cancelled = true;
    };
  }, [resolvedTheme]);

  // Splash hide + Android hardware back button, once per mount.
  // The back-button listener is Android-only (no hardware back on iOS).
  // Cleanup owns every allocation: the `cancelled` flag plus the immediate
  // remove on the unmount-during-subscribe race above guarantee no listener
  // outlives this effect — the rule cannot see that ownership statically.
  // eslint-disable-next-line react-doctor/effect-needs-cleanup
  useEffect(() => {
    if (!isNative()) return;
    let handle: { remove: () => Promise<void> } | undefined = undefined;
    let cancelled = false;
    (async () => {
      // Independent of the back-button subscription below.
      await SplashScreen.hide();
      if (cancelled || getPlatform() !== "android") return;
      const listener = await App.addListener("backButton", () => {
        if (globalThis.history.length > 1) {
          // Animated when a SwipeBack frame is mounted; instant otherwise.
          playBackTransition(() => router.history.back());
        } else {
          void App.exitApp();
        }
      });
      // Unmounted while subscribing: the stale cleanup already ran with an
      // empty handle, so own this allocation and remove it immediately —
      // otherwise the listener outlives the shell and fires into a dead router.
      if (cancelled) {
        await listener.remove().catch((error: unknown) => console.error("[native] shell", error));
        return;
      }
      handle = listener;
    })().catch((error: unknown) => console.error("[native] shell", error));
    return () => {
      cancelled = true;
      void handle?.remove();
    };
  }, [router]);

  // Listening checkpoint on background/kill (native): bank the partial
  // session when the app leaves the foreground — the OS may kill the WebView
  // with no further events. Same subscribe-race ownership as the back-button
  // effect above (checkpointing is idempotent: sub-threshold banks no-op).
  // eslint-disable-next-line react-doctor/effect-needs-cleanup
  useEffect(() => {
    if (!isNative()) return;
    let handle: { remove: () => Promise<void> } | undefined = undefined;
    let cancelled = false;
    void App.addListener("appStateChange", (event) => {
      if (!event.isActive) checkpointListeningSession();
    })
      .then((listener) => {
        if (cancelled) {
          listener.remove().catch((error: unknown) => console.error("[native] listening", error));
          return;
        }
        handle = listener;
      })
      .catch((error: unknown) => console.error("[native] listening", error));
    return () => {
      cancelled = true;
      void handle?.remove();
    };
  }, []);

  // OTA update check (static in-repo manifest + GitHub Release zips, see
  // `src/lib/ota.ts` and `scripts/publish-ota.mjs`), once per mount. The work lives in `runOtaUpdateCheck` above; the effect only
  // owns the abort signal, so unmounting mid-check cancels the fetch and
  // every later step stands down via the same signal. A freshly staged
  // bundle surfaces as a restart toast (it would otherwise apply silently
  // on the next backgrounding with no signal anything changed).
  // Justification for no-fetch-in-effect: one-shot native boot check (not
  // reactive data — Query would add a subscription lifecycle to a
  // fire-and-forget bridge call), abort-guarded end to end.
  // eslint-disable-next-line react-doctor/effect-needs-cleanup, react-doctor/no-fetch-in-effect
  useEffect(() => {
    if (!isNative()) return;
    const controller = new AbortController();
    void runOtaUpdateCheck(controller.signal)
      .then((staged) => {
        if (staged && !controller.signal.aborted) {
          toast("Update downloaded", {
            description: `${staged} applies on next launch — or restart now.`,
            action: {
              label: "Restart now",
              onClick: () =>
                void CapacitorUpdater.reload().catch((error: unknown) => console.error("[ota] reload", error)),
            },
          });
        }
      })
      .catch((error: unknown) => console.error("[ota]", error));
    return () => {
      controller.abort();
    };
  }, []);

  return null;
}
