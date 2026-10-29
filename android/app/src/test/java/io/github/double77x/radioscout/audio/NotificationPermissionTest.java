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

    @Test
    public void firstPlayAsksOnce() {
        assertTrue(NativeAudioPlugin.notificationPermissionRequestNeeded(33, false, false));
    }

    @Test
    public void deniedAnswerIsRemembered() {
        assertFalse(NativeAudioPlugin.notificationPermissionRequestNeeded(33, false, true));
    }

    @Test
    public void grantedPermissionIsNeverRequested() {
        assertFalse(NativeAudioPlugin.notificationPermissionRequestNeeded(33, true, false));
        assertFalse(NativeAudioPlugin.notificationPermissionRequestNeeded(33, true, true));
    }

    @Test
    public void preTiramisuIsNeverRequestedEvenWhenUnanswered() {
        assertFalse(NativeAudioPlugin.notificationPermissionRequestNeeded(32, false, false));
    }
}
