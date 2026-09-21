package io.github.double77x.radioscout.audio;

import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;

/**
 * Foreground playback service. Owns the ExoPlayer + MediaSession so audio
 * survives the WebView and the system renders the standard media UI
 * (notification, lock-screen, headset, Android Auto).
 *
 * <p>Driven exclusively through {@link NativeAudioPlugin} via a
 * MediaController — the web UI never talks to this class directly.
 */
public class RadioPlaybackService extends MediaSessionService {

    private MediaSession session;

    @Override
    public void onCreate() {
        super.onCreate();
        ExoPlayer player =
                new ExoPlayer.Builder(this)
                        .setAudioAttributes(
                                new AudioAttributes.Builder()
                                        .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                                        .setUsage(C.USAGE_MEDIA)
                                        .build(),
                                /* handleAudioFocus= */ true)
                        .setHandleAudioBecomingNoisy(true)
                        .setWakeMode(C.WAKE_MODE_NETWORK)
                        .build();
        session = new MediaSession.Builder(this, player).build();
    }

    @Override
    public MediaSession onGetSession(MediaSession.ControllerInfo controllerInfo) {
        return session;
    }

    @Override
    public void onDestroy() {
        if (session != null) {
            session.getPlayer().release();
            session.release();
            session = null;
        }
        super.onDestroy();
    }
}
