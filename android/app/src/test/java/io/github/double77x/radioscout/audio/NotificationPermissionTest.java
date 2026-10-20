package io.github.double77x.radioscout.audio;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/** The Android 13 notification-permission decision, independent of a context. */
public class NotificationPermissionTest {

    @Test
    public void preTiramisuNeverRequests() {
        assertFalse(NativeAudioPlugin.notificationPermissionRequired(32, false));
        assertFalse(NativeAudioPlugin.notificationPermissionRequired(32, true));
    }

    @Test
    public void tiramisuDeniedNeedsRequest() {
        assertTrue(NativeAudioPlugin.notificationPermissionRequired(33, false));
    }

    @Test
    public void tiramisuGrantedNeedsNoRequest() {
        assertFalse(NativeAudioPlugin.notificationPermissionRequired(33, true));
    }

    @Test
    public void newerVersionsKeepTheSameRule() {
        assertTrue(NativeAudioPlugin.notificationPermissionRequired(36, false));
        assertFalse(NativeAudioPlugin.notificationPermissionRequired(36, true));
    }
}
