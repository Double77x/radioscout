import { beforeEach, describe, expect, it } from "vite-plus/test";
import { readSheetTab, writeSheetTab, SHEET_TAB_KEY } from "@/lib/radio/sheet-tab";

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- mutable record view of a global for stub install
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

describe("sheet tab memory", () => {
  it("starts null and round-trips per station", () => {
    expect(readSheetTab("a")).toBeNull();
    writeSheetTab("a", "recent");
    writeSheetTab("b", "stats");
    expect(readSheetTab("a")).toBe("recent");
    expect(readSheetTab("b")).toBe("stats");
    expect(readSheetTab("c")).toBeNull();
  });

  it("collapses garbage to null", () => {
    backing.set(SHEET_TAB_KEY, JSON.stringify({ a: "everywhere", b: 42 }));
    expect(readSheetTab("a")).toBeNull();
    expect(readSheetTab("b")).toBeNull();
    backing.set(SHEET_TAB_KEY, "not json");
    expect(readSheetTab("a")).toBeNull();
  });

  it("caps remembered stations, oldest first", () => {
    for (let index = 0; index < 105; index += 1) {
      writeSheetTab(`station-${index}`, "recent");
    }
    expect(readSheetTab("station-0")).toBeNull();
    expect(readSheetTab("station-4")).toBeNull();
    expect(readSheetTab("station-5")).toBe("recent");
    expect(readSheetTab("station-104")).toBe("recent");
  });
});
