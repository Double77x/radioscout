import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { LoaderCircle, Pause, Play, Radio, Square, Volume1, Volume2, VolumeX, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { StationArt } from "@/components/radio/StationArt";
import { focusRadioSearch } from "@/lib/focus-radio-search";
import { usePlayer } from "@/hooks/use-player";
import { openStationDetail } from "@/hooks/use-station-detail";
import { formatCountryName, formatTags } from "@/lib/radio/format";

/** Seconds before the volume overlay retreats on its own. */
const VOLUME_AUTOHIDE_MS = 3000;

/**
 * Bottom dock: the app's player bar. Volume slides left over the station
 * name as an overlay (the dock never changes height) and retreats after
 * a few idle seconds.
 */
export function PlayerDock() {
  const { station, status, error, volume, muted, toggle, stop, play, setVolume, toggleMute } = usePlayer();
  const [volumeOpen, setVolumeOpen] = useState(false);
  // Timeout ref (not state): the auto-hide timer is imperative by nature —
  // no declarative alternative, and cleanup owns the handle.
  const hideTimer = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);

  const busy = status === "loading";
  const playing = status === "playing";
  const level = muted ? 0 : volume;
  const VolumeIcon = level === 0 ? VolumeX : level < 0.5 ? Volume1 : Volume2;
  const overlayOpen = volumeOpen && station !== null;
  const location = useLocation();
  const navigate = useNavigate();

  const browse = () => {
    // Already home: drop the cursor straight into search. Coming from
    // elsewhere: go home first, then focus once the header mounts.
    if (location.pathname !== "/") {
      navigate({ to: "/" });
      globalThis.setTimeout(focusRadioSearch, 100);
      return;
    }
    focusRadioSearch();
  };

  const pokeAutohide = () => {
    if (hideTimer.current !== null) globalThis.clearTimeout(hideTimer.current);
    hideTimer.current = globalThis.setTimeout(() => setVolumeOpen(false), VOLUME_AUTOHIDE_MS);
  };

  const toggleVolume = () => {
    setVolumeOpen((prev) => {
      if (!prev) pokeAutohide();
      else if (hideTimer.current !== null) globalThis.clearTimeout(hideTimer.current);
      return !prev;
    });
  };

  // Own the auto-hide handle: clear it on unmount so a staged close can
  // never fire into an unmounted dock. No declarative alternative.
  useEffect(() => {
    const timer = hideTimer;
    return () => {
      if (timer.current !== null) globalThis.clearTimeout(timer.current);
    };
  }, []);

  return (
    <section aria-label='Player' className='sticky bottom-0 z-40 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]'>
      <div className='rounded-full border border-border bg-card p-2 shadow-lg shadow-black/5 backdrop-blur-xl'>
        <div className='relative flex items-center gap-2'>
          {station ? (
            <button
              type='button'
              aria-label={`Details for ${station.name}`}
              onClick={() => openStationDetail(station)}
              className='shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'>
              <StationArt
                key={station.favicon || station.stationuuid}
                src={station.favicon}
                className='size-12 rounded-full'
                iconClassName='size-5'
              />
            </button>
          ) : (
            <span
              aria-hidden='true'
              className='grid size-12 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground'>
              <Radio className='size-5' />
            </span>
          )}

          {station ? (
            <button
              type='button'
              aria-label={`Details for ${station.name}`}
              onClick={() => openStationDetail(station)}
              className='min-w-0 flex-1 pl-1 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
              aria-live='polite'>
              <span className='flex items-center gap-1.5'>
                {playing ? (
                  <span className='relative flex size-2 shrink-0' aria-hidden='true'>
                    <span className='absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60' />
                    <span className='relative inline-flex size-2 rounded-full bg-primary' />
                  </span>
                ) : null}
                <span className='block truncate text-sm font-semibold'>{station.name}</span>
              </span>
              <span className='block truncate text-xs text-muted-foreground'>
                {busy
                  ? "Tuning in…"
                  : playing
                    ? formatTags(station.tags) || formatCountryName(station.country, station.countrycode) || "Live"
                    : (error ?? "Paused")}
              </span>
            </button>
          ) : (
            <span className='min-w-0 flex-1 pl-1' aria-live='polite'>
              <span className='block truncate text-sm font-semibold'>Nothing playing</span>
              <span className='block truncate text-xs text-muted-foreground'>Pick a station</span>
            </span>
          )}

          {station ? (
            <>
              <button
                type='button'
                aria-label={muted ? "Unmute" : "Volume"}
                aria-expanded={volumeOpen}
                onClick={toggleVolume}
                onDoubleClick={toggleMute}
                className={cn(
                  "grid size-12 shrink-0 place-items-center rounded-full transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  volumeOpen
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}>
                <VolumeIcon className='size-5' fill='currentColor' />
              </button>
              <button
                type='button'
                aria-label={playing ? `Pause ${station.name}` : `Play ${station.name}`}
                onClick={() => {
                  if (!playing && !busy) play(station);
                  else toggle();
                }}
                disabled={busy && !playing}
                className='grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60'>
                {busy ? (
                  <LoaderCircle className='size-5 animate-spin' />
                ) : playing ? (
                  <Pause className='size-5' fill='currentColor' />
                ) : (
                  <Play className='size-5 translate-x-px' fill='currentColor' />
                )}
              </button>
              <button
                type='button'
                aria-label='Stop playback'
                onClick={stop}
                className='grid size-12 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'>
                <Square className='size-5' fill='currentColor' />
              </button>
            </>
          ) : (
            <button
              type='button'
              onClick={browse}
              className='grid h-12 shrink-0 place-items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'>
              Browse
            </button>
          )}
        </div>

        {station ? (
          <div
            inert={!overlayOpen}
            aria-hidden={!overlayOpen}
            className={cn(
              "absolute inset-y-0 right-30 left-0 flex items-center gap-2 rounded-full border border-border bg-card/95 p-2 pr-3 backdrop-blur-xl transition-[clip-path] duration-300 ease-out",
              overlayOpen ? "[clip-path:inset(0)]" : "pointer-events-none [clip-path:inset(0_0_0_100%)]",
            )}>
            <button
              type='button'
              aria-label={muted ? "Unmute" : "Mute"}
              aria-pressed={muted}
              tabIndex={overlayOpen ? 0 : -1}
              onClick={() => {
                toggleMute();
                pokeAutohide();
              }}
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
                setVolume(Number(event.target.value) / 100);
                pokeAutohide();
              }}
              tabIndex={overlayOpen ? 0 : -1}
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
              tabIndex={overlayOpen ? 0 : -1}
              onClick={toggleVolume}
              className='grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'>
              <X className='size-5' />
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
