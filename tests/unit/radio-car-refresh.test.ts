import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  CAR_REFRESH_KEY,
  carRefreshEnabled,
  readCarRefreshEnabled,
  writeCarRefreshEnabled,
} from "@/lib/radio/car-refresh";

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

afterEach(() => {
  delete globalScope.window;
  delete globalScope.localStorage;
});

describe("carRefreshEnabled", () => {
  it("reads the persisted on/off strings", () => {
    expect(carRefreshEnabled("1")).toBe(true);
    expect(carRefreshEnabled("0")).toBe(false);
  });

  it("accepts the number and boolean forms the backup may hold", () => {
    expect(carRefreshEnabled(1)).toBe(true);
    expect(carRefreshEnabled(true)).toBe(true);
    expect(carRefreshEnabled(0)).toBe(false);
    expect(carRefreshEnabled(false)).toBe(false);
  });

  // The toggle is opt-in and can rebuffer, so anything unexpected must fail
  // closed rather than surprise a listener with a seek per song change.
  it("collapses garbage to off", () => {
    for (const value of [null, undefined, "", "yes", "true", 2, -1, {}, []]) {
      expect(carRefreshEnabled(value)).toBe(false);
    }
  });
});

describe("readCarRefreshEnabled", () => {
  it("is off during prerender, where there is no storage to read", () => {
    delete globalScope.window;
    delete globalScope.localStorage;
    expect(readCarRefreshEnabled()).toBe(false);
  });

  it("is off when nothing has been written", () => {
    installStorageStub();
    expect(readCarRefreshEnabled()).toBe(false);
  });

  it("round-trips a written toggle", () => {
    installStorageStub();
    writeCarRefreshEnabled(true);
    expect(readCarRefreshEnabled()).toBe(true);
    writeCarRefreshEnabled(false);
    expect(readCarRefreshEnabled()).toBe(false);
  });
});

describe("writeCarRefreshEnabled", () => {
  it("stores the plain on/off strings under its own key", () => {
    installStorageStub();
    writeCarRefreshEnabled(true);
    expect(backing.get(CAR_REFRESH_KEY)).toBe("1");
    writeCarRefreshEnabled(false);
    expect(backing.get(CAR_REFRESH_KEY)).toBe("0");
  });

  it("never throws when storage is unavailable", () => {
    delete globalScope.window;
    delete globalScope.localStorage;
    globalScope.localStorage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        // no-op: this stub exists to prove the throwing paths, not to store
      },
      clear: () => {
        // no-op, same reason
      },
      get length() {
        return 0;
      },
      key: () => null,
    };
    expect(() => {
      writeCarRefreshEnabled(true);
    }).not.toThrow();
    expect(readCarRefreshEnabled()).toBe(false);
  });
});
