import { useEffect, useReducer, useRef } from "react";
import { GripVertical } from "lucide-react";
import { StationCard } from "@/components/radio/StationCard";
import { StationListSkeleton } from "@/components/radio/StationSkeleton";
import { useIsClient } from "@/hooks/use-is-client";
import { togglePlay, usePlayer } from "@/hooks/use-player";
import { FAVOURITES_KEY, useFavourites, useToggleFavourite } from "@/hooks/use-radio";
import { useOpenStationDetail } from "@/hooks/use-station-detail";
import { queryClient } from "@/lib/query-client";
import {
  DRAG_THRESHOLD_PX,
  ROW_GAP,
  TOUCH_HOLD_MS,
  overIndexFor,
  preventTouchScroll,
  resolveDrop,
  rowOuterStyle,
  type DragState,
  type PendingDrag,
} from "@/lib/radio/drag-reorder";
import { cn } from "@/lib/utils";

/** Rendered drag visuals: lifted row, gap, optimistic order, settle-back. */
interface DragVisualState {
  id: string | null;
  overIndex: number | null;
  dy: number;
  gap: number;
  orderOverride: string[] | null;
  settle: { id: string; dy: number } | null;
}

const INITIAL_DRAG_VISUAL: DragVisualState = {
  id: null,
  overIndex: null,
  dy: 0,
  gap: 0,
  orderOverride: null,
  settle: null,
};

type DragVisualAction =
  | { type: "activate"; id: string; gap: number; index: number }
  | { type: "move"; dy: number; over: number | null }
  | { type: "commit"; order: string[]; settle: { id: string; dy: number } }
  | { type: "settle-done" }
  | { type: "reset" };

/**
 * One reducer for the six visual states above (react-doctor
 * prefer-useReducer: they always change together on grab / move / drop).
 * Handler-owned mirrors (overRef/dyRef) stay refs: listeners close over
 * renders and must read current values without re-subscribing.
 */
function dragVisualReducer(state: DragVisualState, action: DragVisualAction): DragVisualState {
  switch (action.type) {
    case "activate": {
      return { ...state, id: action.id, gap: action.gap, overIndex: action.index, dy: 0, settle: null };
    }
    case "move": {
      return state.dy === action.dy && state.overIndex === action.over
        ? state
        : { ...state, dy: action.dy, overIndex: action.over };
    }
    case "commit": {
      return {
        ...state,
        id: null,
        overIndex: null,
        dy: 0,
        orderOverride: action.order,
        settle: action.settle,
      };
    }
    case "settle-done": {
      return state.settle === null ? state : { ...state, settle: null };
    }
    case "reset": {
      return state.id === null && state.overIndex === null && state.dy === 0
        ? state
        : { ...state, id: null, overIndex: null, dy: 0 };
    }
    default: {
      return state;
    }
  }
}

/** Persist a committed uuid order, then refresh the list (no-op on failure). */
function persistOrder(uuids: string[]): void {
  void import("@/lib/radio/store")
    .then((store) => store.reorderFavourites(uuids))
    .then(() => queryClient.invalidateQueries({ queryKey: FAVOURITES_KEY }))
    // The service loop mirrors Saved order — push the new order so car
    // skips follow the drag, not the pre-drag sequence. Best-effort: the
    // next play rebuilds the loop regardless.
    .then(() => {
      void import("@/hooks/use-player").then((player) => {
        player.syncNativePlaylist();
      });
    })
    .catch(() => {});
}

/**
 * Saved stations as standard rows with pointer-based drag reorder.
 * One code path for mouse and touch (Pointer Events + a `touch-none`
 * handle, so the list itself still scrolls normally). The dragged row
 * lifts (shadow, translate follows the pointer instantly) while
 * settled rows slide aside with CSS transitions; on drop the committed
 * order lands frozen frame-exact, then the dragged row alone glides home.
 */
export function SavedStations() {
  const { data: favourites, isFetching } = useFavourites();
  const toggleFavourite = useToggleFavourite();
  const player = usePlayer();
  const isClient = useIsClient();
  const openDetail = useOpenStationDetail();

  const [visual, dispatch] = useReducer(dragVisualReducer, INITIAL_DRAG_VISUAL);
  const { id: dragId, overIndex, dy: dragDy, gap: dragGap, orderOverride, settle } = visual;

  const listRef = useRef<HTMLUListElement | null>(null);
  const dragState = useRef<DragState | null>(null);
  const pendingRef = useRef<PendingDrag | null>(null);
  const suppressClickRef = useRef(false);
  const dragAbort = useRef<AbortController | null>(null);
  const rafId = useRef(0);
  const settleRaf = useRef(0);
  // Handler-written mirror of overIndex: the pointerup listener closes over
  // the beginDrag render, so render state would commit stale.
  const overRef = useRef<number | null>(null);
  const dyRef = useRef(0);

  // Unmount mid-drag aborts the gesture listeners (they own no state).
  useEffect(() => {
    const abort = dragAbort;
    const frame = rafId;
    const settleFrame = settleRaf;
    const pending = pendingRef;
    return () => {
      abort.current?.abort();
      if (pending.current?.timer) globalThis.clearTimeout(pending.current.timer);
      pending.current = null;
      if (frame.current !== 0) globalThis.cancelAnimationFrame(frame.current);
      if (settleFrame.current !== 0) globalThis.cancelAnimationFrame(settleFrame.current);
    };
  }, []);

  const rowsById = new Map(favourites.map((row) => [row.stationuuid, row]));
  const liveIds = favourites.map((row) => row.stationuuid);
  // The override converges on its own: once the refetch lands with the
  // committed order, it matches live data and drops out — derived in
  // render, never synced with an effect.
  const overrideActive =
    orderOverride !== null &&
    (orderOverride.length !== liveIds.length || orderOverride.some((id, index) => id !== liveIds[index]));
  const displayIds = overrideActive && orderOverride ? orderOverride : liveIds;
  const rows = displayIds.flatMap((id) => {
    const row = rowsById.get(id);
    return row ? [row] : [];
  });

  const teardownPending = () => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending?.timer !== null && pending?.timer !== undefined) globalThis.clearTimeout(pending.timer);
    dragAbort.current?.abort();
    dragAbort.current = null;
  };

  const stopDrag = (commit: boolean, releaseY?: number) => {
    const state = dragState.current;
    const over = overRef.current;
    dragState.current = null;
    overRef.current = null;
    dragAbort.current?.abort();
    dragAbort.current = null;
    if (rafId.current !== 0) {
      globalThis.cancelAnimationFrame(rafId.current);
      rafId.current = 0;
    }
    if (commit && state && over !== null) {
      // Fast flicks outrun the rAF-throttled visuals: overRef/dyRef lag a
      // frame behind the finger, so settling from them jumps the row (up on
      // a fast downward drop) before it glides home. Recompute both from the
      // release coordinates — one consistent pair, no jump.
      const drop = resolveDrop(
        state,
        releaseY,
        listRef.current?.getBoundingClientRect().top ?? null,
        displayIds,
        over,
        dyRef.current,
      );
      if (drop) {
        // Settle animation: the dragged row keeps a transform from its
        // release point to its committed home, then relaxes to none.
        dispatch({ type: "commit", order: drop.order, settle: { id: state.id, dy: drop.settleDy } });
        if (settleRaf.current !== 0) globalThis.cancelAnimationFrame(settleRaf.current);
        settleRaf.current = globalThis.requestAnimationFrame(() => {
          globalThis.requestAnimationFrame(() => {
            settleRaf.current = 0;
            dispatch({ type: "settle-done" });
          });
        });
        persistOrder(drop.order);
        // A real drag just ended: swallow the click landing on the row so a
        // drop over a button can't trigger it. Plain taps never set this.
        suppressClickRef.current = true;
      }
    }
    dispatch({ type: "reset" });
    dyRef.current = 0;
  };

  /** Promote an armed press into a live drag (shared by grip + row paths). */
  const activateDrag = (pending: PendingDrag) => {
    pendingRef.current = null;
    const list = listRef.current;
    if (!list) return;
    const elements = [...list.querySelectorAll<HTMLElement>("li[data-uuid]")];
    const listTop = list.getBoundingClientRect().top;
    const tops = elements.map((element) => element.getBoundingClientRect().top - listTop);
    const heights = elements.map((element) => element.getBoundingClientRect().height);
    const fromIndex = displayIds.indexOf(pending.uuid);
    if (fromIndex === -1) return;
    dragState.current = {
      id: pending.uuid,
      fromIndex,
      startY: pending.startY,
      ids: [...displayIds],
      tops,
      heights,
    };
    pending.element.setPointerCapture?.(pending.pointerId);
    if (pending.touch) {
      // Lock page scroll for the gesture; dies with the gesture controller.
      document.addEventListener("touchmove", preventTouchScroll, {
        passive: false,
        signal: dragAbort.current?.signal,
      });
      globalThis.navigator?.vibrate?.(10);
    }
    dispatch({ type: "activate", id: pending.uuid, gap: (heights[fromIndex] ?? 0) + ROW_GAP, index: fromIndex });
    overRef.current = fromIndex;
    dyRef.current = 0;
  };

  /**
   * Arm a drag from a grip press (immediate) or anywhere on the row
   * (threshold-gated so taps, button clicks and touch scrolls pass
   * through untouched).
   */
  const beginDrag = (event: React.PointerEvent<HTMLElement>, uuid: string, immediate: boolean) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const list = listRef.current;
    const item = event.currentTarget.closest("li");
    if (!list || !item) return;
    const target = event.target;
    if (!immediate && target instanceof Element && target.closest("button, a, input, textarea, select")) return;
    if (immediate) event.preventDefault();

    const controller = new AbortController();
    dragAbort.current?.abort();
    dragAbort.current = controller;
    const { signal } = controller;
    const touch = event.pointerType === "touch";

    if (immediate) {
      activateDrag({
        uuid,
        element: event.currentTarget,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        touch,
        timer: null,
      });
    } else {
      const pending: PendingDrag = {
        uuid,
        element: event.currentTarget,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        touch,
        timer: null,
      };
      // Touch holds still to drag (shorter moves scroll natively); mouse
      // arms on travel distance in the move handler below.
      if (touch) {
        pending.timer = globalThis.setTimeout(() => {
          pending.timer = null;
          if (pendingRef.current === pending) activateDrag(pending);
        }, TOUCH_HOLD_MS);
      }
      pendingRef.current = pending;
    }

    globalThis.addEventListener(
      "pointermove",
      (moveEvent: PointerEvent) => {
        const state = dragState.current;
        if (!state) {
          // Armed but not live: resolve tap vs scroll vs drag.
          const pending = pendingRef.current;
          if (!pending) return;
          const travelled = Math.hypot(moveEvent.clientX - pending.startX, moveEvent.clientY - pending.startY);
          if (travelled <= DRAG_THRESHOLD_PX) return;
          if (pending.touch) {
            // Real travel is a scroll — stand down, browser takes over.
            teardownPending();
          } else {
            activateDrag(pending);
          }
          return;
        }
        const pointerY = moveEvent.clientY;
        // Commit position computes synchronously on every event — the drop
        // must never depend on frame budget (loaded devices starve rAF).
        overRef.current = overIndexFor(pointerY, list.getBoundingClientRect().top, state, displayIds.length);
        // Visuals alone ride rAF (one setState per frame max).
        if (rafId.current !== 0) return;
        rafId.current = globalThis.requestAnimationFrame(() => {
          rafId.current = 0;
          const active = dragState.current;
          if (!active) return;
          const dy = pointerY - active.startY;
          dyRef.current = dy;
          dispatch({ type: "move", dy, over: overRef.current });
        });
      },
      { signal },
    );
    globalThis.addEventListener(
      "pointerup",
      (upEvent: PointerEvent) => {
        if (dragState.current) stopDrag(true, upEvent.clientY);
        else teardownPending();
      },
      { signal },
    );
    globalThis.addEventListener(
      "pointercancel",
      () => {
        if (dragState.current) stopDrag(false);
        else teardownPending();
      },
      { signal },
    );
  };

  const onListClickCapture = (event: React.SyntheticEvent) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  // Local store resolves after first paint. Prerender with the skeleton (the
  // store never runs on the server, so the empty state would mismatch
  // hydration and flash over real rows); the empty state appears only once
  // the client fetch actually resolves with zero rows. Non-empty lists keep
  // rendering through background refetches.
  if (favourites.length === 0) {
    if (!isClient || isFetching) return <StationListSkeleton rows={3} />;
    return (
      <div className='flex flex-col items-center rounded-scout-card border border-dashed border-border bg-card px-6 py-10 text-center'>
        <p className='font-semibold'>No favourites yet</p>
        <p className='mt-1 text-sm text-muted-foreground'>Tap the star on any station to keep it here.</p>
      </div>
    );
  }

  const fromIndex = dragId ? displayIds.indexOf(dragId) : -1;
  // Gap the dragged row leaves behind, so settled rows slide around it.
  const gap = dragId ? dragGap : 0;

  return (
    <ul ref={listRef} onClickCapture={onListClickCapture} className='flex flex-col gap-2'>
      {rows.map((row, index) => {
        const dragging = dragId === row.stationuuid;
        const settling = settle?.id === row.stationuuid ? settle.dy : null;
        let shift = 0;
        if (!dragging && overIndex !== null && fromIndex !== -1) {
          if (fromIndex < overIndex && index > fromIndex && index < overIndex) shift = -gap;
          else if (fromIndex > overIndex && index >= overIndex && index < fromIndex) shift = gap;
        }
        return (
          <StationCard
            key={row.stationuuid}
            station={row.snapshot}
            playing={player.station?.stationuuid === row.stationuuid && player.status === "playing"}
            favourited
            onPlay={togglePlay}
            onToggleFavourite={(item) => {
              toggleFavourite.mutate(item);
            }}
            onOpenDetail={openDetail}
            animate={false}
            dataUuid={row.stationuuid}
            onRowPointerDown={(event, uuid) => {
              beginDrag(event, uuid, false);
            }}
            outerStyle={rowOuterStyle({ dragging, dragDy, settleDy: settling, shift, frozen: settle !== null })}
            outerClassName={cn(
              "cursor-grab transition-transform duration-200 active:cursor-grabbing",
              dragging && "shadow-xl",
            )}
            dragHandle={
              <button
                type='button'
                aria-label={`Reorder ${row.snapshot.name}`}
                onPointerDown={(event) => {
                  beginDrag(event, row.stationuuid, true);
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                }}
                className='grid h-11 w-7 shrink-0 cursor-grab touch-none place-items-center rounded-full text-muted-foreground transition active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'>
                <GripVertical className='size-4' />
              </button>
            }
          />
        );
      })}
    </ul>
  );
}
