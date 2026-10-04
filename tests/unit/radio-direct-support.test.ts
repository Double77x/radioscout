import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { loadDirectUnsupported, recordDirectUnsupported } from "@/lib/radio/direct-support";

/**
 * Node has no DOM storage — stub the two globals the memo touches.
 * Same shape as the backup/store tests.
 */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- mutable record view of a global for stub install/restore
const globalScope = globalThis as unknown as { window?: unknown; localStorage?: Storage };
const backing = new Map<string, string>();

function installStorageStub(): void {
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
}

function uninstallStorageStub(): void {
  delete globalScope.window;
  delete globalScope.localStorage;
}

describe("direct-support memo", () => {
  beforeEach(() => {
    installStorageStub();
  });

  afterEach(() => {
    uninstallStorageStub();
  });

  it("starts empty and round-trips a recorded URL", () => {
    expect(loadDirectUnsupported().size).toBe(0);
    recordDirectUnsupported("https://example.com/s.mp3");
    expect(loadDirectUnsupported()).toEqual(new Set(["https://example.com/s.mp3"]));
  });

  it("ignores blanks and survives corrupt storage", () => {
    recordDirectUnsupported("");
    backing.set("radioscout:icy-direct-unsupported", "not-json{{{");
    expect(loadDirectUnsupported().size).toBe(0);
    backing.set("radioscout:icy-direct-unsupported", JSON.stringify({ "https://a.test/x": "yesterday" }));
    expect(loadDirectUnsupported().size).toBe(0);
  });

  it("expires entries after a week so fixed stations are retried", () => {
    const old = Date.now() - 8 * 24 * 60 * 60 * 1000;
    backing.set("radioscout:icy-direct-unsupported", JSON.stringify({ "https://old.test/s.mp3": old }));
    expect(loadDirectUnsupported().size).toBe(0);
    recordDirectUnsupported("https://new.test/s.mp3");
    expect(loadDirectUnsupported()).toEqual(new Set(["https://new.test/s.mp3"]));
  });

  it("caps stored entries so one bad session cannot grow it forever", () => {
    for (let index = 0; index < 210; index++) {
      recordDirectUnsupported(`https://example.com/${index}.mp3`);
    }
    const loaded = loadDirectUnsupported();
    expect(loaded.size).toBeLessThanOrEqual(200);
    expect(loaded.has("https://example.com/209.mp3")).toBe(true);
  });

  it("no-ops without a window (SSR)", () => {
    uninstallStorageStub();
    expect(loadDirectUnsupported().size).toBe(0);
    recordDirectUnsupported("https://example.com/s.mp3");
  });
});
