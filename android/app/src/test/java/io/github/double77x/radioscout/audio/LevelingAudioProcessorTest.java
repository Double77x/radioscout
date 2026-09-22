package io.github.double77x.radioscout.audio;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

/**
 * Pure-DSP coverage for {@link LevelingAudioProcessor}: the same attack /
 * release / clamp / freeze contract as the web loop
 * ({@code tests/unit/radio-normalize.test.ts}). Graph plumbing
 * (ByteBuffers, service wiring) is verified by assembling the APK.
 */
public class LevelingAudioProcessorTest {

    private static final float TARGET_RMS = 0.14f;

    @Test
    public void rmsOfReadsSilenceAsZero() {
        assertEquals(0f, LevelingAudioProcessor.rmsOf(new short[2048]), 0f);
        assertEquals(0f, LevelingAudioProcessor.rmsOf(new short[0]), 0f);
    }

    @Test
    public void rmsOfReadsFullScaleDcNearOne() {
        short[] dc = new short[1024];
        java.util.Arrays.fill(dc, Short.MAX_VALUE);
        assertEquals(1f, LevelingAudioProcessor.rmsOf(dc), 0.001f);
    }

    @Test
    public void rmsOfReadsSineAtAmplitudeOverRootTwo() {
        short[] sine = new short[2048];
        for (int i = 0; i < sine.length; i++) {
            sine[i] = (short) (18000 * Math.sin((i / (double) sine.length) * Math.PI * 2 * 8));
        }
        assertEquals(18000f / (float) Math.sqrt(2) / 32768f, LevelingAudioProcessor.rmsOf(sine), 0.002f);
    }

    @Test
    public void adaptGainPullsDownFastWhenLouder() {
        assertEquals(1 + (0.5f - 1) * 0.3f, LevelingAudioProcessor.adaptGain(1f, TARGET_RMS * 2), 1e-5f);
    }

    @Test
    public void adaptGainRidesUpSlowWhenQuieter() {
        assertEquals(1 + (2 - 1) * 0.05f, LevelingAudioProcessor.adaptGain(1f, TARGET_RMS / 2), 1e-5f);
    }

    @Test
    public void adaptGainConvergesOnTheExactCorrection() {
        float gain = 1f;
        for (int i = 0; i < 200; i++) {
            gain = LevelingAudioProcessor.adaptGain(gain, 0.07f);
        }
        assertEquals(TARGET_RMS / 0.07f, gain, 0.01f);
    }

    @Test
    public void adaptGainClampsAndConvergesIntoRange() {
        float gain = 100f;
        for (int i = 0; i < 50; i++) {
            gain = LevelingAudioProcessor.adaptGain(gain, TARGET_RMS);
        }
        assertEquals(1f, gain, 0.1f);
    }

    @Test
    public void adaptGainFreezesBelowTheFloor() {
        assertEquals(1.7f, LevelingAudioProcessor.adaptGain(1.7f, 0f), 0f);
        assertEquals(1.7f, LevelingAudioProcessor.adaptGain(1.7f, Float.NaN), 0f);
    }
}
