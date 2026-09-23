import { Pause, Play, Star } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CountryFlag } from "@/components/radio/CountryFlag";
import { StationArt } from "@/components/radio/StationArt";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Station } from "@/lib/radio/types";

interface StationCardProps {
  station: Station;
  playing: boolean;
  favourited: boolean;
  onPlay: (station: Station) => void;
  onToggleFavourite: (station: Station) => void;
  onOpenDetail: (station: Station) => void;
  /** Optional drag handle (Saved reorder) rendered at the row end. */
  dragHandle?: ReactNode;
  /** Drag plumbing (Saved reorder): identity, style and classes for the <li>. */
  dataUuid?: string;
  outerStyle?: CSSProperties;
  outerClassName?: string;
  /** Row press handler for drag-from-anywhere (Saved reorder). */
  onRowPointerDown?: (event: React.PointerEvent<HTMLLIElement>, uuid: string) => void;
  /**
   * Mount enter animation. Off for reorderable rows: DOM moves re-trigger
   * the fill animation on drop (opacity flash + translateY replay over the
   * settle glide), so Saved rows mount plain and move cleanly.
   */
  animate?: boolean;
}

/** One row in the station lists. 40px targets, lazy favicons. */
export function StationCard({
  station,
  playing,
  favourited,
  onPlay,
  onToggleFavourite,
  onOpenDetail,
  dragHandle,
  dataUuid,
  outerStyle,
  outerClassName,
  onRowPointerDown,
  animate = true,
}: StationCardProps) {
  const meta = [
    station.bitrate > 0 ? `${station.bitrate}k` : null,
    station.codec || null,
    station.hls === 1 ? "HLS" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li
      data-uuid={dataUuid}
      data-testid='station-row'
      data-playing={playing ? "true" : "false"}
      style={outerStyle}
      onPointerDown={onRowPointerDown ? (event) => dataUuid && onRowPointerDown(event, dataUuid) : undefined}
      className={cn(
        "flex min-h-16 items-center gap-2 rounded-3xl border border-border bg-card p-3 pr-2",
        animate && "animate-scout-enter",
        outerClassName,
      )}>
      <Button
        type='button'
        size='icon'
        data-testid='station-play'
        aria-label={playing ? `Pause ${station.name}` : `Play ${station.name}`}
        onClick={() => onPlay(station)}
        className={cn(
          "size-10 shrink-0 rounded-full",
          playing ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
        )}>
        {playing ? (
          <Pause className='size-5' fill='currentColor' />
        ) : (
          <Play className='size-5 translate-x-px' fill='currentColor' />
        )}
      </Button>
      <StationArt
        key={station.favicon || station.stationuuid}
        src={station.favicon}
        className='size-9 rounded-xl'
        iconClassName='size-4'
      />
      <button
        type='button'
        aria-label={`Details for ${station.name}`}
        onClick={() => onOpenDetail(station)}
        className='min-w-0 flex-1 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'>
        <span className='block truncate text-sm font-semibold'>{station.name}</span>
        <span className='flex items-center gap-1.5 truncate text-xs text-muted-foreground'>
          <CountryFlag code={station.countrycode} name={station.country} className='shrink-0 text-xs' />
          <span className='truncate'>
            {meta}
            {station.votes > 0 ? ` · ★ ${formatCount(station.votes)}` : ""}
          </span>
        </span>
      </button>
      <button
        type='button'
        aria-label={favourited ? `Remove ${station.name} from favourites` : `Save ${station.name} to favourites`}
        aria-pressed={favourited}
        onClick={() => onToggleFavourite(station)}
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          favourited ? "text-amber-500" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}>
        <Star className='size-5' fill='currentColor' />
      </button>
      {dragHandle}
    </li>
  );
}
