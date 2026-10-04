# Stream titles

The player subtitle shows the live `StreamTitle` where the station sends
one, replacing the genre/country fallback. Track changes update it;
pause/stop/new-play clear it. The same title reaches the system media
session, so a car, the lock screen and Android Auto show the song too.

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

## Session metadata (car, lock screen, Android Auto)

The dock is not the only thing a listener looks at. Both engines publish the
title into the media session the system renders elsewhere: with a track, the
song takes the title slot and the station moves to the artist slot (otherwise
every one of those surfaces prints the station twice and never names the
song). Without a track, the station leads and tags/country keep the second
line.

- **APK:** `RadioPlaybackService.publishTrackTitle` swaps the current item's
  metadata via `Player.replaceMediaItems`, which is the only in-place update
  path in media3-exoplayer 1.9.0 — `canUpdateMediaItem` compares playback
  identity and ignores metadata (URI plus `imageDurationMs`/`customCacheKey`
  for progressive sources, URI plus stream keys/DRM/live configuration for
  HLS), so the source already loading is reused and the position holds.
  `setMediaItem` would build a fresh source and re-read the stream (a rebuffer
  per track change), so it is not used here. Skipped mid-handoff: until the
  blend swaps the session, the retiring item is what the car is showing.
- **Web:** `updateMediaSession(station, handlers, track)` in
  `lib/player/native-bridge`, republished from `engine.ts` whenever a probe
  title lands. Needs *Show song titles* on, since that is what feeds it.

## Bluetooth car displays

The title reaches the platform media session — verified on device with
`adb shell dumpsys media_session`, where `metadata: size=11,
description=<song>, <station>, RadioScout` tracks the song. That is the
value Bluetooth/AVRCP reads, so the app side is done.

Some stereos never re-render it. Older head units (AVRCP 1.3-era cars
especially) refresh on a play-status change, not on a metadata update, and
a live stream has no track boundary to announce — so they keep the first
title they received. Reproduced upstream with the stock Media3 demo
([androidx/media#430](https://github.com/androidx/media/issues/430)); the
same thread notes the old ExoPlayer session could force it, and Media3's
`MediaSession` has no `setMetadata` to do it with. Newer head units and
Android Auto read the session directly and are unaffected.

Settings → Audio → *Refresh car display* (APK only, off by default) works
around it: on each published title the service re-seeks to the current
position, which re-pushes the platform `PlaybackState`
(`onPositionDiscontinuity` → `MediaSessionLegacyStub
.updateLegacySessionPlaybackState` → `MediaSessionCompat
.setPlaybackState`, verified in media3-session 1.9.0) — a play-status
change every 1.3-era sink answers by re-reading the title. A volume nudge
cannot do it: `onVolumeChanged` is not wired to that push. The seek can
cost a brief rebuffer, which is why it is opt-in with the warning in the
switch copy. Logcat: `car display nudge at <ms>`.

Two things worth knowing when a car shows nothing at all:

- Check the negotiated AVRCP version. The phone advertises one (Developer
  options → Bluetooth AVRCP version on some builds, 1.3–1.6) and the car
  takes the lower of the two. A car that only does 1.3 gets no benefit from
  a newer phone setting, and version behaviour is not monotonic — one
  report has 1.6/1.4/1.3 working and 1.5 not.
- A station switch is a real item transition, so the next title *should*
  appear after one. If it does not, the head unit is ignoring even track
  transitions and no app-side nudge will help.

## Edge caching (Cache API)

Ok responses carry `Cache-Control: public, max-age=60`; errors
`no-store`. The header alone does not get Pages Function responses
edge-cached (verified live: repeats re-probed upstream with no
`cf-cache-status`), so the function also stores verdicts explicitly via
`caches.default.put` keyed on the full request URL. Repeats inside the
TTL are served without waking the probe or touching the station —
roughly one short upstream pull per station per minute globally,
however many are listening. Errors bypass the cache entirely.

Verification:

```bash
curl -s 'https://<preview>.pages.dev/api/icy-title?url=<stream>'  # probes
curl -s 'https://<preview>.pages.dev/api/icy-title?url=<stream>'  # cached
```

The two bodies must be byte-identical (same embedded probe timing).
Client polling (45s) vs TTL (60s) keeps worst-case staleness around
a minute.

## Debugging

- **Web/dev:** open `/__icy`, probe the station URL, read `trace`. The
  engine also logs `[icy-probe] subtitle:` in dev on every paint.
- **APK:** `adb shell dumpsys media_session` is the ground truth — it prints
  the platform metadata every Bluetooth stereo reads. If the title moves
  there, the app published and anything stale is downstream. `adb logcat |
  grep 'track:'` shows titles as ExoPlayer forwards them; `'session
  title:'` shows each one that also reached the media session
  (no line between the two means the car is showing the station name).
  Two failure lines to watch for: `'session title not published (<Class>):'`
  means the in-place update threw on-device (the class names the cause);
  `'session title MISMATCH:'` means the write went through but a read-back
  disagrees — the session and its surfaces have diverged.
  Nothing at all means the stream sends no usable frames (test an MP3 ICY
  station like Capital Xtra, not HLS), or the APK predates the v0.3.5 bridge
  fix — rebuild with `pnpm build:android:apk`.
