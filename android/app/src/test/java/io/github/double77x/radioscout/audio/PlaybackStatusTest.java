package io.github.double77x.radioscout.audio;

import static org.junit.Assert.assertEquals;

import androidx.media3.common.Player;
import org.junit.Test;

/** The bridge status precedence, including the paused-while-buffering case. */
public class PlaybackStatusTest {

    @Test
    public void pausedBufferingReportsPaused() {
        assertEquals("paused", PlaybackStatus.resolve(Player.STATE_BUFFERING, false, true, false));
    }

    @Test
    public void bufferingWhilePlayingReportsLoading() {
        assertEquals("loading", PlaybackStatus.resolve(Player.STATE_BUFFERING, true, true, false));
    }

    @Test
    public void readyWhilePlayingReportsPlaying() {
        assertEquals("playing", PlaybackStatus.resolve(Player.STATE_READY, true, false, false));
    }

    @Test
    public void readyWhilePausedReportsPaused() {
        assertEquals("paused", PlaybackStatus.resolve(Player.STATE_READY, false, false, false));
    }

    @Test
    public void idleWithoutMediaReportsPaused() {
        assertEquals("paused", PlaybackStatus.resolve(Player.STATE_IDLE, false, false, false));
    }

    @Test
    public void errorOverrideWinsOverTransportState() {
        assertEquals("error", PlaybackStatus.resolve(Player.STATE_BUFFERING, true, true, true));
    }
}
