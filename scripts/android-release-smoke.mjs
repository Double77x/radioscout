#!/usr/bin/env node
/**
 * Release APK launch gate. Release builds have no WebView devtools socket, so
 * this does not drive the UI; it proves the minified, non-debuggable package
 * starts, reaches MainActivity, renders its first screen and leaves no fatal
 * process crash in logcat.
 *
 * Build a locally installable release with the debug key for this check:
 *   cd android
 *   ANDROID_KEYSTORE_FILE="$HOME/.android/debug.keystore" \
 *   ANDROID_KEYSTORE_PASSWORD=android \
 *   ANDROID_KEY_ALIAS=androiddebugkey \
 *   ANDROID_KEY_PASSWORD=android \
 *   ./gradlew assembleRelease
 *
 * Then install `app/build/outputs/apk/release/radioscout-release.apk` and run:
 *   node scripts/android-release-smoke.mjs
 *
 * The release-shaped `releaseTest` variant covers the actual media path with
 * Playwright and the local fixture. Use both: this catches R8/manifest launch
 * breakage, `releaseTest` catches WebView/media regressions under shrinking.
 */
import { _android as android } from "@playwright/test";

const PKG = "io.github.double77x.radioscout";

/** @param {number} ms */
const sleep = (ms) =>
  new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });

/** @param {import("@playwright/test").AndroidDevice} device */
function serialOf(device) {
  // oxlint-disable-next-line typescript/unbound-method -- getters evaluate against the device receiver
  const value = device.serial;
  return typeof value === "function" ? value.call(device) : value;
}

/** @returns {Promise<import("@playwright/test").AndroidDevice>} */
async function pickDevice() {
  const devices = await android.devices();
  if (devices.length === 0) throw new Error("no Android devices attached");
  const wanted = process.env.ANDROID_SERIAL;
  const chosen = wanted ? devices.find((device) => serialOf(device) === wanted) : undefined;
  const device = chosen ?? (devices.length === 1 ? devices[0] : undefined);
  if (!device) {
    throw new Error(
      `several devices attached — set ANDROID_SERIAL (${devices.map((item) => serialOf(item)).join(", ")})`,
    );
  }
  return device;
}

/** @param {import("@playwright/test").AndroidDevice} device */
async function topActivity(device) {
  const dump = String(await device.shell("dumpsys activity activities"));
  return /topResumedActivity=.*?\s(?<top>[^\s/]+\/[^\s}]+)/.exec(dump)?.groups?.top ?? "";
}

/** @param {import("@playwright/test").AndroidDevice} device */
async function waitForApp(device) {
  const started = Date.now();
  while (Date.now() - started < 30_000) {
    if ((await topActivity(device)).includes(PKG)) return;
    await sleep(500);
  }
  throw new Error(`timeout waiting for ${PKG} to reach the foreground`);
}

/** @param {import("@playwright/test").AndroidDevice} device */
async function firstScreen(device) {
  const started = Date.now();
  while (Date.now() - started < 15_000) {
    await device.shell("rm -f /sdcard/window.xml").catch(() => {});
    await device.shell("timeout 8 uiautomator dump /sdcard/window.xml").catch(() => {});
    const xml = String(await device.shell("cat /sdcard/window.xml").catch(() => ""));
    if (xml.includes("<hierarchy")) return xml;
    await sleep(1000);
  }
  throw new Error("UIAutomator produced no view hierarchy for the release build");
}

async function main() {
  const device = await pickDevice();
  const installed = String(await device.shell(`dumpsys package ${PKG}`));
  if (!installed.includes("versionName=")) throw new Error(`${PKG} is not installed`);

  const debuggable = /flags=\[[^\]]*DEBUGGABLE/.test(installed);
  if (debuggable) throw new Error("release smoke must run against a non-debuggable build");

  await device.shell(`am force-stop ${PKG}`);
  await device.shell("logcat -c");
  const started = String(await device.shell(`am start -W -n ${PKG}/.MainActivity`));
  if (!/Status: ok|LaunchState: COLD|LaunchState: WARM/.test(started)) {
    throw new Error(`MainActivity did not start:\n${started}`);
  }
  await waitForApp(device);
  await sleep(3000);

  const activity = await topActivity(device);
  if (!activity.includes(PKG)) throw new Error(`top activity is ${activity}, not ${PKG}`);

  const screen = await firstScreen(device);
  if (!/RadioScout|On air|Most loved|search|Play/i.test(screen)) {
    throw new Error("the first screen rendered no recognisable UI");
  }

  const logs = String(await device.shell("logcat -d -v brief"));
  const fatal = logs
    .split(/\r?\n/)
    .filter((line) => line.includes("FATAL EXCEPTION") || line.includes(`Process: ${PKG}`))
    .filter((line) => !line.includes("Process: com.android"));
  if (fatal.length > 0) throw new Error(`fatal logcat lines:\n${fatal.join("\n")}`);

  console.log(`PASS  release ${PKG} launches on ${serialOf(device)}`);
  console.log("PASS  first screen is visible (UIAutomator)");
  console.log("PASS  no fatal crash in logcat");
}

await main();
process.exit(process.exitCode ?? 0);
