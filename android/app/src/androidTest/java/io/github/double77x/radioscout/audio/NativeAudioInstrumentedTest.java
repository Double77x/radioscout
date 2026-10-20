package io.github.double77x.radioscout.audio;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.content.ContextCompat;
import androidx.media3.common.Player;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.Arrays;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Device-side contract for the status matrix and the Android 13 notification
 * permission. The JVM tests cover the same matrix without Android; this one
 * proves the device's Media3 constants and permission state agree with the
 * bridge's decision. The real permission-dialog denial is exercised by
 * `scripts/android-permission-smoke.mjs`.
 */
@RunWith(AndroidJUnit4.class)
public class NativeAudioInstrumentedTest {

    @Test
    public void statusMatrixMatchesDeviceMedia3Constants() {
        assertEquals("paused", PlaybackStatus.resolve(Player.STATE_BUFFERING, false, true, false));
        assertEquals("loading", PlaybackStatus.resolve(Player.STATE_BUFFERING, true, true, false));
        assertEquals("playing", PlaybackStatus.resolve(Player.STATE_READY, true, false, false));
        assertEquals("paused", PlaybackStatus.resolve(Player.STATE_READY, false, false, false));
        assertEquals("paused", PlaybackStatus.resolve(Player.STATE_IDLE, false, false, false));
        assertEquals("error", PlaybackStatus.resolve(Player.STATE_BUFFERING, true, true, true));
    }

    @Test
    public void notificationPermissionIsDeclared() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        PackageInfo info =
                context.getPackageManager()
                        .getPackageInfo(
                                context.getPackageName(), PackageManager.GET_PERMISSIONS);
        assertTrue(
                "POST_NOTIFICATIONS must be requested in the manifest",
                Arrays.asList(info.requestedPermissions).contains(Manifest.permission.POST_NOTIFICATIONS));
    }

    @Test
    public void permissionDecisionMatchesTheDeviceState() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return;
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        boolean granted =
                ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                        == PackageManager.PERMISSION_GRANTED;
        assertEquals(
                "the bridge must request a missing Android 13 notification permission",
                !granted,
                NativeAudioPlugin.notificationPermissionRequired(Build.VERSION.SDK_INT, granted));
        assertTrue(
                "a denied permission must always be requested on Android 13+",
                NativeAudioPlugin.notificationPermissionRequired(Build.VERSION.SDK_INT, false));
    }
}
