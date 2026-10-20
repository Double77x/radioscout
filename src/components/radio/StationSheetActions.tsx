import { Play, Square, Star, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Station } from "@/lib/radio/types";
import { cn } from "@/lib/utils";

interface StationSheetActionsProps {
  station: Station;
  favourited: boolean;
  playing: boolean;
  alreadyVoted: boolean;
  onToggleFavourite: () => void;
  onPlayToggle: () => void;
  onVote: () => void;
}

/** Always-reachable transport and library actions below the tabs. */
export function StationSheetActions({
  station,
  favourited,
  playing,
  alreadyVoted,
  onToggleFavourite,
  onPlayToggle,
  onVote,
}: StationSheetActionsProps) {
  return (
    <div className='mt-4 grid shrink-0 grid-cols-[1fr_1.5fr_1fr] gap-2 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]'>
      <Button
        type='button'
        variant='secondary'
        onClick={onToggleFavourite}
        aria-pressed={favourited}
        aria-label={favourited ? `Remove ${station.name} from favourites` : `Save ${station.name} to favourites`}
        className='h-12 rounded-full transition-colors'>
        <Star
          key={favourited ? "saved" : "save"}
          className={cn("size-4 shrink-0 animate-scout-pop", favourited && "text-primary")}
          fill='currentColor'
        />
      </Button>
      <Button
        type='button'
        onClick={onPlayToggle}
        aria-label={playing ? `Stop ${station.name}` : `Play ${station.name}`}
        className='h-12 rounded-full text-base transition-colors'>
        {playing ? (
          <Square className='size-4 shrink-0 animate-scout-pop' fill='currentColor' />
        ) : (
          <Play className='size-4 shrink-0 animate-scout-pop' fill='currentColor' />
        )}
      </Button>
      <Button
        type='button'
        variant='secondary'
        onClick={onVote}
        disabled={alreadyVoted}
        aria-label={`Vote for ${station.name}`}
        className='h-12 rounded-full transition-colors'>
        <ThumbsUp
          key={alreadyVoted ? "voted" : "unvoted"}
          className={cn("size-4 shrink-0 animate-scout-pop", alreadyVoted && "text-primary")}
          fill='currentColor'
        />
      </Button>
    </div>
  );
}
