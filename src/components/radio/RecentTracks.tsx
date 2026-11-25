import { useEffect, useState } from "react";
import { MicVocal, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useLyrics } from "@/hooks/use-lyrics";
import { usePlayer } from "@/hooks/use-player";
import { useClearStationTracks, useRecentTracks } from "@/hooks/use-radio";
import { formatRelativeTime } from "@/lib/format";
import { isBracketLine } from "@/lib/radio/lyrics";
import type { TrackRow } from "@/lib/radio/store";
import { cn } from "@/lib/utils";

/**
 * Heard titles for one station, newest first — banked by the engine while
 * playing (probe tiers on web, bridge frames on the APK). Live-updates via
 * the tracks query the engine invalidates on every bank.
 *
 * The newest row is the song playing now, so it is the one row that can carry
 * lyrics: hovering it shows the hand, its mic icon marks the lyrics as
 * available, and a click expands the whole song underneath. Untimed — a radio
 * stream carries no playback position — and fetched only on that click, so an
 * untouched tab names no track to LRCLIB.
 */
const TRACKS_EMPTY: TrackRow[] = [];
const LYRICS_PANEL_ID = "recent-lyrics-panel";
/** Bars for the pending skeleton, longest first: widths are static classes. */
const SKELETON_LINES: readonly string[] = ["w-3/4", "w-2/3", "w-1/2", "w-2/5", "w-1/3"];

export function RecentTracks({ stationuuid }: { stationuuid: string }) {
  const { data } = useRecentTracks(stationuuid, 15);
  const tracks = data ?? TRACKS_EMPTY;
  const { station, track } = usePlayer();
  const [openLyrics, setOpenLyrics] = useState(false);
  // Only the playing station's newest title is a title the player can vouch
  // for; every other row is history whose song has moved on.
  const liveTitle = station?.stationuuid === stationuuid ? track : null;
  const { data: lyrics, isPending, isError } = useLyrics(liveTitle, openLyrics && liveTitle !== null);
  const stanzas = lyrics ?? [];
  const hasLyrics = stanzas.length > 0;
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
        {tracks.map((trackRow, index) => {
          // A programme is not a song: LRCLIB has nothing to offer for a show
          // title, and its badge must not end up inside the row's button.
          const expandable =
            liveTitle !== null && index === 0 && trackRow.kind !== "programme" && trackRow.title === liveTitle;
          const row = (
            <>
              <span className='min-w-0 flex-1 truncate'>{trackRow.title}</span>
              {trackRow.kind === "programme" ? (
                <Badge variant='secondary' className='shrink-0'>
                  Show
                </Badge>
              ) : null}
              {expandable ? (
                <MicVocal aria-hidden='true' className='size-3.5 shrink-0 self-center text-primary' />
              ) : null}
              <span className='w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums'>
                {formatRelativeTime(trackRow.played_at)}
              </span>
            </>
          );
          return (
            <li key={trackRow.id ?? `${trackRow.played_at}-${trackRow.title}`} className='text-sm'>
              {expandable ? (
                <button
                  type='button'
                  aria-expanded={openLyrics}
                  aria-controls={LYRICS_PANEL_ID}
                  onClick={() => {
                    setOpenLyrics(!openLyrics);
                  }}
                  className='flex w-full cursor-pointer items-baseline gap-2 rounded-xl px-1.5 py-1 text-left transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'>
                  {row}
                </button>
              ) : (
                <div className='flex w-full items-baseline gap-2 px-1.5 py-1'>{row}</div>
              )}
              {expandable && openLyrics ? (
                <div id={LYRICS_PANEL_ID} className='mt-1 mb-2'>
                  {isPending ? (
                    <div
                      aria-busy='true'
                      className='mt-1 animate-pulse rounded-2xl bg-muted/60 px-3 py-2.5 motion-reduce:animate-none'>
                      <span className='sr-only'>Looking for lyrics…</span>
                      <span aria-hidden='true' className='flex flex-col items-center gap-2'>
                        {SKELETON_LINES.map((width) => (
                          <span key={width} className={cn("h-3 rounded-full bg-muted", width)} />
                        ))}
                      </span>
                    </div>
                  ) : null}
                  {!isPending && isError ? (
                    <p className='px-1.5 text-xs text-muted-foreground'>
                      LRCLIB is busy right now — try again in a moment.
                    </p>
                  ) : null}
                  {!isPending && !isError && !hasLyrics ? (
                    <p className='px-1.5 text-xs text-muted-foreground'>No lyrics for this track.</p>
                  ) : null}
                  {hasLyrics ? (
                    <section
                      aria-label='Song lyrics'
                      className='flex max-h-64 flex-col gap-3 overflow-y-auto overscroll-contain rounded-2xl bg-muted/60 px-3 py-2.5 text-center text-sm leading-relaxed'>
                      {stanzas.map((stanza, stanzaIndex) => (
                        <p key={`${stanzaIndex}-${stanza[0] ?? ""}`} className='wrap-break-word'>
                          {stanza.map((line, lineIndex) => (
                            <span
                              key={`${lineIndex}-${line}`}
                              className={cn("block", isBracketLine(line) && "text-muted-foreground italic")}>
                              {line}
                            </span>
                          ))}
                        </p>
                      ))}
                    </section>
                  ) : null}
                  {hasLyrics ? (
                    <p className='mt-1 px-1.5 text-xs text-muted-foreground'>
                      Lyrics via{" "}
                      <a
                        href='https://lrclib.net'
                        target='_blank'
                        rel='noreferrer'
                        className='underline underline-offset-4 hover:text-foreground'>
                        LRCLIB
                      </a>
                    </p>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
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
