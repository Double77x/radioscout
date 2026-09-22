import { describe, expect, it } from "vitest";
import { emit, getSnapshot } from "@/lib/player/store";

describe("player track title", () => {
  it("starts null and merges without touching transport state", () => {
    const before = getSnapshot();
    emit({ track: "Artist - Title" });
    const after = getSnapshot();
    expect(after.track).toBe("Artist - Title");
    expect(after.status).toBe(before.status);
    expect(after.station).toBe(before.station);
    emit({ track: null });
    expect(getSnapshot().track).toBeNull();
  });

  it("a track-only emit never banks or restarts listening state", () => {
    emit({ station: null, status: "idle", track: null });
    emit({ track: "Late Night Jazz" });
    expect(getSnapshot().status).toBe("idle");
    expect(getSnapshot().track).toBe("Late Night Jazz");
    emit({ track: null });
  });
});
