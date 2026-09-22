package io.github.double77x.radioscout.audio;

import android.Manifest;
import android.content.ComponentName;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import androidx.core.content.ContextCompat;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
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

    private final Player.Listener listener =
            new Player.Listener() {
                @Override
                public void onEvents(Player player, Player.Events events) {
                    emitStatus(player, null);
                }

                @Override
                public void onPlayerError(PlaybackException error) {
                    Player active = controller;
                    emitStatus(active, error.getMessage());
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
                    mediaController.setVolume(muted ? 0f : volume);
                    applyLeveling();
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

    private void applyLeveling() {
        LevelingAudioProcessor processor = RadioPlaybackService.getLevelingProcessor();
        if (processor != null) {
            processor.setLevelingEnabled(levelingEnabled);
        }
    }

    @Override
    protected void handleOnDestroy() {
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
