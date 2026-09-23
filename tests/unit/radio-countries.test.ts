import { afterEach, describe, expect, it } from "vitest";
import {
  COUNTRIES_KEY,
  displayCountryName,
  normalizeCountries,
  readCountries,
  writeCountries,
} from "@/lib/radio/countries";

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

describe("country filter", () => {
  it("trims and dedupes without lowercasing directory names", () => {
    expect(normalizeCountries(["Germany", " Germany  ", "germany", "France", "", 42, null])).toEqual([
      "Germany",
      "France",
    ]);
  });

  it("reads worldwide without a window (SSR)", () => {
    expect(readCountries()).toEqual([]);
  });

  it("round-trips the selection through storage", () => {
    installStorageStub();
    expect(readCountries()).toEqual([]);
    writeCountries(["The United Kingdom Of Great Britain And Northern Ireland", "Germany"]);
    expect(backing.get(COUNTRIES_KEY)).toBe('["The United Kingdom Of Great Britain And Northern Ireland","Germany"]');
    expect(readCountries()).toEqual(["The United Kingdom Of Great Britain And Northern Ireland", "Germany"]);
  });

  it("shortens directory names for display without touching storage", () => {
    expect(displayCountryName("The United Kingdom Of Great Britain And Northern Ireland")).toBe("United Kingdom");
    expect(displayCountryName("The United States Of America")).toBe("United States");
    expect(displayCountryName("The Russian Federation")).toBe("Russia");
    expect(displayCountryName("The Netherlands")).toBe("Netherlands");
    expect(displayCountryName("The Philippines")).toBe("Philippines");
    expect(displayCountryName("The United Arab Emirates")).toBe("UAE");
    expect(displayCountryName("The Republic Of Korea")).toBe("South Korea");
    expect(displayCountryName("Taiwan, Republic Of China")).toBe("Taiwan");
    expect(displayCountryName("Bolivarian Republic Of Venezuela")).toBe("Venezuela");
    expect(displayCountryName("Islamic Republic Of Iran")).toBe("Iran");
    expect(displayCountryName("Germany")).toBe("Germany");
    expect(displayCountryName("Czechia")).toBe("Czechia");
  });
});
