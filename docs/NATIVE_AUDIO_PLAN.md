# Native Audio Plan — Media3 foreground-service player (APK)

Status: N1 + N2 done (plugin + service + web wiring ship together), N5 done
(leveling processor + main-thread controller traffic + compat notice).
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
- [x] N5: loudness leveling in the Media3 pipeline (`LevelingAudioProcessor`,
  same DSP as the web loop, JVM-tested) via `setLeveling` bridge + per-play
  flag — one Settings switch drives both players. Volume-safe: ExoPlayer
  applies user volume downstream at the AudioTrack, so no slider fighting.

## Threading rule (2026-09-22 — the silent-fallback outage)

Capacitor invokes `@PluginMethod`s on a background thread (logcat shows
`CapacitorPlugins`, never main). `MediaController` rejects every call from
any other thread (`MediaController method is called from a wrong thread`),
and our bridge caught that rejection into the silent `<audio>` fallback —
audio played, no lockscreen/shade UI, zero errors anywhere. It looked
version-related because only the *first* play after launch takes the connect
path; later plays reuse the controller through the one call site that was
already main-threaded.

- **Rule:** every `MediaController` touch — `buildAsync`, listener attach,
  and all ops — goes through `mainHandler.post` (`withControllerOnMain` in
  `NativeAudioPlugin.java`). Never call the controller from a plugin method
  body, a future callback, or any background executor directly.
- **Diagnostics:** the plugin logs the `RadioPlayback` tag at play entry
  (with the notification permission state), controller connect, op
  success/failure with the reason, and service create/destroy. A WebView
  fallback additionally raises a one-time "Compatibility playback" toast
  naming the missing lockscreen controls, so a silent bridge failure is
  visible on-device without logcat.
- **Verification:** emulator + debug APK (`pnpm build:android:apk`), tap
  play, then confirm `play dispatched` + foreground-service start in logcat
  and a `category=transport` notification in
  `dumpsys notification`; `dumpsys media_session` must show the session
  PLAYING, never NONE-while-audible (that combination means WebView
  fallback — check `AudioFocusDelegate` in the focus log to confirm).

## Open questions

1. Proxy vs allowlist for HTTP-only streams — proxy fixes web too but adds
   streaming egress; allowlist is APK-only. Decide at N3.
2. Recording/wake alarms stay native-only (out of scope, same as before).
