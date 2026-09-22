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
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.audio.AudioProcessor;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.audio.AudioSink;
import androidx.media3.exoplayer.audio.DefaultAudioSink;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.common.util.concurrent.ListenableFuture;
import java.util.concurrent.ExecutionException;

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
    private static final String LOG_TAG = "RadioPlayback";

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private MediaController controller;
    private ListenableFuture<MediaController> controllerFuture;
    private String lastStatus = "";
    private boolean levelingEnabled = false;

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
                    emitStatus(controller, error.getMessage());
                }
            };

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
        lastStatus = "";
        withController(
                (mediaController) -> {
                    MediaMetadata.Builder metadata =
                            new MediaMetadata.Builder()
                                    .setTitle(title)
                                    .setArtist(artist)
                                    .setAlbumTitle("RadioScout");
                    if (artwork != null && !artwork.isEmpty()) {
                        try {
                            metadata.setArtworkUri(Uri.parse(artwork));
                        } catch (Exception ignored) {
                            // Artwork is decorative — never fail playback.
                        }
                    }
                    MediaItem item =
                            new MediaItem.Builder()
                                    .setUri(Uri.parse(url))
                                    .setMediaId("radioscout-live")
                                    .setMediaMetadata(metadata.build())
                                    .build();
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
                            && mediaController.getCurrentTimeline().getWindowCount() == 1
                            && (mediaController.isPlaying()
                                    || mediaController.getPlaybackState() == Player.STATE_BUFFERING)) {
                        if (startFadePlayer(mediaController, item, url, volume, muted)) {
                            Log.i(LOG_TAG, "crossfade staged: " + url);
                            call.resolve();
                            return;
                        }
                        // Build failed — fall through to the classic cutover.
                    }
                    mediaController.setVolume(muted ? 0f : volume);
                    applyLeveling();
                    resetLeveling();
                    mediaController.setMediaItem(item);
                    mediaController.prepare();
                    mediaController.play();
                    Log.i(LOG_TAG, "play dispatched: " + url);
                    call.resolve();
                },
                call);
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
                    mediaController.stop();
                    mediaController.clearMediaItems();
                    call.resolve();
                },
                call);
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
     * Start the overlap: build a second player on the new URL at zero volume
     * and play it. When it reaches READY the 1s blend begins; stalls/errors
     * cut over classically instead. Returns false when the incoming player
     * can't even be built (caller falls through to the cutover). Main thread
     * only — every touch here is a controller/player call.
     */
    private boolean startFadePlayer(
            MediaController mediaController, MediaItem item, String url, float volume, boolean muted) {
        killFadePlayer();
        Context context = getContext();
        if (context == null) return false;
        Context app = context.getApplicationContext();
        try {
            LevelingAudioProcessor processor = new LevelingAudioProcessor();
            processor.setLevelingEnabled(levelingEnabled);
            processor.resetForNewStation();
            fadeLeveling = processor;
            DefaultRenderersFactory renderersFactory =
                    new DefaultRenderersFactory(app) {
                        @Override
                        protected AudioSink buildAudioSink(
                                Context ctx,
                                boolean enableFloatOutput,
                                boolean enableAudioTrackPlaybackParams) {
                            return new DefaultAudioSink.Builder(ctx)
                                    .setAudioProcessors(new AudioProcessor[] {processor})
                                    .setEnableFloatOutput(enableFloatOutput)
                                    .setEnableAudioTrackPlaybackParams(enableAudioTrackPlaybackParams)
                                    .build();
                        }
                    };
            // Focus stays with the session player until the swap (audio focus
            // is app-level, so the mix is clean); noisy stays off so only the
            // session player answers headset unplug mid-blend.
            ExoPlayer player =
                    new ExoPlayer.Builder(app)
                            .setRenderersFactory(renderersFactory)
                            .setAudioAttributes(
                                    new AudioAttributes.Builder()
                                            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                                            .setUsage(C.USAGE_MEDIA)
                                            .build(),
                                    /* handleAudioFocus= */ true)
                            .setHandleAudioBecomingNoisy(false)
                            .setWakeMode(C.WAKE_MODE_NETWORK)
                            .build();
            fadePlayer = player;
            fadeTarget = muted ? 0f : volume;
            fadeBlending = false;
            player.setVolume(0f);
            player.setMediaItem(item);
            fadeListener =
                    new Player.Listener() {
                        @Override
                        public void onPlaybackStateChanged(int state) {
                            if (state == Player.STATE_READY
                                    && fadePlayer == player
                                    && !fadeBlending) {
                                beginBlend(mediaController, player, item, url);
                            }
                        }

                        @Override
                        public void onPlayerError(PlaybackException error) {
                            if (fadePlayer != player) return;
                            Log.i(LOG_TAG, "crossfade incoming failed, cutting over: " + error.getMessage());
                            fallbackCutover(mediaController, item, url);
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
                        fallbackCutover(mediaController, item, url);
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
            MediaController mediaController, ExoPlayer player, MediaItem item, String url) {
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
                            // item over classically (metadata intact).
                            fallbackCutover(mediaController, item, url);
                            return;
                        }
                        if (t >= 1f) {
                            finishBlend(mediaController, player, item, url);
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
     * failure the same item cuts over classically (the item is immutable and
     * reusable even though the released player held it).
     */
    private void finishBlend(
            MediaController mediaController, ExoPlayer player, MediaItem item, String url) {
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
        fallbackCutover(mediaController, item, url);
    }

    /**
     * Incoming failed, stalled, or mid-blend dead: park it and cut the session
     * player over directly. The old station plays until this lands, so the
     * worst case is the old hard cut, never silence.
     */
    private void fallbackCutover(MediaController mediaController, MediaItem item, String url) {
        killFadePlayer();
        float target = lastMuted ? 0f : lastVolume;
        try {
            mediaController.setVolume(target);
            if (item == null) return;
            applyLeveling();
            resetLeveling();
            mediaController.setMediaItem(item);
            mediaController.prepare();
            mediaController.play();
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
        if (controllerFuture != null) {
            MediaController.releaseFuture(controllerFuture);
            controllerFuture = null;
        }
        controller = null;
        lastStatus = "";
    }
}
