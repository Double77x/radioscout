import { useRef, type PointerEvent as ReactPointerEvent, type SyntheticEvent } from "react";

/**
 * Mouse drag-to-scroll for horizontal chip rails (touch keeps native
 * momentum scrolling). Refs only, no effects: the returned handlers own the
 * whole gesture, including swallowing the click that lands a real drag
 * (capture runs before the chip link sees it).
 */
export function useDragScroll<T extends HTMLElement>(): {
  ref: React.RefObject<T | null>;
  handlers: {
    onPointerDown: (event: ReactPointerEvent<T>) => void;
    onPointerMove: (event: ReactPointerEvent<T>) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
    onClickCapture: (event: SyntheticEvent) => void;
  };
} {
  const ref = useRef<T | null>(null);
  const drag = useRef<{ startX: number; startScroll: number } | null>(null);
  const moved = useRef(false);

  const onPointerDown = (event: ReactPointerEvent<T>) => {
    if (event.pointerType === "touch" || (event.pointerType === "mouse" && event.button !== 0)) return;
    const el = ref.current;
    if (!el) return;
    drag.current = { startX: event.clientX, startScroll: el.scrollLeft };
    moved.current = false;
  };

  const onPointerMove = (event: ReactPointerEvent<T>) => {
    const current = drag.current;
    const el = ref.current;
    if (!current || !el) return;
    const dx = event.clientX - current.startX;
    if (!moved.current && Math.abs(dx) > 6) {
      // A real drag: capture so the trailing click lands on the rail
      // (where the capture-click guard swallows it) instead of a chip.
      moved.current = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    if (moved.current) el.scrollLeft = current.startScroll - dx;
  };

  const endDrag = () => {
    drag.current = null;
  };

  const onClickCapture = (event: SyntheticEvent) => {
    if (!moved.current) return;
    moved.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  return {
    ref,
    handlers: { onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag, onClickCapture },
  };
}
