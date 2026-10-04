package io.github.double77x.radioscout.audio;

import android.Manifest;
import android.content.ComponentName;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import androidx.core.content.ContextCompat;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.Metadata;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.extractor.metadata.icy.IcyInfo;
import androidx.media3.extractor.metadata.id3.TextInformationFrame;
import androidx.media3.extractor.metadata.vorbis.VorbisComment;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.common.util.concurrent.ListenableFuture;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ExecutionException;
import org.json.JSONObject;

/**
 * Capacitor bridge to {@link RadioPlaybackService}. One method per transport
 * control plus a {@code playbackStatus} event (playing | paused | loading |
 * error) so the web snapshot can mirror native state.
 *
 * <p>Every call degrades gracefully: when the service is unreachable the
 * method rejects and the web layer falls back to {@code <audio>}.
 */
@CapacitorPlugin(
        name = "NativeAudio",
        permissions = {@Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS})})
public class NativeAudioPlugin extends Plugin {

    private static final String EVENT_STATUS = "playbackStatus";
    private static final String EVENT_TRACK = "trackUpdate";
    private static final String EVENT_STATION_CHANGE = "stationChange";
    private static final String LOG_TAG = "RadioPlayback";

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private MediaController controller;
    private ListenableFuture<MediaController> controllerFuture;
    private String lastStatus = "";
    private boolean levelingEnabled = false;
    /**
     * Car-display refresh workaround (Settings → Audio, native only). Mirrored
     * into the service on every play and connect, so a service that restarts
     * mid-session picks the persisted preference back up — the static lives in
     * the service, which dies with the process.
     */
    private boolean carTitleRefreshEnabled = false;

    /**
     * True overlapping station crossfade. A second ExoPlayer buffers the next
     * station while the session player keeps playing, then the two blend over
     * CROSSFADE_MS (old out, new in — mirrors the web 1s crossfade) and the
     * session swaps to the new player. Single-ExoPlayer playlist staging can
     * only cut, never blend, so overlap needs the second player. Everything
     * lives and dies on the main thread (controller ops and player callbacks
     * both run there).
     */
    private ExoPlayer fadePlayer;
    private LevelingAudioProcessor fadeLeveling;
    private Player.Listener fadeListener;
    private Runnable fadeWatchdogRunnable;
    private Runnable fadeRampRunnable;
    /** True once the 1s blend starts (pre-buffer phase before that). */
    private boolean fadeBlending;
    /** Live output target so mid-blend volume drags apply to the ramp. */
    private float fadeTarget;
    /** Blend length — matches the web CROSSFADE_MS so both engines agree. */
    private static final long CROSSFADE_MS = 1000;
    private static final int FADE_STEPS = 20;
    /** Upper bound for the incoming pre-buffer before cutting over instead. */
    private static final long FADE_WATCHDOG_MS = 20_000;
    /** Last forwarded stream title (dedupes the metadata firehose). */
    private String lastTrack;
    /**
     * Station name of the play in flight — the artist line that replaces it
     * when a stream title takes over the session title (published via
     * {@link RadioPlaybackService#publishTrackTitle}). Written and read on
     * main only (set inside the play op, read in {@link #metadataListener}).
     */
    private String stationTitle = "Radio";
    /**
     * Item the last transition moved to. Same-id echoes (our own metadata
     * replaces, playlist surgery, swap re-syncs) skip the reset and the
     * bridge event — without this, every song publish re-transitioned and
     * the reset undid it, pinning the car on station/station while the dock
     * showed the song. Null until the first play.
     */
    private String lastTransitionMediaId;
    /** Last user level (play/setVolume) — restores the session volume when a
     * pause kills a mid-blend ramp part-way down. */
    private float lastVolume = 0.9f;
    private boolean lastMuted = false;

    private final Player.Listener listener =
            new Player.Listener() {
                @Override
                public void onEvents(Player player, Player.Events events) {
                    emitStatus(player, null);
                }

                @Override
                public void onPlayerError(PlaybackException error) {
                    // A session-player error reports — fade-player errors have
                    // their own listener with a cutover fallback (below).
                    Log.i(LOG_TAG, "session player error: " + describeError(error));
                    emitStatus(controller, error.getMessage());
                }

                @Override
                public void onMediaItemTransition(MediaItem mediaItem, int reason) {
                    // Unlike timed metadata, item transitions DO cross the
                    // controller boundary — this is how the web snapshot
                    // follows native playlist seeks (car buttons executing on
                    // the service loop with the WebView possibly dead). The
                    // engine ignores ids it already shows (own plays) and
                    // looks up the rest.
                    if (mediaItem == null || mediaItem.mediaId == null) return;
                    // Same-item echoes must NOT reset: our own metadata
                    // replaces, playlist surgery and swap re-syncs all report
                    // transitions for the item already playing (verified in
                    // ExoPlayerImpl: equal window UIDs plus a changed timeline
                    // still yields PLAYLIST_CHANGED). Resetting there undid
                    // live publishes — each ICY repeat re-published (clearing
                    // the dedupe lock), each publish re-transitioned, each
                    // transition reset, and the car sat on station/station
                    // while the dock showed the song.
                    if (mediaItem.mediaId.equals(lastTransitionMediaId)) return;
                    lastTransitionMediaId = mediaItem.mediaId;
                    resetIncomingMetadata(mediaItem);
                    JSObject data = new JSObject();
                    data.put("stationuuid", mediaItem.mediaId);
                    notifyListeners(EVENT_STATION_CHANGE, data, true);
                }
                // NOTE: no onMetadata here on purpose. Timed metadata never
                // crosses the controller boundary (no binder path for it in
                // the session protocol), so a controller listener is deaf to
                // ICY by framework design — see metadataListener below.
            };

    /**
     * Re-anchor a freshly entered item. Loop items are built once at play
     * carrying their station name in `subtitle` (see buildPlaylistItem) and
     * their title slot is rewritten with song titles by publishTrackTitle —
     * which touches only the CURRENT item, so by the time the loop comes back
     * around this item's title can still be a song from a station played
     * minutes ago. Without this reset the car names that stale song over the
     * new station until its first ICY title lands. Restore the stashed station
     * name into the title slot and drop the title dedupe lock. No-op when the
     * title already is the station name (the common case). Never throws — a
     * stale display line beats a dead service.
     */
    private void resetIncomingMetadata(MediaItem mediaItem) {
        try {
            MediaMetadata metadata = mediaItem.mediaMetadata;
            if (metadata == null) return;
            // Station name comes from the `subtitle` stash the loop builder
            // writes (see buildPlaylistItem), NOT from the title slot — that
            // one holds the PREVIOUS station's song once publishTrackTitle
            // has been here, which is exactly what must not survive. Legacy
            // single items (old OTA shell) have no subtitle and were never
            // swapped, so the incoming title is still their station name.
            CharSequence stashed = metadata.subtitle;
            CharSequence shown = metadata.title;
            String stashText = stashed == null ? "" : stashed.toString();
            lastTrack = null;
            if (stashText.isEmpty()) return;
            stationTitle = stashText;
            // Title already IS the station name (a loop item nobody has played
            // yet, or a legacy single item) — nothing to undo.
            if (stashText.equals(shown == null ? "" : shown.toString())) return;
            MediaController connected = controller;
            if (connected == null || !connected.isConnected()) return;
            int index = connected.getCurrentMediaItemIndex();
            if (index < 0 || index >= connected.getMediaItemCount()) return;
            // Artist takes the station name too: publishTrackTitle always
            // overwrote it alongside the song, so the built-time tags are
            // long gone by the time this runs. Station/station until the
            // first ICY title lands (usually a second or two).
            connected.replaceMediaItem(
                    index,
                    mediaItem.buildUpon()
                            .setMediaMetadata(
                                    metadata.buildUpon().setTitle(stationTitle).setArtist(stationTitle).build())
                            .build());
        } catch (Exception e) {
            // Cosmetic reset — the incoming ICY titles still land normally.
            Log.i(LOG_TAG, "incoming metadata not reset: " + e.getMessage());
        }
    }

    /**
     * Stream-title listener for the session ExoPlayer itself (NOT the
     * controller). Registered via the service so it follows crossfade
     * swaps; add is idempotent, so re-registering per connect is safe.
     */
    private final Player.Listener metadataListener =
            new Player.Listener() {
                @Override
                public void onMetadata(Metadata metadata) {
                    // ICY/ID3/Vorbis now-playing titles ride the stream itself
                    // (the browser can never read these — CORS — but the
                    // service parses them for free). Forward changes only.
                    String title = extractTrackTitle(metadata);
                    if (title == null || title.equals(lastTrack)) return;
                    lastTrack = title;
                    // The car, lock screen, Auto and the notification all read
                    // the session metadata, which `play` freezes at the station
                    // name — republish it so those follow the track too. Skipped
                    // mid-handoff: until the blend swaps, the retiring item is
                    // the one on display and its title is the outgoing
                    // station's. Cosmetic at worst: the bridge event below still
                    // feeds the dock either way.
                    if (fadePlayer == null) {
                        RadioPlaybackService.publishTrackTitle(title, stationTitle);
                    }
                    Log.i(LOG_TAG, "track: " + title);
                    JSObject data = new JSObject();
                    data.put("title", title);
                    notifyListeners(EVENT_TRACK, data, true);
                }
            };

    /**
     * One service playlist entry from the bridge (uuid, resolved URL, display
     * fields). Corrupt entries fail the whole list back to the legacy single
     * item — a partial loop would strand skips on dead entries.
     */
    private static MediaItem buildPlaylistItem(
            String mediaId, String url, String title, String artist, String artwork) {
        // `subtitle` carries the station name as a private stash: the title
        // slot is rewritten with song titles as they arrive (the song must
        // lead on every surface), so the station line needs somewhere to
        // come back from. No car/lock-screen surface renders it.
        MediaMetadata.Builder metadata =
                new MediaMetadata.Builder()
                        .setTitle(title)
                        .setSubtitle(title)
                        .setArtist(artist)
                        .setAlbumTitle("RadioScout");
        if (artwork != null && !artwork.isEmpty()) {
            try {
                metadata.setArtworkUri(Uri.parse(artwork));
            } catch (Exception ignored) {
                // Artwork is decorative — never fail playback.
            }
        }
        return new MediaItem.Builder()
                .setUri(Uri.parse(url))
                .setMediaId(mediaId)
                .setMediaMetadata(metadata.build())
                .build();
    }

    /**
     * Service-side favourites loop from the play call. Null when absent
     * (old OTA web shells predate it) or unreadable — callers fall back to
     * the legacy single item, where car skip behaves exactly as before.
     */
    private static List<MediaItem> readPlaylist(PluginCall call) {
        try {
            JSArray array = call.getArray("playlist");
            if (array == null || array.length() == 0) return null;
            List<MediaItem> items = new ArrayList<>(array.length());
            for (int i = 0; i < array.length(); i++) {
                JSONObject entry = array.optJSONObject(i);
                if (entry == null) return null;
                String uuid = entry.optString("stationuuid", "");
                String itemUrl = entry.optString("url", "");
                if (uuid.isEmpty() || itemUrl.isEmpty()) return null;
                items.add(
                        buildPlaylistItem(
                                uuid,
                                itemUrl,
                                entry.optString("title", uuid),
                                entry.optString("artist", "RadioScout"),
                                entry.optString("artwork", "")));
            }
            return items;
        } catch (Exception e) {
            Log.i(LOG_TAG, "playlist unreadable, single item: " + e.getMessage());
            return null;
        }
    }

    /**
     * Display title of a playlist item (the station name on fresh items)
     * for the artist line. Never empty — falls back to the play-call title.
     */
    private static String stationNameOf(MediaItem item, String fallback) {
        try {
            CharSequence name =
                    item == null || item.mediaMetadata == null ? null : item.mediaMetadata.title;
            if (name != null && !name.toString().isEmpty()) return name.toString();
        } catch (Exception ignored) {
            // Artist line keeps the fallback — cosmetic either way.
        }
        return fallback;
    }

    /** Functional interface to avoid java.util.function on older toolchains. */
    private interface ControllerOp {
        void run(MediaController controller) throws Exception;
    }

    private static float clamp01(double value) {
        if (!Double.isFinite(value)) return 0.9f;
        if (value < 0) return 0f;
        if (value > 1) return 1f;
        return (float) value;
    }

    /**
     * Pull the now-playing title out of stream metadata: Shoutcast/Icecast
     * `StreamTitle`, ID3 TIT2 (HLS/MP3 tags), or Vorbis `TITLE`, in that
     * order. Null when nothing carries a title — never throws.
     */
    private static String extractTrackTitle(Metadata metadata) {
        if (metadata == null) return null;
        String id3 = null;
        String vorbis = null;
        for (int i = 0; i < metadata.length(); i++) {
            try {
                Metadata.Entry entry = metadata.get(i);
                if (entry instanceof IcyInfo) {
                    String title = ((IcyInfo) entry).title;
                    if (title != null && !title.trim().isEmpty()) return title.trim();
                } else if (entry instanceof TextInformationFrame) {
                    TextInformationFrame frame = (TextInformationFrame) entry;
                    if ("TIT2".equals(frame.id)
                            && frame.value != null
                            && !frame.value.trim().isEmpty()
                            && id3 == null) {
                        id3 = frame.value.trim();
                    }
                } else if (entry instanceof VorbisComment) {
                    VorbisComment comment = (VorbisComment) entry;
                    if ("TITLE".equalsIgnoreCase(comment.key)
                            && comment.value != null
                            && !comment.value.trim().isEmpty()
                            && vorbis == null) {
                        vorbis = comment.value.trim();
                    }
                }
            } catch (Exception ignored) {
                // One malformed entry must never hide the rest.
            }
        }
        return id3 != null ? id3 : vorbis;
    }
    /**
     * One-line root cause for a player failure (the dock only shows the bare
     * message, e.g. "Source error"): numeric code + code name + the cause
     * chain, so logcat says whether it was cleartext policy, HTTP status,
     * timeout, or a dead socket.
     */
    private static String describeError(PlaybackException error) {
        StringBuilder out = new StringBuilder();
        try {
            out.append(error.getMessage())
                    .append(" code=")
                    .append(error.errorCode)
                    .append(" ")
                    .append(PlaybackException.getErrorCodeName(error.errorCode));
        } catch (Exception e) {
            out.append(error);
        }
        Throwable cause = error.getCause();
        for (int depth = 0; cause != null && depth < 3; depth++) {
            String detail = cause.getMessage();
            if (detail != null && !detail.isEmpty()) {
                out.append(" <- ").append(detail);
            }
            cause = cause.getCause();
        }
        return out.toString();
    }

    private void withController(ControllerOp op, PluginCall call) {
        // Every MediaController call on the main thread: the controller
        // rejects calls from any other thread, and plugin methods do not run
        // on main. (One silent web fallback with no lockscreen UI taught us.)
        Log.i(LOG_TAG, "withController on " + Thread.currentThread().getName());
        mainHandler.post(() -> withControllerOnMain(op, call));
    }

    private void withControllerOnMain(ControllerOp op, PluginCall call) {
        if (controller != null && controller.isConnected()) {
            try {
                op.run(controller);
            } catch (Exception e) {
                Log.i(LOG_TAG, "controller op failed: " + e.getMessage());
                call.reject(e.getMessage(), e);
            }
            return;
        }
        Context context = getContext();
        if (context == null) {
            call.reject("Activity is gone");
            return;
        }
        SessionToken token =
                new SessionToken(context, new ComponentName(context, RadioPlaybackService.class));
        controllerFuture = new MediaController.Builder(context, token).buildAsync();
        controllerFuture.addListener(
                () -> {
                    try {
                        controller = controllerFuture.get();
                    } catch (ExecutionException | InterruptedException e) {
                        if (e instanceof InterruptedException) {
                            Thread.currentThread().interrupt();
                        }
                        Log.i(LOG_TAG, "controller connect failed", e);
                        call.reject("Native player unavailable", e);
                        return;
                    }
                    Log.i(LOG_TAG, "controller connected");
                    controller.addListener(listener);
                    // Titles ride the session player directly (see above).
                    // Skip needs no registration here: it is session-level, not
                    // player-level, so `load()` owns it and swaps can't drop it.
                    RadioPlaybackService.addMetadataListener(metadataListener);
                    RadioPlaybackService.setCarTitleRefresh(carTitleRefreshEnabled);
                    try {
                        op.run(controller);
                    } catch (Exception e) {
                        Log.i(LOG_TAG, "controller op failed: " + e.getMessage());
                        call.reject(e.getMessage(), e);
                    }
                },
                ContextCompat.getMainExecutor(context));
    }

    private void emitStatus(Player player, String errorOverride) {
        if (player == null) return;
        String status;
        if (errorOverride != null) {
            status = "error";
        } else if (player.getPlaybackState() == Player.STATE_BUFFERING) {
            status = "loading";
        } else if (player.getPlayWhenReady()
                && player.getPlaybackState() == Player.STATE_READY) {
            status = "playing";
        } else if (player.isLoading()) {
            status = "loading";
        } else {
            // READY-paused, ENDED, and IDLE-without-media all read as paused
            // to the dock; stop() clears the web station separately.
            status = "paused";
        }
        if (status.equals(lastStatus) && errorOverride == null) return;
        lastStatus = status;
        JSObject data = new JSObject();
        data.put("status", status);
        if (errorOverride != null) {
            data.put("error", errorOverride);
        }
        notifyListeners(EVENT_STATUS, data, true);
    }

    @PluginMethod
    public void play(PluginCall call) {
        String permissionState;
        try {
            permissionState = String.valueOf(getPermissionState("notifications"));
        } catch (Exception e) {
            permissionState = "unknown";
        }
        Log.i(LOG_TAG, "play: notifications=" + permissionState);
        if (needsNotificationPermission()) {
            // First playback on Android 13+: ask for the notification
            // permission in context, then start regardless — denied just
            // means no lock-screen/shade UI, audio still plays.
            requestPermissionForAlias("notifications", call, "startPlayAfterPermission");
            return;
        }
        startPlay(call);
    }

    @PermissionCallback
    private void startPlayAfterPermission(PluginCall call) {
        startPlay(call);
    }

    /**
     * True when the media notification (and with it the lock-screen / shade
     * controls) would be silently dropped: Android 13+ denies
     * POST_NOTIFICATIONS by default and the manifest declaration alone is
     * not enough. Fail-open to playback if the plumbing is unavailable.
     */
    private boolean needsNotificationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return false;
        try {
            return getPermissionState("notifications") != PermissionState.GRANTED;
        } catch (Exception e) {
            return false;
        }
    }

    private void startPlay(PluginCall call) {
        String url = call.getString("url", "");
        if (url == null || url.isEmpty()) {
            Log.i(LOG_TAG, "play rejected: missing stream URL");
            call.reject("Missing stream URL");
            return;
        }
        String title = call.getString("title", "Radio");
        String artist = call.getString("artist", "RadioScout");
        String artwork = call.getString("artwork", "");
        float volume = clamp01(call.getDouble("volume", 0.9));
        boolean muted = call.getBoolean("muted", false);
        levelingEnabled = call.getBoolean("leveling", false);
        carTitleRefreshEnabled = call.getBoolean("carTitleRefresh", carTitleRefreshEnabled);
        RadioPlaybackService.setCarTitleRefresh(carTitleRefreshEnabled);
        lastStatus = "";
        withController(
                (mediaController) -> {
                    // Per-play state lands here, on main, in op-execution order —
                    // not at tap time on the bridge thread. Queued ops run FIFO,
                    // so a rapid A-then-B switch publishes under A while A's item
                    // is current and under B after; writing outside would let B's
                    // tap clobber A's window before A's op even runs, and a
                    // trailing ICY frame from the old station in that gap would
                    // dedupe-miss (lastTrack already cleared) and publish under
                    // the new station's name. The web snapshot clears its copy
                    // at tap time in parallel — this is the native half.
                    lastTrack = null;
                    // Service-side favourites loop (new web) or the legacy
                    // single item (old OTA shells send no playlist — skip
                    // then has nowhere to go, exactly like before).
                    List<MediaItem> items = readPlaylist(call);
                    int startIndex = 0;
                    if (items == null || items.isEmpty()) {
                        items =
                                Collections.singletonList(
                                        buildPlaylistItem("radioscout-live", url, title, artist, artwork));
                    } else {
                        try {
                            startIndex = call.getInt("index", 0);
                        } catch (Exception ignored) {
                            // Missing index starts at the head — harmless.
                        }
                        startIndex = Math.max(0, Math.min(startIndex, items.size() - 1));
                    }
                    stationTitle = stationNameOf(items.get(startIndex), title);
                    // Overlapping crossfade when the web layer asks for it and the
                    // service is mid-station: a second player pre-buffers the
                    // new URL while the session player keeps playing, then the
                    // two blend over CROSSFADE_MS and the session swaps. A
                    // failed incoming falls back to the classic cutover below
                    // — a failed blend must never be worse than a cut.
                    boolean wantHandoff = call.getBoolean("handoff", false);
                    cancelHandoff();
                    lastVolume = volume;
                    lastMuted = muted;
                    Log.i(
                            LOG_TAG,
                            "play handoff="
                                    + wantHandoff
                                    + " current="
                                    + (mediaController.getCurrentMediaItem() != null)
                                    + " windows="
                                    + mediaController.getCurrentTimeline().getWindowCount()
                                    + " playing="
                                    + mediaController.isPlaying()
                                    + " state="
                                    + mediaController.getPlaybackState());
                    if (wantHandoff
                            && mediaController.getCurrentMediaItem() != null
                            && (mediaController.isPlaying()
                                    || mediaController.getPlaybackState() == Player.STATE_BUFFERING)) {
                        if (startFadePlayer(mediaController, items, startIndex, url, volume, muted)) {
                            Log.i(LOG_TAG, "crossfade staged: " + url);
                            call.resolve();
                            return;
                        }
                        // Build failed — fall through to the classic cutover.
                    }
                    setPlaylistAndPlay(mediaController, items, startIndex, volume, muted);
                    Log.i(LOG_TAG, "play dispatched: " + url);
                    call.resolve();
                },
                call);
    }

    /**
     * Classic cutover onto a playlist: repeat-all wraps the ends so the loop
     * never runs out (single item behaves exactly as before), then play from
     * the resolving station. Live positions land on the live edge either way.
     */
    private void setPlaylistAndPlay(
            MediaController mediaController, List<MediaItem> items, int index, float volume, boolean muted) {
        mediaController.setVolume(muted ? 0f : volume);
        applyLeveling();
        resetLeveling();
        try {
            mediaController.setRepeatMode(Player.REPEAT_MODE_ALL);
        } catch (Exception ignored) {
            // Repeat only wraps the loop ends — playback starts regardless.
        }
        mediaController.setMediaItems(items, index, C.TIME_UNSET);
        mediaController.prepare();
        mediaController.play();
    }

    @PluginMethod
    public void pause(PluginCall call) {
        withController(
                (mediaController) -> {
                    // A staged/blending crossfade dies with the pause
                    // (mirrors the web killIncoming): blending behind an
                    // explicit pause would strand the snapshot. The ramp may
                    // have ducked the session part-way — restore the user
                    // level before parking so resume isn't left quiet.
                    killFadePlayer();
                    try {
                        mediaController.setVolume(lastMuted ? 0f : lastVolume);
                    } catch (Exception ignored) {
                        // Volume restore is cosmetic — the pause below owns it.
                    }
                    mediaController.pause();
                    call.resolve();
                },
                call);
    }

    @PluginMethod
    public void resume(PluginCall call) {
        withController(
                (mediaController) -> {
                    mediaController.play();
                    call.resolve();
                },
                call);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        withController(
                (mediaController) -> {
                    cancelHandoff();
                    lastTrack = null;
                    mediaController.stop();
                    mediaController.clearMediaItems();
                    call.resolve();
                },
                call);
    }

    /**
     * Audible station id for the foreground resync. Empty object when the
     * service holds nothing (stopped, never played) — the engine keeps its
     * view. Legacy single items report `radioscout-live`, which the engine
     * ignores (it only adopts Saved uuids).
     */
    @PluginMethod
    public void currentStation(PluginCall call) {
        withController(
                (mediaController) -> {
                    JSObject result = new JSObject();
                    try {
                        MediaItem current = mediaController.getCurrentMediaItem();
                        if (current != null && current.mediaId != null) {
                            result.put("stationuuid", current.mediaId);
                        }
                    } catch (Exception ignored) {
                        // Unknown bridles the resync — it stays best-effort.
                    }
                    call.resolve(result);
                },
                call);
    }

    /**
     * Refresh the service loop to the latest Saved order without disturbing
     * the audible item: drop the gone, move the audible item home, insert
     * the new — all gapless while they avoid the current period. Rejects
     * (best-effort upstream) when the service is unreachable or holds
     * nothing; the next play rebuilds the loop regardless.
     */
    @PluginMethod
    public void syncPlaylist(PluginCall call) {
        List<MediaItem> items = readPlaylist(call);
        if (items == null || items.isEmpty()) {
            call.reject("Missing playlist");
            return;
        }
        withController(
                (mediaController) -> {
                    try {
                        syncPlaylistOnMain(mediaController, items);
                        call.resolve();
                    } catch (Exception e) {
                        Log.i(LOG_TAG, "playlist sync failed: " + e.getMessage());
                        call.reject(e.getMessage(), e);
                    }
                },
                call);
    }

    /** Playlist surgery that never touches the audible period. Main thread only. */
    private static void syncPlaylistOnMain(MediaController mediaController, List<MediaItem> items) {
        MediaItem current = mediaController.getCurrentMediaItem();
        if (current == null || current.mediaId == null) return;
        String currentId = current.mediaId;
        List<MediaItem> target = new ArrayList<>(items);
        // The audible item survives unfavouriting: it heads the loop until
        // the next manual play rebuilds from scratch.
        if (indexOfId(target, currentId) == -1) {
            target.add(0, current);
        }
        if (sameIds(mediaController, target)) return;
        // Drop the gone from the end (earlier indices hold).
        int currentIndex = mediaController.getCurrentMediaItemIndex();
        for (int i = mediaController.getMediaItemCount() - 1; i >= 0; i--) {
            if (i == currentIndex) continue;
            if (indexOfId(target, idAt(mediaController, i)) == -1) {
                mediaController.removeMediaItem(i);
                if (i < currentIndex) currentIndex--;
            }
        }
        // Move the audible item home.
        int home = indexOfId(target, currentId);
        if (home != -1 && home != currentIndex) {
            mediaController.moveMediaItem(currentIndex, home);
            currentIndex = home;
        }
        // Insert the new at their positions (later inserts account for
        // earlier ones shifting the audible item right).
        for (int i = 0; i < target.size(); i++) {
            if (i < mediaController.getMediaItemCount()
                    && target.get(i).mediaId.equals(idAt(mediaController, i))) {
                continue;
            }
            mediaController.addMediaItem(i, target.get(i));
            if (i <= currentIndex) currentIndex++;
        }
        try {
            mediaController.setRepeatMode(Player.REPEAT_MODE_ALL);
        } catch (Exception ignored) {
            // Repeat only wraps the loop ends — the order still lands.
        }
    }

    /** Position of a media id in a list, or -1. Null-safe on both sides. */
    private static int indexOfId(List<MediaItem> items, String mediaId) {
        if (mediaId == null) return -1;
        for (int i = 0; i < items.size(); i++) {
            MediaItem item = items.get(i);
            if (item != null && mediaId.equals(item.mediaId)) return i;
        }
        return -1;
    }

    /** Media id at a controller index, or null. Never throws. */
    private static String idAt(MediaController mediaController, int index) {
        try {
            MediaItem item = mediaController.getMediaItemAt(index);
            return item == null ? null : item.mediaId;
        } catch (Exception ignored) {
            return null;
        }
    }

    /** True when the controller already holds exactly these ids in order. */
    private static boolean sameIds(MediaController mediaController, List<MediaItem> items) {
        try {
            if (mediaController.getMediaItemCount() != items.size()) return false;
            for (int i = 0; i < items.size(); i++) {
                MediaItem item = items.get(i);
                if (item == null || item.mediaId == null || !item.mediaId.equals(idAt(mediaController, i))) {
                    return false;
                }
            }
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        float volume = clamp01(call.getDouble("volume", 0.9));
        boolean muted = call.getBoolean("muted", false);
        lastVolume = volume;
        lastMuted = muted;
        // A mid-blend drag retargets the incoming ramp live (the tick reads
        // the field); the retiring side keeps its captured start level.
        fadeTarget = muted ? 0f : volume;
        withController(
                (mediaController) -> {
                    mediaController.setVolume(muted ? 0f : volume);
                    call.resolve();
                },
                call);
    }

    /**
     * Flip loudness leveling live. The processor lives in the service (same
     * process); when it doesn't exist yet the flag rides along on the next
     * play() call instead.
     */
    @PluginMethod
    public void setLeveling(PluginCall call) {
        levelingEnabled = call.getBoolean("enabled", false);
        applyLeveling();
        call.resolve();
    }

    /**
     * Flip the car-display refresh workaround. The flag is a static in the
     * service, so it is mirrored on every play and connect as well — this call
     * only makes a toggle take effect without waiting for the next play.
     */
    @PluginMethod
    public void setCarTitleRefresh(PluginCall call) {
        carTitleRefreshEnabled = call.getBoolean("enabled", false);
        RadioPlaybackService.setCarTitleRefresh(carTitleRefreshEnabled);
        call.resolve();
    }

    /** Pending native sleep deadline (main-thread only — posted and cleared there). */
    private Runnable sleepPauseRunnable;

    /**
     * Sleep timer, native arm: pause when the deadline hits even if the
     * WebView timers are throttled with the screen off. Best-effort — if the
     * service is gone there is nothing audible to pause. A later call with 0
     * seconds (or firing) clears it. No controller touch except the pause
     * itself, on main like every other op.
     */
    @PluginMethod
    public void setSleepTimer(PluginCall call) {
        long seconds = Math.max(0, Math.round(call.getDouble("seconds", 0.0)));
        mainHandler.post(
                () -> {
                    if (sleepPauseRunnable != null) {
                        mainHandler.removeCallbacks(sleepPauseRunnable);
                        sleepPauseRunnable = null;
                    }
                    if (seconds > 0) {
                        sleepPauseRunnable =
                                () -> {
                                    sleepPauseRunnable = null;
                                    // Park any crossfade first — pausing only
                                    // the session mid-blend would let the
                                    // incoming ramp finish the swap awake.
                                    killFadePlayer();
                                    if (controller != null && controller.isConnected()) {
                                        try {
                                            controller.setVolume(lastMuted ? 0f : lastVolume);
                                            controller.pause();
                                        } catch (Exception e) {
                                            Log.i(LOG_TAG, "sleep pause failed: " + e.getMessage());
                                        }
                                    }
                                };
                        mainHandler.postDelayed(sleepPauseRunnable, seconds * 1000);
                    }
                });
        call.resolve();
    }

    private void applyLeveling() {
        LevelingAudioProcessor processor = RadioPlaybackService.getLevelingProcessor();
        if (processor != null) {
            processor.setLevelingEnabled(levelingEnabled);
        }
    }

    /** Cancel a pending crossfade (superseded play, pause, stop, or error). */
    private void cancelHandoff() {
        killFadePlayer();
    }

    /**
     * Start the overlap: build a second player on the new playlist at zero
     * volume and play it. When it reaches READY the 1s blend begins;
     * stalls/errors cut over classically instead. Returns false when the
     * incoming player can't even be built (caller falls through to the
     * cutover). Main thread only — every touch here is a controller/player
     * call. The full loop rides along so the swap hands the session a
     * ready-to-seek playlist, not a lone item.
     */
    private boolean startFadePlayer(
            MediaController mediaController,
            List<MediaItem> items,
            int index,
            String url,
            float volume,
            boolean muted) {
        killFadePlayer();
        Context context = getContext();
        if (context == null) return false;
        Context app = context.getApplicationContext();
        try {
            LevelingAudioProcessor processor = new LevelingAudioProcessor();
            processor.setLevelingEnabled(levelingEnabled);
            processor.resetForNewStation();
            fadeLeveling = processor;
            ExoPlayer player = RadioPlayerFactory.create(app, processor, false, false);
            fadePlayer = player;
            fadeTarget = muted ? 0f : volume;
            fadeBlending = false;
            player.setVolume(0f);
            player.setRepeatMode(Player.REPEAT_MODE_ALL);
            player.setMediaItems(items, index, C.TIME_UNSET);
            fadeListener =
                    new Player.Listener() {
                        @Override
                        public void onPlaybackStateChanged(int state) {
                            if (state == Player.STATE_READY
                                    && fadePlayer == player
                                    && !fadeBlending) {
                                beginBlend(mediaController, player, items, index, url);
                            }
                        }

                        @Override
                        public void onPlayerError(PlaybackException error) {
                            if (fadePlayer != player) return;
                            Log.i(LOG_TAG, "crossfade incoming failed, cutting over: " + describeError(error));
                            fallbackCutover(mediaController, items, index, url);
                        }
                    };
            player.addListener(fadeListener);
            player.prepare();
            player.play();
            fadeWatchdogRunnable =
                    () -> {
                        fadeWatchdogRunnable = null;
                        if (fadePlayer != player || fadeBlending) return;
                        Log.i(LOG_TAG, "crossfade incoming stalled, cutting over: " + url);
                        fallbackCutover(mediaController, items, index, url);
                    };
            mainHandler.postDelayed(fadeWatchdogRunnable, FADE_WATCHDOG_MS);
            return true;
        } catch (Exception e) {
            Log.i(LOG_TAG, "crossfade build failed, cutting over: " + e.getMessage());
            killFadePlayer();
            return false;
        }
    }

    /**
     * The incoming player is buffered: ramp the session player out and the
     * newcomer in over CROSSFADE_MS, then hand the session over. Cancelled by
     * any transport action (the token is the `fadePlayer` identity — a kill
     * nulls it and the next tick no-ops).
     */
    private void beginBlend(
            MediaController mediaController,
            ExoPlayer player,
            List<MediaItem> items,
            int index,
            String url) {
        if (fadePlayer != player) return;
        fadeBlending = true;
        if (fadeWatchdogRunnable != null) {
            mainHandler.removeCallbacks(fadeWatchdogRunnable);
            fadeWatchdogRunnable = null;
        }
        float from;
        try {
            from = mediaController.getVolume();
        } catch (Exception e) {
            from = lastMuted ? 0f : lastVolume;
        }
        final float oldStart = from;
        // Wall-clock ramp (not step-counted): a loaded main thread stretches
        // the tick spacing, and the blend must still last ~1s rather than
        // stretching with it.
        final long blendStart = SystemClock.uptimeMillis();
        Log.i(LOG_TAG, "crossfade blending: " + url);
        fadeRampRunnable =
                new Runnable() {
                    @Override
                    public void run() {
                        fadeRampRunnable = null;
                        if (fadePlayer != player) return;
                        float t =
                                Math.min(
                                        1f,
                                        (float) (SystemClock.uptimeMillis() - blendStart)
                                                / (float) CROSSFADE_MS);
                        float target = fadeTarget;
                        try {
                            mediaController.setVolume(oldStart * (1f - t));
                        } catch (Exception ignored) {
                            // A dead session ends the blend — the watchdog is
                            // gone, so park quietly and wait for the next play.
                            killFadePlayer();
                            return;
                        }
                        try {
                            player.setVolume(target * t);
                        } catch (Exception ignored) {
                            // The newcomer died mid-blend — the session player
                            // still holds the old station, so cut the same
                            // loop over classically (metadata intact).
                            fallbackCutover(mediaController, items, index, url);
                            return;
                        }
                        if (t >= 1f) {
                            finishBlend(mediaController, player, items, index, url);
                            return;
                        }
                        fadeRampRunnable = this;
                        mainHandler.postDelayed(fadeRampRunnable, CROSSFADE_MS / FADE_STEPS);
                    }
                };
        fadeRampRunnable.run();
    }

    /**
     * Blend done: the newcomer is at full level and the old at zero — move
     * the session onto the newcomer and release the retiree. On a swap
     * failure the same loop cuts over classically (items are immutable and
     * reusable even though the released player held them).
     */
    private void finishBlend(
            MediaController mediaController,
            ExoPlayer player,
            List<MediaItem> items,
            int index,
            String url) {
        if (fadePlayer != player) return;
        try {
            player.removeListener(fadeListener);
        } catch (Exception ignored) {
            // Listener detach is hygiene — the swap below owns correctness.
        }
        fadeListener = null;
        float target = fadeTarget;
        if (RadioPlaybackService.swapSessionPlayer(player, fadeLeveling)) {
            // Ownership transferred — clear WITHOUT releasing (the service
            // owns the player now; releasing here would kill the audio).
            fadePlayer = null;
            fadeLeveling = null;
            fadeBlending = false;
            try {
                mediaController.setVolume(target);
            } catch (Exception ignored) {
                // Level already lands via the player ramp — cosmetic only.
            }
            Log.i(LOG_TAG, "crossfade complete: " + url);
            return;
        }
        Log.i(LOG_TAG, "crossfade swap failed, cutting over: " + url);
        fallbackCutover(mediaController, items, index, url);
    }

    /**
     * Incoming failed, stalled, or mid-blend dead: park it and cut the session
     * player over directly. The old station plays until this lands, so the
     * worst case is the old hard cut, never silence.
     */
    private void fallbackCutover(
            MediaController mediaController, List<MediaItem> items, int index, String url) {
        killFadePlayer();
        float target = lastMuted ? 0f : lastVolume;
        try {
            if (items == null || items.isEmpty()) return;
            setPlaylistAndPlay(
                    mediaController,
                    items,
                    Math.max(0, Math.min(index, items.size() - 1)),
                    target,
                    lastMuted);
            Log.i(LOG_TAG, "play dispatched (cutover after fade abort): " + url);
        } catch (Exception e) {
            Log.i(LOG_TAG, "cutover failed: " + e.getMessage());
        }
    }

    /** Park a blending/staging incoming player. Never throws. Main thread only. */
    private void killFadePlayer() {
        fadeBlending = false;
        if (fadeWatchdogRunnable != null) {
            mainHandler.removeCallbacks(fadeWatchdogRunnable);
            fadeWatchdogRunnable = null;
        }
        if (fadeRampRunnable != null) {
            mainHandler.removeCallbacks(fadeRampRunnable);
            fadeRampRunnable = null;
        }
        ExoPlayer player = fadePlayer;
        fadePlayer = null;
        fadeLeveling = null;
        fadeListener = null;
        if (player != null) {
            try {
                player.stop();
            } catch (Exception ignored) {
                // Already idle — release below still applies.
            }
            try {
                player.release();
            } catch (Exception ignored) {
                // Release races a dead surface — nothing audible to save.
            }
        }
    }

    /**
     * New station, new correction: restart the settle window at unity so the
     * last station's gain never blasts or ducks the next one. Null-safe for
     * the pre-service race (a fresh processor already starts settled-ready).
     */
    private void resetLeveling() {
        LevelingAudioProcessor processor = RadioPlaybackService.getLevelingProcessor();
        if (processor != null) {
            processor.resetForNewStation();
        }
    }

    @Override
    protected void handleOnDestroy() {
        // Staged timers must never fire into a dead plugin — the service
        // dies with the activity, so there is nothing to advance to.
        mainHandler.post(
                () -> {
                    cancelHandoff();
                    if (sleepPauseRunnable != null) {
                        mainHandler.removeCallbacks(sleepPauseRunnable);
                        sleepPauseRunnable = null;
                    }
                });
        if (controller != null) {
            try {
                controller.removeListener(listener);
            } catch (Exception ignored) {
                // Teardown races a dead player — nothing to forward.
            }
        }
        RadioPlaybackService.removeMetadataListener(metadataListener);
        if (controllerFuture != null) {
            MediaController.releaseFuture(controllerFuture);
            controllerFuture = null;
        }
        controller = null;
        lastStatus = "";
    }
}
