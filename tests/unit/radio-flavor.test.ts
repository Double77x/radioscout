import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { FLAVORS, readStoredFlavor, storedFlavor, writeStoredFlavor, FLAVOR_STORAGE_KEY } from "@/lib/theme";
import { collectRadioBackup, restoreRadioBackup } from "@/lib/radio/backup";
import { RadioDB } from "@/lib/radio/store";

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

describe("flavour storage", () => {
  it("defaults empty and round-trips every flavour", () => {
    expect(readStoredFlavor()).toBe("default");
    for (const flavor of FLAVORS) {
      writeStoredFlavor(flavor);
      expect(readStoredFlavor()).toBe(flavor);
    }
  });

  it("collapses garbage to default", () => {
    expect(storedFlavor("neon")).toBe("default");
    expect(storedFlavor(42)).toBe("default");
    expect(storedFlavor(null)).toBe("default");
    backing.set(FLAVOR_STORAGE_KEY, "neon");
    expect(readStoredFlavor()).toBe("default");
  });
});

describe("flavour backup (v8)", () => {
  it("round-trips the flavour", async () => {
    writeStoredFlavor("gruvbox");
    const source = new RadioDB("radioscout-flavor-test-source");
    const target = new RadioDB("radioscout-flavor-test-target");
    try {
      const payload = await collectRadioBackup(source);
      expect(payload.flavor).toBe("gruvbox");
      writeStoredFlavor("default");
      await restoreRadioBackup(payload, target);
      expect(readStoredFlavor()).toBe("gruvbox");
    } finally {
      await source.delete();
      await target.delete();
    }
  });

  it("restores v7 backups without flavour as default", async () => {
    const source = new RadioDB("radioscout-flavor-test-legacy");
    const target = new RadioDB("radioscout-flavor-test-legacy-target");
    try {
      const payload = await collectRadioBackup(source);
      const { flavor: _dropped, ...v7 } = payload;
      writeStoredFlavor("nord");
      await restoreRadioBackup({ ...v7, version: 7 }, target);
      expect(readStoredFlavor()).toBe("default");
    } finally {
      await source.delete();
      await target.delete();
    }
  });
});
