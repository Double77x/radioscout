import { describe, expect, it } from "vite-plus/test";
import { ddgArtworkUrl, isDdgPlaceholder, wsrvArtworkUrl } from "@/lib/radio/artwork";

const TUNEIN = "https://cdn-radiotime-logos.tunein.com/s24939q.png";
const HTTP_ROW = "http://www.smoothradio.com/assets_v4r/smooth/img/favicon-196x196.png";

describe("ddgArtworkUrl (primary)", () => {
  it("wraps the source untouched and encoded", () => {
    expect(ddgArtworkUrl(TUNEIN)).toBe(`https://proxy.duckduckgo.com/iu/?u=${encodeURIComponent(TUNEIN)}`);
  });

  it("accepts http sources (the proxy is https, so no mixed content)", () => {
    expect(ddgArtworkUrl(HTTP_ROW).startsWith("https://proxy.duckduckgo.com/iu/?u=")).toBe(true);
  });

  it("blank in, blank out — callers render the fallback tile", () => {
    expect(ddgArtworkUrl("")).toBe("");
    expect(ddgArtworkUrl("   ")).toBe("");
  });
});

describe("proxy order", () => {
  it("tries wsrv first — it reports failure honestly, so onError works", () => {
    // The component builds `primary` from wsrv and only reaches DDG after a
    // failure; this pins that mapping so the order cannot silently flip back.
    expect(new URL(wsrvArtworkUrl(TUNEIN)).host).toBe("wsrv.nl");
    expect(new URL(ddgArtworkUrl(TUNEIN)).host).toBe("proxy.duckduckgo.com");
  });
});

describe("isDdgPlaceholder", () => {
  it("catches the refusal placeholder DDG serves with a 400", () => {
    // Measured across all seven DDG refusal classes — every one is
    // 400 image/svg+xml at exactly 260x180 (viewBox 0 0 384 304).
    expect(isDdgPlaceholder(260, 180)).toBe(true);
  });

  it("leaves every real directory favicon dimension alone", () => {
    // 86 live favicons measured: square sizes dominate and none is 260x180.
    for (const [w, h] of [
      [180, 180],
      [512, 512],
      [120, 120],
      [32, 32],
      [196, 196],
      [1024, 1024],
      [260, 181],
      [259, 180],
      [260, 179],
      [520, 360],
    ]) {
      expect(isDdgPlaceholder(w, h)).toBe(false);
    }
  });

  it("is not fooled by wide logos sharing the placeholder's aspect ratio", () => {
    // Aspect-ratio matching would misfire here; exact dimensions do not.
    expect(isDdgPlaceholder(520, 360)).toBe(false);
    expect(isDdgPlaceholder(780, 540)).toBe(false);
  });
});

describe("wsrvArtworkUrl (fallback)", () => {
  it("passes the full URL including scheme (stripped form breaks TLS-only ports)", () => {
    expect(wsrvArtworkUrl(TUNEIN)).toBe(`https://wsrv.nl/?url=${encodeURIComponent(TUNEIN)}`);
    expect(wsrvArtworkUrl(HTTP_ROW)).toBe(`https://wsrv.nl/?url=${encodeURIComponent(HTTP_ROW)}`);
  });

  it("blank in, blank out", () => {
    expect(wsrvArtworkUrl("")).toBe("");
  });

  it("the browser connects to wsrv.nl, never the origin host", () => {
    for (const raw of [TUNEIN, HTTP_ROW]) {
      expect(new URL(wsrvArtworkUrl(raw)).host).toBe("wsrv.nl");
      expect(new URL(ddgArtworkUrl(raw)).host).toBe("proxy.duckduckgo.com");
    }
  });
});
