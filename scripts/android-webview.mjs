#!/usr/bin/env node
/**
 * Android WebView probe — programmatic debugging for the APK on a connected
 * device/emulator, no phone-tapping required.
 *
 * Needs a DEBUGGABLE WebView, i.e. a debug build:
 *   .\gradlew.bat assembleDebug            # in android/
 *   adb install android/app/build/outputs/apk/debug/radioscout-debug.apk
 *
 * Release builds (android:debuggable=false) expose no devtools socket, so
 * `webView()` cannot attach — logcat is the fallback there.
 *
 * Usage (ANDROID_SERIAL picks the device when several are attached):
 *   node scripts/android-webview.mjs state                    # url + dock + storage keys
 *   node scripts/android-webview.mjs console [secs=15]         # stream page console
 *   node scripts/android-webview.mjs tap "Play BBC Radio 1"    # tap by accessible name, print dock
 *   node scripts/android-webview.mjs eval "<js expression>"    # run JS, print result
 */
import { _android as android } from "@playwright/test";

const PKG = "io.github.double77x.radioscout";

const [command, ...rest] = process.argv.slice(2);

function deviceSerial(device) {
  const value = device.serial;
  return typeof value === "function" ? value.call(device) : value;
}

async function pickDevice() {
  const devices = await android.devices();
  if (devices.length === 0) throw new Error("no android devices attached (adb devices is empty)");
  const wanted = process.env.ANDROID_SERIAL;
  const device = wanted ? devices.find((d) => deviceSerial(d) === wanted) : undefined;
  const chosen = device ?? (devices.length === 1 ? devices[0] : undefined);
  if (!chosen) {
    const serials = devices.map((d) => deviceSerial(d)).join(", ");
    throw new Error(`several devices attached (${serials}) — set ANDROID_SERIAL to pick one`);
  }
  return chosen;
}

async function attach() {
  const device = await pickDevice();
  console.log(`device: ${deviceSerial(device)}`);
  const webview = await device.webView({ pkg: PKG });
  const page = await webview.page();
  page.on("console", (msg) => console.log(`PAGE-CONSOLE [${msg.type()}]: ${msg.text().slice(0, 300)}`));
  page.on("pageerror", (error) => console.log(`PAGE-ERROR: ${String(error).slice(0, 300)}`));
  return page;
}

function dockText(page) {
  return page.getByRole("region", { name: "Player" }).textContent();
}

if (command === "launch") {
  const device = await pickDevice();
  console.log(`device: ${deviceSerial(device)}`);
  await device.shell(`monkey -p ${PKG} -c android.intent.category.LAUNCHER 1`);
  console.log("launched");
  process.exit(0);
}

if (command === "state") {
  const page = await attach();
  console.log(`url: ${page.url()}`);
  console.log(`title: ${await page.title()}`);
  console.log(`dock: ${(await dockText(page))?.replaceAll(/\s+/g, " ").trim()}`);
  const keys = await page.evaluate(() => Object.keys(globalThis.localStorage ?? {}));
  console.log(`localStorage keys: ${keys.filter((k) => k.startsWith("radioscout:")).join(", ")}`);
  process.exit(0);
}

if (command === "console") {
  const secs = Math.max(1, Number(rest[0] ?? 15));
  await attach();
  console.log(`streaming console for ${secs}s…`);
  await new Promise((resolve) => {
    globalThis.setTimeout(resolve, secs * 1000);
  });
  process.exit(0);
}

if (command === "tap") {
  const name = rest.join(" ");
  if (!name) throw new Error('usage: tap "Accessible Name"');
  const page = await attach();
  // Dismiss any modal (e.g. the OTA update dialog) so taps can land.
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(500);
  await page.locator(`button[aria-label="${name}"]`).first().click({ timeout: 20_000 });
  await page.waitForTimeout(3000);
  console.log(`dock: ${(await dockText(page))?.replaceAll(/\s+/g, " ").trim()}`);
  process.exit(0);
}

if (command === "tap-first") {
  const prefix = rest.join(" ");
  if (!prefix) throw new Error('usage: tap-first "Prefix"');
  const page = await attach();
  // Dismiss any modal (e.g. the OTA update dialog) so taps can land.
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(500);
  const button = page.locator(`button[aria-label^="${prefix}"]`).first();
  const label = await button.getAttribute("aria-label", { timeout: 30_000 });
  await button.click({ timeout: 30_000 });
  console.log(`tapped: ${label}`);
  await page.waitForTimeout(5000);
  console.log(`dock: ${(await dockText(page))?.replaceAll(/\s+/g, " ").trim()}`);
  process.exit(0);
}

if (command === "eval") {
  const expression = rest.join(" ");
  if (!expression) throw new Error('usage: eval "<js expression>"');
  const page = await attach();
  const result = await page.evaluate(`(${expression})`);
  console.log(typeof result === "string" ? result : JSON.stringify(result));
  process.exit(0);
}

console.error('unknown command — state | console [secs] | tap "Name" | eval "expr"');
process.exit(1);
