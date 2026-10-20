import type { CSSProperties } from "react";

/** Gap between rows — must match the list `gap-2`. */
export const ROW_GAP = 8;

/** Pointer travel before a row press becomes a drag (clicks stay clicks). */
export const DRAG_THRESHOLD_PX = 8;

/** Hold-still delay before a touch press becomes a drag (shorter moves scroll). */
export const TOUCH_HOLD_MS = 400;

export interface DragState {
  id: string;
  fromIndex: number;
  startY: number;
  /** Uuid order at grab time. */
  ids: string[];
  /** Top of every row relative to the list, in grab-time display order. */
  tops: number[];
  /** Height of every row in grab-time display order. */
  heights: number[];
}

export interface PendingDrag {
  uuid: string;
  element: HTMLElement;
  pointerId: number;
  startX: number;
  startY: number;
  touch: boolean;
  timer: ReturnType<typeof globalThis.setTimeout> | null;
}

/**
 * Landing index for a pointer height against grab-time geometry (rows only
 * translate mid-drag, so tops stay valid): first row whose middle sits below
 * the pointer, falling past the end when below every row.
 */
export function overIndexFor(pointerY: number, listTop: number, state: DragState, count: number): number {
  const y = pointerY - listTop;
  let over = count;
  for (const [index, top] of state.tops.entries()) {
    const height = state.heights[index] ?? 0;
    if (index === state.fromIndex) continue;
    if (y < top + height / 2) {
      over = index > state.fromIndex ? index + 1 : index;
      break;
    }
  }
  return over;
}

/** Move one id within an order, clamping the landing gap into range. */
export function arrayMoveId(ids: string[], from: number, gap: number): string[] {
  const to = Math.max(0, Math.min(ids.length - (from < gap ? 1 : 0), gap - (from < gap ? 1 : 0)));
  const next = [...ids];
  const [item] = next.splice(from, 1);
  if (item === undefined) return ids;
  next.splice(to, 0, item);
  return next;
}

/** Top of one id inside an order, from grab-time measurements. */
export function topOfOrder(order: string[], id: string, state: DragState): number {
  const heightById = new Map(state.ids.map((rowId, index) => [rowId, state.heights[index] ?? 0] as const));
  let top = 0;
  for (const rowId of order) {
    if (rowId === id) return top;
    top += (heightById.get(rowId) ?? 0) + ROW_GAP;
  }
  return top;
}

export interface RowStyle {
  dragging: boolean;
  dragDy: number;
  settleDy: number | null;
  shift: number;
  /**
   * True for the two frames between drop-commit and glide start. Every row
   * lands frame-exact with transitions off: shifted siblings snap into their
   * new slots (their shift already equals the slot move, so snapping is
   * continuous) and the dragged row snaps to the release-exact offset. Then
   * `settle-done` clears the freeze and the dragged row alone glides home.
   * Without the freeze, each shifted sibling jumps a full row and glides
   * back — the "secondary slide" on every drop.
   */
  frozen: boolean;
}

/** Inline style per row state. Uses the independent `translate` property (not
 * `transform`) so drag motion never fights transforms. Dragged follows
 * instantly, shifts ease — except on the frozen commit frame, where every
 * row snaps transition-free. */
export function rowOuterStyle({ dragging, dragDy, settleDy, shift, frozen }: RowStyle): CSSProperties | undefined {
  if (dragging) {
    return {
      translate: `0 ${dragDy}px`,
      transitionProperty: "box-shadow",
      transitionDuration: "250ms",
      zIndex: 10,
      position: "relative",
    };
  }
  if (settleDy !== null) {
    // Frozen: exact release spot, lifted stacking kept so overlapped
    // siblings can't flash above mid-glide. Shadow already dropped at
    // commit (reads as landing contact).
    return {
      translate: `0 ${settleDy}px`,
      transitionProperty: "none",
      zIndex: 10,
      position: "relative",
    };
  }
  if (shift !== 0) return { translate: `0 ${shift}px` };
  if (frozen) return { transitionProperty: "none" };
  return undefined;
}

/**
 * Resolve a committed drop into the next order and the dragged row's settle
 * offset. Recomputes the landing index from the release coordinates because
 * the rAF-throttled visuals lag a fast flick.
 */
export function resolveDrop(
  state: DragState,
  releaseY: number | undefined,
  listTop: number | null,
  displayIds: readonly string[],
  over: number,
  dy: number,
): { order: string[]; settleDy: number } | null {
  const dropOver =
    releaseY === undefined || listTop === null ? over : overIndexFor(releaseY, listTop, state, displayIds.length);
  const dropDy = releaseY === undefined ? dy : releaseY - state.startY;
  const from = displayIds.indexOf(state.id);
  const originTop = from === -1 ? undefined : state.tops[from];
  if (from === -1 || originTop === undefined) return null;
  const order = arrayMoveId([...displayIds], from, dropOver);
  const newTop = topOfOrder(order, state.id, state);
  return { order, settleDy: originTop + dropDy - newTop };
}

/** Non-passive scroll lock while a touch drag is live (owned by AbortController). */
export function preventTouchScroll(event: TouchEvent): void {
  event.preventDefault();
}
