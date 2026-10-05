/**
 * Delete generated service-worker artifacts from a web build directory.
 *
 * The native shell must never bundle a worker (stale-HTML vs OTA
 * conflicts), but `dist/` persists between builds and the `vp run build`
 * task cache replays outputs — so an environment flag alone cannot
 * guarantee a clean native bundle. Every native pipeline therefore strips
 * unconditionally, right before consuming `dist/client`:
 * - `cap:android` (`package.json`) before `cap sync`,
 * - `release-apk.yml` before Gradle assembles,
 * - `publish-ota.mjs` before zipping (OTA bundles ride native shells).
 *
 * Web (Pages) deploys never call this — the worker ships there.
 */
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_OUT_DIR = join(import.meta.dirname, "..", "dist", "client");

/** Remove sw.js (+map) and the workbox runtime. Returns removed names. */
export function stripServiceWorker(outDir = DEFAULT_OUT_DIR) {
  if (!existsSync(outDir)) return [];
  const removed = [];
  for (const name of readdirSync(outDir)) {
    if (name === "sw.js" || name === "sw.js.map" || /^workbox-.*\.js(?<map>\.map)?$/.test(name)) {
      rmSync(join(outDir, name), { force: true });
      removed.push(name);
    }
  }
  return removed;
}

const invokedDirectly = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  const removed = stripServiceWorker();
  console.log(removed.length > 0 ? `[sw] stripped ${removed.join(", ")}` : "[sw] nothing to strip");
}
