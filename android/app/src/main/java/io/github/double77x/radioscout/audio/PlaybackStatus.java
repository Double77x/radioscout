package io.github.double77x.radioscout.audio;

import androidx.media3.common.Player;

/**
 * Maps Media3 player state to the status the WebView dock understands.
 *
 * Paused wins over buffering: a live stream keeps its buffer warm after a
 * pause, and reporting that as loading leaves the dock on "Tuning in…".
 */
final class PlaybackStatus {

    private PlaybackStatus() {}

    static String resolve(int playbackState, boolean playWhenReady, boolean loading, boolean hasError) {
        if (hasError) return "error";
        if (!playWhenReady) return "paused";
        if (playbackState == Player.STATE_BUFFERING) return "loading";
        if (playbackState == Player.STATE_READY) return "playing";
        if (loading) return "loading";
        // READY-paused, ENDED, and IDLE-without-media all read as paused to
        // the dock; stop() clears the web station separately.
        return "paused";
    }
}
