/**
 * Sleep timer: pause playback at a wall-clock deadline. Station-independent
 * (survives switches — only explicit cancel or firing clears it) and never
 * persisted. On the APK the service arms its own deadline too, so screen-off
 * WebView throttling can't trap the radio on all night; the web timeout
 * stays armed as the `<audio>`-mode fallback. Both arms are idempotent —
 * whichever fires first pauses, the other finds nothing playing and clears.
 *
 * Pure deadline ownership — no player state read or written except the
 * `sleepEndsAt` snapshot field. The audible consequence (fade-out + pause)
 * stays in the engine: callers pass it as `onFire` so this module never
 * imports transport (which would cycle back here). Never throws.
 */
import { toast } from "sonner";
import { canUseNativeAudio, nativeSetSleepTimer } from "@/lib/native-audio";
import { emit } from "@/lib/player/store";
import { normalizeSleepMinutes } from "@/lib/radio/sleep";

/** Pending sleep-timer fire handle (null = off; station-independent). */
let sleepTimeout: ReturnType<typeof globalThis.setTimeout> | null = null;

function clearSleepTimer(): void {
  if (sleepTimeout !== null) {
    globalThis.clearTimeout(sleepTimeout);
    sleepTimeout = null;
  }
}

/** Deadline hit: clear both arms, then hand the audible path to the engine. */
function fireSleepTimer(onFire: () => void): void {
  sleepTimeout = null;
  emit({ sleepEndsAt: 0 });
  if (canUseNativeAudio()) void nativeSetSleepTimer(0).catch(() => {});
  onFire();
}

/** Arm the deadline: clear any pending wait, emit the new `sleepEndsAt`,
 * mirror the arm to the native service, and schedule the web fallback.
 * `onFire` is the engine's audible continuation (fade-out + pause). */
export function armSleepTimer(minutes: number, onFire: () => void): void {
  clearSleepTimer();
  const validated = normalizeSleepMinutes(minutes);
  if (validated <= 0) {
    emit({ sleepEndsAt: 0 });
    return;
  }
  const endsAt = Date.now() + validated * 60_000;
  emit({ sleepEndsAt: endsAt });
  if (canUseNativeAudio()) void nativeSetSleepTimer(validated * 60).catch(() => {});
  sleepTimeout = globalThis.setTimeout(() => fireSleepTimer(onFire), Math.max(0, endsAt - Date.now()));
  toast("Sleep timer set", { description: `Playback fades out in ${validated} min.` });
}

/** Disarm the sleep timer on both arms. Never throws. */
export function disarmSleepTimer(): void {
  clearSleepTimer();
  emit({ sleepEndsAt: 0 });
  if (canUseNativeAudio()) void nativeSetSleepTimer(0).catch(() => {});
  toast("Sleep timer off");
}
