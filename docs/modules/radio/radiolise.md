# Radiolise title lookup

`src/lib/radio/radiolise.ts` is a one-shot title lookup against Radiolise's open metadata API. It sits at the head of the title probe chain because their server holds the upstream ICY connection open across callers — a warm station answers in a fraction of a second with no audio bytes pulled by anyone.

Cold stations behave differently: their REST route only responds on the first published title, so a cold lookup *hangs* rather than returning empty. Callers must therefore cap this well under the poll interval and fall through on any outcome other than `ok`. `engine.ts` uses a 5s cap against a 20s poll.

## POST, not GET

The request is a POST with the station URL in a JSON body. Their docs warn that query parameters land in server logs, which would record who listens to what on every poll. The body carries the same field their route already reads, so this costs nothing.

**This is a privacy constraint, not a style preference.** Do not "simplify" it to a GET.

## Outcomes

`fetchRadioliseTitle` never rejects. Every failure maps to an outcome the caller can route on:

| Outcome | Meaning |
| :---- | :---- |
| `ok` | Title returned |
| `no-title` | Reached the API, nothing published or nothing parseable |
| `timeout` | Caller's signal or the internal cap fired |
| `http-error` | Non-2xx response |
| `fetch-error` | Network failure |

## Invariants

- **Titles run through `normalizeStreamTitle`** like in-page reads do. Their parser ships the raw stuffed value with ad markers included.
- **The `AbortSignal` combinators are built inside the `try`**, because `AbortSignal.timeout`/`any` throw synchronously on older browsers. This mirrors `fetchIcyTitles` and is deliberate.

## Lineage

No dedicated entry; the probe chain's shape is described in `docs/plans/STREAM_TITLES.md`, and the introduction of Radiolise into the chain is in `docs/lineage.md` under 2026-10-01 (Stream Titles). The warm/cold measurements behind the cap are in the same entry.

Tests: `tests/unit/radio-radiolise.test.ts`.