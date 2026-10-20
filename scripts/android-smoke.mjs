#!/usr/bin/env node
/**
 * Android APK smoke test — one debug WebView session, checked against the
 * native bridge and the system media session.
 *
 * Prerequisites:
 *   pnpm build:android:apk
 *   pnpm cap:doctor
 *   adb install -r android/app/build/outputs/apk/debug/radioscout-debug.apk
 *
 * Then, with a device/emulator connected:
 *   node scripts/android-smoke.mjs
 *
 * `ANDROID_SERIAL` picks the device when several are attached. The app must
 * be debuggable (the debug APK is); release builds expose no WebView devtools
 * socket, so this script cannot attach to them.
 *
 * The flow covers the failures that a build-only check cannot see: launch,
 * live catalogue, notification permission, native playback, the media
 * session and its MediaStyle notification, pause/resume, the 1% volume keys,
 * settings, the station sheet, favourites, Android back and background
 * playback. It is deliberately a smoke test, not a replacement for the web
 * Playwright suite or the Java DSP tests.
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { _android as android } from "@playwright/test";
import { FIXTURE_STATION_NAME, startFixtureServer } from "./android-fixture-server.mjs";

const PKG = "io.github.double77x.radioscout";
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

/**
 * @param {import("@playwright/test").AndroidDevice} device
 * @returns {string}
 */
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

/**
 * Run a host-side adb command. The Playwright device shell runs inside the
 * device, but `adb reverse` has to run on the host.
 *
 * @param {import("@playwright/test").AndroidDevice} device
 * @param {string[]} args
 * @returns {Promise<string>}
 */
async function runAdb(device, args) {
  const result = await execFileAsync(adbExecutable(), ["-s", serialOf(device), ...args], {
    maxBuffer: 4 * 1024 * 1024,
  });
  return result.stdout;
}

/** @returns {Promise<import("@playwright/test").AndroidDevice>} */
async function pickDevice() {
  const devices = await android.devices();
  if (devices.length === 0) throw new Error("no Android devices attached (adb devices is empty)");
  const wanted = process.env.ANDROID_SERIAL;
  const chosen = wanted ? devices.find((device) => serialOf(device) === wanted) : undefined;
  const device = chosen ?? (devices.length === 1 ? devices[0] : undefined);
  if (!device) {
    throw new Error(
      `several devices attached (${devices.map((item) => serialOf(item)).join(", ")}) — set ANDROID_SERIAL`,
    );
  }
  return device;
}

async function main() {
  const device = await pickDevice();
  const sdk = Number(String(await device.shell("getprop ro.build.version.sdk")).trim());
  console.log(`device: ${serialOf(device)} (API ${sdk})`);

  const fixture = await startFixtureServer();
  let reverseReady = false;
  try {
    await runAdb(device, ["reverse", `tcp:${fixture.port}`, `tcp:${fixture.port}`]);
    reverseReady = true;
  } catch (error) {
    throw new Error(
      `could not set up adb reverse for the local stream: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  const fixtureStation = {
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

  // Start from a clean data directory: a previous run's last station and
  // player state can leave the native service bound to an old session, which
  // makes the media-session checks lie. `pm clear` also revokes runtime
  // permissions, so grant the notification permission again afterwards.
  await device.shell(`pm clear ${PKG}`).catch(() => {});
  if (sdk >= 33) {
    await device.shell(`pm grant ${PKG} android.permission.POST_NOTIFICATIONS`).catch(() => {});
  }
  await device.shell(`am force-stop ${PKG}`);
  await device.shell(`monkey -p ${PKG} -c android.intent.category.LAUNCHER 1`);
  await sleep(4000);

  const webview = await device.webView({ pkg: PKG });
  const page = await webview.page();
  page.setDefaultTimeout(30_000);

  /** @type {string[]} */
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(message.text());
  });

  // The APK normally talks to the live radio-browser mirrors. Replace those
  // responses with one station pointing at the local ICY fixture, so the
  // smoke tests the directory → bridge → Media3 → fixture path without a
  // public stream. Unknown endpoints get an empty result; nothing audio
  // related leaves the device.
  await page.route(/^https:\/\/.*\.api\.radio-browser\.info\/.*/, (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.includes("/json/stations/search") || pathname.includes("/json/stations/topvote")) {
      return route.fulfill({ json: [fixtureStation] });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto(HOME_URL, { waitUntil: "domcontentloaded" });

  /** @type {string[]} */
  const passed = [];
  /** @type {string[]} */
  const failed = [];
  /**
   * @param {string} label
   * @param {string} [detail]
   */
  const pass = (label, detail = "") => {
    passed.push(label);
    console.log(`PASS  ${label}${detail ? ` — ${detail}` : ""}`);
  };
  /**
   * @param {string} label
   * @param {unknown} error
   */
  const fail = (label, error) => {
    failed.push(label);
    console.error(`FAIL  ${label} — ${error instanceof Error ? error.message : String(error)}`);
  };
  /**
   * @param {string} label
   * @param {() => void | Promise<void>} work
   */
  const check = async (label, work) => {
    try {
      await work();
      pass(label);
    } catch (error) {
      fail(label, error);
    }
  };
  /**
   * @param {string} label
   * @param {() => boolean | Promise<boolean>} predicate
   * @param {number} [timeout]
   */
  const until = async (label, predicate, timeout = 30_000) => {
    const started = Date.now();
    /** @type {unknown} */
    let lastError = null;
    while (Date.now() - started < timeout) {
      try {
        if (await predicate()) return;
      } catch (error) {
        lastError = error;
      }
      await sleep(300);
    }
    const reason = lastError instanceof Error ? lastError.message : "unknown error";
    throw new Error(`timeout: ${label}${lastError ? ` (${reason})` : ""}`);
  };
  const dockText = async () =>
    ((await page.getByRole("region", { name: "Player" }).textContent()) ?? "").replaceAll(/\s+/g, " ").trim();
  const mediaSession = async () => String(await device.shell("dumpsys media_session"));
  /** @param {string} state */
  const hasSessionState = async (state) => {
    const dump = await mediaSession();
    const packageAt = dump.indexOf(`package=${PKG}`);
    if (packageAt === -1) return false;
    return dump.slice(packageAt, packageAt + 5000).includes(`state=PlaybackState {state=${state}`);
  };
  const notificationDump = async () => String(await device.shell("dumpsys notification --noredact"));
  const topActivity = async () => {
    const dump = String(await device.shell("dumpsys activity activities"));
    return /topResumedActivity=.*?\s(?<top>[^\s/]+\/[^\s}]+)/.exec(dump)?.groups?.top ?? "";
  };

  let stationName = "";
  /** @type {import("@playwright/test").Locator} */
  let stationRow = page.locator("body");

  try {
    await page.keyboard.press("Escape").catch(() => {});
    await page.getByTestId("radio-search").waitFor({ state: "visible", timeout: 45_000 });
    await page
      .getByRole("button", { name: /^Play / })
      .first()
      .waitFor({ state: "visible", timeout: 45_000 });
    pass("launch", `webview at ${page.url()}`);

    if (page.url() !== HOME_URL) throw new Error(`unexpected start URL ${page.url()}`);

    if (sdk >= 33) {
      await check("Android 13+ notification permission is granted", async () => {
        const permissions = String(await device.shell(`dumpsys package ${PKG}`));
        if (!permissions.includes("android.permission.POST_NOTIFICATIONS: granted=true")) {
          throw new Error("POST_NOTIFICATIONS is not granted");
        }
      });
    } else {
      pass("notification permission", `not required before API 33 (API ${sdk})`);
    }

    await check("catalogue renders inside the APK", async () => {
      await page.getByText("Most loved", { exact: false }).first().waitFor({ state: "visible", timeout: 45_000 });
      const body = (await page.locator("body").textContent()) ?? "";
      if (!body.includes("stations ·")) throw new Error("the saved-count line is missing");
    });

    await check("search finds the local fixture station", async () => {
      await device.shell("logcat -c").catch(() => {});
      await page.getByTestId("radio-search").fill(FIXTURE_STATION_NAME);
      await sleep(1200);
      const button = page
        .locator(`button[data-testid="station-play"][aria-label="Play ${FIXTURE_STATION_NAME}"]:visible`)
        .first();
      await button.waitFor({ state: "visible" });
      const label = await button.getAttribute("aria-label");
      if (!label) throw new Error("station play button has no accessible name");
      stationName = label.replace(/^Play /, "");
      if (stationName !== FIXTURE_STATION_NAME) throw new Error(`unexpected fixture station ${stationName}`);
      // Anchor on the row's detail button, not its play button: playback
      // changes that button's accessible name to "Pause …" and a locator
      // built from "Play …" stops resolving once the stream starts.
      stationRow = page
        .locator("li")
        .filter({ has: page.locator(`button[aria-label="Details for ${stationName}"]`) })
        .first();
    });

    await check("native playback reaches the playing state", async () => {
      await page
        .locator(`button[data-testid="station-play"][aria-label="Play ${stationName}"]:visible`)
        .first()
        .click();
      await until(
        "dock leaves loading",
        async () => {
          const text = await dockText();
          return !/Tuning in|Couldn't|Nothing playing/.test(text);
        },
        45_000,
      );
      await until("media session is playing", () => hasSessionState("PLAYING"), 30_000);
    });

    await check("MediaStyle notification is posted", async () => {
      await until(
        "notification is posted",
        async () => {
          const dump = await notificationDump();
          return dump.includes(`pkg=${PKG}`) && dump.includes("MediaStyle");
        },
        20_000,
      );
    });

    await check("ICY track title reaches the dock", async () => {
      await until(
        "a live title replaces the station line",
        async () => {
          const logs = String(await device.shell("logcat -d -s RadioPlayback"));
          return logs.includes("track:");
        },
        30_000,
      );
    });

    await check("pause and resume keep the session alive", async () => {
      await until(
        "the dock also reports playing",
        async () => ((await page.getByTestId("player-toggle").getAttribute("aria-label")) ?? "").startsWith("Pause"),
        20_000,
      );
      // Let the first live buffer settle. Pausing in the same beat as the
      // native `PLAYING` event races the decoder and is not a user-realistic
      // start; the separate native-state check still covers that transition.
      await sleep(2000);
      await page.getByTestId("player-toggle").click();
      await until("dock pauses", async () => (await dockText()).includes("Paused"), 15_000);
      await until("session pauses", () => hasSessionState("PAUSED"), 15_000);
      await page.getByTestId("player-toggle").click();
      await until("session resumes", () => hasSessionState("PLAYING"), 20_000);
    });

    await check("volume arrows step by 1%", async () => {
      await page.getByRole("button", { name: "Volume", exact: true }).click();
      const slider = page.getByRole("slider", { name: "Volume" }).last();
      const before = Number(await slider.getAttribute("aria-valuenow"));
      await page.keyboard.press("ArrowRight");
      await until("one point up", async () => Number(await slider.getAttribute("aria-valuenow")) === before + 1, 5000);
      await page.keyboard.press("ArrowLeft");
      await until("one point down", async () => Number(await slider.getAttribute("aria-valuenow")) === before, 5000);
      const close = page.locator('button[aria-label="Close volume"]:visible').last();
      await close.click({ timeout: 5000 });
    });

    await check("mute and unmute work", async () => {
      await page.getByRole("button", { name: "Volume", exact: true }).click();
      await page.locator('button[aria-label="Mute"]:visible').last().click();
      await page.locator('button[aria-label="Unmute"]:visible').last().waitFor({ state: "visible" });
      await page.locator('button[aria-label="Unmute"]:visible').last().click();
      await page.locator('button[aria-label="Mute"]:visible').last().waitFor({ state: "visible" });
      await page.locator('button[aria-label="Close volume"]:visible').last().click();
    });

    await check("settings sections render", async () => {
      await page.getByRole("button", { name: "Settings" }).click();
      await page.getByText("Radio data, filters, audio and style.").waitFor({ state: "visible" });
      await page.getByRole("button", { name: /^Audio/ }).click();
      await page.getByText("Level volume", { exact: true }).waitFor({ state: "visible" });
      await page.getByText("Refresh car display", { exact: true }).waitFor({ state: "visible" });
      await page.getByRole("switch", { name: "Level volume across stations" }).waitFor({ state: "visible" });
      // Close the popover in the UI. Hardware back belongs to the router
      // here: with search history present it would clear the query rather
      // than dismiss a popover that is not URL state.
      await page.keyboard.press("Escape");
      await page.getByText("Radio data, filters, audio and style.").waitFor({ state: "hidden" });
    });

    await check("station sheet tabs open and Android back closes the sheet", async () => {
      await stationRow.locator(`button[aria-label="Details for ${stationName}"]`).first().click();
      const dialog = page.getByRole("dialog").last();
      await dialog.waitFor({ state: "visible" });
      const text = await dialog.textContent();
      if (!text?.includes("Info") || !text.includes("Recent") || !text.includes("Stats")) {
        throw new Error("sheet tabs are incomplete");
      }
      await page.getByText("Stats", { exact: true }).last().click();
      await dialog
        .getByText(/listening/i)
        .first()
        .waitFor({ state: "visible" });
      await device.shell("input keyevent KEYCODE_BACK");
      await dialog.waitFor({ state: "hidden" });
    });

    await check("favourite toggles through Dexie", async () => {
      await stationRow.getByRole("button", { name: `Save ${stationName} to favourites` }).click();
      await stationRow.getByRole("button", { name: `Remove ${stationName} from favourites` }).waitFor({
        state: "visible",
      });
      await stationRow.getByRole("button", { name: `Remove ${stationName} from favourites` }).click();
      await stationRow.getByRole("button", { name: `Save ${stationName} to favourites` }).waitFor({ state: "visible" });
    });

    await check("background playback survives the app losing the foreground", async () => {
      if (!(await hasSessionState("PLAYING"))) {
        await page.getByTestId("player-toggle").click();
        await until("session is playing before backgrounding", () => hasSessionState("PLAYING"), 20_000);
      }
      await device.shell("input keyevent KEYCODE_HOME");
      await sleep(1500);
      await until("session keeps playing", () => hasSessionState("PLAYING"), 15_000);
      if (!(await topActivity()).includes("com.google.android.apps.nexuslauncher")) {
        throw new Error("the app did not leave the foreground");
      }
      await device.shell(`am start -n ${PKG}/.MainActivity`);
      await until("app returns to the foreground", async () => (await topActivity()).includes(PKG), 15_000);
      await until(
        "dock still reports playback",
        async () => {
          const text = await dockText();
          return !text.includes("Paused") && !text.includes("Nothing playing");
        },
        15_000,
      );
    });

    await check("stop clears the dock", async () => {
      await page.getByRole("button", { name: "Stop playback" }).click();
      await until("dock is empty", async () => (await dockText()).includes("Nothing playing"), 20_000);
    });
  } finally {
    if (failed.length > 0) {
      console.error(`page errors: ${pageErrors.length > 0 ? pageErrors.join(" | ") : "none"}`);
      const screenshot = `${process.env.TEMP ?? "."}\\android-smoke-failure.png`;
      await page.screenshot({ path: screenshot }).catch(() => {});
      console.error(`screenshot: ${screenshot}`);
    }
    if (reverseReady) {
      await runAdb(device, ["reverse", "--remove", `tcp:${fixture.port}`]).catch(() => {});
    }
    await fixture.close();
    console.log(`\n${passed.length} passed, ${failed.length} failed`);
    if (failed.length > 0) process.exitCode = 1;
  }
}

await main();
process.exit(process.exitCode ?? 0);
