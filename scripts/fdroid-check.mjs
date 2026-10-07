/**
 * Repository-side F-Droid readiness gate.
 *
 * Verifies the contracts F-Droid cannot repair during its build: the committed
 * Android version must match package.json, the in-repo Fastlane listing must
 * contain valid, current assets for that versionCode, and the checked-in
 * `capacitor.config.fdroid.json` must still be exactly what
 * `capacitor.config.ts` resolves to in the F-Droid flavour.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");
/** @type {string[]} */
const failures = [];

/**
 * @param {string} name
 * @param {boolean} ok
 * @returns {void}
 */
function check(name, ok) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) failures.push(name);
}

/**
 * @param {string[]} parts
 * @returns {string}
 */
function absolute(...parts) {
  return path.join(root, ...parts);
}

/**
 * @param {string} relativePath
 * @returns {string}
 */
function readText(relativePath) {
  const file = absolute(relativePath);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    check(`${relativePath} exists`, false);
    return "";
  }
  check(`${relativePath} exists`, true);
  return fs.readFileSync(file, "utf8");
}

/**
 * @param {string} relativePath
 * @param {number} maxLength
 * @returns {string}
 */
function checkText(relativePath, maxLength) {
  const text = readText(relativePath);
  check(`${relativePath} is non-empty`, text.trim().length > 0);
  check(`${relativePath} <= ${maxLength} characters`, text.length <= maxLength);
  return text;
}

/**
 * @param {string} relativePath
 * @returns {{ width: number, height: number } | null}
 */
function pngDimensions(relativePath) {
  const file = absolute(relativePath);
  if (!fs.existsSync(file)) {
    check(`${relativePath} exists`, false);
    return null;
  }
  const bytes = fs.readFileSync(file);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(signature)) {
    check(`${relativePath} is a PNG`, false);
    return null;
  }
  check(`${relativePath} is a PNG`, true);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/** @type {unknown} */
const pkgJson = JSON.parse(readText("package.json"));
const pkgVersion =
  typeof pkgJson === "object" && pkgJson !== null && "version" in pkgJson ? pkgJson.version : undefined;
const version = typeof pkgVersion === "string" ? pkgVersion : "";
const versionParts = /^(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)$/.exec(version);
check(`package.json version is stable semver (${version || "missing"})`, versionParts !== null);

const versionCode = versionParts
  ? Number(versionParts.groups?.major) * 10_000 +
    Number(versionParts.groups?.minor) * 100 +
    Number(versionParts.groups?.patch)
  : Number.NaN;
check("encoded versionCode fits Android's signed 32-bit limit", Number.isSafeInteger(versionCode) && versionCode > 0);

const gradle = readText("android/app/build.gradle");
const gradleCode = Number(/versionCode\s+(?<code>\d+)/.exec(gradle)?.groups?.code);
const gradleName = /versionName\s+"(?<name>[^"]+)"/.exec(gradle)?.groups?.name;
check(`package.json version matches Gradle versionName (${gradleName ?? "missing"})`, version === gradleName);
check(`encoded versionCode matches Gradle (${versionCode})`, versionCode === gradleCode);

const metadata = "fastlane/metadata/android/en-US";
checkText(`${metadata}/title.txt`, 50);
checkText(`${metadata}/short_description.txt`, 80);
checkText(`${metadata}/full_description.txt`, 4000);
checkText(`${metadata}/changelogs/${gradleCode}.txt`, 500);

const icon = pngDimensions(`${metadata}/images/icon.png`);
check("listing icon is at least 512x512", icon !== null && icon.width >= 512 && icon.height >= 512);

const screenshotDir = absolute(metadata, "images/phoneScreenshots");
const screenshots = fs.existsSync(screenshotDir)
  ? fs
      .readdirSync(screenshotDir)
      .filter((name) => name.toLowerCase().endsWith(".png"))
      .toSorted()
  : [];
check(`two phone screenshots are present (found ${screenshots.length})`, screenshots.length >= 2);
for (const name of screenshots.slice(0, 2)) {
  const size = pngDimensions(`${metadata}/images/phoneScreenshots/${name}`);
  check(`${name} is a portrait phone screenshot`, size !== null && size.width >= 320 && size.height >= 480);
}

/**
 * Stable JSON with sorted keys, so two configs that differ only in key order
 * compare equal.
 *
 * @param {unknown} value
 * @returns {string}
 */
function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  const entries = Object.entries(value)
    .filter(([, v]) => v !== undefined)
    .toSorted(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(",")}}`;
}

/**
 * The F-Droid recipe copies `capacitor.config.fdroid.json` over
 * `capacitor.config.json` so `cap sync` sees a static config that cannot
 * re-enable the updater, whatever the buildserver's Node does with the
 * TypeScript source. That copy is a duplicate, so it can drift from the file
 * it mirrors; resolve `capacitor.config.ts` in the F-Droid flavour and require
 * the checked-in JSON to match it exactly.
 */
const fdroidConfigPath = absolute("capacitor.config.fdroid.json");
const previousDistribution = process.env.VITE_DISTRIBUTION;
process.env.VITE_DISTRIBUTION = "fdroid";
try {
  // The cache-busting query defeats a config module already loaded earlier in
  // this process, so the module-scope flavour check re-runs.
  const configUrl = `${pathToFileURL(absolute("capacitor.config.ts")).href}?flavor=fdroid`;
  // Annotating as unknown is what makes assigning the dynamic import's `any`
  // safe; the `in` check then narrows it without an assertion.
  /** @type {unknown} */
  const moduleNamespace = await import(configUrl);
  const resolved =
    typeof moduleNamespace === "object" && moduleNamespace !== null && "default" in moduleNamespace
      ? moduleNamespace.default
      : null;
  /** @type {unknown} */
  const committed = fs.existsSync(fdroidConfigPath) ? JSON.parse(fs.readFileSync(fdroidConfigPath, "utf8")) : null;
  const same = committed !== null && stableStringify(committed) === stableStringify(resolved);
  check("capacitor.config.fdroid.json matches capacitor.config.ts in the F-Droid flavour", same);
  if (!same && committed !== null) {
    console.error(`  committed: ${stableStringify(committed)}`);
    console.error(`  resolved:  ${stableStringify(resolved)}`);
  }
} catch (error) {
  check("capacitor.config.ts is importable to resolve the F-Droid config (needs Node type stripping)", false);
  console.error(`  ${error instanceof Error ? error.message : String(error)}`);
} finally {
  if (previousDistribution === undefined) delete process.env.VITE_DISTRIBUTION;
  else process.env.VITE_DISTRIBUTION = previousDistribution;
}

if (failures.length > 0) {
  console.error(`\nfdroid:check failed (${failures.length}): ${failures.join("; ")}`);
  process.exit(1);
}
console.log("\nfdroid:check OK");
