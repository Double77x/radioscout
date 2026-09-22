package io.github.double77x.radioscout.audio;

import androidx.media3.common.C;
import androidx.media3.common.audio.AudioProcessor;
import androidx.media3.common.audio.BaseAudioProcessor;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

/**
 * Adaptive loudness-leveling processor: steers every station toward the same
 * short-term RMS so switching stations stops jumping in volume. Java port of
 * the web leveling loop ({@code src/lib/radio/normalize.ts}) — same target,
 * attack, release, freeze floor and clamps, so both players agree.
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
    private static final float FREEZE_FLOOR = 0.01f;
    private static final float MIN_GAIN = 0.25f;
    private static final float MAX_GAIN = 8f;

    private volatile boolean levelingEnabled;
    private float gain = 1f;

    /** Flip leveling live (bridge thread-safe via volatile). */
    public void setLevelingEnabled(boolean enabled) {
        levelingEnabled = enabled;
    }

    public boolean isLevelingEnabled() {
        return levelingEnabled;
    }

    /**
     * Pure gain step, mirrored in unit tests: fast pull-down when louder
     * than target, slow ride-up when quieter, frozen below the floor,
     * clamped to the hard range.
     */
    static float adaptGain(float currentGain, float rms) {
        if (!Float.isFinite(rms) || rms < FREEZE_FLOOR) return currentGain;
        float desired = Math.min(MAX_GAIN, Math.max(MIN_GAIN, TARGET_RMS / Math.max(rms, 1e-3f)));
        float coefficient = desired < currentGain ? ATTACK : RELEASE;
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
        double sum = 0;
        for (int i = 0; i < frames; i++) {
            short sample = inputBuffer.getShort(position + i * 2);
            sum += (double) sample * sample;
        }
        float rms = (float) (Math.sqrt(sum / frames) / 32768.0);
        gain = adaptGain(gain, rms);
        ByteBuffer output = replaceOutputBuffer(bytes);
        output.order(ByteOrder.LITTLE_ENDIAN);
        for (int i = 0; i < frames; i++) {
            short sample = inputBuffer.getShort(position + i * 2);
            int scaled = Math.round(sample * gain);
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
