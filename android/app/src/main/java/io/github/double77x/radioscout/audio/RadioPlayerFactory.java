package io.github.double77x.radioscout.audio;

import android.content.Context;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.audio.AudioProcessor;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.audio.AudioSink;
import androidx.media3.exoplayer.audio.DefaultAudioSink;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.exoplayer.source.MediaSource;

/**
 * Single builder for every playback ExoPlayer (session + crossfade
 * incoming), so both engines agree on pipeline, redirects and focus.
 *
 * <p>Two deliberate choices live here:
 *
 * <ul>
 *   <li>Cross-protocol redirects are followed: directory URLs are https but
 *       some edges 302 down to http (Dance Wave). Whether the http target may
 *       actually load is still decided by the network security config
 *       (scoped allowlist, deny by default) — following is not permitting.
 *   <li>Focus/noisy handling is a parameter, not a default: only the session
 *       player answers them. An incoming blend player must never steal focus
 *       (it would silence the still-playing predecessor mid-crossfade).
 * </ul>
 */
public final class RadioPlayerFactory {

    private RadioPlayerFactory() {}

    public static ExoPlayer create(
            Context app,
            LevelingAudioProcessor leveling,
            boolean handleAudioFocus,
            boolean handleAudioBecomingNoisy) {
        DefaultRenderersFactory renderersFactory =
                new DefaultRenderersFactory(app) {
                    @Override
                    protected AudioSink buildAudioSink(
                            Context context,
                            boolean enableFloatOutput,
                            boolean enableAudioTrackPlaybackParams) {
                        return new DefaultAudioSink.Builder(context)
                                .setAudioProcessors(new AudioProcessor[] {leveling})
                                .setEnableFloatOutput(enableFloatOutput)
                                .setEnableAudioTrackPlaybackParams(enableAudioTrackPlaybackParams)
                                .build();
                    }
                };
        DefaultHttpDataSource.Factory httpFactory =
                new DefaultHttpDataSource.Factory().setAllowCrossProtocolRedirects(true);
        MediaSource.Factory mediaSourceFactory =
                new DefaultMediaSourceFactory(app).setDataSourceFactory(httpFactory);
        return new ExoPlayer.Builder(app)
                .setRenderersFactory(renderersFactory)
                .setMediaSourceFactory(mediaSourceFactory)
                .setAudioAttributes(
                        new AudioAttributes.Builder()
                                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                                .setUsage(C.USAGE_MEDIA)
                                .build(),
                        handleAudioFocus)
                .setHandleAudioBecomingNoisy(handleAudioBecomingNoisy)
                .setWakeMode(C.WAKE_MODE_NETWORK)
                .build();
    }
}
