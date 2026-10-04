/**
 * Station artwork proxy chain (client-side third-party cookie fix).
 *
 * Station favicons load from ~100 unrelated publisher hosts, and a plain
 * `<img>` sends each host's cookies and stores whatever `Set-Cookie` comes
 * back (measured 2026-10-04: 15 of 33 Best of British rows set cookies,
 * including TuneIn's CDNs). There is no client-side purge — `document.cookie`
 * and `Clear-Site-Data` are origin-scoped — so the artwork must never be
 * fetched direct.
 *
 * Chain: **wsrv.nl primary, DuckDuckGo fallback.** Both strip `Set-Cookie`
 * (verified live: wsrv preserved 32/33 shelf rows, and neither proxy emits a
 * cookie across ~70 probes).
 *
 * wsrv leads because it reports failure *honestly* — a real 404 with
 * `application/json` — so `onError` fires and the browser logs nothing worse
 * than a genuine missing image. DDG answers refusals with a decodable
 * placeholder SVG, so it cannot be the leg that has to fail correctly (see
 * {@link isDdgPlaceholder}). DDG stays as the fallback because it rasterises
 * what wsrv cannot decode (`.ico`), which was the one measured gap.
 *
 * Both are unversioned third-party endpoints, so `img-src` in
 * `public/_headers` names exactly these two hosts — a future direct load
 * fails loudly instead of leaking quietly.
 */

const DDG_PROXY = "https://proxy.duckduckgo.com/iu/?u=";
const WSRV_PROXY = "https://wsrv.nl/?url=";

/**
 * DDG refuses upstream hosts with a **400 carrying a real 260x180 SVG
 * placeholder** — not an empty body. Chrome decodes it, fires `load`, and
 * never fires `error`, so `onError` cannot detect a refusal and the row would
 * sit on the placeholder forever (measured: 14 stuck placeholders in Most
 * loved before this existed). Verified across all seven refusal classes
 * (non-standard TLS port, SVG source, dead host, 402 host, `.ico`, missing
 * file, bare host): every one answers `400 image/svg+xml` at exactly 260x180
 * with `viewBox="0 0 384 304"`.
 *
 * The detection is exact, not a heuristic: measured 86 real directory
 * favicons and none is 260x180 (histogram is square — 180x180, 512x512,
 * 196x196, 120x120 …) and none shares the placeholder's 1.444 aspect. A
 * shape check would misfire on legitimately wide logos; exact dimensions
 * cannot.
 *
 * Needed only on the DDG leg, which is why wsrv is the primary: this exists
 * to make a *fallback* leg safe, not because the primary needed it.
 */
export function isDdgPlaceholder(width: number, height: number): boolean {
  return width === 260 && height === 180;
}

/**
 * Fallback artwork URL (blank in, blank out — callers render the fallback
 * tile). Passes the full source URL including scheme: the scheme-stripped
 * form makes wsrv default to plain HTTP, which fails on TLS-only
 * non-standard ports (`:8443` returns upstream 400 — measured on the WALM
 * rows).
 */
export function ddgArtworkUrl(raw: string): string {
  const src = raw.trim();
  if (src === "") return "";
  return `${DDG_PROXY}${encodeURIComponent(src)}`;
}

/**
 * Primary artwork URL (blank in, blank out). Takes the full source URL
 * including scheme — see {@link ddgArtworkUrl} for why stripping it breaks
 * TLS-only ports. Answers `ACAO: *` and a year-long browser cache.
 */
export function wsrvArtworkUrl(raw: string): string {
  const src = raw.trim();
  if (src === "") return "";
  return `${WSRV_PROXY}${encodeURIComponent(src)}`;
}
