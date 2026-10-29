# Android device checklist — release runtime

The emulator smoke covers the WebView and Media3 software path, including R8.
It cannot prove audible output, lock-screen presentation, headset/Bluetooth
routing, Android Auto, or doze behaviour. Run this checklist on a physical
device before promoting a release, and record the device, Android version and
build hash with the result.

## Prerequisites

- A release-signed APK from the tag, or a `releaseTest` APK for the media path.
  Never publish a `releaseTest` APK.
- A clean install: `adb uninstall io.github.double77x.radioscout || true`,
  then `adb install <apk>`, then `adb shell pm clear
  io.github.double77x.radioscout`.
- Wi-Fi and mobile data available; Bluetooth headset and a car head unit (or
  Android Auto desktop head unit) if the release touches audio routing.
- `adb logcat -c` before the run. Keep `adb logcat -s RadioPlayback` running
  for playback failures.

## Core playback

- [ ] Play a public HTTPS station and confirm audible output from the phone
      speaker.
- [ ] Switch to a second station and confirm the crossfade/switch is audible
      and the first station stops.
- [ ] Pause and resume. The dock must leave “Tuning in…” immediately on pause,
      stay paused through a network hiccup, and resume to the same station.
- [ ] Press stop. The notification and media session disappear; the dock
      returns to the browse state.
- [ ] Change volume with the phone keys and with the dock's `←`/`→` keys;
      confirm 1% steps and that muting/restoring does not jump.
- [ ] Enable loudness leveling in Settings and repeat two tracks with different
      loudness. Disable it and confirm the gain glides rather than stepping.

## Notification and lock screen

- [ ] On Android 13+, the first play shows the notification permission prompt
      once. Grant it and confirm a MediaStyle notification with artwork,
      station and live track.
- [ ] Deny the permission on a fresh install. Playback must still start; the
      notification is absent; the app must not remain on “Tuning in…”. Play a
      second station: the prompt must not return.
- [ ] Lock the screen. Controls are present and play/pause works from the lock
      screen.
- [ ] Open the shade and pause/resume/stop from the notification.
- [ ] Leave the app in the background for at least five minutes. Playback
      continues and the notification remains.

## Routing and interruptions

- [ ] Plug in wired headphones; audio routes to them, and unplugging pauses or
      routes back to the speaker according to the platform's behaviour.
- [ ] Connect a Bluetooth headset before playback; audio routes to it and
      controls work.
- [ ] Take an incoming call or play a voice message during playback. Audio
      ducks/pauses and resumes correctly afterwards.
- [ ] Trigger a navigation prompt while listening and confirm the same ducking
      behaviour (if navigation is installed).
- [ ] If the car path changed, connect Android Auto and test play/pause, skip
      buttons and the now-playing display. The car display must not freeze on
      the first song.

## Network and background survival

- [ ] Start a station, turn Wi-Fi off and let mobile data take over. Playback
      reconnects or shows a recoverable error; it does not silently die.
- [ ] Toggle airplane mode for 30 seconds and back. The reconnect path recovers
      or the UI shows a clear error with a retry.
- [ ] Start playback, enable doze (screen off, unplugged, stationary) for 30
      minutes, and confirm playback and the media session survive.
- [ ] Force-stop the app from Settings. The media notification and session are
      removed; relaunch works.

## App shell

- [ ] Rotate the device during playback and with the detail sheet open.
- [ ] Press the Android back button from the sheet, settings and a filtered
      home; each returns one level and the app does not exit unexpectedly.
- [ ] Toggle a favourite, force-stop, relaunch and confirm it persists.
- [ ] Open an OTA update prompt and confirm it does not interrupt playback.

## Evidence and teardown

- [ ] Save `adb logcat -d` and screenshots of the lock screen, notification,
      settings and any failure.
- [ ] Record the APK SHA-256 and the device/Android build.
- [ ] Uninstall the test build or clear its data before handing the device on.

| Date | Device / Android | Build SHA-256 | Result | Notes |
| :--- | :--------------- | :------------ | :----- | :---- |
| 2026-10-20 | none — no device attached | `3bad4b795779fb9b4b767920e847835c1de3141ad489b57ddd3b1723f24c0a56` (published v0.4.5 APK) | Not run | Released on the hosted emulator (instrumentation) and the JVM/R8 evidence only. Audible output, lock-screen presentation, routing, calls, Android Auto and doze are unproven for 0.4.5. |
