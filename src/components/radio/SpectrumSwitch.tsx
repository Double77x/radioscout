import { usePersistentString } from "@/hooks/use-persistent-state";
import { VISUALISER_KEY, visualiserEnabled } from "@/lib/radio/visualiser";
import { cn } from "@/lib/utils";

/** Stable fallback for the persisted hook (referential stability matters). */
const SPECTRUM_OFF = "0";

/**
 * Audio-visualiser switch for Settings (web only — the wings never mount on
 * the APK). The component reads the same key, so a flip mounts or unmounts
 * it live: no reload, no player call, and the engine learns about it through
 * the mounted component at the next element build.
 */
export function SpectrumSwitch() {
  const [value, setValue] = usePersistentString(VISUALISER_KEY, SPECTRUM_OFF);
  const on = visualiserEnabled(value);

  return (
    <div>
      <div className='flex items-center gap-3'>
        <div className='min-w-0 flex-1'>
          <p className='text-sm font-medium'>Audio spectrum</p>
          <p className='mt-0.5 text-xs text-muted-foreground'>
            Show a live spectrum either side of the app on laptop screens and larger, reacting to what is playing.
          </p>
        </div>
        <button
          type='button'
          role='switch'
          aria-checked={on}
          aria-label='Show the audio spectrum beside the app'
          onClick={() => {
            setValue(on ? "0" : "1");
          }}
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
