# BBC live metadata

`src/lib/radio/bbc.ts` reads the BBC's Radio & Music Services JSON feeds to supply now-playing lines for BBC stations.

BBC streams are HLS, and HLS playlists carry no in-band ICY metadata, so the normal title path finds nothing. RMS sends browsers no CORS headers either, which is why **this module never calls RMS from the client** — the edge function `functions/api/bbc-title.ts` does, with a dev-only `/__bbc/probe` mirror. Everything here is pure parsing plus URL building, which is what makes it safe to load in both places.

## Two feeds, first hit wins

1. `segments/latest` — the last music segment, rendered `Artist - Track`.
2. `broadcasts/latest` — the on-air programme, `Show - Episode`, for speech stations and music gaps.

A segment only counts while it is flagged now-playing or its recency label reads as under a minute old. Anything older is stale, and a news bulletin following music would otherwise pin a 20-minute-old track, so the programme feed takes over instead.

`parseBbcBroadcasts` prefers an explicit `on_air` flag, then the window covering now, then the entry **nearest** to now — a stale window has to resolve to its most recent row, not its oldest.

## No station list to maintain

The RMS service id (`bbc_radio_two`, `bbc_6music`, `bbc_radio_one_anthems`) is embedded in both the Sounds homepage and the stream URLs, so `bbcServiceIdForStation` reads it out of the station row rather than consulting a hardcoded mapping. Homepage first, because it is the canonical Sounds play id; Akamai HLS paths and rebroadcast proxies both carry it too.

## Poll policy

Tracks poll every 30s. Programmes back off to a three-minute safety net, because music rarely starts mid-show unannounced.

Accuracy comes from a **boundary one-shot** rather than from polling: `bbcBoundaryDelayMs` schedules a re-probe at the programme's `end` plus a 10s buffer, because RMS lags the rollover. So a three-hour show costs roughly 60 polls rather than 360, and the change still lands within seconds. `bbcNextPollDelayMs` picks whichever is sooner.

Three cases return null and fall back to the interval loop: an unparseable date, one already past, and anything beyond a 12-hour sanity cap.

## Paging

The `latest` broadcasts feed pages ascending by start with 30 per page by default, so a single page often ends hours before now — Radio 4's window runs to 134 entries. `limit=200` takes the whole window in one request; `fetchBbcBroadcastEntries` pages the remainder to a cap of three pages if a window ever outgrows that.

## The local `isRecord`

This module defines its own `isRecord` rather than importing the one from `@/lib/utils`. That is not duplication: the dev middleware in `scripts/icy-probe-plugin.ts` loads this file inside Vite config resolution, where the `@/` alias does not exist. Keep it local.

## Lineage

`docs/lineage.md`, 2026-10-04 (BBC live metadata) for the feed design and the paging discovery, and 2026-10-05 (BBC titles missing on APK builds) for why the client falls back to the hardcoded canonical URL. The endpoint's caching is in `docs/plans/STREAM_TITLES.md`.

Tests: `tests/unit/bbc.test.ts`, `tests/unit/bbc-title-function.test.ts`.