# Artwork proxy chain

Station logos load from roughly a hundred unrelated broadcaster hosts. A plain `<img>` sends each host's cookies and stores whatever `Set-Cookie` comes back, and there is no client-side purge — `document.cookie` and `Clear-Site-Data` are both origin-scoped. So artwork is never fetched direct: `src/lib/radio/artwork.ts` builds the URLs, and every caller goes through it.

`StationArt` walks the chain and falls back to a lucide tile. `native-bridge.ts` and `engine.ts` take only the primary leg, because MediaSession artwork has no error path to recover through.

## Chain order

**wsrv.nl first, DuckDuckGo second.** The order is a safety decision, not a quality preference: the leg that might have to fail has to fail loudly.

wsrv reports a refusal honestly — a real 404 with `application/json` — so `onError` fires and the browser logs nothing worse than a genuine missing image. DuckDuckGo has no honest failure mode. It answers a refusal with a **decodable blank placeholder** and a 400 status, so Chrome fires `load` and never fires `error`, and an `onError`-only chain cannot advance past it.

That is the whole reason wsrv leads. DDG stays in the chain only as the fallback leg, because it rasterises `.ico` sources that wsrv cannot decode.

The ordering is not encoded in the exported names, and that has already cost us. Three places once described the chain backwards — the stage comment in `StationArt.tsx` and the `describe` labels in `tests/unit/artwork-proxy.test.ts` all read DDG-first while the code ran wsrv-first. Nothing in the types prevents it, so `StationArt` keeps binding them to `primary` and `fallback` locally and `artwork-proxy.test.ts` asserts both hosts' roles explicitly. If you touch the chain, check every mention of primary/fallback, not just the code.

## The DuckDuckGo placeholder trap, and its weak point

`isDdgPlaceholder()` is the only thing making that fallback leg safe. It matches **exact dimensions** — 260x180 — rather than shape or aspect ratio, because a shape check would misfire on legitimately wide station logos and exact dimensions cannot.

The exactness is also the fragility, and it should be stated rather than left implicit: **DDG owns that placeholder.** If they change its dimensions the check returns false, and every station wsrv cannot serve degrades from station art to a blank image instead of the lucide tile — the icon-only fallback stops firing and nothing throws. It fails quietly, but it fails *downward*, not silently into a broken page.

Widening the check is reasonable if the placeholder moves. Two things to preserve if you do:

- It must not match real station artwork at the sizes logos actually use. Past measurements found none of 86 live favicons at 260x180, with the size distribution clustering on squares (180, 512, 196, 120), but wide logos exist and a loose aspect-ratio test would catch them.
- It must run in both places it currently runs — `onLoad` and the ref callback at commit — because a cached instant decode resolves before React registers its listeners.

## Invariants

- **Pass the full source URL including its scheme.** The scheme-stripped form makes wsrv default to plain HTTP, which fails on TLS-only non-standard ports.
- **Blank in, blank out.** A blank source yields a blank URL so the caller can render its own tile rather than proxying nothing.
- **`img-src` in `public/_headers` names exactly the two proxy hosts.** A future direct load then fails loudly instead of leaking quietly. This matters because both endpoints are unversioned third parties, so their behaviour can change under us.

## Lineage

What was measured when this was built, and what it replaced: `docs/lineage.md`, entries for 2026-10-06 (Artwork chain order is a safety decision), 2026-10-04 (Artwork proxy chain) and 2026-09-20 (Launcher Artwork Source of Trust).

The 2026-10-04 entry describes the chain as DuckDuckGo-first with wsrv second. That ordering was wrong, and the 2026-10-06 entry supersedes it: the code has always shipped wsrv-first, for the reason given above. The 2026-10-04 entry's measurements still stand; read its sequence claim as void.

Owning an `/api/art` edge proxy is the end state, since it also stops the broadcaster learning our IP. This chain is the zero-Workers stopgap, and swapping to it is a one-line change here plus the CSP entry.

Tests: `tests/unit/artwork-proxy.test.ts`.