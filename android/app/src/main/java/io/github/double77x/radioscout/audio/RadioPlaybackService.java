package io.github.double77x.radioscout.audio;

import android.util.Log;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;
import java.util.Collections;

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
     * Metadata listeners follow the session player across crossfade swaps.
     * Timed metadata (`Player.Listener.onMetadata`) never crosses the
     * controller boundary — the 1.9.0 session protocol has no binder path
     * for it — so these attach to the ExoPlayer itself, not the controller.
     * Add is idempotent (player listener sets ignore duplicates).
     */
    private static final java.util.concurrent.CopyOnWriteArraySet<Player.Listener> metadataListeners =
            new java.util.concurrent.CopyOnWriteArraySet<>();

    /** Attach now if a session player exists; remembered for swaps either way. Call on main. */
    public static void addMetadataListener(Player.Listener listener) {
        if (listener == null) return;
        metadataListeners.add(listener);
        try {
            RadioPlaybackService self = instance;
            if (self != null && self.session != null) {
                Player current = self.session.getPlayer();
                if (current != null) current.addListener(listener);
            }
        } catch (Exception ignored) {
            // Session not ready — the next swap attaches (see below).
        }
    }

    /** Detach everywhere; release drops listeners anyway, so best-effort is fine. Call on main. */
    public static void removeMetadataListener(Player.Listener listener) {
        if (listener == null) return;
        metadataListeners.remove(listener);
        try {
            RadioPlaybackService self = instance;
            if (self != null && self.session != null) {
                Player current = self.session.getPlayer();
                if (current != null) current.removeListener(listener);
            }
        } catch (Exception ignored) {
            // Teardown races a dead player — nothing to forward.
        }
    }

    /**
     * Car / headset / shade skip buttons. The playlist holds one live item,
     * so there is no next item to seek to — the web layer owns the Saved
     * favourites and performs the actual station switch, the service only
     * forwards the press (same split as the `trackUpdate` title event).
     */
    public interface SkipListener {
        void onSkipNext();

        void onSkipPrevious();
    }

    private static final java.util.concurrent.CopyOnWriteArraySet<SkipListener> skipListeners =
            new java.util.concurrent.CopyOnWriteArraySet<>();

    /** Remembered for the session's lifetime; add is idempotent. Call on main. */
    public static void addSkipListener(SkipListener listener) {
        if (listener == null) return;
        skipListeners.add(listener);
    }

    /** Best-effort detach; the set dies with the process anyway. Call on main. */
    public static void removeSkipListener(SkipListener listener) {
        if (listener == null) return;
        skipListeners.remove(listener);
    }

    /**
     * Session callback: advertise skip and forward presses to the web layer.
     * Without the {@code onConnect} half the stub rejects SEEK_TO_NEXT /
     * SEEK_TO_PREVIOUS with NOT_SUPPORTED before this callback ever runs, and
     * the car never lights the buttons up. The {@code onPlayerCommandRequest}
     * return is 0 to allow (the default impl returns 0 too — any non-zero
     * value is a SessionResult error code that rejects the command); the
     * player itself no-ops the seek on a one-item live playlist while the
     * bridge event below drives the real switch.
     */
    private final MediaSession.Callback sessionCallback =
            new MediaSession.Callback() {
                @Override
                public MediaSession.ConnectionResult onConnect(
                        MediaSession session, MediaSession.ControllerInfo controllerInfo) {
                    Player.Commands defaults =
                            new MediaSession.ConnectionResult.AcceptedResultBuilder(session)
                                    .build()
                                    .availablePlayerCommands;
                    return new MediaSession.ConnectionResult.AcceptedResultBuilder(session)
                            .setAvailablePlayerCommands(
                                    defaults.buildUpon()
                                            .add(Player.COMMAND_SEEK_TO_NEXT)
                                            .add(Player.COMMAND_SEEK_TO_PREVIOUS)
                                            .build())
                            .build();
                }

                @Override
                public int onPlayerCommandRequest(
                        MediaSession session,
                        MediaSession.ControllerInfo controllerInfo,
                        int command) {
                    if (command == Player.COMMAND_SEEK_TO_NEXT) {
                        for (SkipListener listener : skipListeners) {
                            try {
                                listener.onSkipNext();
                            } catch (Exception ignored) {
                                // One bad listener must not silence the rest.
                            }
                        }
                    } else if (command == Player.COMMAND_SEEK_TO_PREVIOUS) {
                        for (SkipListener listener : skipListeners) {
                            try {
                                listener.onSkipPrevious();
                            } catch (Exception ignored) {
                                // One bad listener must not silence the rest.
                            }
                        }
                    }
                    return 0;
                }
            };

    /**
     * Move a live stream title into the published session metadata: song in
     * the title slot, station in the artist slot. The platform session, the
     * notification, Android Auto and a Bluetooth car's AVRCP display all read
     * these fields, so without this they show the station name for the whole
     * play even though ExoPlayer has been decoding ICY the whole time.
     *
     * <p>{@code replaceMediaItems} is the in-place update path (verified
     * against media3-exoplayer 1.9.0: only it consults
     * {@code MediaSource.canUpdateMediaItem}, which compares playback
     * identity and ignores metadata — URI plus {@code imageDurationMs} /
     * {@code customCacheKey} for progressive sources, URI plus stream keys /
     * DRM / live configuration for HLS).
     * It hands the new item to the source already loading, so the stream keeps
     * buffering and the position holds. {@code setMediaItem} would build a
     * fresh source and re-read the stream — a rebuffer
     * on every track change, which is exactly the wrong place to spend one.
     *
     * <p>Never throws: a stale title on a car display beats a dropped stream.
     * Call on main (the player's application thread) — that is where
     * {@link androidx.media3.common.Player.Listener#onMetadata} delivers.
     */
    public static void publishTrackTitle(String title, String station) {
        if (title == null || title.isEmpty()) return;
        try {
            RadioPlaybackService self = instance;
            if (self == null || self.session == null) return;
            Player player = self.session.getPlayer();
            if (player == null) return;
            MediaItem current = player.getCurrentMediaItem();
            int index = player.getCurrentMediaItemIndex();
            // `replaceMediaItems` addresses the playlist, not the current item.
            int windows = player.getCurrentTimeline().getWindowCount();
            if (current == null || current.mediaMetadata == null || index < 0 || index >= windows) return;
            CharSequence shown = current.mediaMetadata.title;
            if (title.equals(shown == null ? null : shown.toString())) return;
            player.replaceMediaItems(
                    index,
                    index + 1,
                    Collections.singletonList(
                            current.buildUpon()
                                    .setMediaMetadata(
                                            current.mediaMetadata.buildUpon()
                                                    .setTitle(title)
                                                    .setArtist(station)
                                                    .build())
                                    .build()));
            Log.i(LOG_TAG, "session title: " + title);
        } catch (Exception e) {
            Log.i(LOG_TAG, "session title not published: " + e.getMessage());
        }
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
            // Metadata listeners live on the player, not the controller —
            // move them across so titles survive the swap.
            for (Player.Listener metadataListener : metadataListeners) {
                try {
                    newPlayer.addListener(metadataListener);
                } catch (Exception ignored) {
                    // A dead incoming owns nothing to listen to.
                }
            }
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
        ExoPlayer player = RadioPlayerFactory.create(this, levelingProcessor, true, true);
        session = new MediaSession.Builder(this, player).setCallback(sessionCallback).build();
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
