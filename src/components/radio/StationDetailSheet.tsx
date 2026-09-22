import { useState } from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { ExternalLink, Play, Share2, Square, Star, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { badgeVariants } from "@/components/ui/badge-variants";
import { Button } from "@/components/ui/button";
import { CountryFlag } from "@/components/radio/CountryFlag";
import { StationArt } from "@/components/radio/StationArt";
import { play, stop, usePlayer } from "@/hooks/use-player";
import { useFavourites, useToggleFavourite } from "@/hooks/use-radio";
import { useDetailStation } from "@/hooks/use-station-detail";
import { hasVoted, markVoted } from "@/lib/radio/votes";
import { shareStation } from "@/lib/radio/share";
import { cn } from "@/lib/utils";
import { formatCount } from "@/lib/format";
import { formatCountryName, formatTags } from "@/lib/radio/format";

/** API stays out of the initial bundle — loaded when the sheet votes. */
const loadDetailApi = () => import("@/lib/radio/api");
/** Query client stays out of the initial bundle — loaded when the sheet votes. */
const loadQueryClient = () => import("@/lib/query-client");

function formatChecked(iso: string): string {
  const match = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/.exec(iso);
  if (!match?.groups?.year || !match.groups.month || !match.groups.day) return "unknown";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[Number(match.groups.month) - 1];
  if (!month) return "unknown";
  return `${Number(match.groups.day)} ${month} ${match.groups.year}`;
}

interface StationDetailSheetProps {
  onClose: () => void;
}

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

  const vote = () => {
    if (!live || alreadyVoted) return;
    const station = live;
    void loadDetailApi().then((api) => api.voteStation(station.stationuuid));
    markVoted(station.stationuuid);
    setVoted(true);
    // Optimistic +1: directory counts refresh every few minutes, so bump the
    // cached detail (this sheet) and refetch the lists behind it. The server
    // dedupes per IP/day and the local guard allows one vote per device, so
    // a rejected duplicate overshooting by one is accepted.
    void loadQueryClient().then(({ queryClient }) => {
      queryClient.setQueryData(["radio", "detail", station.stationuuid], { ...station, votes: station.votes + 1 });
      queryClient.invalidateQueries({ queryKey: ["radio", "top"] });
      queryClient.invalidateQueries({ queryKey: ["radio", "search"] });
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

              <div className='mt-3 flex flex-wrap items-center gap-1.5'>
                {live.codec ? <Badge variant='secondary'>{live.codec}</Badge> : null}
                {live.bitrate > 0 ? <Badge variant='secondary'>{live.bitrate}k</Badge> : null}
                {live.hls === 1 ? <Badge variant='secondary'>HLS</Badge> : null}
                <Badge variant={live.lastcheckok === 1 ? "secondary" : "destructive"}>
                  {live.lastcheckok === 1 ? "Online" : "Offline"}
                </Badge>
                <button
                  type='button'
                  onClick={() => void shareStation(live)}
                  aria-label={`Share ${live.name}`}
                  className={cn(badgeVariants({ variant: "secondary" }), "ml-auto cursor-pointer gap-1")}>
                  <Share2 className='size-3.5' /> Share
                </button>
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
          ) : open ? (
            missing ? (
              <div className='px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center'>
                <span aria-hidden='true' className='mx-auto block h-1 w-10 rounded-full bg-border' />
                <BaseDialog.Title className='mt-3 text-lg font-semibold tracking-tight'>
                  Couldn't open that station
                </BaseDialog.Title>
                <BaseDialog.Description className='mt-1 text-sm text-muted-foreground'>
                  The link may be stale, or the station was removed from the directory.
                </BaseDialog.Description>
                <BaseDialog.Close className='mt-4 h-11 w-full rounded-full bg-secondary font-semibold text-secondary-foreground transition hover:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'>
                  Close
                </BaseDialog.Close>
              </div>
            ) : (
              <div
                aria-busy='true'
                className='px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-pulse motion-reduce:animate-none'>
                <span aria-hidden='true' className='mx-auto block h-1 w-10 rounded-full bg-border' />
                <BaseDialog.Title className='sr-only'>Loading station…</BaseDialog.Title>
                <BaseDialog.Description className='sr-only'>The shared station is loading.</BaseDialog.Description>
                <div className='mt-3 flex items-start gap-3'>
                  <span aria-hidden='true' className='size-14 shrink-0 rounded-2xl bg-muted' />
                  <span aria-hidden='true' className='min-w-0 flex-1'>
                    <span className='block h-6 w-3/4 rounded-full bg-muted' />
                    <span className='mt-2 block h-4 w-1/2 rounded-full bg-muted' />
                  </span>
                </div>
                <div aria-hidden='true' className='mt-4 grid grid-cols-3 gap-2'>
                  {[0, 1, 2].map((index) => (
                    <span key={index} className='h-16 rounded-2xl bg-muted/60' />
                  ))}
                </div>
              </div>
            )
          ) : null}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
