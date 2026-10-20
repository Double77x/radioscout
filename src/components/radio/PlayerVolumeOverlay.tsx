import { useRef, type RefObject } from "react";
import { Volume1, Volume2, VolumeX, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PlayerVolumeOverlayProps {
  open: boolean;
  /** Muted level (0 while muted). */
  level: number;
  muted: boolean;
  wideRef: RefObject<HTMLDivElement | null>;
  tallRef: RefObject<HTMLDivElement | null>;
  onScrub: (volume: number) => void;
  onToggleMute: () => void;
  onClose: () => void;
}

/** Keyboard step for the vertical volume slider (its own focused control). */
const VOLUME_SLIDER_STEP = 0.05;

/**
 * Vertical volume slider for touch layouts (the dock overlay on small
 * screens). Native rotated range inputs render inconsistently across
 * mobile browsers, so this is pointer-driven with full keyboard support:
 * arrows nudge, Home/End jump, and it carries the slider role itself.
 */
function VolumeSlider({
  level,
  interactive,
  onScrub,
}: {
  level: number;
  interactive: boolean;
  onScrub: (volume: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragId = useRef<number | null>(null);

  const scrubTo = (clientY: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    if (rect.height <= 0) return;
    const ratio = 1 - (clientY - rect.top) / rect.height;
    onScrub(Math.min(1, Math.max(0, ratio)));
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragId.current = event.pointerId;
    scrubTo(event.clientY);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragId.current !== event.pointerId) return;
    scrubTo(event.clientY);
  };
  const endScrub = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragId.current !== event.pointerId) return;
    dragId.current = null;
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === "ArrowUp" || event.key === "ArrowRight"
        ? VOLUME_SLIDER_STEP
        : event.key === "ArrowDown" || event.key === "ArrowLeft"
          ? -VOLUME_SLIDER_STEP
          : event.key === "PageUp"
            ? VOLUME_SLIDER_STEP * 2
            : event.key === "PageDown"
              ? -VOLUME_SLIDER_STEP * 2
              : null;
    if (step !== null) {
      event.preventDefault();
      onScrub(Math.min(1, Math.max(0, level + step)));
    } else if (event.key === "Home") {
      event.preventDefault();
      onScrub(0);
    } else if (event.key === "End") {
      event.preventDefault();
      onScrub(1);
    }
  };

  const percent = Math.round(level * 100);
  return (
    <div
      role='slider'
      tabIndex={interactive ? 0 : -1}
      aria-label='Volume'
      aria-orientation='vertical'
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={`${percent} percent`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endScrub}
      onPointerCancel={endScrub}
      onKeyDown={onKeyDown}
      className='relative grid h-44 w-12 cursor-pointer touch-none place-items-center rounded-2xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'>
      <div ref={trackRef} aria-hidden='true' className='relative h-full w-2 overflow-hidden rounded-full bg-muted'>
        <div className='absolute inset-x-0 bottom-0 rounded-full bg-foreground' style={{ height: `${percent}%` }} />
      </div>
      <span
        aria-hidden='true'
        style={{ bottom: `calc(${percent}% - 14px)` }}
        className='pointer-events-none absolute left-1/2 size-7 -translate-x-1/2 rounded-full bg-foreground shadow-lg'
      />
    </div>
  );
}

/**
 * Volume panels over the dock. The wide one slides across the station name;
 * the tall one pops above the dock on touch layouts. Both stay mounted so
 * their transitions run and both refs stay stable for focus return; `inert`
 * and `tabIndex` gate the hidden one.
 */
export function PlayerVolumeOverlay({
  open,
  level,
  muted,
  wideRef,
  tallRef,
  onScrub,
  onToggleMute,
  onClose,
}: PlayerVolumeOverlayProps) {
  const VolumeIcon = level === 0 ? VolumeX : level < 0.5 ? Volume1 : Volume2;
  return (
    <>
      <div
        ref={wideRef}
        inert={!open}
        className={cn(
          "absolute inset-y-0 right-30 left-0 hidden items-center gap-2 rounded-full border border-border bg-card/95 p-2 pr-3 backdrop-blur-xl transition-[clip-path] duration-300 ease-out lg:flex",
          open ? "[clip-path:inset(0)]" : "pointer-events-none [clip-path:inset(0_0_0_100%)]",
        )}>
        <button
          type='button'
          aria-label={muted ? "Unmute" : "Mute"}
          aria-pressed={muted}
          tabIndex={open ? 0 : -1}
          onClick={onToggleMute}
          className='grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'>
          <VolumeIcon className='size-5' fill='currentColor' />
        </button>
        <label htmlFor='dock-volume' className='sr-only'>
          Volume
        </label>
        <input
          id='dock-volume'
          type='range'
          min={0}
          max={100}
          step={1}
          value={Math.round(level * 100)}
          onChange={(event) => {
            onScrub(Number(event.target.value) / 100);
          }}
          tabIndex={open ? 0 : -1}
          className='volume-slider h-11 w-full cursor-pointer'
        />
        <span
          aria-hidden='true'
          className='w-10 shrink-0 text-right text-sm font-semibold text-muted-foreground tabular-nums'>
          {Math.round(level * 100)}
        </span>
        <button
          type='button'
          aria-label='Close volume'
          tabIndex={open ? 0 : -1}
          onClick={onClose}
          className='grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'>
          <X className='size-5' />
        </button>
      </div>
      <div
        ref={tallRef}
        inert={!open}
        className={cn(
          "absolute right-2 bottom-full mb-3 flex origin-bottom flex-col items-center gap-2 rounded-3xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur-xl transition-all duration-200 lg:hidden",
          open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0",
        )}>
        <button
          type='button'
          aria-label='Close volume'
          tabIndex={open ? 0 : -1}
          onClick={onClose}
          className='grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'>
          <X className='size-4' />
        </button>
        <VolumeSlider level={level} interactive={open} onScrub={onScrub} />
        <span aria-hidden='true' className='text-sm font-semibold text-muted-foreground tabular-nums'>
          {Math.round(level * 100)}
        </span>
        <button
          type='button'
          aria-label={muted ? "Unmute" : "Mute"}
          aria-pressed={muted}
          tabIndex={open ? 0 : -1}
          onClick={onToggleMute}
          className='grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'>
          <VolumeIcon className='size-5' fill='currentColor' />
        </button>
      </div>
    </>
  );
}
