import { useEffect, useRef, type ReactNode, type TouchEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import { commitBack, registerBackAnimator } from "@/lib/animated-back";

const EDGE_PX = 32;
const ACTIVATION_PX = 10;
const COMMIT_FRACTION = 0.32;
const MIN_FLICK_PX = 64;
const FLICK_VELOCITY_PX_MS = 0.45;
const FLY_OUT_MS = 200;
const SNAP_BACK_MS = 160;

interface Track {
  startX: number;
  startY: number;
  startT: number;
  live: boolean;
}

function canGoBack(): boolean {
  return globalThis.history.length > 1;
}

/**
 * True when the gesture belongs to inner UI, not the page: open dialogs and
 * sheets, form fields, or a carousel/chip row that can still scroll right.
 */
function gestureBlocked(target: EventTarget | null, root: HTMLElement | null): boolean {
  const el = target instanceof HTMLElement ? target : null;
  if (!el) return true;
  if (el.closest('[role="dialog"], [data-state="open"], input, textarea, select, [contenteditable="true"]')) {
    return true;
  }
  let node: HTMLElement | null = el;
  while (node && node !== root) {
    if (node.scrollWidth > node.clientWidth + 4 && node.scrollLeft > 0) return true;
    node = node.parentElement;
  }
  return false;
}

function setX(frame: HTMLElement, px: number, ms: number): void {
  frame.style.transition = ms === 0 ? "none" : `transform ${ms}ms ease-out`;
  frame.style.transform = px === 0 ? "" : `translateX(${px}px)`;
}

function frameWidth(frame: HTMLElement): number {
  return frame.clientWidth || globalThis.innerWidth;
}

/**
 * Interactive swipe-to-go-back. An edge swipe drags the whole pane with the
 * finger; releasing past a third of the width (or a fast flick) flies the
 * pane off and commits `history.back()`, otherwise it snaps back.
 * Touch-gated, so desktop and mouse input are unaffected.
 */
export function SwipeBack({ children }: { children: ReactNode }) {
  const router = useRouter();
  const frameRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<Track | null>(null);
  const busyRef = useRef(false);

  const flyOut = (commit: () => void) => {
    const frame = frameRef.current;
    if (!frame || busyRef.current) {
      commitBack(commit);
      return;
    }
    busyRef.current = true;
    setX(frame, frameWidth(frame) + 8, FLY_OUT_MS);
    globalThis.setTimeout(() => {
      commitBack(commit);
      setX(frame, 0, 0);
      busyRef.current = false;
    }, FLY_OUT_MS + 40);
  };

  // System/hardware back reuses the same fly-out (see animated-back.ts).
  useEffect(
    () =>
      registerBackAnimator((commit) => {
        if (!canGoBack()) {
          commitBack(commit);
          return;
        }
        flyOut(commit);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    trackRef.current = null;
    if (busyRef.current || event.touches.length !== 1 || !canGoBack()) return;
    const touch = event.touches[0];
    if (touch.clientX > EDGE_PX) return;
    if (gestureBlocked(event.target, frameRef.current)) return;
    trackRef.current = { startX: touch.clientX, startY: touch.clientY, startT: performance.now(), live: false };
  };

  const onTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    const frame = frameRef.current;
    if (!track || !frame || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const dx = touch.clientX - track.startX;
    const dy = touch.clientY - track.startY;
    if (!track.live) {
      if (Math.abs(dy) > Math.abs(dx) * 1.3 || dx < 0) {
        trackRef.current = null;
        return;
      }
      if (dx < ACTIVATION_PX) return;
      track.live = true;
    }
    setX(frame, Math.min(Math.max(dx, 0), frameWidth(frame)), 0);
  };

  const endTouch = (event: TouchEvent<HTMLDivElement>, cancelled: boolean) => {
    const track = trackRef.current;
    const frame = frameRef.current;
    trackRef.current = null;
    if (!track?.live || !frame) return;
    const touch = event.changedTouches[0];
    const dx = Math.max(0, touch.clientX - track.startX);
    const dt = Math.max(1, performance.now() - track.startT);
    const width = frameWidth(frame);
    const flick = dx > MIN_FLICK_PX && dx / dt > FLICK_VELOCITY_PX_MS;
    if (!cancelled && (dx > width * COMMIT_FRACTION || flick)) {
      flyOut(() => router.history.back());
    } else {
      setX(frame, 0, SNAP_BACK_MS);
    }
  };

  return (
    <div
      ref={frameRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={(event) => endTouch(event, false)}
      onTouchCancel={(event) => endTouch(event, true)}
      style={{ touchAction: "pan-y" }}
      className='flex min-h-full flex-1 flex-col overflow-x-clip'>
      {children}
    </div>
  );
}
