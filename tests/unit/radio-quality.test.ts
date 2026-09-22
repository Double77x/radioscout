import { afterEach, describe, expect, it } from "vitest";
import {
  normalizeMinBitrate,
  passesMinBitrate,
  qualityLabel,
  readMinBitrate,
  writeMinBitrate,
  QUALITY_KEY,
} from "@/lib/radio/quality";

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

afterEach(() => {
  delete globalScope.window;
  delete globalScope.localStorage;
});

describe("quality filter", () => {
  it("normalizes stored values to valid options", () => {
    expect(normalizeMinBitrate("128")).toBe(128);
    expect(normalizeMinBitrate(64)).toBe(64);
    expect(normalizeMinBitrate("96")).toBe(0);
    expect(normalizeMinBitrate("loud")).toBe(0);
    expect(normalizeMinBitrate(undefined)).toBe(0);
  });

  it("reads any quality without a window (SSR)", () => {
    expect(readMinBitrate()).toBe(0);
  });

  it("round-trips the selection through storage", () => {
    installStorageStub();
    expect(readMinBitrate()).toBe(0);
    writeMinBitrate(128);
    expect(backing.get(QUALITY_KEY)).toBe("128");
    expect(readMinBitrate()).toBe(128);
    writeMinBitrate(96);
    expect(readMinBitrate()).toBe(0);
  });

  it("labels options for triggers and pickers", () => {
    expect(qualityLabel(0)).toBe("Any quality");
    expect(qualityLabel(128)).toBe("128 kbps+");
  });

  it("passes everything at any quality, verified bitrates at a minimum", () => {
    expect(passesMinBitrate(0, 0)).toBe(true);
    expect(passesMinBitrate(32, 0)).toBe(true);
    expect(passesMinBitrate(128, 128)).toBe(true);
    expect(passesMinBitrate(320, 128)).toBe(true);
    expect(passesMinBitrate(96, 128)).toBe(false);
    // Unknown bitrates never match an active minimum.
    expect(passesMinBitrate(0, 128)).toBe(false);
  });
});
