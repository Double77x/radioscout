import { toast } from "sonner";
import { isNative } from "@/lib/capacitor";

/**
 * Service-worker registration (web only — the native shell neither emits
 * nor registers one, so this is a no-op there by construction).
 *
 * What offline means here: the shell, favourites, history, stats and the
 * cached directory stay readable with no connection; playback still needs
 * the network (live streams are never cached — see `scripts/generate-sw.mjs`).
 * The two toasts below are the whole update UX: ready once on first install,
 * then a reload action whenever a waiting worker means a new bundle landed.
 */
export function registerServiceWorker(): void {
  if (isNative()) return;
  try {
    if (!("serviceWorker" in navigator)) return;
    const register = (): void => {
      navigator.serviceWorker
        .register("/sw.js")
        .then(
          (registration) => {
            // Fresh install with no controller yet: the shell just became
            // offline-capable.
            if (!navigator.serviceWorker.controller) {
              toast("Available offline", {
                description: "Favourites, history and stats open without a connection — playback still needs one.",
              });
            }
            // A waiting worker means a newer bundle already downloaded.
            if (registration.waiting) {
              notifyWaiting(registration.waiting);
              return;
            }
            registration.addEventListener("updatefound", () => {
              const installing = registration.installing;
              if (!installing) return;
              installing.addEventListener("statechange", () => {
                if (installing.state === "installed" && navigator.serviceWorker.controller) {
                  notifyWaiting(installing);
                }
              });
            });
          },
          () => {
            // Registration rejected (private mode, unsupported context) —
            // the app works exactly as before, just online-only.
          },
        )
        .catch(() => {});
    };
    if (document.readyState === "complete") register();
    else globalThis.addEventListener("load", register, { once: true });
  } catch {
    // No navigator/serviceWorker here (prerender) — nothing to do.
  }
}

/** Offer the reload that swaps in a waiting worker. Best-effort. */
function notifyWaiting(worker: ServiceWorker): void {
  toast("Update downloaded", {
    description: "A new version is ready.",
    action: {
      label: "Reload",
      onClick: () => {
        try {
          worker.postMessage({ type: "SKIP_WAITING" });
        } catch {
          globalThis.location.reload();
        }
      },
    },
  });
}
