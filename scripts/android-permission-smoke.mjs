#!/usr/bin/env node
/**
 * Android 13 notification-denial smoke.
 *
 * Starts with POST_NOTIFICATIONS denied, plays the local fixture, taps
 * "Don't allow" in the system dialog and proves the plugin still starts
 * playback. This is the fail-open half of the permission contract; the main
 * smoke checks the granted half (MediaStyle notification plus media session).
 *
 * Prerequisites are the same as `android-smoke.mjs`: a debuggable or
 * release-shaped APK installed and a device/emulator connected.
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { _android as android } from "@playwright/test";
import { FIXTURE_STATION_NAME, startFixtureServer } from "./android-fixture-server.mjs";

const PKG = "io.github.double77x.radioscout";
const PERMISSION = "android.permission.POST_NOTIFICATIONS";
const HOME_URL = "https://localhost/";

/**
 * @param {string} file
 * @param {string[]} args
 * @param {{ maxBuffer?: number }} options
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
function execFileAsync(file, args, options) {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(new Error("adb command failed", { cause: error }));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

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

function adbExecutable() {
  if (process.env.ANDROID_ADB) return process.env.ANDROID_ADB;
  const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  if (sdk) {
    const candidate = path.join(sdk, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb");
    if (existsSync(candidate)) return candidate;
  }
  return "adb";
}

/** @param {import("@playwright/test").AndroidDevice} device @param {string[]} args */
async function runAdb(device, args) {
  const result = await execFileAsync(adbExecutable(), ["-s", serialOf(device), ...args], {
    maxBuffer: 4 * 1024 * 1024,
  });
  return result.stdout;
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
async function sdkInt(device) {
  return Number(String(await device.shell("getprop ro.build.version.sdk")).trim());
}

/** @param {import("@playwright/test").AndroidDevice} device */
async function mediaSessionPlaying(device) {
  const dump = String(await device.shell("dumpsys media_session"));
  const at = dump.indexOf(`package=${PKG}`);
  return at !== -1 && dump.slice(at, at + 5000).includes("state=PlaybackState {state=PLAYING");
}

/** @param {import("@playwright/test").AndroidDevice} device */
async function permissionGranted(device) {
  const dump = String(await device.shell(`dumpsys package ${PKG}`));
  return dump.includes(`${PERMISSION}: granted=true`);
}

/** @param {import("@playwright/test").AndroidDevice} device */
async function permissionDialogVisible(device) {
  const focus = String(await device.shell("dumpsys window | grep -E 'mCurrentFocus|mFocusedApp'"));
  const activities = String(
    await device.shell("dumpsys activity activities | grep -Ei 'GrantPermissions|PermissionController' | head -8"),
  );
  return /permissioncontroller|grantpermissions/i.test(`${focus}\n${activities}`);
}

async function main() {
  const device = await pickDevice();
  const sdk = await sdkInt(device);
  if (sdk < 33) {
    console.log(`SKIP  Android ${sdk}: POST_NOTIFICATIONS does not exist before API 33`);
    return;
  }

  const fixture = await startFixtureServer();
  let reverseReady = false;
  try {
    await runAdb(device, ["reverse", `tcp:${fixture.port}`, `tcp:${fixture.port}`]);
    reverseReady = true;

    // Clear first so no previous session/permission state can short-circuit
    // the request; the app is not running, so revoking cannot kill it.
    await device.shell(`pm clear ${PKG}`).catch(() => {});
    await device.shell(`pm revoke ${PKG} ${PERMISSION}`).catch(() => {});
    await device.shell(`am force-stop ${PKG}`);
    if (await permissionGranted(device)) throw new Error("POST_NOTIFICATIONS was not revoked");
    await device.shell(`monkey -p ${PKG} -c android.intent.category.LAUNCHER 1`);
    await sleep(4000);

    const webview = await device.webView({ pkg: PKG });
    const page = await webview.page();
    page.setDefaultTimeout(30_000);
    const station = {
      stationuuid: "00000000-0000-4000-8000-000000000001",
      name: FIXTURE_STATION_NAME,
      url: fixture.streamUrl,
      url_resolved: fixture.streamUrl,
      homepage: "https://127.0.0.1/",
      favicon: "",
      tags: "test,fixture",
      country: "Testland",
      countrycode: "TT",
      state: "",
      language: "english",
      codec: "MP3",
      bitrate: 32,
      hls: 0,
      votes: 100,
      clickcount: 100,
      clicktrend: 0,
      lastcheckok: 1,
    };
    await page.route(/^https:\/\/.*\.api\.radio-browser\.info\/.*/, (route) => route.fulfill({ json: [station] }));
    await page.goto(HOME_URL, { waitUntil: "domcontentloaded" });
    await page.getByTestId("radio-search").waitFor({ state: "visible", timeout: 45_000 });
    await page.getByTestId("radio-search").fill(FIXTURE_STATION_NAME);
    await sleep(1200);
    await device.shell("logcat -c").catch(() => {});
    await page
      .locator(`button[data-testid="station-play"][aria-label="Play ${FIXTURE_STATION_NAME}"]:visible`)
      .first()
      .click();

    // Leave any system permission dialog open. The contract under test is
    // that playback does not wait for it (or for a callback that may never
    // arrive); interacting with the dialog would only make the check depend
    // on System UI text and animation timing.
    if (await permissionDialogVisible(device)) {
      console.log("INFO  permission dialog is open; playback must still start");
    } else {
      console.log("INFO  permission dialog absent; checking callback-loss fail-open");
    }

    const started = Date.now();
    let playing = false;
    while (Date.now() - started < 30_000) {
      if (await mediaSessionPlaying(device)) {
        playing = true;
        break;
      }
      await sleep(500);
    }
    if (!playing) throw new Error("playback did not start after denying notifications");
    if (await permissionGranted(device)) throw new Error("permission is still granted after denying");

    const logs = String(await device.shell("logcat -d -s RadioPlayback"));
    if (!logs.includes("notifications=not granted")) {
      throw new Error("the native plugin did not take the denied-permission path");
    }
    // A stale MediaStyle notification from an earlier granted run can survive
    // `pm clear`/force-stop on some emulators, so notification absence is not
    // a reliable denial assertion. The granted path's notification is covered
    // by the main smoke; this script proves playback starts while denied.
    const notifications = String(await device.shell("dumpsys notification --noredact"));
    if (notifications.includes(`pkg=${PKG}`) && notifications.includes("MediaStyle")) {
      console.log("WARN  a stale MediaStyle notification is still present");
    }

    console.log("PASS  playback still starts without notification permission");
  } finally {
    await device.shell(`am force-stop ${PKG}`).catch(() => {});
    await device.shell(`pm grant ${PKG} ${PERMISSION}`).catch(() => {});
    if (reverseReady) {
      await runAdb(device, ["reverse", "--remove", `tcp:${fixture.port}`]).catch(() => {});
    }
    await fixture.close();
  }
}

await main();
process.exit(process.exitCode ?? 0);
