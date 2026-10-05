/**
 * Web-only service-worker build (`node scripts/generate-sw.mjs`, chained in
 * the `build` task in `vite.config.ts`).
 *
 * Why a script and not vite-plugin-pwa: the plugin's output hooks never
 * fire under TanStack Start's multi-environment build (no sw.js emitted,
 * no error — verified), so generation runs here explicitly with
 * workbox-build instead. Registration stays hand-rolled in `src/lib/pwa.ts`
 * (plain `navigator.serviceWorker`, no workbox-window needed).
 *
 * Web builds emit `dist/client/sw.js` (+ the workbox runtime); native
 * builds (`CAPACITOR_BUILD=1`, set by `cap:android`) skip generation AND
 * delete stale artifacts — the native shell must never bundle a worker
 * (stale-HTML vs OTA conflicts), and `dist/` persists between builds.
 */
import { join } from "node:path";
import { stripServiceWorker } from "./strip-sw.mjs";

const OUT_DIR = join(import.meta.dirname, "..", "dist", "client");
const SW_DEST = join(OUT_DIR, "sw.js");

async function main() {
  if (process.env.CAPACITOR_BUILD === "1") {
    const removed = stripServiceWorker(OUT_DIR);
    if (removed.length > 0) console.log(`[sw] removed stale ${removed.join(", ")} (native build)`);
    console.log("[sw] skipped (CAPACITOR_BUILD=1)");
    return;
  }
  const { generateSW } = await import("workbox-build");
  const { count, size } = await generateSW({
    globDirectory: OUT_DIR,
    globPatterns: ["**/*.{html,js,css,ico,png,svg,webp,woff,woff2,webmanifest,json,txt,xml}"],
    swDest: SW_DEST,
    cleanupOutdatedCaches: true,
    // Claim clients on activate: the installing page comes under control
    // immediately instead of needing a reload first. Safe: the precache is
    // always this deploy's files, so there is nothing stale to serve.
    // skipWaiting stays off — updates apply through the Reload action.
    clientsClaim: true,
    // Offline navigations fall back to the cached app shell (the client
    // router then renders the route from precached chunks); /api/* and
    // media streams always hit the network (see runtimeCaching).
    navigateFallback: "/index.html",
    navigateFallbackDenylist: [/^\/api\//],
    runtimeCaching: [
      {
        urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
        handler: "NetworkOnly",
      },
      {
        // Directory rows stay browsable offline; refreshed daily.
        urlPattern: /^https:\/\/.*\.api\.radio-browser\.info\/.*/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "directory",
          expiration: { maxEntries: 100, maxAgeSeconds: 86_400 },
        },
      },
      {
        // Station artwork (already proxied): immutable enough for a month.
        urlPattern: ({ request }) => request.destination === "image",
        handler: "CacheFirst",
        options: {
          cacheName: "artwork",
          expiration: { maxEntries: 200, maxAgeSeconds: 30 * 86_400 },
        },
      },
    ],
  });
  console.log(`[sw] precached ${count} files (${size} bytes) → ${SW_DEST}`);
}

await main();
