import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** px per second: short overflows crawl, long ones never sprint. */
const TICKER_SPEED_PX_S = 28;
const MIN_DURATION_S = 6;
const MAX_DURATION_S = 30;
/** Matches the dock's own `lg:` boundary: compact layout, narrow text lane. */
const MOBILE_QUERY = "(max-width: 1023px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Event-driven media query with cleanup; zero per-frame cost. */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => globalThis.matchMedia?.(query)?.matches ?? false);
  useEffect(() => {
    const list = globalThis.matchMedia?.(query);
    if (!list) return undefined;
    const onChange = (): void => {
      setMatches(list.matches);
    };
    list.addEventListener("change", onChange);
    return () => {
      list.removeEventListener("change", onChange);
    };
  }, [query]);
  return matches;
}

interface TrackTickerProps {
  text: string;
  className?: string;
}

/**
 * Now-playing line that scrolls only on compact viewports and only when the
 * text overflows its box (measured with a ResizeObserver, not
 * breakpoint-guessed): static truncated text everywhere else. The loop is
 * seamless (-50% over two identical copies, the second aria-hidden so
 * screen readers hear the title once), pauses on hover/focus/press, and
 * stays fully static under prefers-reduced-motion.
 *
 * Remount per title (`key={text}` at the call site): a new title restarts
 * from x=0 and re-measures with no reset cascade.
 */
export function TrackTicker({ text, className }: TrackTickerProps) {
  const viewportRef = useRef<HTMLSpanElement | null>(null);
  const contentRef = useRef<HTMLSpanElement | null>(null);
  const [overflow, setOverflow] = useState(0);
  const compactViewport = useMediaQuery(MOBILE_QUERY);
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const scrolling = overflow > 0 && compactViewport && !reducedMotion;

  // Observer subscription with cleanup. No synchronous measure: the
  // observer fires once on observe, so state only ever updates from the
  // async callback. Disconnects while the marquee shows (nothing stable
  // to measure against); a text swap remounts via key and re-measures.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") return undefined;
    const update = (): void => {
      const content = contentRef.current;
      if (!content) return;
      const extra = content.scrollWidth - viewport.clientWidth;
      setOverflow(extra > 4 ? extra : 0);
    };
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    return () => {
      observer.disconnect();
    };
  }, []);

  if (!scrolling) {
    return (
      <span ref={viewportRef} className={cn("block overflow-hidden", className)}>
        <span ref={contentRef} className='block truncate'>
          {text}
        </span>
      </span>
    );
  }

  const duration = Math.min(MAX_DURATION_S, Math.max(MIN_DURATION_S, overflow / TICKER_SPEED_PX_S));
  return (
    <span
      ref={viewportRef}
      className={cn(
        "block overflow-hidden mask-[linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]",
        className,
      )}>
      <span
        className='animate-ticker inline-flex w-max hover:paused focus-visible:paused active:paused'
        style={{ animationDuration: `${duration}s` }}>
        <span className='whitespace-nowrap pr-8'>{text}</span>
        <span aria-hidden='true' className='whitespace-nowrap pr-8'>
          {text}
        </span>
      </span>
    </span>
  );
}
