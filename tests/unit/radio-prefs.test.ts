import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { DEFAULT_VOLUME, loadMuted, loadVolume, persistVolume, readPlayerPrefs } from "@/lib/radio/prefs";

/** Node storage stub, matching the pattern in `radio-backup.test.ts`. */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- mutable record view of a global for stub install/restore
const globalScope = globalThis as unknown as { window?: unknown; localStorage?: Storage };
const backing = new Map<string, string>();

beforeEach(() => {
  backing.clear();
  globalScope.window = globalThis;
  globalScope.localStorage = {
    getItem: (key: string) => backing.get(key) ?? null,
    setItem: (key: string, value: string) => {
      backing.set(key, value);
    },
    removeItem: (key: string) => {
      backing.delete(key);
    },
    clear: () => {
      backing.clear();
    },
    get length() {
      return backing.size;
    },
    key: (index: number) => [...backing.keys()][index] ?? null,
  };
});

afterEach(() => {
  delete globalScope.localStorage;
  delete globalScope.window;
});

describe("loadVolume", () => {
  it("reads a missing key as the fresh-install default, not as 0", () => {
    expect(loadVolume()).toBe(DEFAULT_VOLUME);
  });

  it("reads an empty key as the default too", () => {
    backing.set("radioscout:volume", "");
    expect(loadVolume()).toBe(DEFAULT_VOLUME);
  });

  it("keeps a stored 0 — silence the user chose is not a missing key", () => {
    backing.set("radioscout:volume", "0");
    expect(loadVolume()).toBe(0);
  });

  it("clamps a stored value into 0..1 and falls back on junk", () => {
    backing.set("radioscout:volume", "1.4");
    expect(loadVolume()).toBe(1);
    backing.set("radioscout:volume", "-0.2");
    expect(loadVolume()).toBe(0);
    backing.set("radioscout:volume", "loud");
    expect(loadVolume()).toBe(DEFAULT_VOLUME);
  });

  it("falls back when storage throws", () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalScope, "localStorage");
    Object.defineProperty(globalScope, "localStorage", {
      configurable: true,
      get: () => {
        throw new Error("private mode");
      },
    });
    expect(loadVolume()).toBe(DEFAULT_VOLUME);
    if (descriptor) Object.defineProperty(globalScope, "localStorage", descriptor);
  });
});

describe("persistVolume", () => {
  it("round-trips the level and the muted flag", () => {
    persistVolume(0.4, true);
    expect(loadVolume()).toBe(0.4);
    expect(loadMuted()).toBe(true);
    expect(readPlayerPrefs()).toEqual({ volume: 0.4, muted: true });
  });

  it("reads a missing muted key as unmuted", () => {
    expect(loadMuted()).toBe(false);
  });
});
