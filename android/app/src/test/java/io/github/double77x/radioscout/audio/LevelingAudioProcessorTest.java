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
    public void adaptGainSteadyCrawlsWhereSettleStrides() {
        float settle = Math.abs(LevelingAudioProcessor.adaptGain(1f, TARGET_RMS * 2) - 1f);
        float steady = Math.abs(LevelingAudioProcessor.adaptGainSteady(1f, TARGET_RMS * 2) - 1f);
        assertEquals(1 + (0.5f - 1) * 0.002f, LevelingAudioProcessor.adaptGainSteady(1f, TARGET_RMS * 2), 1e-5f);
        org.junit.Assert.assertTrue(steady < settle / 10);
    }

    @Test
    public void adaptGainSteadyClampsToPlusMinusSixDb() {
        org.junit.Assert.assertTrue(LevelingAudioProcessor.adaptGainSteady(1f, 1e-4f) <= 2f);
        org.junit.Assert.assertTrue(LevelingAudioProcessor.adaptGainSteady(2f, TARGET_RMS * 100) >= 0.5f);
    }

    @Test
    public void adaptGainSteadyFreezesBelowTheFloor() {
        assertEquals(1.4f, LevelingAudioProcessor.adaptGainSteady(1.4f, 0f), 0f);
        assertEquals(1.4f, LevelingAudioProcessor.adaptGainSteady(1.4f, Float.NaN), 0f);
    }

    @Test
    public void steadyPhaseIgnoresSongSections() {
        // Settle on a 2x-loud station, then ±3 dB verse/chorus for two
        // minutes at web-tick parity (4 steps/sec): breathing under 1 dB.
        float gain = 1f;
        for (int i = 0; i < 32; i++) {
            gain = LevelingAudioProcessor.adaptGain(gain, TARGET_RMS * 2);
        }
        assertEquals(0.5f, gain, 0.05f);
        gain = 1f;
        for (int i = 0; i < 32; i++) {
            gain = LevelingAudioProcessor.adaptGain(gain, TARGET_RMS);
        }
        float settled = gain;
        float peakDb = 0f;
        for (int i = 0; i < 480; i++) {
            float rms = (i / 80) % 2 == 0 ? TARGET_RMS / 1.41f : TARGET_RMS * 1.41f;
            gain = LevelingAudioProcessor.adaptGainSteady(gain, rms);
            peakDb = Math.max(peakDb, Math.abs(20 * (float) Math.log10(gain / settled)));
        }
        org.junit.Assert.assertTrue("breathing " + peakDb + " dB", peakDb < 1f);
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
