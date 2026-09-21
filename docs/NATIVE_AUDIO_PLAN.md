# Native Audio Plan — Media3 foreground-service player (APK)

Status: N1 + N2 done (plugin + service + web wiring ship together).
N3 (HTTP allowlist vs proxy) and N4 (Auto/headset QA) remain.

## Why the WebView is not enough

1. **`http://`-only streams** (legacy `stream-*.planetradio.co.uk` Sharp-Stream
   edges — TLS handshake aborts, verified 2026-09-20). Web blocks them as mixed
   content (`allowMixedContent: false`, `cleartext: false` in
   `capacitor.config.ts:16-22`; no `usesCleartextTraffic` in
   `AndroidManifest.xml`). Do NOT fix with `cleartext: true` — Play policy and
   security downgrade for the whole app.
2. **HLS (`.m3u8`) streams.** Chrome/Android WebView cannot play them in
   `<audio>` — `use-player.ts` already gates these behind `needsNative`, but
   `playViaNative` (`use-player.ts:115`) is a stub returning `false`, so they
   never play anywhere today.
3. **Background playback.** When the WebView dies, audio dies. Radio needs a
   foreground service + MediaSession to survive.

## Design (Android-first, same as Capacitor plan)

- **Engine:** Media3 ExoPlayer (`androidx.media3:media3-exoplayer`,
  `media3-exoplayer-hls`, `media3-session`, `media3-ui` via
  `android/app/build.gradle`). ExoPlayer handles ICY/Shoutcast metadata,
  AAC/MP3/AAC+, and HLS from one API.
- **Service:** `RadioPlaybackService : MediaSessionService` (Kotlin,
  `android/app/src/main/java/.../audio/`), `MediaSession` for lock-screen /
  headset / Android Auto controls. Foreground with `FOREGROUND_SERVICE_MEDIA_PLAYBACK`
  permission + notification channel (port of RadioDroid's `PlayerService.java`).
- **Cleartext scoping:** keep the app default `cleartext: false`. If
  HTTP-only playback is required, add a `networkSecurityConfig` allowlisting
  ONLY the stream hosts (`stream-*.planetradio.co.uk`,
  `live-bauerkiss.sharp-stream.com`) — never `cleartextTrafficPermitted="true"`
  globally. Prefer this over per-host `usesCleartextTraffic`.
- **Bridge:** one Capacitor plugin (`NativeAudio`, no third-party dep):
  `play({ url, title, artist, artwork })`, `pause()`, `resume()`, `stop()`,
  `setVolume()`, event `playbackStatus` (`playing | paused | loading | error`).
  Web stays canonical — every call keeps its `<audio>` fallback.
- **Web wiring:** `playViaNative(station, url)` becomes: `if (!isNative())
  return false; if (await NativeAudio.play(...)) { emit({ status: "playing" });
  return true; } return false;` HLS routes here first; plain HTTPS streams may
  stay on `<audio>` until the service proves stable (one code path eventually).
- **Metadata/artwork:** pass `station.name`, tags/country subtitle
  (`format.ts` helpers), `station.favicon` for the notification + existing
  `updateMediaSession` stays as the web fallback.

## Milestones

- [x] N1: `NativeAudio` plugin skeleton + `playViaNative` wiring; HLS plays on
  device, HTTPS `<audio>` path untouched as fallback.
- [x] N2: foreground service + MediaSession (lock-screen controls, survives
  WebView death); OTA-safe (native-layer edits still need a full APK).
  POST_NOTIFICATIONS is requested in-context on first native play
  (Android 13+ denies it by default — without the grant the media
  notification, and with it all lock-screen/shade controls, never appears).
- [ ] N3: scoped cleartext allowlist for legacy HTTP edges OR server-side HTTPS
  proxy decision (proxy would also fix web — revisit then); HTTP-only error
  copy in `use-player.ts` updated to match whichever lands.
- [ ] N4: headset/Auto handling, retry + audio-focus (calls) behavior, device QA
  matrix (offline start, rotation, 120Hz, back-button with mini-player).

## Open questions

1. Proxy vs allowlist for HTTP-only streams — proxy fixes web too but adds
   streaming egress; allowlist is APK-only. Decide at N3.
2. Recording/wake alarms stay native-only (out of scope, same as before).
