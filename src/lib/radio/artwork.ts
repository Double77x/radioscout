/**
 * Station artwork proxy URLs. Logos come from ~100 unrelated broadcaster
 * hosts, and the browser must never fetch them direct, so every caller goes
 * through one of these two proxies.
 *
 * Chain order, the DDG placeholder trap and the CSP constraint:
 * docs/modules/radio/artwork.md
 */

const DDG_PROXY = "https://proxy.duckduckgo.com/iu/?u=";
const WSRV_PROXY = "https://wsrv.nl/?url=";

/**
 * True when a decoded image is DuckDuckGo's refusal placeholder. A refusal is
 * a decodable 400 carrying a blank image, so `onError` never fires and the
 * chain cannot advance without this — which is why wsrv leads.
 *
 * Exact dimensions rather than shape or aspect: a shape check would misfire on
 * legitimately wide station logos. The trade is fragility, since DDG owns the
 * placeholder. If they resize it this returns false and those rows fall back to
 * the blank image rather than the tile. Widening it is fine as long as it keeps
 * matching real logos — see docs/modules/radio/artwork.md.
 */
export function isDdgPlaceholder(width: number, height: number): boolean {
  return width === 260 && height === 180;
}

/**
 * Fallback-leg artwork URL. Blank in, blank out so callers render their own
 * tile. Needs the source URL including its scheme.
 */
export function ddgArtworkUrl(raw: string): string {
  const src = raw.trim();
  if (src === "") return "";
  return `${DDG_PROXY}${encodeURIComponent(src)}`;
}

/**
 * Primary-leg artwork URL. Blank in, blank out. Needs the source URL
 * including its scheme: the scheme-stripped form makes wsrv fall back to
 * plain HTTP, which fails on TLS-only ports.
 */
export function wsrvArtworkUrl(raw: string): string {
  const src = raw.trim();
  if (src === "") return "";
  return `${WSRV_PROXY}${encodeURIComponent(src)}`;
}
