import { useEffect, useState } from "react";
import { usePlayer } from "@/hooks/use-player";
import { formatSleepCountdown } from "@/lib/radio/sleep";

/** Countdown refresh cadence (minute precision needs nothing faster). */
const COUNTDOWN_TICK_MS = 20_000;

/**
 * Live sleep-timer countdown label (`"45m"`), null when off. Ticks lazily —
 * the label only changes by the minute, so this never re-renders the dock
 * every second. Timer handle is owned with cleanup (no declarative clock).
 */
export function useSleepCountdown(): string | null {
  const { sleepEndsAt } = usePlayer();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (sleepEndsAt <= 0) return;
    const timer = globalThis.setInterval(() => setNow(Date.now()), COUNTDOWN_TICK_MS);
    return () => globalThis.clearInterval(timer);
  }, [sleepEndsAt]);

  return formatSleepCountdown(sleepEndsAt, now);
}
