import { useSyncExternalStore } from "react";
import { setNormalization } from "@/hooks/use-player";
import { usePersistentString } from "@/hooks/use-persistent-state";
import { isNative } from "@/lib/capacitor";
import { NORMALIZE_KEY, normalizeEnabled } from "@/lib/radio/normalize";
import { cn } from "@/lib/utils";

/** Stable fallback for the persisted hook (referential stability matters). */
const LEVEL_OFF = "0";

function subscribeNative() {
  return () => {};
}

// Hoisted: useSyncExternalStore requires stable snapshot identities. The
// platform never changes mid-session, so the client snapshot is constant —
// and the server snapshot keeps the prerender identical on every platform.
const getNativeSnapshot = () => isNative();
const getServerSnapshot = () => false;

/**
 * Loudness-leveling switch for Settings. One tap flips the persisted toggle
 * and live-applies it to the player (no reload, no query invalidation —
 * playback state owns the graph). The APK renders this disabled with the
 * reason inline: Media3 owns audio there, so there is no Web Audio graph to
 * level through. The native check lands post-mount so the prerender matches
 * hydration on every platform.
 */
export function NormalizeSwitch() {
  const [value, setValue] = usePersistentString(NORMALIZE_KEY, LEVEL_OFF);
  const on = normalizeEnabled(value);
  const native = useSyncExternalStore(subscribeNative, getNativeSnapshot, getServerSnapshot);

  const toggle = () => {
    if (native) return;
    const next = !on;
    setValue(next ? "1" : "0");
    setNormalization(next);
  };

  return (
    <div>
      <div className='flex items-center gap-3'>
        <div className='min-w-0 flex-1'>
          <p className='text-sm font-medium'>Level volume</p>
          <p className='mt-0.5 text-xs text-muted-foreground'>
            {native
              ? "Web player only — the APK uses the system player."
              : "Even out loudness differences between stations."}
          </p>
        </div>
        <button
          type='button'
          role='switch'
          aria-checked={on && !native}
          aria-label='Level volume across stations'
          disabled={native}
          onClick={toggle}
          className={cn(
            "relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60",
            on && !native ? "bg-primary" : "bg-muted",
          )}>
          <span
            aria-hidden='true'
            className={cn(
              "absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform",
              on && !native && "translate-x-5",
            )}
          />
        </button>
      </div>
    </div>
  );
}
