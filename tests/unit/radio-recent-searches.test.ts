import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearRecentSearches,
  MAX_RECENT_SEARCHES,
  readRecentSearches,
  RECENT_SEARCHES_KEY,
  recordRecentSearch,
} from "@/lib/radio/recent-searches";

/** Node has no DOM storage — stub the globals the module touches. */
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
    clear: () => backing.clear(),
    get length() {
      return backing.size;
    },
    key: (index: number) => [...backing.keys()][index] ?? null,
  } as Storage;
}

function uninstallStorageStub(): void {
  delete globalScope.window;
  delete globalScope.localStorage;
}

beforeEach(() => {
  installStorageStub();
});

afterEach(() => {
  uninstallStorageStub();
});

describe("recent searches", () => {
  it("starts empty and records trimmed terms newest-first", () => {
    expect(readRecentSearches()).toEqual([]);
    recordRecentSearch("  bbc  ");
    recordRecentSearch("jazz");
    expect(readRecentSearches()).toEqual(["jazz", "bbc"]);
  });

  it("ignores short and empty terms", () => {
    recordRecentSearch("");
    recordRecentSearch("  ");
    recordRecentSearch("x");
    expect(readRecentSearches()).toEqual([]);
    expect(backing.has(RECENT_SEARCHES_KEY)).toBe(false);
  });

  it("dedupes case-insensitively, moving the latest casing to front", () => {
    recordRecentSearch("bbc");
    recordRecentSearch("jazz");
    recordRecentSearch("BBC");
    expect(readRecentSearches()).toEqual(["BBC", "jazz"]);
  });

  it("caps the list at the max", () => {
    for (let index = 0; index < MAX_RECENT_SEARCHES + 3; index += 1) {
      recordRecentSearch(`station ${index}`);
    }
    const terms = readRecentSearches();
    expect(terms).toHaveLength(MAX_RECENT_SEARCHES);
    expect(terms[0]).toBe(`station ${MAX_RECENT_SEARCHES + 2}`);
  });

  it("clears everything", () => {
    recordRecentSearch("bbc");
    clearRecentSearches();
    expect(readRecentSearches()).toEqual([]);
  });

  it("collapses corrupt payloads back to empty", () => {
    backing.set(RECENT_SEARCHES_KEY, "not-json{{{");
    expect(readRecentSearches()).toEqual([]);
    backing.set(RECENT_SEARCHES_KEY, JSON.stringify({ nope: true }));
    expect(readRecentSearches()).toEqual([]);
  });

  it("no-ops without a window (SSR)", () => {
    uninstallStorageStub();
    expect(readRecentSearches()).toEqual([]);
    recordRecentSearch("bbc");
    clearRecentSearches();
  });
});
