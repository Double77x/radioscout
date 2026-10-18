package io.github.double77x.radioscout.audio;

import static org.junit.Assert.assertEquals;

import androidx.media3.common.C;
import androidx.media3.common.audio.AudioProcessor;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import org.junit.Test;

/**
 * Pure-DSP coverage for {@link LevelingAudioProcessor}: the same attack /
 * release / clamp / freeze contract as the web loop
 * ({@code tests/unit/radio-normalize.test.ts}), the stage-1 tap shape
 * (measured identical in Blink and Gecko), and the buffer path for what the
 * web taps read off each channel layout. Service wiring is verified by
 * assembling the APK.
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

    @Test
    public void stageOneTapMatchesTheWebFilterShape() {
        // Browser-measured response of the web tap (60 Hz high-pass at Web
        // Audio's default Q — the spec's dB convention — then the +4 dB/1.5 kHz
        // shelf), identical to the hundredth in Blink and Gecko. A linear-Q
        // high-pass would read the 60 Hz point a full dB low, so these pin the
        // exact convention, not just the general shape.
        float[] hp = LevelingAudioProcessor.highpassCoeffs(48_000f, 60f);
        assertEquals("rumble", -18.52f, gainDb(hp, 20f, 48_000f), 0.25f);
        assertEquals("cutoff", 1.00f, gainDb(hp, 60f, 48_000f), 0.25f);
        assertEquals("peak", 1.79f, gainDb(hp, 90f, 48_000f), 0.25f);
        assertEquals("passband", 0.02f, gainDb(hp, 1000f, 48_000f), 0.1f);
        float[] shelf = LevelingAudioProcessor.highShelfCoeffs(48_000f, 1500f, 4f);
        assertEquals("shelf floor", 0.00f, gainDb(shelf, 100f, 48_000f), 0.1f);
        assertEquals("shelf midpoint", 2.00f, gainDb(shelf, 1500f, 48_000f), 0.1f);
        assertEquals("presence lift", 4.00f, gainDb(shelf, 9000f, 48_000f), 0.1f);
    }

    @Test
    public void stageOneTapTracksTheConfiguredRate() {
        // 44.1 kHz streams get coefficients computed at that rate, so the
        // shape lands on the same frequencies instead of shifting.
        float[] hp = LevelingAudioProcessor.highpassCoeffs(44_100f, 60f);
        assertEquals(1.00f, gainDb(hp, 60f, 44_100f), 0.25f);
        assertEquals(0.02f, gainDb(hp, 1000f, 44_100f), 0.1f);
        float[] shelf = LevelingAudioProcessor.highShelfCoeffs(44_100f, 1500f, 4f);
        assertEquals(2.00f, gainDb(shelf, 1500f, 44_100f), 0.1f);
        assertEquals(4.00f, gainDb(shelf, 9000f, 44_100f), 0.1f);
    }

    @Test
    public void anchorEasesOnTheWebTwoMinuteTau() {
        // Native windows are 400 ms of contiguous audio against the web's
        // ~2.34 s tick-sampled window, so the per-window easing must carry the
        // 400/2340 factor: 60 windows (24 s) close well under a quarter of a
        // 10 dB step. The web's raw 0.02 would close 70% here — six times the
        // intended speed, letting bursts move the trim target.
        float anchor = -30f;
        for (int window = 0; window < 60; window++) {
            anchor = LevelingAudioProcessor.updateAnchor(anchor, -20f);
        }
        org.junit.Assert.assertTrue("anchor " + anchor, anchor > -29f && anchor < -27.5f);
    }

    @Test
    public void stereoAntiPhaseFreezesStageOne() {
        // The tap reads the mono down-mix, so an anti-phase stereo pair
        // cancels to exactly zero: frozen gain, output identical to input. A
        // channel-0-only tap would read 1 kHz at 0.5 and duck the pair.
        short[] input = new short[4800 * 2];
        for (int frame = 0; frame < 4800; frame++) {
            short sample = (short) Math.round(16384 * Math.sin(2 * Math.PI * 1000 * frame / 48_000));
            input[frame * 2] = sample;
            input[frame * 2 + 1] = (short) -sample;
        }
        org.junit.Assert.assertArrayEquals(input, throughProcessor(48_000, 2, input));
    }

    @Test
    public void stereoDownmixHalvesBeforeTheTap() {
        // Correlated stereo at 0.5: (L+R)/2 reads 0.383 after the shelf and
        // lands the output at 0.2863. An unhalved sum would read 0.707 and duck
        // to ~0.267 — the tolerance separates the two.
        short[] input = new short[4800 * 2];
        for (int frame = 0; frame < 4800; frame++) {
            short sample = (short) Math.round(16384 * Math.sin(2 * Math.PI * 1000 * frame / 48_000));
            input[frame * 2] = sample;
            input[frame * 2 + 1] = sample;
        }
        float[] rms = channelRms(throughProcessor(48_000, 2, input), 2);
        assertEquals(0.2863f, rms[0], 0.003f);
        assertEquals(0.2863f, rms[1], 0.003f);
    }

    @Test
    public void monoRumbleReadsThroughTheTapAndBoosts() {
        // 20 Hz at 0.5: raw RMS 0.354 would duck to ~0.29, but the tap's 60 Hz
        // high-pass reads 0.042 → boost clamps at 2.8 → the settle step lands
        // 1.27 (ride-up RELEASE) and the output sits at 0.449.
        short[] input = sine(4800, 20f, 16384);
        float[] rms = channelRms(throughProcessor(48_000, 1, input), 1);
        assertEquals(0.449f, rms[0], 0.005f);
    }

    @Test
    public void toggleOffGlidesToUnityAcrossSmallBuffers() {
        // Decoder buffers run ~21 ms (1024 frames at 48 kHz) — shorter than
        // the glide's 50 ms time constant, so the eased product must carry
        // across buffers. Restarting from the settled gain each buffer leaves
        // a buffer-rate sawtooth and never reaches unity (the web's
        // setTargetAtTime eases one continuous curve).
        LevelingAudioProcessor processor = new LevelingAudioProcessor();
        try {
            processor.configure(new AudioProcessor.AudioFormat(48_000, 2, C.ENCODING_PCM_16BIT));
        } catch (AudioProcessor.UnhandledAudioFormatException e) {
            throw new AssertionError("PCM-16 must be handled", e);
        }
        processor.flush(AudioProcessor.StreamMetadata.DEFAULT);
        processor.setLevelingEnabled(true);
        short[] settledInput = stereo1k(12_000);
        float inputRms = channelRms(settledInput, 2)[0];
        float settled = channelRms(enqueue(processor, settledInput), 2)[0];
        org.junit.Assert.assertTrue("settled " + settled, settled < inputRms * 0.9f);
        processor.setLevelingEnabled(false);
        short[] small = stereo1k(1024);
        float last = 0f;
        for (int i = 0; i < 12; i++) {
            last = channelRms(enqueue(processor, small), 2)[0];
        }
        assertEquals(inputRms, last, 0.004f);
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
     * Steady-state biquad gain in dB at a sine frequency, measured as the
     * ratio of tail RMS to input RMS (0.7071 for a unit sine) — RMS over many
     * cycles is exact where a sampled peak under-reads near Nyquist.
     */
    private static float gainDb(float[] coeffs, float frequency, float sampleRate) {
        float[] state = new float[4];
        double energy = 0;
        int total = 48_000;
        int tail = total / 2;
        for (int i = 0; i < total; i++) {
            float value =
                    LevelingAudioProcessor.biquadSample(
                            (float) Math.sin(2 * Math.PI * frequency * i / sampleRate), coeffs, state);
            if (i >= tail) energy += (double) value * value;
        }
        float rms = (float) Math.sqrt(energy / tail);
        return (float) (20 * Math.log10(rms) + 3.0103);
    }

    /** PCM-16 sine at 48 kHz in the given amplitude (in sample units). */
    private static short[] sine(int frames, float frequency, float amplitude) {
        short[] samples = new short[frames];
        for (int i = 0; i < frames; i++) {
            samples[i] = (short) Math.round(amplitude * Math.sin(2 * Math.PI * frequency * i / 48_000));
        }
        return samples;
    }

    /** Correlated stereo 1 kHz sine at 0.5, both channels — the tap's test tone. */
    private static short[] stereo1k(int frames) {
        short[] samples = new short[frames * 2];
        for (int frame = 0; frame < frames; frame++) {
            short sample = (short) Math.round(16384 * Math.sin(2 * Math.PI * 1000 * frame / 48_000));
            samples[frame * 2] = sample;
            samples[frame * 2 + 1] = sample;
        }
        return samples;
    }

    /**
     * Enqueue one interleaved PCM-16 buffer through a configured processor and
     * return its output samples — one step of the path ExoPlayer drives.
     */
    private static short[] enqueue(LevelingAudioProcessor processor, short[] interleaved) {
        ByteBuffer input = ByteBuffer.allocateDirect(interleaved.length * 2).order(ByteOrder.LITTLE_ENDIAN);
        for (short sample : interleaved) {
            input.putShort(sample);
        }
        input.flip();
        processor.queueInput(input);
        ByteBuffer output = processor.getOutput().order(ByteOrder.LITTLE_ENDIAN);
        short[] out = new short[interleaved.length];
        for (int i = 0; i < out.length; i++) {
            out[i] = output.getShort();
        }
        return out;
    }

    /**
     * Enqueue one interleaved PCM-16 buffer through a fresh, configured
     * processor (leveling on, settle reset) and return the output samples —
     * the same path ExoPlayer drives in the Media3 pipeline, including the
     * {@code configure → flush} pair that populates the input format.
     */
    private static short[] throughProcessor(int rate, int channels, short[] interleaved) {
        LevelingAudioProcessor processor = new LevelingAudioProcessor();
        try {
            processor.configure(new AudioProcessor.AudioFormat(rate, channels, C.ENCODING_PCM_16BIT));
        } catch (AudioProcessor.UnhandledAudioFormatException e) {
            throw new AssertionError("PCM-16 must be handled", e);
        }
        processor.flush(AudioProcessor.StreamMetadata.DEFAULT);
        processor.setLevelingEnabled(true);
        return enqueue(processor, interleaved);
    }

    /** Per-channel RMS of an interleaved PCM-16 buffer as 0..1 float. */
    private static float[] channelRms(short[] samples, int channels) {
        int frames = samples.length / channels;
        float[] energy = new float[channels];
        for (int i = 0; i < samples.length; i++) {
            float value = samples[i] / 32768f;
            energy[i % channels] += value * value;
        }
        float[] rms = new float[channels];
        for (int channel = 0; channel < channels; channel++) {
            rms[channel] = (float) Math.sqrt(energy[channel] / frames);
        }
        return rms;
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
