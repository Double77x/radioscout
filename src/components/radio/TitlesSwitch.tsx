import { setIcyProbing } from "@/hooks/use-player";
import { usePersistentString } from "@/hooks/use-persistent-state";
import { TITLES_KEY, titlesEnabled } from "@/lib/radio/titles";
import { cn } from "@/lib/utils";

/** Stable fallback for the persisted hook (referential stability matters). */
const TITLES_OFF = "0";

/**
 * Stream-titles switch for Settings (web only — hidden on native, where
 * ExoPlayer reports titles through the bridge event regardless). One tap
 * flips the persisted toggle and live-applies it to current playback.
 */
export function TitlesSwitch() {
  const [value, setValue] = usePersistentString(TITLES_KEY, TITLES_OFF);
  const on = titlesEnabled(value);

  const toggle = () => {
    const next = !on;
    setValue(next ? "1" : "0");
    setIcyProbing(next);
  };

  return (
    <div>
      <div className='flex items-center gap-3'>
        <div className='min-w-0 flex-1'>
          <p className='text-sm font-medium'>Show song titles</p>
          <p className='mt-0.5 text-xs text-muted-foreground'>
            Replace the subtitle with the live track — the StreamTitle where the station sends one, BBC data for BBC
            stations.
          </p>
        </div>
        <button
          type='button'
          role='switch'
          aria-checked={on}
          aria-label='Show live song titles in the player'
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
