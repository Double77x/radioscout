import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useClearStationTracks, useRecentTracks } from "@/hooks/use-radio";
import { formatRelativeTime } from "@/lib/format";
import type { TrackRow } from "@/lib/radio/store";

/**
 * Heard titles for one station, newest first — banked by the engine while
 * playing (probe tiers on web, bridge frames on the APK). Live-updates via
 * the tracks query the engine invalidates on every bank.
 */
const TRACKS_EMPTY: TrackRow[] = [];

export function RecentTracks({ stationuuid }: { stationuuid: string }) {
  const { data } = useRecentTracks(stationuuid, 15);
  const tracks = data ?? TRACKS_EMPTY;
  const clearTracks = useClearStationTracks();
  const [confirmClear, setConfirmClear] = useState(false);
  // Wall-clock ages ("45s") freeze between title banks — a 30s interval
  // re-render keeps them honest while this tab is open. Time has no
  // reactive source, so the timer lives in an effect with cleanup.
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = globalThis.setInterval(() => {
      setTick((tick) => tick + 1);
    }, 30_000);
    return () => {
      globalThis.clearInterval(timer);
    };
  }, []);
  if (tracks.length === 0) {
    return (
      <p className='mt-1 text-sm text-muted-foreground'>No songs caught yet — titles appear here while you listen.</p>
    );
  }
  return (
    <>
      <ul className='flex flex-col gap-1.5'>
        {tracks.map((track) => (
          <li key={track.id ?? `${track.played_at}-${track.title}`} className='flex items-baseline gap-2 text-sm'>
            <span className='min-w-0 flex-1 truncate'>{track.title}</span>
            {track.kind === "programme" ? (
              <Badge variant='secondary' className='shrink-0'>
                Show
              </Badge>
            ) : null}
            <span className='w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums'>
              {formatRelativeTime(track.played_at)}
            </span>
          </li>
        ))}
      </ul>
      <div className='mt-3 flex justify-center'>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          onClick={() => {
            setConfirmClear(true);
          }}
          className='min-w-36 rounded-full bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'>
          <Trash2 aria-hidden='true' />
          Clear song history
        </Button>
      </div>
      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title='Clear song history?'
        description='This erases the heard titles for this station.'
        confirmLabel='Clear'
        pending={clearTracks.isPending}
        onConfirm={() => {
          clearTracks.mutate(stationuuid);
          setConfirmClear(false);
        }}
      />
    </>
  );
}
