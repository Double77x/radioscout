package io.github.double77x.radioscout.audio;

import android.util.Log;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
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
     * Car-display refresh workaround, opt-in (Settings → Audio). Older
     * Bluetooth stereos — AVRCP 1.3-era head units especially — never re-read
     * the now-playing attributes on a metadata-only change: they refresh when
     * playback state changes, and a live stream legitimately has no track
     * boundary to announce, so the first title they receive is the title they
     * keep (upstream androidx/media#430, reproduced with the stock Media3 demo
     * on a car console; Media3 has no `MediaSession.setMetadata`, the API the
     * old ExoPlayer connector used to force the push).
     *
     * <p>A re-seek is the one silent trigger available inside Media3: it raises
     * `onPositionDiscontinuity`, and media3-session 1.9.0 turns that into a
     * fresh platform `PlaybackState` (`MediaSessionLegacyStub
     * .updateLegacySessionPlaybackState` → `MediaSessionCompat
     * .setPlaybackState`) — a play-status change, which every 1.3-era sink
     * answers by re-reading the title. `onVolumeChanged` is not wired to that
     * push, so a volume nudge cannot do this.
     *
     * <p>Cost: a seek can rebuffer for a moment, hence off by default with the
     * warning in the settings copy. {@code Player.setMetadata} does not exist
     * in 1.9.0, so there is no metadata-only alternative.
     */
    private static volatile boolean carTitleRefresh = false;

    /** Minimum gap between nudges — a station can flap titles in bursts. */
    private static final long CAR_REFRESH_MIN_GAP_MS = 5_000;

    private static long lastCarRefreshAt = 0;

    /** Flip the car-display refresh workaround. Safe from any thread. */
    public static void setCarTitleRefresh(boolean enabled) {
        carTitleRefresh = enabled;
    }

    /**
     * Car / headset / shade skip buttons. The session now holds a genuine
     * multi-item favourites loop (one entry per Saved station, repeat-all),
     * so `hasNext` / `hasPrevious` stay true at every position and every
     * surface that builds its buttons from the player commands keeps skip
     * visible on every station. Presses execute on the player itself — no
     * WebView round-trip, so they work locked and dozed.
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
                    // 0 allows (the default impl returns 0 too — any non-zero
                    // value is a SessionResult error code that rejects). Seeks
                    // run on the playlist above, so there is nothing to
                    // forward: the web layer only syncs its snapshot via the
                    // item-transition event the plugin forwards.
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
            MediaMetadata metadata = current.mediaMetadata;
            CharSequence shown = metadata.title;
            if (title.equals(shown == null ? null : shown.toString())) return;
            player.replaceMediaItems(
                    index,
                    index + 1,
                    Collections.singletonList(
                            current.buildUpon()
                                    .setMediaMetadata(
                                            metadata.buildUpon()
                                                    .setTitle(title)
                                                    .setArtist(station)
                                                    .build())
                                    .build()));
            // Read-back: the in-place path updates the masking timeline
            // synchronously on this thread, so the current item must already
            // carry the song. If it doesn't, the session (and every surface
            // reading it) is showing something else — say so loudly instead
            // of logging a success that never landed.
            MediaItem applied = player.getCurrentMediaItem();
            CharSequence landed =
                    applied == null || applied.mediaMetadata == null ? null : applied.mediaMetadata.title;
            if (title.equals(landed == null ? null : landed.toString())) {
                Log.i(LOG_TAG, "session title: " + title);
            } else {
                Log.i(LOG_TAG, "session title MISMATCH: want=" + title + " got=" + landed);
            }
            nudgeCarDisplay(player);
        } catch (Exception e) {
            // Class name included: a bare message is often null, which tells
            // nobody whether this was a guardrail (IllegalArgument), a dead
            // session (IllegalState) or something new entirely.
            Log.i(LOG_TAG, "session title not published (" + e.getClass().getSimpleName() + "): " + e.getMessage());
        }
    }

    /**
     * Re-push the platform playback state so a stale car display re-reads the
     * title just published (see {@link #carTitleRefresh} for why that is the
     * only lever). A seek to the current position is silent in itself — it only
     * raises {@code onPositionDiscontinuity} — but it can cost a short rebuffer,
     * so it stays off until the user opts in.
     *
     * <p>Skipped unless really playing, never twice inside
     * {@link #CAR_REFRESH_MIN_GAP_MS}, and never fatal: this is cosmetic and
     * must never cost the stream. Call on main.
     */
    private static void nudgeCarDisplay(Player player) {
        try {
            if (!carTitleRefresh) return;
            if (!player.getPlayWhenReady() || player.getPlaybackState() != Player.STATE_READY) return;
            long now = android.os.SystemClock.elapsedRealtime();
            if (now - lastCarRefreshAt < CAR_REFRESH_MIN_GAP_MS) return;
            long position = player.getCurrentPosition();
            // Negative means the live window has no position yet — nothing to
            // seek to, so skip rather than clamp (which would jump the stream).
            if (position < 0) return;
            lastCarRefreshAt = now;
            player.seekTo(position);
            Log.i(LOG_TAG, "car display nudge at " + position);
        } catch (Exception e) {
            Log.i(LOG_TAG, "car display nudge skipped (" + e.getClass().getSimpleName() + "): " + e.getMessage());
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
