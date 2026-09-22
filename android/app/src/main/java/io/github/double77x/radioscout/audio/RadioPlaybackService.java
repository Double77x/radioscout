package io.github.double77x.radioscout.audio;

import android.content.Context;
import android.util.Log;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
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
    private static final String LOG_TAG = "RadioPlayback";

    /** Live processor for the plugin bridge (null before onCreate / after onDestroy). */
    public static LevelingAudioProcessor getLevelingProcessor() {
        return levelingInstance;
    }

    @Override
    public void onCreate() {
        super.onCreate();
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
        if (session != null) {
            session.getPlayer().release();
            session.release();
            session = null;
        }
        super.onDestroy();
    }
}
