import { setCarTitleRefresh } from "@/hooks/use-player";
import { usePersistentString } from "@/hooks/use-persistent-state";
import { CAR_REFRESH_KEY, carRefreshEnabled } from "@/lib/radio/car-refresh";
import { cn } from "@/lib/utils";

/** Stable fallback for the persisted hook (referential stability matters). */
const REFRESH_OFF = "0";

/**
 * Car-display refresh switch for Settings (APK only — a browser has no
 * Bluetooth stereo to refresh, and the lock screen and notification already
 * follow every title on their own). One tap flips the persisted toggle and
 * live-applies it, exactly like `NormalizeSwitch`.
 *
 * <p>The copy carries the trade-off on purpose: this works by nudging playback
 * at every song change, so a click or short rebuffer is the price of a car that
 * stops showing the first song forever.
 */
export function CarRefreshSwitch() {
  const [value, setValue] = usePersistentString(CAR_REFRESH_KEY, REFRESH_OFF);
  const on = carRefreshEnabled(value);

  const toggle = () => {
    const next = !on;
    setValue(next ? "1" : "0");
    setCarTitleRefresh(next);
  };

  return (
    <div>
      <div className='flex items-center gap-3'>
        <div className='min-w-0 flex-1'>
          <p className='text-sm font-medium'>Refresh car display</p>
          <p className='mt-0.5 text-xs text-muted-foreground'>
            Some Bluetooth stereos — older cars especially — keep the first song title they receive and only re-read it
            when playback state changes. This nudges playback each time the song changes so they do.
          </p>
          <p className='mt-1 text-xs text-muted-foreground'>
            The nudge can cause a brief click or rebuffer at every song change. Leave it off unless your car is showing
            a stale title — your lock screen and notification already update on their own.
          </p>
        </div>
        <button
          type='button'
          role='switch'
          aria-checked={on}
          aria-label='Nudge playback so a Bluetooth car display refreshes the song title'
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
