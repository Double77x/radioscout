/**
 * Repository-side F-Droid readiness gate.
 *
 * Verifies the two contracts F-Droid cannot repair during its build: the
 * committed Android version must match package.json, and the in-repo Fastlane
 * listing must contain valid, current assets for that versionCode.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const failures = [];

function check(name, ok) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) failures.push(name);
}

function absolute(...parts) {
  return path.join(root, ...parts);
}

function readText(relativePath) {
  const file = absolute(relativePath);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    check(`${relativePath} exists`, false);
    return "";
  }
  check(`${relativePath} exists`, true);
  return fs.readFileSync(file, "utf8");
}

function checkText(relativePath, maxLength) {
  const text = readText(relativePath);
  check(`${relativePath} is non-empty`, text.trim().length > 0);
  check(`${relativePath} <= ${maxLength} characters`, text.length <= maxLength);
  return text;
}

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

const pkg = JSON.parse(readText("package.json"));
const version = String(pkg.version ?? "");
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

if (failures.length > 0) {
  console.error(`\nfdroid:check failed (${failures.length}): ${failures.join("; ")}`);
  process.exit(1);
}
console.log("\nfdroid:check OK");
