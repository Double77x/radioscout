package io.github.double77x.radioscout.audio;

import android.content.Context;
import android.util.Log;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.audio.AudioSink;
import androidx.media3.exoplayer.audio.DefaultAudioSink;
import androidx.media3.common.audio.AudioProcessor;
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
    private LevelingAudioProcessor levelingProcessor;
    private static LevelingAudioProcessor levelingInstance;
    private static RadioPlaybackService instance;
    private static final String LOG_TAG = "RadioPlayback";

    /** Live processor for the plugin bridge (null before onCreate / after onDestroy). */
    public static LevelingAudioProcessor getLevelingProcessor() {
        return levelingInstance;
    }

    /**
     * Hand the session to a pre-buffered crossfade player (station switch).
     * The previous session player is released; the new player's leveling
     * processor becomes the live one. Must be called on the players'
     * application thread (main — both are built there). Returns false when
     * there is no session to swap (caller cuts over classically instead).
     */
    public static boolean swapSessionPlayer(ExoPlayer newPlayer, LevelingAudioProcessor newProcessor) {
        RadioPlaybackService self = instance;
        if (self == null || self.session == null || newPlayer == null) return false;
        try {
            Player old = self.session.getPlayer();
            self.session.setPlayer(newPlayer);
            levelingInstance = newProcessor;
            // The newcomer takes over focus/noisy handling only NOW that it
            // owns the session: asking earlier would steal focus from the
            // still-playing predecessor mid-blend. The retiree is already at
            // zero, so its focus-loss response is inaudible either way.
            try {
                newPlayer.setAudioAttributes(
                        new AudioAttributes.Builder()
                                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                                .setUsage(C.USAGE_MEDIA)
                                .build(),
                        /* handleAudioFocus= */ true);
            } catch (Exception ignored) {
                // Focus stays with the released player until the next cold
                // start — transient ducking just won't apply meanwhile.
            }
            try {
                newPlayer.setHandleAudioBecomingNoisy(true);
            } catch (Exception ignored) {
                // Noisy handling stays with the released player — headset
                // unplug just won't pause until the next cold start.
            }
            if (old instanceof ExoPlayer) {
                try {
                    ((ExoPlayer) old).release();
                } catch (Exception ignored) {
                    // Release races a dead surface — the session moved on.
                }
            }
            Log.i(LOG_TAG, "crossfade swapped session player");
            return true;
        } catch (Exception e) {
            Log.i(LOG_TAG, "crossfade swap failed: " + e.getMessage());
            return false;
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        Log.i(LOG_TAG, "service created");
        levelingProcessor = new LevelingAudioProcessor();
        levelingInstance = levelingProcessor;
        DefaultRenderersFactory renderersFactory =
                new DefaultRenderersFactory(this) {
                    @Override
                    protected AudioSink buildAudioSink(
                            Context context, boolean enableFloatOutput, boolean enableAudioTrackPlaybackParams) {
                        return new DefaultAudioSink.Builder(context)
                                .setAudioProcessors(new AudioProcessor[] {levelingProcessor})
                                .setEnableFloatOutput(enableFloatOutput)
                                .setEnableAudioTrackPlaybackParams(enableAudioTrackPlaybackParams)
                                .build();
                    }
                };
        ExoPlayer player =
                new ExoPlayer.Builder(this)
                        .setRenderersFactory(renderersFactory)
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
        Log.i(LOG_TAG, "service destroyed");
        levelingInstance = null;
        instance = null;
        if (session != null) {
            session.getPlayer().release();
            session.release();
            session = null;
        }
        super.onDestroy();
    }
}
