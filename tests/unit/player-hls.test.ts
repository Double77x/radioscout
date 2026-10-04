import { describe, expect, it } from "vite-plus/test";
import {
  HLS_UNSUPPORTED_MESSAGE,
  canBridgeHls,
  destroyHls,
  hasNativeHls,
  hlsSourceUrl,
  hlsUnsupportedNote,
  needsHlsBridge,
} from "@/lib/player/hls";

const BBC_HLS =
  "https://as-hls-ww-live.akamaized.net/pool_1/live/ww/bbc_radio_one.isml/bbc_radio_one-audio%3d128000.norewind.m3u8";
const PLAIN_MP3 = "https://stream.example.org/live.mp3";

/** Partial element double: only `canPlayType` is exercised here. */
function stubElement(canPlay: string): HTMLAudioElement {
  return {
    canPlayType: () => canPlay,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- partial test double: unexercised members are intentionally absent
  } as unknown as HTMLAudioElement;
}

describe("hasNativeHls", () => {
  it("reads the browser's own HLS claim", () => {
    expect(hasNativeHls(stubElement("maybe"))).toBe(true);
    expect(hasNativeHls(stubElement("probably"))).toBe(true);
    expect(hasNativeHls(stubElement(""))).toBe(false);
  });

  it("treats a throwing element as unsupported", () => {
    const element = {
      canPlayType: () => {
        throw new Error("detached");
      },
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- partial test double: unexercised members are intentionally absent
    } as unknown as HTMLAudioElement;
    expect(hasNativeHls(element)).toBe(false);
  });
});

describe("needsHlsBridge", () => {
  it("bridges HLS only when the element can't decode it (the Firefox shape)", () => {
    expect(needsHlsBridge(stubElement(""), BBC_HLS)).toBe(true);
  });

  it("leaves native-HLS browsers (Chrome 142+, Safari) alone", () => {
    expect(needsHlsBridge(stubElement("maybe"), BBC_HLS)).toBe(false);
  });

  it("never bridges a plain stream", () => {
    expect(needsHlsBridge(stubElement(""), PLAIN_MP3)).toBe(false);
  });

  it("sees through playlist junk before the extension check", () => {
    expect(needsHlsBridge(stubElement(""), `${BBC_HLS}%20#EXTINF:0,Track`)).toBe(true);
  });
});

describe("canBridgeHls", () => {
  it("is false without a window (SSR/prerender has no MediaSource)", () => {
    expect(canBridgeHls()).toBe(false);
  });
});

describe("teardown helpers", () => {
  it("destroyHls tolerates null and unbridged elements", () => {
    expect(() => {
      destroyHls(null);
    }).not.toThrow();
    expect(() => {
      destroyHls(stubElement(""));
    }).not.toThrow();
  });

  it("hlsSourceUrl reports no playlist for an unbridged element", () => {
    expect(hlsSourceUrl(stubElement(""))).toBeNull();
  });
});

describe("messages", () => {
  it("names the real reason instead of only the APK", () => {
    expect(HLS_UNSUPPORTED_MESSAGE).toContain("HLS");
    expect(HLS_UNSUPPORTED_MESSAGE).not.toContain("needs the native player");
  });

  it("the handoff note keeps the predecessor and names the station", () => {
    expect(hlsUnsupportedNote("BBC Radio 1")).toBe(
      "BBC Radio 1 streams as HLS, which this browser can't decode — kept playing the current station.",
    );
  });
});
