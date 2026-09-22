package io.github.double77x.radioscout.audio;

import androidx.media3.common.C;
import androidx.media3.common.audio.AudioProcessor;
import androidx.media3.common.audio.BaseAudioProcessor;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

/**
 * Two-phase loudness-leveling processor: steers every station toward the same
 * short-term RMS so switching stations stops jumping in volume — without
 * riding the music inside a station. Java port of the web leveling loop
 * ({@code src/lib/radio/normalize.ts}) — same target, settle/steady
 * coefficients, clamps and freeze floor, so both players agree.
 *
 * <p>Phase 1 (settle, 8s after {@link #resetForNewStation}): fast
 * attack/release kills the inter-station jump. Phase 2 (steady): a crawl
 * tracks only slow drift, so songs play untouched — no pumping.
 *
 * <p>Adaptation runs on a ~250ms wall-clock cadence (RMS accumulated across
 * buffers), matching the web ~4Hz tick: per-buffer stepping would converge
 * tens of times faster and ride every beat. Gain resets to unity on every
 * station change, so one station's correction never blasts the next.
 *
 * <p>PCM-16 only; anything else passes through untouched (throwing in
 * {@code onConfigure} would fail playback instead of skipping leveling).
 * Disabled by default; when off the sink bypasses it with zero overhead.
 * Runs on the playback thread — two linear passes over 16-bit samples, no
 * allocation. Volume-safe by construction: ExoPlayer applies user volume
 * downstream at the AudioTrack, so the measurement never fights the slider.
 */
public final class LevelingAudioProcessor extends BaseAudioProcessor {

    private static final float TARGET_RMS = 0.14f;
    private static final float ATTACK = 0.3f;
    private static final float RELEASE = 0.05f;
    private static final float STEADY_ATTACK = 0.002f;
    private static final float STEADY_RELEASE = 0.001f;
    private static final float FREEZE_FLOOR = 0.01f;
    private static final float MIN_GAIN = 0.5f;
    private static final float MAX_GAIN = 2f;
    /** Adaptation cadence: match the web tick so coefficients agree. */
    private static final long ADAPT_INTERVAL_NS = 250_000_000L;
    /** Fast-settle window after tune-in: kill the jump, then hold. */
    private static final long SETTLE_NS = 8_000_000_000L;

    private volatile boolean levelingEnabled;
    private volatile float gain = 1f;
    private volatile long settleDeadlineNanos = System.nanoTime() + SETTLE_NS;
    private long lastAdaptNanos = 0L;
    private double rmsAccum = 0;
    private long rmsFrames = 0;

    /**
     * Flip leveling live (bridge thread-safe via volatile). Enabling
     * restarts the settle window at unity, like a fresh tune-in.
     */
    public void setLevelingEnabled(boolean enabled) {
        levelingEnabled = enabled;
        if (enabled) {
            resetForNewStation();
        }
    }

    /**
     * Restart leveling for a new station: unity gain plus a fresh
     * fast-settle window. Called from the plugin's play path; safe from any
     * thread (worst case one short RMS window misreads and self-corrects).
     */
    public void resetForNewStation() {
        gain = 1f;
        settleDeadlineNanos = System.nanoTime() + SETTLE_NS;
        rmsAccum = 0;
        rmsFrames = 0;
        // Adapt on the next buffer so the new station settles immediately.
        lastAdaptNanos = 0L;
    }

    public boolean isLevelingEnabled() {
        return levelingEnabled;
    }

    /**
     * Pure gain step, mirrored in unit tests: settle-phase attack/release
     * (fast pull-down when louder, brisk ride-up when quieter), frozen below
     * the floor, clamped to the hard range.
     */
    static float adaptGain(float currentGain, float rms) {
        return stepGain(currentGain, rms, ATTACK, RELEASE);
    }

    /**
     * Steady-phase step: same target and clamps, but a crawl — settled
     * playback never breathes.
     */
    static float adaptGainSteady(float currentGain, float rms) {
        return stepGain(currentGain, rms, STEADY_ATTACK, STEADY_RELEASE);
    }

    private static float stepGain(float currentGain, float rms, float attack, float release) {
        if (!Float.isFinite(rms) || rms < FREEZE_FLOOR) return currentGain;
        float desired = Math.min(MAX_GAIN, Math.max(MIN_GAIN, TARGET_RMS / Math.max(rms, 1e-3f)));
        float coefficient = desired < currentGain ? attack : release;
        return currentGain + (desired - currentGain) * coefficient;
    }

    /** Short-term RMS of 16-bit samples as 0..1 float. */
    static float rmsOf(short[] samples) {
        if (samples.length == 0) return 0f;
        double sum = 0;
        for (short sample : samples) {
            sum += (double) sample * sample;
        }
        return (float) (Math.sqrt(sum / samples.length) / 32768.0);
    }

    @Override
    protected AudioFormat onConfigure(AudioFormat inputAudioFormat) {
        return inputAudioFormat;
    }

    @Override
    public boolean isActive() {
        return levelingEnabled;
    }

    @Override
    public void queueInput(ByteBuffer inputBuffer) {
        int position = inputBuffer.position();
        int limit = inputBuffer.limit();
        int bytes = limit - position;
        if (bytes <= 0) {
            return;
        }
        if (!levelingEnabled || inputAudioFormat.encoding != C.ENCODING_PCM_16BIT || (bytes & 1) != 0) {
            ByteBuffer passthrough = replaceOutputBuffer(bytes);
            passthrough.put(inputBuffer);
            passthrough.flip();
            inputBuffer.position(limit);
            return;
        }
        int frames = bytes / 2;
        inputBuffer.order(ByteOrder.LITTLE_ENDIAN);
        // Accumulate energy across buffers; the gain step runs at most every
        // ~250ms (web-tick parity) no matter how small the buffers are.
        double sum = 0;
        for (int i = 0; i < frames; i++) {
            short sample = inputBuffer.getShort(position + i * 2);
            sum += (double) sample * sample;
        }
        rmsAccum += sum;
        rmsFrames += frames;
        long now = System.nanoTime();
        if (rmsFrames > 0 && now - lastAdaptNanos >= ADAPT_INTERVAL_NS) {
            float rms = (float) (Math.sqrt(rmsAccum / rmsFrames) / 32768.0);
            rmsAccum = 0;
            rmsFrames = 0;
            lastAdaptNanos = now;
            float stepped =
                    now < settleDeadlineNanos ? adaptGain(gain, rms) : adaptGainSteady(gain, rms);
            gain = stepped;
        }
        float applied = gain;
        ByteBuffer output = replaceOutputBuffer(bytes);
        output.order(ByteOrder.LITTLE_ENDIAN);
        for (int i = 0; i < frames; i++) {
            short sample = inputBuffer.getShort(position + i * 2);
            int scaled = Math.round(sample * applied);
            if (scaled > 32767) {
                scaled = 32767;
            } else if (scaled < -32768) {
                scaled = -32768;
            }
            output.putShort((short) scaled);
        }
        output.flip();
        inputBuffer.position(limit);
    }
}
