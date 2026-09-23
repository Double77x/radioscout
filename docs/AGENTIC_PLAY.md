# Agentic Play — URL contract + expansion path

> Status: Tier 0 (docs) + Tier 1 (URL autoplay) landed. Tier 2/3 below are
> future expansion only — do not implement without a proven resolution failure.

## 1. Goal

An agent given `https://radioscout.pages.dev` as a source can play
"Kisstory" or "BBC Radio 1" for the user. Two agent shapes:

- **Browser agent** — navigates to a URL, clicks play (needs stable URLs + stable DOM hooks).
- **API agent** — never renders JS (needs a deterministic URL that resolves to audio).

Both are served by the same contract: **the URL is the API**.

## 2. URL contract (Tier 0 + Tier 1, implemented)

Base: `https://radioscout.pages.dev/`

| Pattern | Meaning | Example |
|---|---|---|
| `/?q=<name>` | Search, no autoplay. Agent inspects results, picks a row. | `/?q=kisstory` |
| `/?tag=<genre>` | Genre chart. | `/?tag=dance` |
| `/?station=<uuid>` | Open detail sheet for an exact station. No autoplay. | `/?station=96d3a...` |
| `/?station=<uuid>&play=1` | Open detail + start playback. Canonical share-to-play form. | `/?station=96d3a...&play=1` |
| `/?play=<uuid>` | Start playback by exact uuid. Sheet state untouched. | `/?play=96d3a...` |
| `/?play=<alias-or-name>` | Start playback by curated alias or free-text name. | `/?play=kisstory`, `/?play=bbc-radio-1` |

### Resolution order for `?play=`

1. Exact `stationuuid` (36-char `8-4-4-4-12` hex) → `stationByUuid()`, then `play()`.
2. Curated alias (`src/data/station-aliases.ts`, e.g. `kisstory` → `Kisstory`,
   `bbc-radio-1` → `BBC Radio 1`) → `searchStationsIlike()`, first playable hit, then `play()`.
3. Raw free-text fallback → `searchStationsIlike()`, first playable hit, then `play()`.
4. No hit → no playback, no navigation loop. The `play` param is stripped
   from the URL in all cases (success or miss) so refresh never retries.

### Rules for agents

- Prefer `?station=<uuid>&play=1` when you already know the uuid (deterministic).
- Use `?play=<alias>` for the ~60 curated stations; use `?q=<name>` + row pick otherwise.
- Never persist `play` in shared links beyond the first navigation — the app
  strips it with `replace: true` after resolving.
- Playback requires a user gesture on some mobile browsers; on desktop a
  direct navigation to a `play` URL starts audio. If blocked, the station is
  still loaded in the dock and one tap resumes.
- Only `https://` streams play on web (`filterPlayableStations`). `http://`-only
  directory rows are dropped from discovery lists by design.

### Stable DOM hooks for browser agents

- `data-testid="radio-search"` — search input (`RadioHeader`).
- `data-testid="station-row"` + `data-playing="true|false"` — each `StationCard` `<li>`.
- `data-testid="station-play"` — row play/pause button (`aria-label` includes station name).
- `data-testid="player-dock"` — dock section; `data-testid="player-toggle"` — dock play/pause.

## 3. Performance budget (why it stays fast)

- SSG unchanged: `/` still prerenders to static HTML; `?play=` / `?q=` are
  client-only search params excluded from prerender crawl (`vite.config.ts`
  filter drops `?` and `#`). No new prerendered pages in Tier 1.
- `use-agentic-play` dynamic-imports `@/lib/radio/api` (never in the initial
  bundle) and no-ops during SSR (`useIsClient` gate). Cost on normal loads: one
  hook + one search-string read.
- Alias map is a ~2KB static table, no network.
- Only one resolution runs per `play` value (single-flight ref); failures are
  silent + param stripped, never retried.

## 4. Files

- `docs/AGENTIC_PLAY.md` (this file) — contract + expansion path.
- `public/llms.txt` — "How to play" section for LLM discovery.
- `src/data/station-aliases.ts` — curated alias → search-term table + normalizer.
- `src/hooks/use-agentic-play.ts` — `?play=` / `?station=&play=1` resolver (client-only).
- `src/routes/index.tsx` — `play: string` in the `/` search schema.
- `src/components/scout/AppShell.tsx` — mounts the hook (route-agnostic, all pages).
- `tests/unit/agentic-play.test.ts` — alias + param-parsing unit tests.
- `src/data/best-of-british.ts` + `src/hooks/use-best-of-british.ts` +
  `src/components/radio/BestOfBritish.tsx` — homepage shelf (one batched
  `stationsByUuid` fetch, playable-filtered, A–Z); add uuids there, never URLs.

## 5. Tier 3 expansion path (future, not implemented)

Implement only when agents demonstrably fail to resolve names via Tier 1
(e.g. headless API agents with no JS, or ambiguous names needing server rank).

### Option A — edge resolver (recommended if needed)

- `GET /api/resolve?name=kisstory` → `{ uuid, name, url_resolved, homepage }`.
- Runs on Cloudflare (Pages Function / Worker), caches radio-browser upstream
  with SWR (e.g. 1h edge cache), returns first playable hit using the same
  `searchStationsIlike` ranking as the client.
- Pros: one-hop JSON for headless agents, no client JS. Cons: new runtime
  surface, cache invalidation, abusive scraping vector → needs rate limits.
- Gate: add only with `Cache-Control: public, s-maxage=3600` + per-IP throttle.

### Option B — prerendered station pages

- `/s/<slug>-<uuid>` for top ~200 stations, each with JSON-LD `RadioStation`
  schema + canonical `?station=` link.
- Pros: citable per-station URLs, SEO. Cons: build-time directory fetch,
  prerender crawl growth, stale metadata. Keep to top N; never the full directory.

### Option C — MCP / tool endpoint

- Expose `searchStations` / `resolveStreamUrl` as MCP tools or
  `.well-known/ai-plugin.json`.
- Pros: richest agent integration. Cons: most maintenance, auth/abuse questions.
  Only if product commits to first-class agent support.

## 6. Verification

- `pnpm test:unit` (alias + param parsing).
- `pnpm lint && pnpm format`.
- `pnpm build` — prerender count unchanged (9 pages), no new routes.
- Manual: `/?play=kisstory` starts audio; param stripped after resolve;
  `/?station=<uuid>&play=1` opens sheet + plays; `/?q=kisstory` unchanged.

## 7. Maintaining (humans + future agents)

Adding an alias (e.g. a listener requests `?play=gold`):

1. Key form: run the name through `normalizeAlias` mentally — lowercase,
   spaces/underscores/dots/slashes → hyphens, diacritics and other
   punctuation stripped (`"KISSTORY R&B"` → `kisstory-rb`, `"Dance Wave!"`
   → `dance-wave`). Add every spelling users will try (`kisstory-rb` +
   `kisstory-rnb`).
2. Value form: a good `searchStationsIlike` query, usually the directory
   name (`"BBC Radio 4 Extra"`). It only needs to rank the right station
   first — it is a search, not an exact match.
3. Keep brand groups together in `src/data/station-aliases.ts` (BBC,
   Capital/Heart, Kiss/Kisstory, Global, niche).
4. Add a `resolveAlias` case to `tests/unit/agentic-play.test.ts`.
5. Never commit personal data: aliases are generic names only — no uuids,
   no backup-export Station snapshots, no listening history.
6. Verify: `pnpm test:unit`, `pnpm lint`, `pnpm format`, `pnpm build`
   (prerender count unchanged, no new routes).

HTTP-only directory rows: if the `https://` twin serves the same audio
(verify with a GET: expect `200` + `audio/*` + matching ICY metadata, as
done 2026-09-23 for `media-the.musicradio.com`), add the exact host to
`HTTPS_UPGRADE_HOSTS` in `src/lib/radio/types.ts` — never blind-swap
unverified hosts. The shelf and discovery lists pick it up automatically.

Changing the contract (`?play=` semantics, new params, new `data-testid`
hooks): update this doc, `public/llms.txt` ("How to play"), and the tests
in the same PR. `llms.txt` is what external agents read — it must never
drift from the implementation.
