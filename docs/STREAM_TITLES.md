# Stream titles (dock subtitle)

The player subtitle shows the live `StreamTitle` where the station sends
one, replacing the genre/country fallback. Track changes update it;
pause/stop/new-play clear it.

## Where titles come from

- **APK (native, always on):** ExoPlayer parses Shoutcast/Icecast
  (`IcyInfo`), ID3 `TIT2` and Vorbis `TITLE` frames and forwards them over
  the `trackUpdate` bridge event (`NativeAudioPlugin.java` →
  `onNativeTrackUpdate` → `snapshot.track`). No switch, no network beyond
  the stream itself. HLS carries no ICY blocks, so BBC-style HLS stations
  show nothing — expected, not a bug. Implementation note: the listener
  attaches to the session ExoPlayer itself (via
  `RadioPlaybackService.addMetadataListener`, which follows crossfade
  swaps) — timed `onMetadata` has no binder path in the Media3 1.9 session
  protocol (verified against `MediaControllerStub`), so a controller
  listener is deaf to ICY by framework design.
- **Web (opt-in):** Settings → Audio → *Show song titles* (off by default).
  Each play probes once immediately, then re-polls every 45s while playing
  so track changes land instead of going stale. Probes are staleness-guarded
  (play token + station uuid) and never paint after supersede/pause/stop.

## Web probe tiers (first hit wins, silent otherwise)

1. **Dev:** vite-only `/__icy` middleware (full trace, `meta=0` toggle).
2. **Prod web / APK:** edge function `GET /api/icy-title?url=<stream>`
   (`functions/api/icy-title.ts`; absolute canonical URL on native).
3. **Last resort:** direct browser fetch (CORS-permitting direct streams
   only — redirects and non-CORS hosts fail here by design).

Shared decoder: `src/lib/radio/icy.ts` (`parseIcyBlock`,
`fetchIcyTitles`). Display: `TrackTicker` (scrolls only on compact
viewports when overflowing, static otherwise).

## Edge caching (verify on preview deploy)

Ok responses carry `Cache-Control: public, max-age=60`; errors
`no-store`. Repeats inside the TTL are served from the edge with zero
worker invocations and zero upstream bytes — roughly one short upstream
pull per station per minute globally, however many are listening.

Verification (cannot be done locally — workerd doesn't emulate edge cache):

```bash
curl -sI 'https://<preview>.pages.dev/api/icy-title?url=<stream>'  # MISS
curl -sI 'https://<preview>.pages.dev/api/icy-title?url=<stream>'  # expect HIT
```

Check `cf-cache-status: HIT` on the second response. If both are
`DYNAMIC`, the edge isn't caching function responses: switch the function
to an explicit `caches.default.put` instead of headers. Client polling
(45s) vs TTL (60s) keeps worst-case staleness around a minute.

## Debugging

- **Web/dev:** open `/__icy`, probe the station URL, read `trace`. The
  engine also logs `[icy-probe] subtitle:` in dev on every paint.
- **APK:** `adb logcat | grep 'track:'` shows titles as ExoPlayer forwards
  them. Nothing there means the stream sends no usable frames (test an
  MP3 ICY station like Capital Xtra, not HLS), or the APK predates the
  v0.3.5 bridge fix — rebuild with `pnpm build:android:apk`.
