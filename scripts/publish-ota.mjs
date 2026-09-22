/**
 * Publish an OTA bundle for sideloaded APKs (Capgo plugin, zero services).
 *
 * No backend of any kind: the version manifest is a static file in this
 * repo (`public/ota/<channel>.json`, served by Pages) and the bundles are
 * GitHub Release assets. The app picks its update client-side
 * (`src/lib/ota.ts`). Requires a PUBLIC repo (release assets on private
 * repos need auth the app doesn't have) and `gh` logged in (`gh auth login`).
 *
 * Usage: pnpm ota:publish [--channel production] [--keep 3]
 *          [--min-native-code N] [--max-native-code N] [--version X]
 *
 * - Builds the web bundle, zips dist/client (~600KB), attaches it to a
 *   new `ota-<channel>-<version>` release, registers it in the local
 *   manifest (newest first), then prunes everything but the newest --keep
 *   entries (old releases are deleted via `gh`, manifest rows dropped).
 * - Bundle versions look like 0.3.0+ota.2 (package.json core + per-core
 *   sequence); the app compares core numerically, then the ota sequence,
 *   and gates on the native versionCode range.
 * - `v*` tags belong to the APK release workflow — OTA tags use the `ota-`
 *   prefix so the two never trigger each other.
 * - Native-only changes (manifest, plugins, Capacitor itself) can NEVER
 *   ship OTA — tag a real APK release for those instead.
 *
 * Going live is two steps: this script (release + local manifest), then
 * commit + push the manifest — Pages deploys it and devices see it.
 */
import { execSync, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";

const root = process.cwd();

function arg(name, fallback) {
  const flag = `--${name}`;
  const idx = process.argv.findIndex((entry) => entry === flag || entry.startsWith(`${flag}=`));
  if (idx === -1) return fallback;
  const hit = process.argv[idx];
  const eq = hit.indexOf("=");
  if (eq !== -1) return hit.slice(eq + 1);
  // Space-separated form (`--channel production`): take the next argv
  // entry. A missing value (or another flag) means a boolean switch.
  const next = process.argv[idx + 1];
  if (next === undefined || next.startsWith("--")) return true;
  return next;
}

function fail(message) {
  console.error(`[ota:publish] ${message}`);
  process.exit(1);
}

function sh(command, options) {
  try {
    return execSync(command, { cwd: root, encoding: "utf8", stdio: "pipe", ...options }).trim();
  } catch (error) {
    fail(`${command} failed:\n${error.stderr || error.message}`);
  }
}

function versionCode(version) {
  const [major = 0, minor = 0, patch = 0] = version.split(".").map(Number);
  return major * 10_000 + minor * 100 + patch;
}

function parseOta(version) {
  const match = String(version).match(/^(?<core>\d+\.\d+\.\d+)(?:\+ota\.(?<seq>\d+))?$/);
  if (!match?.groups) return null;
  return { core: match.groups.core, seq: Math.trunc(Number(match.groups.seq ?? "0")) || 0 };
}

function toPositiveInt(value, fallback) {
  const parsed = typeof value === "string" ? Math.trunc(Number(value)) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const channel = String(arg("channel", "production"));
const keep = toPositiveInt(arg("keep", "3"), 3);
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const core = String(pkg.version ?? "0.1.0");
const explicitVersion = arg("version", null);
const minNativeCode = arg("min-native-code", null);
const maxNativeCode = arg("max-native-code", null);

const repo = sh("gh repo view --json nameWithOwner -q .nameWithOwner");
if (!repo) fail("Couldn't resolve the repo — is `gh` logged in (`gh auth login`)?");

// The local manifest is the source of truth for sequencing (single
// publisher: it always reflects the last publish once committed).
const manifestPath = path.join(root, "public", "ota", `${channel}.json`);
let manifest = { channel, versions: [] };
if (fs.existsSync(manifestPath)) {
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {
    fail(`Couldn't parse ${manifestPath} — fix or delete it first.`);
  }
}
if (!Array.isArray(manifest.versions)) manifest.versions = [];

// Resolve the bundle version: explicit --version wins, else next ota
// sequence for the current package.json core.
let version = typeof explicitVersion === "string" && explicitVersion !== "" ? explicitVersion : null;
if (!version) {
  let seq = 0;
  for (const row of manifest.versions) {
    const parsed = parseOta(row?.version);
    if (parsed && parsed.core === core) seq = Math.max(seq, parsed.seq);
  }
  version = `${core}+ota.${seq + 1}`;
}
if (!parseOta(version)) fail(`Version "${version}" must look like 0.3.0 or 0.3.0+ota.2.`);
const minCode = minNativeCode === null ? versionCode(core) : Math.trunc(Number(minNativeCode));
const maxCode = maxNativeCode === null ? null : Math.trunc(Number(maxNativeCode));
if (!Number.isInteger(minCode) || (maxCode !== null && !Number.isInteger(maxCode))) {
  fail("Native version codes must be integers (major*10000 + minor*100 + patch).");
}

// Fresh production build, then zip it.
console.log(`[ota:publish] building ${version} for channel "${channel}"…`);
const built = spawnSync("pnpm", ["build"], { cwd: root, stdio: "inherit", shell: true });
if (built.status !== 0) fail("pnpm build failed — not publishing.");
const assetName = `${version}.zip`;
const zipPath = path.join(os.tmpdir(), `radioscout-ota-${randomUUID()}.zip`);
const zip = new AdmZip();
zip.addLocalFolder(path.join(root, "dist", "client"));
zip.writeZip(zipPath);
const bytes = fs.readFileSync(zipPath);
const checksum = createHash("sha256").update(bytes).digest("hex");
console.log(`[ota:publish] bundle ${(bytes.length / 1024).toFixed(0)} KB, sha256 ${checksum.slice(0, 16)}…`);

const tag = `ota-${channel}-${version}`;
// `gh release create <file>#<label>` renaming is a no-op on Windows, and
// GitHub serves `+` in asset names only percent-encoded — so stage an
// exactly-named copy: the uploaded asset, the manifest URL and the on-disk
// file always match, on every platform.
const namedPath = path.join(os.tmpdir(), assetName);
fs.copyFileSync(zipPath, namedPath);
sh(
  // Prerelease so `…/releases/latest` keeps pointing at the APK releases —
  // OTA bundles are for the in-app updater, not for humans.
  `gh release create ${tag} --prerelease ${JSON.stringify(namedPath)} --title ${JSON.stringify(`OTA ${version} (${channel})`)} --notes ${JSON.stringify(`OTA bundle for native versionCode ${minCode}${maxCode === null ? "+" : `–${maxCode}`}. Web-side changes only — native edits need a full APK.`)}`,
);

// Retention: newest --keep entries survive; older releases are deleted.
const entry = {
  version,
  min_version_code: minCode,
  max_version_code: maxCode,
  // Percent-encoded: GitHub serves `+` in asset names only as `%2B`.
  url: `https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(assetName)}`,
  checksum,
};
const versions = [entry, ...manifest.versions.filter((row) => row?.version !== version)];
for (const row of versions.slice(keep)) {
  sh(`gh release delete ota-${channel}-${row.version} --cleanup-tag --yes`);
  console.log(`[ota:publish] pruned ${row.version}`);
}
fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
fs.writeFileSync(manifestPath, `${JSON.stringify({ channel, versions: versions.slice(0, keep) }, null, 2)}\n`);
fs.rmSync(zipPath, { force: true });
fs.rmSync(namedPath, { force: true });

console.log(
  `[ota:publish] staged: ${version} on "${channel}" (native ${minCode}${maxCode === null ? "+" : `–${maxCode}`}), keeping ${keep}.`,
);
console.log(`[ota:publish] commit + push ${path.relative(root, manifestPath)} — Pages deploys it and devices see it.`);
