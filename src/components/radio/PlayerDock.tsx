import { useLocation, useNavigate } from "@tanstack/react-router";
import { useHotkey } from "@tanstack/react-hotkeys";
import { Library, LoaderCircle, Shuffle } from "lucide-react";
import { focusRadioSearch } from "@/lib/focus-radio-search";
import { usePlayer } from "@/hooks/use-player";
import { useSleepCountdown } from "@/hooks/use-sleep-countdown";
import { useDockVolume } from "@/hooks/use-dock-volume";
import { useSurpriseMe } from "@/hooks/use-radio";
import { useOpenStationDetail } from "@/hooks/use-station-detail";
import { PlayerControls } from "@/components/radio/PlayerControls";
import { PlayerNowPlaying } from "@/components/radio/PlayerNowPlaying";
import { PlayerVolumeOverlay } from "@/components/radio/PlayerVolumeOverlay";

/**
 * Bottom dock: the app's player bar. Volume slides left over the station
 * name as an overlay (the dock never changes height) and retreats after a
 * few idle seconds.
 *
 * Artwork/identity, transport controls and the volume panels live in their
 * own components; this file owns the wiring, the hotkeys and the auto-hide
 * state (`useDockVolume`).
 */
export function PlayerDock() {
  const { station, status, error, track, volume, muted, toggle, stop, play, setVolume, toggleMute } = usePlayer();
  const sleepCountdown = useSleepCountdown();
  const sleepSuffix = sleepCountdown ? ` · Sleep ${sleepCountdown}` : "";
  const { surprise, isSurprising } = useSurpriseMe();
  const openDetail = useOpenStationDetail();
  const {
    open: volumeOpen,
    toggle: toggleVolume,
    nudge: nudgeVolume,
    scrub: scrubVolume,
    poke: pokeAutohide,
    triggerRef,
    wideRef,
    tallRef,
  } = useDockVolume(volume, setVolume);

  const busy = status === "loading";
  const playing = status === "playing";
  const level = muted ? 0 : volume;
  const overlayOpen = volumeOpen && station !== null;
  const location = useLocation();
  const navigate = useNavigate();

  const playPause = () => {
    if (!playing && !busy && station) play(station);
    else toggle();
  };

  // Play/pause hotkey (YouTube-style "k"). Bare Space/Enter are deliberately
  // NOT bound: Space scrolls the page and activates any focused button
  // (dock toggle would double-fire into a no-op), Enter submits search and
  // selects palette items. A bare letter defaults to ignoreInputs, so typing
  // "k" in search/palette never toggles; it also never natively activates a
  // focused button, so no double-fire there either.
  useHotkey(
    "K",
    (event) => {
      event.preventDefault();
      playPause();
    },
    { enabled: station !== null },
  );

  // Volume keys (YouTube-style ←/→): 1% a press, on the same step the focused
  // range input takes — holding the key simply repeats at the OS rate, so no
  // second "fast" step is needed. The hook opens the overlay so the level is
  // visible, and focus deliberately stays put — moving it into the range input
  // would hand later presses to that input's handlers. Keys a focused control
  // owns (range inputs, radio groups, menus) never reach this: the manager
  // skips them.
  useHotkey(
    "ArrowRight",
    () => {
      nudgeVolume(1);
    },
    { enabled: station !== null },
  );
  useHotkey(
    "ArrowLeft",
    () => {
      nudgeVolume(-1);
    },
    { enabled: station !== null },
  );

  const browse = () => {
    // Already home: drop the cursor straight into search. Coming from
    // elsewhere: go home first, then focus once the header mounts.
    if (location.pathname !== "/") {
      void navigate({ to: "/" });
      globalThis.setTimeout(focusRadioSearch, 100);
      return;
    }
    focusRadioSearch();
  };

  const handleMute = () => {
    toggleMute();
    pokeAutohide();
  };

  return (
    <section
      aria-label='Player'
      data-testid='player-dock'
      className='sticky bottom-0 z-40 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]'>
      <div className='relative rounded-full border border-border bg-card p-2 shadow-lg shadow-black/5 backdrop-blur-xl'>
        <div className='relative flex items-center gap-2'>
          <PlayerNowPlaying
            station={station}
            status={status}
            track={track}
            error={error}
            sleepSuffix={sleepSuffix}
            onOpenDetail={openDetail}
          />

          {station ? (
            <PlayerControls
              station={station}
              playing={playing}
              busy={busy}
              muted={muted}
              level={level}
              volumeOpen={volumeOpen}
              triggerRef={triggerRef}
              onToggleVolume={toggleVolume}
              onMute={toggleMute}
              onPlayPause={playPause}
              onStop={stop}
            />
          ) : (
            <div className='flex shrink-0 items-center gap-2'>
              <button
                type='button'
                onClick={browse}
                aria-label='Browse stations'
                title='Browse stations'
                className='grid size-12 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'>
                <Library className='size-5' />
              </button>
              <button
                type='button'
                onClick={() => {
                  surprise();
                }}
                disabled={isSurprising}
                aria-label='Surprise me — play a random station'
                title='Surprise me — play a random station'
                className='grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60'>
                {isSurprising ? <LoaderCircle className='size-5 animate-spin' /> : <Shuffle className='size-5' />}
              </button>
            </div>
          )}
        </div>

        {station ? (
          <PlayerVolumeOverlay
            open={overlayOpen}
            level={level}
            muted={muted}
            wideRef={wideRef}
            tallRef={tallRef}
            onScrub={scrubVolume}
            onToggleMute={handleMute}
            onClose={toggleVolume}
          />
        ) : null}
      </div>
    </section>
  );
}
