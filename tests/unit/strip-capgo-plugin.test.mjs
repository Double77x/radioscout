import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { stripCapgoPlugin } from "../../scripts/strip-capgo-plugin.mjs";

/** @typedef {{ pkg: string, classpath: string }} Plugin */

const UPDATER = {
  pkg: "@capgo/capacitor-updater",
  classpath: "ee.forgr.capacitor_updater.CapacitorUpdaterPlugin",
};
const APP = { pkg: "@capacitor/app", classpath: "com.capacitorjs.plugins.app.AppPlugin" };
const STATUS_BAR = {
  pkg: "@capacitor/status-bar",
  classpath: "com.capacitorjs.plugins.statusbar.StatusBarPlugin",
};
const ORPHAN = { classpath: "no.pkg.Here" };

let dir = "";
let registry = "";

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "strip-capgo-"));
  registry = join(dir, "capacitor.plugins.json");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/**
 * Write a registry the way `cap sync` does: tab-indented, trailing newline.
 *
 * @param {unknown[]} entries
 * @returns {void}
 */
function write(entries) {
  writeFileSync(registry, JSON.stringify(entries, null, "\t") + "\n");
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isString(value) {
  return typeof value === "string";
}

/**
 * Read the registry back as raw entries.
 *
 * @returns {unknown[]}
 */
function readEntries() {
  /** @type {unknown} */
  const parsed = JSON.parse(readFileSync(registry, "utf8"));
  return Array.isArray(parsed) ? parsed : [];
}

/**
 * Read the registry back as a list of plugin names, skipping entries without one.
 *
 * @returns {string[]}
 */
function pkgNames() {
  /** @type {string[]} */
  const names = [];
  for (const entry of readEntries()) {
    if (typeof entry !== "object" || entry === null || !("pkg" in entry)) continue;
    const { pkg } = entry;
    if (isString(pkg)) names.push(pkg);
  }
  return names;
}

/**
 * Strip and assert the updater is gone and the others survive, in order.
 *
 * @param {Plugin[]} entries
 * @returns {void}
 */
function expectStripped(entries) {
  write(entries);

  expect(stripCapgoPlugin(registry)).toEqual(["@capgo/capacitor-updater"]);
  expect(pkgNames()).toEqual(entries.filter((e) => e.pkg !== UPDATER.pkg).map((e) => e.pkg));
}

describe("stripCapgoPlugin", () => {
  it("removes the updater and keeps every other plugin", () => {
    expectStripped([APP, UPDATER, STATUS_BAR]);
  });

  // The registry ships inside the APK, so these bytes are part of the signed
  // F-Droid reference APK. A stray newline here invalidates it.
  it("writes two-space JSON with no trailing newline", () => {
    write([APP, UPDATER]);

    stripCapgoPlugin(registry);
    const raw = readFileSync(registry, "utf8");

    expect(raw).toBe(JSON.stringify([APP], null, 2));
    expect(raw.endsWith("\n")).toBe(false);
  });

  // The updater happens to be last today, which is the case a `sed` range
  // delete gets wrong by leaving a trailing comma.
  it("produces valid JSON when the updater is last", () => {
    expectStripped([APP, STATUS_BAR, UPDATER]);
  });

  it("produces valid JSON when the updater is first", () => {
    expectStripped([UPDATER, APP, STATUS_BAR]);
  });

  it("produces valid JSON when the updater is in the middle", () => {
    expectStripped([APP, UPDATER, STATUS_BAR]);
  });

  it("produces valid JSON when the updater is the only entry", () => {
    expectStripped([UPDATER]);
  });

  it("is a no-op the second time", () => {
    write([APP, UPDATER]);

    stripCapgoPlugin(registry);
    const once = readFileSync(registry);

    expect(stripCapgoPlugin(registry)).toEqual([]);
    expect(readFileSync(registry).equals(once)).toBe(true);
  });

  it("ignores a missing registry", () => {
    expect(stripCapgoPlugin(join(dir, "absent.json"))).toEqual([]);
  });

  it("ignores a registry that is not an array", () => {
    writeFileSync(registry, JSON.stringify({ pkg: UPDATER.pkg }));

    expect(stripCapgoPlugin(registry)).toEqual([]);
  });

  it("leaves entries without a pkg alone", () => {
    write([APP, ORPHAN, UPDATER]);

    expect(stripCapgoPlugin(registry)).toEqual(["@capgo/capacitor-updater"]);
    expect(readEntries()).toEqual([APP, ORPHAN]);
  });
});
