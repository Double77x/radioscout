import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { App } from "@capacitor/app";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { useTheme } from "@/lib/theme";
import { toast } from "sonner";
import { isNative, getPlatform } from "@/lib/capacitor";
import { runOtaUpdateCheck } from "@/lib/native-ota";
import { playBackTransition } from "@/lib/animated-back";
import { checkpointListeningSession } from "@/lib/player/store";
import { syncNativeStation } from "@/hooks/use-player";

/**
 * Native-shell bootstrap (Capacitor only — no-op on web).
 * Client-only by construction: effects never run during SSG prerender.
 * Static imports are deliberate: the oxlint hooks plugin cannot parse
 * dynamic `import()` inside effects, and these packages are SSR-safe
 * (no DOM access at import time) plus tiny enough for the shared bundle.
 */
export function NativeShell() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();

  // Status bar follows the resolved theme (re-runs on theme change).
  useEffect(() => {
    if (!isNative()) return () => {};
    let cancelled = false;
    (async () => {
      await StatusBar.setOverlaysWebView({ overlay: false });
      if (cancelled) return;
      await StatusBar.setStyle({ style: resolvedTheme === "dark" ? Style.Dark : Style.Light });
    })().catch((error: unknown) => {
      console.error("[native] status-bar", error);
    });
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
    if (!isNative()) return () => {};
    let handle: { remove: () => Promise<void> } | undefined = undefined;
    let cancelled = false;
    (async () => {
      // Independent of the back-button subscription below.
      await SplashScreen.hide();
      if (cancelled || getPlatform() !== "android") return;
      const listener = await App.addListener("backButton", () => {
        if (globalThis.history.length > 1) {
          // Animated when a SwipeBack frame is mounted; instant otherwise.
          playBackTransition(() => {
            router.history.back();
          });
        } else {
          void App.exitApp();
        }
      });
      // Unmounted while subscribing: the stale cleanup already ran with an
      // empty handle, so own this allocation and remove it immediately —
      // otherwise the listener outlives the shell and fires into a dead router.
      if (cancelled) {
        await listener.remove().catch((error: unknown) => {
          console.error("[native] shell", error);
        });
        return;
      }
      handle = listener;
    })().catch((error: unknown) => {
      console.error("[native] shell", error);
    });
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
    if (!isNative()) return () => {};
    let handle: { remove: () => Promise<void> } | undefined = undefined;
    let cancelled = false;
    void App.addListener("appStateChange", (event) => {
      // Foreground again after car/lock-screen presses the WebView slept
      // through: adopt whatever the service is actually playing so the dock
      // can't show a stale station. No-op when already in sync.
      if (event.isActive) syncNativeStation();
      else checkpointListeningSession();
    })
      .then((listener) => {
        if (cancelled) {
          listener.remove().catch((error: unknown) => {
            console.error("[native] listening", error);
          });
          return;
        }
        handle = listener;
      })
      .catch((error: unknown) => {
        console.error("[native] listening", error);
      });
    return () => {
      cancelled = true;
      void handle?.remove();
    };
  }, []);

  // OTA update check (static in-repo manifest + GitHub Release zips, see
  // `src/lib/ota.ts` and `scripts/publish-ota.mjs`), once per mount. The work lives in `src/lib/native-ota.ts`; the effect only
  // owns the abort signal, so unmounting mid-check cancels the fetch and
  // every later step stands down via the same signal. A freshly staged
  // bundle surfaces as a restart toast (it would otherwise apply silently
  // on the next backgrounding with no signal anything changed).
  // Justification for no-fetch-in-effect: one-shot native boot check (not
  // reactive data — Query would add a subscription lifecycle to a
  // fire-and-forget bridge call), abort-guarded end to end.
  // eslint-disable-next-line react-doctor/effect-needs-cleanup, react-doctor/no-fetch-in-effect
  useEffect(() => {
    if (!isNative()) return () => {};
    const controller = new AbortController();
    void runOtaUpdateCheck(controller.signal)
      .then((staged) => {
        if (staged && !controller.signal.aborted) {
          toast("Update downloaded", {
            description: `${staged} applies on next launch — or restart now.`,
            action: {
              label: "Restart now",
              onClick: () =>
                void CapacitorUpdater.reload().catch((error: unknown) => {
                  console.error("[ota] reload", error);
                }),
            },
          });
        }
      })
      .catch((error: unknown) => {
        console.error("[ota]", error);
      });
    return () => {
      controller.abort();
    };
  }, []);

  return null;
}
