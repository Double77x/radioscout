import { setNormalization } from "@/hooks/use-player";
import { usePersistentString } from "@/hooks/use-persistent-state";
import { NORMALIZE_KEY, normalizeEnabled } from "@/lib/radio/normalize";
import { cn } from "@/lib/utils";

/** Stable fallback for the persisted hook (referential stability matters). */
const LEVEL_OFF = "0";

/**
 * Loudness-leveling switch for Settings. One tap flips the persisted toggle
 * and live-applies it — to the Web Audio graph on web, to the Media3
 * service processor on the APK (see `setNormalization`). No reload, no
 * query invalidation — playback state owns the effect on both sides.
 */
export function NormalizeSwitch() {
  const [value, setValue] = usePersistentString(NORMALIZE_KEY, LEVEL_OFF);
  const on = normalizeEnabled(value);

  const toggle = () => {
    const next = !on;
    setValue(next ? "1" : "0");
    setNormalization(next);
  };

  return (
    <div>
      <div className='flex items-center gap-3'>
        <div className='min-w-0 flex-1'>
          <p className='text-sm font-medium'>Level volume</p>
          <p className='mt-0.5 text-xs text-muted-foreground'>Even out loudness differences between stations.</p>
        </div>
        <button
          type='button'
          role='switch'
          aria-checked={on}
          aria-label='Level volume across stations'
          onClick={toggle}
          className={cn(
            "relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            on ? "bg-primary" : "bg-muted",
          )}>
          <span
            aria-hidden='true'
            className={cn(
              "absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform",
              on && "translate-x-5",
            )}
          />
        </button>
      </div>
    </div>
  );
}
