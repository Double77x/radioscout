import { useState } from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Play, Square, Star, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CountryFlag } from "@/components/radio/CountryFlag";
import { StationArt } from "@/components/radio/StationArt";
import { useIsClient } from "@/hooks/use-is-client";
import { play, stop, usePlayer } from "@/hooks/use-player";
import { useFavourites, useToggleFavourite } from "@/hooks/use-radio";
import { hasVoted, markVoted } from "@/lib/radio/votes";
import { formatCount } from "@/lib/format";
import { formatCountryName, formatTags } from "@/lib/radio/format";
import type { Station } from "@/lib/radio/types";

interface StationDetailSheetProps {
  station: Station | null;
  onClose: () => void;
}

/** API stays out of the initial bundle — loaded when the sheet opens/votes. */
const loadDetailApi = () => import("@/lib/radio/api");

function formatChecked(iso: string): string {
  const match = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/.exec(iso);
  if (!match?.groups?.year || !match.groups.month || !match.groups.day) return "unknown";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[Number(match.groups.month) - 1];
  if (!month) return "unknown";
  return `${Number(match.groups.day)} ${month} ${match.groups.year}`;
}

/**
 * Bottom sheet with the full backend record for a station. Opens from any
 * row/tile; refreshes the stats (votes, clicks) on open so the numbers
 * are live, not the cached snapshot.
 */
export function StationDetailSheet({ station, onClose }: StationDetailSheetProps) {
  const isClient = useIsClient();
  const player = usePlayer();
  const { data: favourites } = useFavourites();
  const toggleFavourite = useToggleFavourite();
  const [voted, setVoted] = useState(false);
  const open = station !== null;

  const refresh = useQuery({
    queryKey: ["radio", "detail", station?.stationuuid],
    queryFn: () => loadDetailApi().then((api) => (station ? api.stationByUuid(station.stationuuid) : null)),
    enabled: isClient && open && station !== null,
    staleTime: 1000 * 60,
  });
  const live = refresh.data ?? station;
  const playing = live !== null && player.station?.stationuuid === live.stationuuid && player.status === "playing";
  const favourited = live !== null && favourites.some((row) => row.stationuuid === live.stationuuid);
  const alreadyVoted = live !== null && (voted || hasVoted(live.stationuuid));

  const vote = () => {
    if (!live || alreadyVoted) return;
    void loadDetailApi().then((api) => api.voteStation(live.stationuuid));
    markVoted(live.stationuuid);
    setVoted(true);
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
        <BaseDialog.Popup className='fixed inset-x-0 bottom-0 z-300 mx-auto max-h-[85dvh] w-full max-w-107.5 overflow-y-auto rounded-t-3xl border border-border bg-card shadow-2xl transition duration-300 animate-in slide-in-from-bottom-8 fade-in data-ending-style:translate-y-8 data-ending-style:opacity-0 data-starting-style:translate-y-8 data-starting-style:opacity-0'>
          {live ? (
            <div className='px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]'>
              <span aria-hidden='true' className='mx-auto block h-1 w-10 rounded-full bg-border' />
              <BaseDialog.Title className='mt-3 flex items-start gap-3'>
                <StationArt
                  key={live.favicon || live.stationuuid}
                  src={live.favicon}
                  className='size-14 rounded-2xl'
                  iconClassName='size-6'
                />
                <span className='min-w-0 flex-1'>
                  <span className='block text-xl leading-tight font-semibold tracking-tight text-balance'>
                    {live.name}
                  </span>
                  <span className='mt-0.5 block truncate text-sm text-muted-foreground'>
                    {[formatCountryName(live.country, live.countrycode), live.state].filter(Boolean).join(" · ") ||
                      "Worldwide"}
                  </span>
                </span>
                <BaseDialog.Close
                  aria-label='Close details'
                  className='grid size-11 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'>
                  <X className='size-5' />
                </BaseDialog.Close>
              </BaseDialog.Title>
              <BaseDialog.Description className='sr-only'>
                Details, statistics and playback controls for {live.name}.
              </BaseDialog.Description>

              <div className='mt-3 flex flex-wrap gap-1.5'>
                {live.codec ? <Badge variant='secondary'>{live.codec}</Badge> : null}
                {live.bitrate > 0 ? <Badge variant='secondary'>{live.bitrate}k</Badge> : null}
                {live.hls === 1 ? <Badge variant='secondary'>HLS</Badge> : null}
                <Badge variant={live.lastcheckok === 1 ? "secondary" : "destructive"}>
                  {live.lastcheckok === 1 ? "Online" : "Offline"}
                </Badge>
              </div>

              <dl className='mt-4 grid grid-cols-3 gap-2'>
                {[
                  { label: "Votes", value: formatCount(live.votes) },
                  { label: "Clicks 24h", value: formatCount(live.clickcount) },
                  {
                    label: "Trend",
                    value: `${live.clicktrend >= 0 ? "+" : ""}${formatCount(Math.abs(live.clicktrend))}`,
                  },
                ].map((stat) => (
                  <div key={stat.label} className='rounded-2xl bg-muted/60 px-3 py-2.5 text-center'>
                    <dt className='text-xs font-medium text-muted-foreground'>{stat.label}</dt>
                    <dd className='text-lg font-semibold tabular-nums'>{stat.value}</dd>
                  </div>
                ))}
              </dl>

              <dl className='mt-4 flex flex-col gap-2.5 text-sm'>
                {live.tags ? (
                  <div className='flex gap-2'>
                    <dt className='w-20 shrink-0 font-semibold'>Genre</dt>
                    <dd className='min-w-0 flex-1 text-muted-foreground'>{formatTags(live.tags)}</dd>
                  </div>
                ) : null}
                {live.language ? (
                  <div className='flex gap-2'>
                    <dt className='w-20 shrink-0 font-semibold'>Language</dt>
                    <dd className='min-w-0 flex-1 text-muted-foreground'>
                      {formatTags(live.language)}
                      {live.languagecodes ? ` (${formatTags(live.languagecodes)})` : ""}
                    </dd>
                  </div>
                ) : null}
                {live.countrycode || live.country ? (
                  <div className='flex gap-2'>
                    <dt className='w-20 shrink-0 font-semibold'>Location</dt>
                    <dd className='flex min-w-0 flex-1 items-center gap-1.5 text-muted-foreground'>
                      <CountryFlag code={live.countrycode} name={formatCountryName(live.country, live.countrycode)} />
                      <span className='min-w-0 flex-1 truncate'>
                        {[formatCountryName(live.country, live.countrycode), live.state, live.iso_3166_2]
                          .filter(Boolean)
                          .join(" · ")}
                        {live.geo_lat !== 0 && live.geo_long !== 0
                          ? ` — ${live.geo_lat.toFixed(2)}, ${live.geo_long.toFixed(2)}`
                          : ""}
                      </span>
                    </dd>
                  </div>
                ) : null}
                {live.homepage ? (
                  <div className='flex gap-2'>
                    <dt className='w-20 shrink-0 font-semibold'>Website</dt>
                    <dd className='min-w-0 flex-1'>
                      <a
                        href={live.homepage}
                        target='_blank'
                        rel='noreferrer'
                        className='inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline'>
                        Visit homepage <ExternalLink className='size-3.5' />
                      </a>
                    </dd>
                  </div>
                ) : null}
                <div className='flex gap-2'>
                  <dt className='w-20 shrink-0 font-semibold'>Checked</dt>
                  <dd className='min-w-0 flex-1 text-muted-foreground'>
                    {formatChecked(live.lastcheckoktime_iso8601 || live.lastchangetime_iso8601)}
                  </dd>
                </div>
              </dl>

              <div className='mt-5 flex flex-col gap-2'>
                <Button
                  type='button'
                  onClick={() => {
                    if (playing) stop();
                    else play(live);
                  }}
                  className='h-12 rounded-full text-base'>
                  {playing ? (
                    <>
                      <Square className='size-4' fill='currentColor' /> Stop
                    </>
                  ) : (
                    <>
                      <Play className='size-4' fill='currentColor' /> Play now
                    </>
                  )}
                </Button>
                <div className='grid grid-cols-2 gap-2'>
                  <Button
                    type='button'
                    variant='secondary'
                    onClick={() => toggleFavourite.mutate(live)}
                    aria-pressed={favourited}
                    className='h-11 rounded-full'>
                    <Star className='size-4' fill='currentColor' />
                    {favourited ? "Saved" : "Save"}
                  </Button>
                  <Button
                    type='button'
                    variant='secondary'
                    onClick={vote}
                    disabled={alreadyVoted}
                    className='h-11 rounded-full'>
                    {alreadyVoted ? "Voted ✓" : "Vote +1"}
                  </Button>
                </div>
              </div>

              <p className='mt-4 text-center text-xs text-muted-foreground'>
                {player.status === "error" && playing === false && player.station?.stationuuid === live.stationuuid
                  ? "Couldn't start this stream — it may be offline."
                  : "Votes and clicks feed the global Most loved / Most played charts."}
              </p>
            </div>
          ) : null}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
