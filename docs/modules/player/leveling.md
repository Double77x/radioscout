# Loudness leveling

Leveling exists so switching stations stops jumping in volume, without riding the music inside a station. Four files share that job:

| File | Owns |
| :---- | :---- |
| `src/lib/radio/normalize.ts` | The maths: RMS, the two-stage servo, BS.1770 K-weighting, the trim |
| `src/lib/player/leveling-graph.ts` | Web Audio graph construction for one element |
| `src/lib/player/leveling.ts` | Tick plumbing: buffer lifecycle, settle vs steady, teardown |
| `src/lib/player/engine.ts` | The graph refs, `stageGain`, `settleTicksLeft`, `blockedHosts`, and driving `adaptTick` |

This doc is named after the subsystem rather than mirroring one file, because the interesting decisions span all four.

## Two stages, then a limiter

**Stage 1 — fast AGC, per tune-in.** Eases gain toward a short-term RMS target so the inter-station jump is gone within about eight seconds. Loud bites fast, quiet rides up briskly, and sub-floor input freezes the gain so a spoken intro cannot wind it up.

**Stage 2 — slow LUFS trim.** A ±3 dB servo on gated K-weighted momentary loudness corrects the systematic offsets stage 1 leaves behind (speech versus music spectra, bass-heavy masters) over several minutes. It steers from its slow anchor, never the live block, and content more than 3 dB from the anchor freezes adaptation outright — so bursts, jingles and tune-in transients cannot yank the volume around. This is the same shape broadcast processors use: a fast stage plus a slow programme-loudness nudge, inaudible by construction.

Once settled, stage 1 crawls hard enough that verses, choruses and adverts play untouched.

**The limiter is what makes the boost clamp safe.** A brickwall at −1 dBFS shaves boosted transient tips, so the clamp can sit at +9 dB without flat-topping a hot master. Narrow clamps alone cannot do this job: the boost ceiling would strand dynamic masters quiet, and a wide duck floor over-ducks bass-heavy material whose energy the tap reads cold.

## Graph shape

Measurement never touches the mix:

```
audible:     source → gain → limiter → destination
measurement: source → highpass → presence shelf → analyser → whisper (−60 dB)
trim:        source → splitter → K analysers L/R (BS.1770 biquads run JS-side, per tick)
```

The whisper branch keeps the measurement path pulled toward zero so the analyser stays alive without adding audible signal. It is fully masked.

## Two invariants

Both exist to keep the volume slider the master control:

1. **Measurement taps the SOURCE.** Tapping post-gain would feed the correction back into itself and settle at half the intended value. Stage 2 breaks this deliberately — it measures post-gain loudness — but at a ~3-minute time constant plus a burst deadband, far too slow to oscillate or ride the programme.
2. **The reading is divided by the element volume.** Element volume applies before the graph, so without this any slider setting below 100% would be boosted straight back up — both for stage 1 RMS and stage 2 LUFS. Node gain holds `stageGain * trimLinear(trimDb)` assigned directly, never multiplied in-place, so the trim never compounds across ticks.

## K-weighting

Exact BS.1770 pre-filter and RLB biquads, run in JS per tick against a 48 kHz coefficient table, separately per stereo channel — the spec sums channel energies, and a mono-downmixed tap reads correlated stereo ~3 dB cold (which once railed the trim fighting stage 1). At other context rates the curve shifts a few percent in frequency and the servo absorbs it, because target and measurement run through the same filters.

**Filter state must persist across buffers.** Resetting per buffer re-rings the transient on every tick.

## Gating

An absolute gate at −70 LUFS discards digital silence, which carries no loudness information. A relative gate at 10 LU below the anchor stops wide-dynamic speech dragging the trim around. The anchor itself eases at roughly a two-minute time constant, because the anchor is history rather than current level. During the tune-in settle window the anchor tracks the live reading directly instead, so the trim starts from the settled station loudness rather than climbing out of a cold one.

## CORS is a hard requirement

Pulling a stream through Web Audio needs CORS headers, and many stations do not send them. A CORS-blocked stream routed into a graph fails its load outright, so the player rescues once per element — error event, rebuild direct, replay — and remembers the host for the session. CORS-clean stations stay leveled; the blocked ones play unprocessed rather than not at all.

Because of this, `crossOrigin` must be set **before** any `src` assignment. It is load-time state, which is why routing happens at element build time in both the live and staged paths.

## Lineage

`docs/lineage.md`, 2026-10-05 (Two-stage leveling + safety limiter) records the research, the rejected approaches and the known limits. The earlier clamp-only behaviour and the AGC split are described there rather than here, since this document describes what the code does now.

Tests: `tests/unit/radio-normalize.test.ts`, `tests/unit/player-leveling.test.ts`.