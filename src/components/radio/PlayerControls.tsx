import type { RefObject } from "react";
import { LoaderCircle, Pause, Play, Square, Volume1, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Station } from "@/lib/radio/types";

export interface PlayerControlsProps {
  station: Station;
  playing: boolean;
  busy: boolean;
  muted: boolean;
  /** Muted level (0 while muted), so the icon matches the audible volume. */
  level: number;
  volumeOpen: boolean;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onToggleVolume: () => void;
  onMute: () => void;
  onPlayPause: () => void;
  onStop: () => void;
}

/**
 * The dock's tuned-state controls: volume trigger (overlay + double-click
 * mute), play/pause, stop.
 */
export function PlayerControls({
  station,
  playing,
  busy,
  muted,
  level,
  volumeOpen,
  triggerRef,
  onToggleVolume,
  onMute,
  onPlayPause,
  onStop,
}: PlayerControlsProps) {
  const VolumeIcon = level === 0 ? VolumeX : level < 0.5 ? Volume1 : Volume2;
  return (
    <>
      <button
        type='button'
        ref={triggerRef}
        aria-label={muted ? "Unmute" : "Volume"}
        aria-expanded={volumeOpen}
        aria-keyshortcuts='ArrowLeft ArrowRight'
        title='Volume (← / →)'
        onClick={onToggleVolume}
        onDoubleClick={onMute}
        className={cn(
          "grid size-12 shrink-0 place-items-center rounded-full transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          volumeOpen ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}>
        <VolumeIcon className='size-5' fill='currentColor' />
      </button>
      <button
        type='button'
        data-testid='player-toggle'
        aria-label={playing ? `Pause ${station.name}` : `Play ${station.name}`}
        aria-keyshortcuts='k'
        title={playing ? "Pause (K)" : "Play (K)"}
        onClick={onPlayPause}
        disabled={busy && !playing}
        className='grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60'>
        {busy ? (
          <LoaderCircle className='size-5 animate-spin' />
        ) : playing ? (
          <Pause className='size-5 animate-scout-pop' fill='currentColor' />
        ) : (
          <Play className='size-5 translate-x-px animate-scout-pop' fill='currentColor' />
        )}
      </button>
      <button
        type='button'
        aria-label='Stop playback'
        onClick={onStop}
        className='grid size-12 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'>
        <Square className='size-5' fill='currentColor' />
      </button>
    </>
  );
}
