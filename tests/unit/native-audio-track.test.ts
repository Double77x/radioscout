import { describe, expect, it } from "vite-plus/test";
import { nativePublishTrackTitle } from "@/lib/native-audio";

describe("nativePublishTrackTitle", () => {
  it("no-ops off-device without touching the bridge", async () => {
    await expect(nativePublishTrackTitle("Seyi Vibez - GTA")).resolves.toBeUndefined();
  });
});
