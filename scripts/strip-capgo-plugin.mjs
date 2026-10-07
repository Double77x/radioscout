/**
 * Remove the Capgo updater from Capacitor's generated plugin registry.
 *
 * `cap sync` writes `android/app/src/main/assets/capacitor.plugins.json`, and the
 * native bridge reads it at startup to decide which plugin classes to
 * instantiate. The F-Droid recipe strips the updater from the generated Gradle
 * project *and* from this registry: deleting only the Gradle lines leaves the
 * registry pointing at a plugin class that is no longer on the classpath.
 *
 * This lives in the repository rather than in the `fdroiddata` recipe for two
 * reasons. The registry is JSON, and shell text tools cannot edit it safely —
 * a `sed` range delete leaves a trailing comma when the removed entry is last,
 * which it is. And both the recipe and the reference workflow must apply exactly
 * the same transform, or the F-Droid build stops reproducing the signed
 * reference APK. One implementation, called by both, cannot drift.
 *
 * The file is re-serialised rather than edited in place. Serialising it here
 * means the bytes we emit are fixed by this script and do not depend on whatever
 * formatter produced the input.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_REGISTRY = join(
  import.meta.dirname,
  "..",
  "android",
  "app",
  "src",
  "main",
  "assets",
  "capacitor.plugins.json",
);

const UPDATER_PKG = "@capgo/capacitor-updater";

/**
 * The `pkg` name of a registry entry, or null if the entry is not a plugin.
 *
 * @param {unknown} entry
 * @returns {string | null}
 */
function pluginName(entry) {
  if (typeof entry !== "object" || entry === null || !("pkg" in entry)) return null;
  const { pkg } = entry;
  return typeof pkg === "string" ? pkg : null;
}

/**
 * Drop the Capgo updater entry, in place. Returns the names removed.
 *
 * @param {string} [registryPath]
 * @returns {string[]}
 */
export function stripCapgoPlugin(registryPath = DEFAULT_REGISTRY) {
  if (!existsSync(registryPath)) return [];
  /** @type {unknown} */
  const parsed = JSON.parse(readFileSync(registryPath, "utf8"));
  if (!Array.isArray(parsed)) return [];
  /** @type {unknown[]} */
  const entries = parsed;

  const removed = entries.map((entry) => pluginName(entry)).filter((name) => name === UPDATER_PKG);
  if (removed.length === 0) return [];
  writeFileSync(
    registryPath,
    JSON.stringify(
      entries.filter((entry) => pluginName(entry) !== UPDATER_PKG),
      null,
      2,
    ),
  );
  return removed;
}

const invokedDirectly = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  const removed = stripCapgoPlugin(process.argv[2]);
  console.log(removed.length > 0 ? `[capgo] stripped ${removed.join(", ")}` : "[capgo] nothing to strip");
}
