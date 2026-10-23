import { Radio } from "lucide-react";
import { StationArt } from "@/components/radio/StationArt";
import { TrackTicker } from "@/components/radio/TrackTicker";
import type { PlayerStatus } from "@/lib/player/store";
import type { Station } from "@/lib/radio/types";
import { formatCountryName, formatTags } from "@/lib/radio/format";

export interface PlayerNowPlayingProps {
  station: Station | null;
  status: PlayerStatus;
  track: string | null;
  error: string | null;
  /** " · Sleep 12:34" while a sleep timer runs; empty otherwise. */
  sleepSuffix: string;
  onOpenDetail: (station: Station) => void;
}

/** The dock's subtitle: tuning, the live track, or the pause/error verdict. */
function subtitleFor(
  station: Station,
  status: PlayerStatus,
  track: string | null,
  error: string | null,
  sleepSuffix: string,
): string {
  if (status === "loading") return `Tuning in…${sleepSuffix}`;
  if (status === "playing") {
    const detail =
      track ?? (formatTags(station.tags) || formatCountryName(station.country, station.countrycode) || "Live");
    return `${detail}${sleepSuffix}`;
  }
  return `${error ?? "Paused"}${sleepSuffix}`;
}

/**
 * Station artwork and identity in the dock. Renders the idle placeholder
 * when nothing is tuned; the transport controls sit beside it.
 */
export function PlayerNowPlaying({ station, status, track, error, sleepSuffix, onOpenDetail }: PlayerNowPlayingProps) {
  if (station === null) {
    return (
      <>
        <span
          aria-hidden='true'
          className='grid size-12 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground'>
          <Radio className='size-5' />
        </span>
        <span className='min-w-0 flex-1 pl-1' aria-live='polite'>
          <span className='block truncate text-sm font-semibold'>Nothing playing</span>
          <span className='block truncate text-xs text-muted-foreground'>Pick a station</span>
        </span>
      </>
    );
  }

  const subtitle = subtitleFor(station, status, track, error, sleepSuffix);

  return (
    <>
      <button
        type='button'
        aria-label={station.name}
        onClick={() => {
          onOpenDetail(station);
        }}
        className='shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'>
        <StationArt
          key={station.favicon || station.stationuuid}
          src={station.favicon}
          className='size-12 rounded-full'
          iconClassName='size-5'
        />
      </button>

      <button
        type='button'
        aria-label={station.name}
        onClick={() => {
          onOpenDetail(station);
        }}
        className='min-w-0 flex-1 pl-1 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
        aria-live='polite'>
        <span className='flex items-center gap-1.5'>
          {status === "playing" ? (
            <span className='relative flex size-2 shrink-0' aria-hidden='true'>
              <span className='absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60' />
              <span className='relative inline-flex size-2 rounded-full bg-primary' />
            </span>
          ) : null}
          <span className='block truncate text-sm font-semibold'>{station.name}</span>
        </span>
        <TrackTicker key={subtitle} text={subtitle} className='text-xs text-muted-foreground' />
      </button>
    </>
  );
}
