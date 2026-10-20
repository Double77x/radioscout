import { useState } from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { StationSheetActions } from "@/components/radio/StationSheetActions";
import { StationSheetHeader } from "@/components/radio/StationSheetHeader";
import { StationSheetLoading, StationSheetMissing } from "@/components/radio/StationSheetFallback";
import { StationSheetTabs } from "@/components/radio/StationSheetTabs";
import { play, stop, usePlayer } from "@/hooks/use-player";
import { useFavourites, useToggleFavourite } from "@/hooks/use-radio";
import { useDetailStation } from "@/hooks/use-station-detail";
import { bbcServiceIdForStation, bbcSoundsUrl } from "@/lib/radio/bbc";
import { bumpCachedVotes, hasVoted, markVoted } from "@/lib/radio/votes";

interface StationDetailSheetProps {
  onClose: () => void;
}

/** API stays out of the initial bundle — loaded when the sheet votes. */
const loadDetailApi = () => import("@/lib/radio/api");
/** Query client stays out of the initial bundle — loaded when the sheet votes. */
const loadQueryClient = () => import("@/lib/query-client");

/**
 * Bottom sheet with the full backend record for a station. The station is
 * derived from `?station=` (row taps seed the cache for an instant paint,
 * shared links fetch by uuid), so the URL alone decides open vs closed —
 * browser and Android back close the sheet with no sync effect.
 */
export function StationDetailSheet({ onClose }: StationDetailSheetProps) {
  const player = usePlayer();
  const { data: favourites } = useFavourites();
  const toggleFavourite = useToggleFavourite();
  const [voted, setVoted] = useState(false);

  const { uuid, data, isFetching, isFetched } = useDetailStation();
  const open = uuid !== null;
  const live = data ?? null;
  const settled = isFetched && !isFetching;
  const missing = open && live === null && settled;
  const playing = live !== null && player.station?.stationuuid === live.stationuuid && player.status === "playing";
  const favourited = live !== null && favourites.some((row) => row.stationuuid === live.stationuuid);
  const alreadyVoted = live !== null && (voted || hasVoted(live.stationuuid));
  const bbcSounds = live ? bbcSoundsUrl(bbcServiceIdForStation(live)) : null;

  const vote = () => {
    if (!live || alreadyVoted) return;
    const station = live;
    void loadDetailApi().then((api) => {
      api.voteStation(station.stationuuid);
    });
    markVoted(station.stationuuid);
    setVoted(true);
    // Optimistic +1 everywhere the count renders (sheet, rows, snapshots).
    // The server dedupes per IP/day and its counts lag by minutes, so no
    // refetch here — one would snap the row back behind the sheet.
    void loadQueryClient().then(({ queryClient }) => {
      bumpCachedVotes(queryClient, station.stationuuid);
    });
  };

  return (
    <BaseDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setVoted(false);
          onClose();
        }
      }}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className='fixed inset-0 z-200 bg-background/80 backdrop-blur-sm transition-opacity duration-200 animate-in fade-in data-ending-style:opacity-0 data-starting-style:opacity-0' />
        <BaseDialog.Popup className='fixed inset-x-0 bottom-0 z-300 mx-auto flex h-[75dvh] w-full max-w-107.5 flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl transition duration-300 animate-in slide-in-from-bottom-8 fade-in data-ending-style:translate-y-8 data-ending-style:opacity-0 data-starting-style:translate-y-8 data-starting-style:opacity-0'>
          {live ? (
            <div className='flex min-h-0 flex-1 flex-col pt-3'>
              <span aria-hidden='true' className='mx-auto block h-1 w-10 shrink-0 rounded-full bg-border' />
              <StationSheetHeader station={live} />
              <BaseDialog.Description className='sr-only'>
                Details, statistics and playback controls for {live.name}.
              </BaseDialog.Description>
              <StationSheetTabs key={live.stationuuid} station={live} bbcSounds={bbcSounds} />
              <StationSheetActions
                station={live}
                favourited={favourited}
                playing={playing}
                alreadyVoted={alreadyVoted}
                onToggleFavourite={() => {
                  toggleFavourite.mutate(live);
                }}
                onPlayToggle={() => {
                  if (playing) stop();
                  else play(live);
                }}
                onVote={vote}
              />
              {player.status === "error" && !playing && player.station?.stationuuid === live.stationuuid ? (
                <p className='mt-4 shrink-0 px-5 text-center text-xs text-muted-foreground'>
                  Couldn&apos;t start this stream — it may be offline.
                </p>
              ) : null}
            </div>
          ) : open ? (
            missing ? (
              <StationSheetMissing />
            ) : (
              <StationSheetLoading />
            )
          ) : null}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
