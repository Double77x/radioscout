import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readLastStation, writeLastStation } from "@/lib/radio/last-played";
import { EMPTY_STATION } from "@/lib/radio/types";

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

afterEach(() => {
  uninstallStorageStub();
});

beforeEach(() => {
  installStorageStub();
});

const STATION = { ...EMPTY_STATION, stationuuid: "last-1", name: "Resume FM" };

describe("last played station", () => {
  it("round-trips the written station", () => {
    expect(readLastStation()).toBeNull();
    writeLastStation(STATION);
    expect(readLastStation()?.stationuuid).toBe("last-1");
    expect(readLastStation()?.name).toBe("Resume FM");
  });

  it("collapses corrupt payloads to null", () => {
    backing.set("radioscout:last-station", "{nope");
    expect(readLastStation()).toBeNull();
    backing.set("radioscout:last-station", JSON.stringify({ name: "no uuid" }));
    expect(readLastStation()).toBeNull();
  });
});
