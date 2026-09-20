/**
 * Sync `package.json` version into the Android shell before a native build.
 *
 * - `versionName` = package.json `version` (single source of truth).
 * - `versionCode` = deterministic semver encoding (major * 10000 + minor * 100 + patch),
 *   monotonic across releases without a counter file or git history.
 *
 * No-op (with a log line) until `npx cap add android` has created `android/`.
 * Run via `pnpm cap:version` — wired into `build:android:apk/aab`.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const version = String(pkg.version ?? "0.1.0");
const [major = 0, minor = 0, patch = 0] = version.split(".").map(Number);
const versionCode = major * 10_000 + minor * 100 + patch;

const gradlePath = path.join(root, "android", "app", "build.gradle");
if (!fs.existsSync(gradlePath)) {
  console.log("[cap:version] android/ not present yet — run `npx cap add android` first. Skipping.");
  process.exit(0);
}

let gradle = fs.readFileSync(gradlePath, "utf8");
let touched = false;
if (/versionCode\s+\d+/.test(gradle)) {
  gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
  touched = true;
}
if (/versionName\s+"[^"]*"/.test(gradle)) {
  gradle = gradle.replace(/versionName\s+"[^"]*"/, `versionName "${version}"`);
  touched = true;
}
if (!touched) {
  console.log("[cap:version] no versionCode/versionName lines found in build.gradle — skipping.");
  process.exit(0);
}
fs.writeFileSync(gradlePath, gradle);
console.log(`[cap:version] android → versionCode ${versionCode}, versionName "${version}"`);
