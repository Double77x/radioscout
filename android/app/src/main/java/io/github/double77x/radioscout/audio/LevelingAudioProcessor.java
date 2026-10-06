package io.github.double77x.radioscout.audio;

import android.util.Log;
import androidx.media3.common.C;
import androidx.media3.common.audio.AudioProcessor;
import androidx.media3.common.audio.BaseAudioProcessor;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

/**
 * Two-stage loudness-leveling processor: steers every station toward the same
 * short-term RMS so switching stations stops jumping in volume — without
 * riding the music inside a station. Java port of the web leveling loop
 * ({@code src/lib/radio/normalize.ts}) — same target, settle/steady
 * coefficients, clamps and freeze floor, so both players agree.
 *
 * <p>Stage 1 (fast AGC): settle-phase attack/release kills the inter-station
 * jump inside ~8s; steady phase crawls after that. Stage 2 (slow LUFS trim):
 * a ±3 dB servo on gated K-weighted momentary loudness corrects the
 * systematic offsets stage 1 leaves behind (speech vs music spectra,
 * bass-heavy masters) over ~1 minute — the hybrid-AGC shape shipping
 * broadcast processors use. A final brickwall safety limiter at −1 dBFS
 * shaves boosted transient tips instead of flat-topping them, which is what
 * lets the boost clamp sit at +9 dB.
 *
 * <p>Adaptation runs on a ~250ms wall-clock cadence (RMS accumulated across
 * buffers), matching the web ~4Hz tick: per-buffer stepping would converge
 * tens of times faster and ride every beat. Gain resets to unity on every
 * station change, so one station's correction never blasts the next.
 *
 * <p>PCM-16 only; anything else passes through untouched (throwing in
 * {@code onConfigure} would fail playback instead of skipping leveling).
 * Disabled by default; when off each buffer passes through with a straight
 * copy (see {@link #isActive} for why the processor stays in the chain
 * rather than letting the sink bypass it).
 * Runs on the playback thread — a few linear passes over 16-bit samples, no
 * allocation. Volume-safe by construction: ExoPlayer applies user volume
 * downstream at the AudioTrack, so the measurement never fights the slider.
 */
public final class LevelingAudioProcessor extends BaseAudioProcessor {

    private static final float TARGET_RMS = 0.14f;
    private static final float ATTACK = 0.3f;
    /**
     * Settle ride-up when quieter. Tracks {@code ATTACK} rather than crawling
     * behind it: 0.05 converged a boosted station 80x slower than a ducked one
     * (145s vs 1.8s), leaving anything needing lift audibly quiet. Parity with
     * {@code src/lib/radio/normalize.ts RELEASE}.
     */
    private static final float RELEASE = 0.15f;
    private static final float STEADY_ATTACK = 0.002f;
    private static final float STEADY_RELEASE = 0.001f;
    private static final float FREEZE_FLOOR = 0.01f;
    /**
     * Stage-1 clamps (−9/+9 dB). The safety limiter below — not the clamp —
     * bounds clipping, so the boost ceiling can absorb dynamic masters
     * instead of stranding them quiet. Parity with the web loop.
     */
    private static final float MIN_GAIN = 0.35f;
    private static final float MAX_GAIN = 2.8f;
    /** Adaptation cadence: match the web tick so coefficients agree. */
    private static final long ADAPT_INTERVAL_NS = 250_000_000L;
    /** Fast-settle window after tune-in: kill the jump, then hold. */
    private static final long SETTLE_NS = 8_000_000_000L;
    /** Stage-2 K-domain target: streaming-convention −14 LUFS. */
    private static final float TRIM_TARGET_LU = -14f;
    /** Stage-2 authority: the slow stage corrects, never leads (±3 dB). */
    private static final float TRIM_DB = 3f;
    /**
     * Stage-2 easing per evaluated momentary window (τ ≈ 3 min — far slower
     * than any song section or talk burst, so the trim only corrects
     * sustained station-level offsets and can never ride the programme).
     */
    private static final float TRIM_COEFF = 0.0022f;
    /** Momentary window in frames at the configured rate (400 ms at 48 kHz). */
    private static final int TRIM_WINDOW_FRAMES = 19_200;
    /** BS.1770 absolute gate: digital silence carries no loudness information. */
    private static final float TRIM_ABS_GATE = -70f;
    /** BS.1770 relative gate: blocks this far under the anchor don't steer. */
    private static final float TRIM_REL_GATE = 10f;
    /** Anchor easing per evaluated window (τ ≈ 2 min — history, not news). */
    private static final float TRIM_ANCHOR_COEFF = 0.02f;
    /** Adaptation deadband in LU: content this far from its own slow average
     * freezes the trim (bursts, jingles, tune-in transients) while the anchor
     * keeps learning. Without it the trim chases every burst and the volume
     * audibly breathes on speech stations. */
    private static final float TRIM_DEADBAND = 3f;
    /** BS.1770 calibration offset (mean-square to LUFS). */
    private static final float TRIM_K_OFFSET = 0.691f;
    /** Safety limiter ceiling (−1 dBFS — broadcast headroom, tips shave). */
    private static final float LIMITER_THRESHOLD = 0.891250938f;
    /** Limiter release (50 ms — tips only, bodies untouched). */
    private static final float LIMITER_RELEASE_MS = 50f;
    /** Exact BS.1770 K-weighting biquads (48 kHz table — see web parity note). */
    private static final float[] K_PRE_B = {1.53512485958697f, -2.69169618940638f, 1.19839281085285f};
    private static final float[] K_PRE_A = {1f, -1.69065929318241f, 0.73248077421585f};
    private static final float[] K_RLB_B = {1f, -2f, 1f};
    private static final float[] K_RLB_A = {1f, -1.99004745483398f, 0.99007225036621f};

    /** Shared with the rest of the audio package so logcat filtering stays one tag. */
    private static final String LOG_TAG = "RadioPlayback";

    private volatile boolean levelingEnabled;
    private volatile float gain = 1f;
    private volatile long settleDeadlineNanos = System.nanoTime() + SETTLE_NS;
    private long lastAdaptNanos = 0L;
    private double rmsAccum = 0;
    private long rmsFrames = 0;
    /** Stage-2 slow trim in dB (multiplies stage 1 — bounded by {@code TRIM_DB}). */
    private volatile float trimDb = 0f;
    /** Slow gated-average anchor for the relative gate (null until first read). */
    private float trimAnchor = Float.NaN;
    /** K-weighted energy accumulator for the current momentary window. */
    private double trimAccumE = 0;
    private long trimAccumN = 0;
    /** Continuous K-filter state per channel (never reset mid-station — transients ring). */
    private final float[] kStateL = new float[8];
    private final float[] kStateR = new float[8];
    /** Limiter peak envelope (post-gain — instant attack, slow release). */
    private float limiterEnv = 0f;
    /** Limiter release coefficient, derived from the configured rate. */
    private float limiterReleaseCoeff = 0.999583f;
    /** Frames per momentary window at the configured rate. */
    private int trimWindowFrames = TRIM_WINDOW_FRAMES;

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
        // The slow trim learned the previous station's offsets — and the
        // limiter envelope its peaks. Both restart untrimmed.
        trimDb = 0f;
        trimAnchor = Float.NaN;
        trimAccumE = 0;
        trimAccumN = 0;
        java.util.Arrays.fill(kStateL, 0f);
        java.util.Arrays.fill(kStateR, 0f);
        limiterEnv = 0f;
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

    /**
     * One K-weighted sample (BS.1770 pre-filter then RLB, direct form I).
     * Stateful — the caller threads one 8-float delay vector per channel
     * through the whole stream, never resetting mid-station. Layout:
     * preX1, preX2, preY1, preY2, rlbX1, rlbX2, rlbY1, rlbY2.
     */
    static float kFilterSample(float sample, float[] state) {
        if (!Float.isFinite(sample)) return 0f;
        float pre =
                K_PRE_B[0] * sample
                        + K_PRE_B[1] * state[0]
                        + K_PRE_B[2] * state[1]
                        - K_PRE_A[1] * state[2]
                        - K_PRE_A[2] * state[3];
        state[1] = state[0];
        state[0] = sample;
        state[3] = state[2];
        state[2] = pre;
        float out =
                K_RLB_B[0] * pre
                        + K_RLB_B[1] * state[4]
                        + K_RLB_B[2] * state[5]
                        - K_RLB_A[1] * state[6]
                        - K_RLB_A[2] * state[7];
        state[5] = state[4];
        state[4] = pre;
        state[7] = state[6];
        state[6] = out;
        return out;
    }

    /** Zeroed K delay vector (one per channel, kept for the whole station). */
    static float[] newKState() {
        return new float[8];
    }

    /** Trim correction as a linear multiplier (authority clamped by design). */
    static float trimLinear(float trimDb) {
        if (!Float.isFinite(trimDb)) return 1f;
        return (float) Math.pow(10.0, Math.max(-TRIM_DB, Math.min(TRIM_DB, trimDb)) / 20.0);
    }

    /**
     * One gated trim step toward the K target. Pure DSP core, kept static
     * for unit tests: relative-gated blocks and unreadable reads hold the
     * trim, everything else eases it inside its authority. The step steers
     * from the slow anchor — never the live block — and content outside the
     * deadband freezes adaptation entirely, so bursts (jingles,
     * talk-over-beds) cannot yank it around.
     *
     * @return new trim in dB (caller stores it)
     */
    static float evaluateTrim(float trimDb, float anchor, float postLu) {
        if (!Float.isFinite(postLu) || Float.isNaN(anchor)) return trimDb;
        if (!(postLu > anchor - TRIM_REL_GATE)) return trimDb;
        if (Math.abs(postLu - anchor) > TRIM_DEADBAND) return trimDb;
        float want = Math.max(-TRIM_DB, Math.min(TRIM_DB, TRIM_TARGET_LU - anchor));
        return trimDb + (want - trimDb) * TRIM_COEFF;
    }

    /** Slow anchor update for one gated momentary read (NaN seeds it). */
    static float updateAnchor(float anchor, float postLu) {
        if (!Float.isFinite(postLu)) return anchor;
        if (Float.isNaN(anchor)) return postLu;
        return anchor + (postLu - anchor) * TRIM_ANCHOR_COEFF;
    }

    /** K momentary loudness of one accumulated window (pre-gain domain). */
    static float windowLu(double energy, long frames) {
        if (frames <= 0) return Float.NEGATIVE_INFINITY;
        return (float) (10 * Math.log10(Math.max(energy / frames, 1e-12)) - TRIM_K_OFFSET);
    }

    @Override
    protected AudioFormat onConfigure(AudioFormat inputAudioFormat) {
        // Rate-derived DSP: momentary window in frames, limiter release for a
        // 50 ms tail at this rate. Unknown rates keep the 48 kHz defaults.
        int rate = inputAudioFormat.sampleRate;
        if (rate > 0) {
            trimWindowFrames = (int) Math.round(TRIM_WINDOW_FRAMES * 1.0 * rate / 48000);
            limiterReleaseCoeff = (float) Math.exp(-1.0 / (LIMITER_RELEASE_MS / 1000.0 * rate));
        }
        return inputAudioFormat;
    }

    /**
     * Always active, deliberately.
     *
     * <p>{@code AudioProcessingPipeline.flush()} builds its working list from
     * {@code isActive()} at the moment it flushes (verified in media3-common
     * 1.9.0: {@code flush} walks {@code audioProcessors} and adds only the
     * active ones to {@code activeAudioProcessors}, which is the list
     * {@code processData} feeds). {@code DefaultAudioSink} only calls flush on
     * a rebuffer, discontinuity or parameter change — never because a toggle
     * flipped. So gating this on {@code levelingEnabled} meant a toggle ON
     * mid-station sat in the pipeline with {@code queueInput} never called:
     * leveling engaged only when the stream happened to rebuffer, which is
     * exactly the "it works sometimes" symptom. Reporting active keeps the
     * processor in the chain so the flag is honoured on the very next buffer;
     * {@link #queueInput} still passes through untouched while off.
     *
     * <p>The cost of that choice is one buffer copy per buffer while the
     * feature is off (~176 KB/s for 44.1 kHz stereo 16-bit — a memcpy the
     * playback thread does a hundred times over elsewhere), paid in exchange
     * for the toggle taking effect immediately instead of on the next rebuffer.
     */
    @Override
    public boolean isActive() {
        return true;
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
        // ~250ms (web-tick parity) no matter how small the buffers are. Stage
        // 2 accumulates K-weighted energy in parallel for its momentary reads.
        double sum = 0;
        for (int i = 0; i < frames; i++) {
            short sample = inputBuffer.getShort(position + i * 2);
            sum += (double) sample * sample;
        }
        rmsAccum += sum;
        rmsFrames += frames;
        // K tap on both channels (BS.1770 sums channel energies — a mono mix
        // reads correlated stereo ~3 dB cold and rails the trim fighting
        // stage 1). Matches the web splitter-plus-two-analysers tap.
        for (int i = 0; i < frames; i += 2) {
            float left = (float) inputBuffer.getShort(position + i * 2) / 32768f;
            float right =
                    (i + 1 < frames) ? (float) inputBuffer.getShort(position + (i + 1) * 2) / 32768f : left;
            float lk = kFilterSample(left, kStateL);
            float rk = kFilterSample(right, kStateR);
            trimAccumE += (double) lk * lk + (double) rk * rk;
            trimAccumN += 1;
        }
        long now = System.nanoTime();
        // Stage-2 momentary evaluation every ~400 ms of audio (BS.1770 window
        // at the configured rate). Measures stage-1-post loudness — the trim
        // corrects the remainder onto target (feedforward, exact fixed point).
        if (trimAccumN >= trimWindowFrames) {
            float lu = windowLu(trimAccumE, trimAccumN);
            trimAccumE = 0;
            trimAccumN = 0;
            if (lu > TRIM_ABS_GATE && gain > 0) {
                float postLu = lu + (float) (20 * Math.log10(gain));
                if (now < settleDeadlineNanos) {
                    trimAnchor = postLu;
                } else {
                    trimAnchor = updateAnchor(trimAnchor, postLu);
                    trimDb = evaluateTrim(trimDb, trimAnchor, postLu);
                }
            }
        }
        if (rmsFrames > 0 && now - lastAdaptNanos >= ADAPT_INTERVAL_NS) {
            float rms = (float) (Math.sqrt(rmsAccum / rmsFrames) / 32768.0);
            rmsAccum = 0;
            rmsFrames = 0;
            lastAdaptNanos = now;
            // A frozen window (silence, speech pause below the floor) must not
            // spend the settle budget — otherwise a station whose first 8s are
            // mostly quiet falls into the steady crawl uncorrected. Wall-clock
            // time keeps moving, so hand the interval back to the deadline.
            // Parity with the web tick, which only decrements on acted ticks.
            if (!Float.isFinite(rms) || rms < FREEZE_FLOOR) {
                settleDeadlineNanos += ADAPT_INTERVAL_NS;
            } else {
                float before = gain;
                gain = now < settleDeadlineNanos ? adaptGain(gain, rms) : adaptGainSteady(gain, rms);
                // One line per real move, and only in the settle phase: the steady
                // crawl would log every 250ms forever. Its absence is the signal
                // that leveling is not reaching the audio path at all.
                if (now < settleDeadlineNanos) {
                    Log.i(LOG_TAG, "leveling rms=" + rms + " gain=" + gain + " (was " + before + ")");
                }
            }
        }
        float applied = gain * trimLinear(trimDb);
        ByteBuffer output = replaceOutputBuffer(bytes);
        output.order(ByteOrder.LITTLE_ENDIAN);
        for (int i = 0; i < frames; i++) {
            short sample = inputBuffer.getShort(position + i * 2);
            float scaled = sample * applied;
            // Safety limiter: one envelope fed by every sample, so L/R share
            // the identical attenuation (no image shift). Instant attack,
            // 50 ms release — only boosted transient tips ever engage it.
            float peak = Math.abs(scaled) / 32768f;
            if (peak > limiterEnv) {
                limiterEnv = peak;
            } else {
                limiterEnv *= limiterReleaseCoeff;
            }
            float limited = scaled * Math.min(1f, LIMITER_THRESHOLD / Math.max(limiterEnv, 1e-9f));
            int out = Math.round(limited);
            if (out > 32767) {
                out = 32767;
            } else if (out < -32768) {
                out = -32768;
            }
            output.putShort((short) out);
        }
        output.flip();
        inputBuffer.position(limit);
    }
}
