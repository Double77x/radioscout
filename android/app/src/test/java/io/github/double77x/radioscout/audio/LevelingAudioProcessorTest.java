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
    public void adaptGainRidesUpWhenQuieter() {
        assertEquals(1 + (2 - 1) * 0.15f, LevelingAudioProcessor.adaptGain(1f, TARGET_RMS / 2), 1e-5f);
    }

    @Test
    public void settleConvergesQuietAsFastAsLoud() {
        // Regression parity with the web loop: RELEASE 0.05 against ATTACK 0.3
        // left boosted stations ~145s from target while ducked ones landed in
        // ~2s. Both directions must now land inside the 8s settle window.
        assertSettlesWithin(Float.valueOf(TARGET_RMS * 2), 8f);
        assertSettlesWithin(Float.valueOf(TARGET_RMS / 2), 8f);
    }

    @Test
    public void adaptGainSteadyCrawlsWhereSettleStrides() {
        float settle = Math.abs(LevelingAudioProcessor.adaptGain(1f, TARGET_RMS * 2) - 1f);
        float steady = Math.abs(LevelingAudioProcessor.adaptGainSteady(1f, TARGET_RMS * 2) - 1f);
        assertEquals(1 + (0.5f - 1) * 0.002f, LevelingAudioProcessor.adaptGainSteady(1f, TARGET_RMS * 2), 1e-5f);
        org.junit.Assert.assertTrue(steady < settle / 10);
    }

    @Test
    public void adaptGainSteadyClampsToMinusNinePlusNineDb() {
        org.junit.Assert.assertTrue(LevelingAudioProcessor.adaptGainSteady(1f, 1e-4f) <= 2.8f);
        org.junit.Assert.assertTrue(LevelingAudioProcessor.adaptGainSteady(2.8f, TARGET_RMS * 100) >= 0.35f);
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

    @Test
    public void kFilterBlocksDcAndPassesMidband() {
        float[] state = LevelingAudioProcessor.newKState();
        float dc = 0f;
        for (int i = 0; i < 2000; i++) dc = LevelingAudioProcessor.kFilterSample(1f, state);
        assertEquals(0f, dc, 0.01f);
        float peak = 0f;
        for (int i = 0; i < 4800; i++) {
            float value =
                    LevelingAudioProcessor.kFilterSample((float) Math.sin(2 * Math.PI * 1000 * i / 48_000), state);
            if (i > 2400) peak = Math.max(peak, Math.abs(value));
        }
        org.junit.Assert.assertTrue("peak " + peak, peak > 0.9f && peak < 1.25f);
        assertEquals(0f, LevelingAudioProcessor.kFilterSample(Float.NaN, LevelingAudioProcessor.newKState()), 0f);
    }

    @Test
    public void trimLinearClampsAuthority() {
        assertEquals(1f, LevelingAudioProcessor.trimLinear(0f), 0f);
        assertEquals(1f, LevelingAudioProcessor.trimLinear(Float.NaN), 0f);
        assertEquals((float) Math.pow(10, 3.0 / 20), LevelingAudioProcessor.trimLinear(30f), 1e-5f);
        assertEquals((float) Math.pow(10, -3.0 / 20), LevelingAudioProcessor.trimLinear(-30f), 1e-5f);
    }

    @Test
    public void evaluateTrimServosOutputOntoTarget() {
        // Anchored 3 LU under target trims up; 3 LU over trims down. The step
        // steers from the slow anchor — the live block only feeds the anchor.
        float up = LevelingAudioProcessor.evaluateTrim(0f, -17f, -17f);
        org.junit.Assert.assertTrue(up > 0f && up <= 3f);
        float down = LevelingAudioProcessor.evaluateTrim(0f, -11f, -11f);
        org.junit.Assert.assertTrue(down < 0f && down >= -3f);
        // Relative-gated blocks and garbage hold the trim.
        assertEquals(1f, LevelingAudioProcessor.evaluateTrim(1f, -14f, -30f), 0f);
        assertEquals(1f, LevelingAudioProcessor.evaluateTrim(1f, Float.NaN, -14f), 0f);
        assertEquals(1f, LevelingAudioProcessor.evaluateTrim(1f, -14f, Float.NaN), 0f);
    }

    @Test
    public void evaluateTrimSteersFromTheAnchorSoBurstsCannotYankIt() {
        // Anchor settled on quiet programme; three loud burst blocks sit far
        // outside the deadband, so the trim holds EXACTLY while the anchor
        // underneath keeps learning (a per-block want would chase the bursts
        // straight to −3 dB — the Capital XTRA pumping report).
        float trim = 1.2f;
        float anchor = -16.5f;
        for (int i = 0; i < 3; i++) {
            anchor = LevelingAudioProcessor.updateAnchor(anchor, 0f);
            trim = LevelingAudioProcessor.evaluateTrim(trim, anchor, 0f);
        }
        assertEquals(1.2f, trim, 0f);
        org.junit.Assert.assertTrue("anchor " + anchor, anchor > -16.5f);
    }

    @Test
    public void updateAnchorSeedsAndTracks() {
        assertEquals(-14f, LevelingAudioProcessor.updateAnchor(Float.NaN, -14f), 0f);
        assertEquals(-20f, LevelingAudioProcessor.updateAnchor(-20f, -30f), 0.5f);
        org.junit.Assert.assertTrue(LevelingAudioProcessor.updateAnchor(-20f, -30f) < -20f);
        assertEquals(-20f, LevelingAudioProcessor.updateAnchor(-20f, Float.NaN), 0f);
    }

    @Test
    public void windowLuReadsSilenceAsMinusInfinity() {
        assertEquals(Float.NEGATIVE_INFINITY, LevelingAudioProcessor.windowLu(0, 0), 0f);
        float fullScale = LevelingAudioProcessor.windowLu(1.0, 1);
        assertEquals(-0.691f, fullScale, 0.01f);
    }

    /** Seconds of settle ticking until a constant source sits within 0.5 dB of target. */
    private static void assertSettlesWithin(Float rms, float maxSeconds) {
        float wanted = Math.min(2.8f, Math.max(0.35f, TARGET_RMS / rms));
        float gain = 1f;
        int ticks = 0;
        for (int tick = 0; tick < 32 * 4; tick++) {
            gain = LevelingAudioProcessor.adaptGain(gain, rms);
            ticks = tick;
            if (Math.abs(20 * (float) Math.log10(wanted / gain)) < 0.5f) {
                break;
            }
        }
        org.junit.Assert.assertTrue(
                "rms " + rms + " took " + (ticks / 4f) + "s", ticks / 4f <= maxSeconds);
    }

    /**
     * The toggle must be honoured on the next buffer, not on the next rebuffer:
     * {@code AudioProcessingPipeline} only re-reads {@code isActive()} when it
     * flushes, so gating activity on the flag left a mid-station toggle ON
     * sitting in the pipeline with {@code queueInput} never called.
     */
    @Test
    public void isActiveSoTheToggleLandsWithoutAFlush() {
        LevelingAudioProcessor processor = new LevelingAudioProcessor();
        processor.setLevelingEnabled(false);
        org.junit.Assert.assertTrue(
                "stays in the pipeline while off so the toggle lands without a flush",
                processor.isActive());
        processor.setLevelingEnabled(true);
        org.junit.Assert.assertTrue(processor.isActive());
    }
}
