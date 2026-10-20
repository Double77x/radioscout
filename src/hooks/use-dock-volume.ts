import { useEffect, useRef, useState } from "react";

/** Seconds before the volume overlay retreats on its own. */
const VOLUME_AUTOHIDE_MS = 3000;

/**
 * One press or held repeat of the dock's volume keys — the same 1% the
 * focused range input takes, so an arrow means the same thing wherever it is
 * pressed.
 */
const VOLUME_KEY_STEP = 0.01;

/**
 * Overlay state for the dock's volume control: open flag, auto-hide timer,
 * the trigger and both panel refs, and the key-step nudge.
 *
 * `close` hands focus back to the trigger before a panel goes `inert`, where
 * dropping focus at the document root would lose a keyboard user. The
 * auto-hide path needs that most: it fires with no click to move focus.
 */
export function useDockVolume(volume: number, onVolume: (volume: number) => void) {
  const [open, setOpen] = useState(false);
  // Timeout ref (not state): the auto-hide timer is imperative by nature.
  const hideTimer = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const wideRef = useRef<HTMLDivElement | null>(null);
  const tallRef = useRef<HTMLDivElement | null>(null);

  /**
   * Both panels stay mounted (each is viewport-gated by CSS), so focus can
   * be in either — test them both rather than assuming the wide one is the
   * ref that got set.
   */
  const close = () => {
    const panels = [wideRef.current, tallRef.current];
    if (panels.some((panel) => panel?.contains(document.activeElement))) triggerRef.current?.focus();
    setOpen(false);
  };

  const poke = () => {
    if (hideTimer.current !== null) globalThis.clearTimeout(hideTimer.current);
    hideTimer.current = globalThis.setTimeout(() => {
      close();
    }, VOLUME_AUTOHIDE_MS);
  };

  const toggle = () => {
    if (open) {
      if (hideTimer.current !== null) globalThis.clearTimeout(hideTimer.current);
      close();
      return;
    }
    setOpen(true);
    poke();
  };

  const nudge = (direction: 1 | -1): void => {
    // Base on `volume`, not the muted level, so a press while muted restores
    // the level instead of stepping up from silence.
    const next = Math.min(1, Math.max(0, volume + direction * VOLUME_KEY_STEP));
    if (next !== volume) onVolume(next);
    setOpen(true);
    poke();
  };

  const scrub = (next: number): void => {
    onVolume(next);
    poke();
  };

  // Own the auto-hide handle: clear it on unmount so a staged close can
  // never fire into an unmounted dock. No declarative alternative.
  useEffect(() => {
    const timer = hideTimer;
    return () => {
      if (timer.current !== null) globalThis.clearTimeout(timer.current);
    };
  }, []);

  return { open, toggle, poke, nudge, scrub, triggerRef, wideRef, tallRef };
}
