import { describe, expect, it } from "vitest";
import { pickSurpriseStation } from "@/lib/radio/surprise";
import type { Station } from "@/lib/radio/types";
import { EMPTY_STATION } from "@/lib/radio/types";

function station(uuid: string): Station {
  return { ...EMPTY_STATION, stationuuid: uuid, name: uuid };
}

describe("pickSurpriseStation", () => {
  it("returns null for an empty list", () => {
    expect(pickSurpriseStation([])).toBeNull();
  });

  it("picks deterministically with an injected random", () => {
    const stations = [station("a"), station("b"), station("c")];
    expect(pickSurpriseStation(stations, null, () => 0)?.stationuuid).toBe("a");
    expect(pickSurpriseStation(stations, null, () => 0.99)?.stationuuid).toBe("c");
  });

  it("excludes the current station", () => {
    const stations = [station("a"), station("b")];
    expect(pickSurpriseStation(stations, "a", () => 0)?.stationuuid).toBe("b");
  });

  it("returns null when exclusion empties the pool", () => {
    expect(pickSurpriseStation([station("a")], "a")).toBeNull();
  });
});
