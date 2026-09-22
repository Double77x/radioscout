import { useId, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { usePlayer } from "@/hooks/use-player";
import { usePersistentString } from "@/hooks/use-persistent-state";
import { useSleepCountdown } from "@/hooks/use-sleep-countdown";
import {
  normalizeSleepMinutes,
  SLEEP_DURATION_DEFAULT,
  SLEEP_DURATION_KEY,
  SLEEP_PRESETS_MINUTES,
} from "@/lib/radio/sleep";
import { cn } from "@/lib/utils";

/**
 * Sleep timer row for Settings → Audio: a switch to arm/cancel plus a
 * duration dropdown. Arming starts a wall-clock deadline in the player
 * module (and the service-side arm on the APK); firing fades out, pauses,
 * and flips the switch back off by itself — flip it on again to re-sleep.
 * Changing the dropdown while armed re-arms from now. The duration
 * persists; the deadline itself never does.
 */
export function SleepTimerPicker() {
  const { sleepEndsAt, setSleepTimer, cancelSleepTimer } = usePlayer();
  const [duration, setDuration] = usePersistentString(SLEEP_DURATION_KEY, SLEEP_DURATION_DEFAULT);
  const stored = normalizeSleepMinutes(duration);
  // Stored garbage collapses to 30 (never 0 — the dropdown needs a value).
  const minutes = stored === 0 ? 30 : stored;
  const countdown = useSleepCountdown();
  const armed = sleepEndsAt > 0;
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const toggle = () => {
    if (armed) cancelSleepTimer();
    else setSleepTimer(minutes);
  };

  const changeDuration = (value: string) => {
    const parsed = normalizeSleepMinutes(value);
    const next = parsed === 0 ? 30 : parsed;
    setDuration(String(next));
    setOpen(false);
    if (armed) setSleepTimer(next);
  };

  return (
    <div>
      <div className='flex items-center gap-3'>
        <div className='min-w-0 flex-1'>
          <p className='text-sm font-medium'>Sleep timer</p>
          <p className='mt-0.5 text-xs text-muted-foreground' aria-live='polite'>
            {countdown ? `Fades out in ${countdown}.` : "Fade out and pause after a while."}
          </p>
        </div>
        <button
          type='button'
          role='switch'
          aria-checked={armed}
          aria-label='Sleep timer'
          onClick={toggle}
          className={cn(
            "relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            armed ? "bg-primary" : "bg-muted",
          )}>
          <span
            aria-hidden='true'
            className={cn(
              "absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform",
              armed && "translate-x-5",
            )}
          />
        </button>
      </div>
      <div className='mt-2.5'>
        <button
          type='button'
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((prev) => !prev)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
          className='flex min-h-11 w-full items-center gap-2 rounded-full border border-border bg-card px-4 text-sm transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'>
          <span className='min-w-0 flex-1 truncate text-left font-medium'>After {minutes} min</span>
          <ChevronDown
            className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </button>
        {open ? (
          <div id={panelId} className='mt-2 animate-dropdown-in rounded-2xl border border-border bg-card p-2'>
            <fieldset className='m-0 min-w-0 border-0 p-0'>
              <legend className='sr-only'>Sleep after</legend>
              <div className='flex flex-col'>
                {SLEEP_PRESETS_MINUTES.map((option) => {
                  const active = option === minutes;
                  return (
                    <button
                      key={option}
                      type='button'
                      aria-pressed={active}
                      onClick={() => changeDuration(String(option))}
                      className={cn(
                        "flex min-h-11 items-center gap-2 rounded-xl px-3 text-left text-sm transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        active ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground",
                      )}>
                      <span className='min-w-0 flex-1'>
                        {option} min{option === 60 ? " (1 hour)" : ""}
                      </span>
                      {active ? <Check className='size-4 shrink-0' /> : null}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>
        ) : null}
      </div>
    </div>
  );
}
