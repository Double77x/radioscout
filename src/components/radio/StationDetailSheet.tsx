import { useEffect, useState } from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { ExternalLink, Play, Share2, Square, Star, ThumbsUp, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { CountryFlag } from "@/components/radio/CountryFlag";
import { StationArt } from "@/components/radio/StationArt";
import { StationStats } from "@/components/radio/StationStats";
import { play, stop, usePlayer } from "@/hooks/use-player";
import { useClearStationTracks, useFavourites, useRecentTracks, useToggleFavourite } from "@/hooks/use-radio";
import { useDetailStation } from "@/hooks/use-station-detail";
import { hasVoted, markVoted, bumpCachedVotes } from "@/lib/radio/votes";
import { readSheetTab, writeSheetTab, type SheetTab } from "@/lib/radio/sheet-tab";
import { bbcServiceIdForStation, bbcSoundsUrl } from "@/lib/radio/bbc";
import { shareStation } from "@/lib/radio/share";
import type { TrackRow } from "@/lib/radio/store";
import { cn } from "@/lib/utils";
import { formatCount, formatRelativeTime } from "@/lib/format";
import type { Station } from "@/lib/radio/types";
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

/**
 * Heard titles for one station, newest first — banked by the engine while
 * playing (probe tiers on web, bridge frames on the APK). Live-updates via
 * the tracks query the engine invalidates on every bank.
 */
const TRACKS_EMPTY: TrackRow[] = [];

function RecentTracks({ stationuuid }: { stationuuid: string }) {
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

const SHEET_TAB_OPTIONS: readonly SegmentedOption<SheetTab>[] = [
  { id: "info", label: "Info" },
  { id: "recent", label: "Recent" },
  { id: "stats", label: "Stats" },
];

/**
 * Tabbed sheet body, keyed by stationuuid at the call site. The last tab
 * persists per station, so reopening lands where the listener left it.
 * Transport actions stay outside (always reachable); Info owns the badges,
 * tiles and directory rows, Recent the song history, Stats the
 * station-scoped listening charts. Only the panel scrolls — header, tabs
 * and actions stay put, so swapping sections never moves the card.
 */
function SheetTabs({ station, bbcSounds }: { station: Station; bbcSounds: string | null }) {
  const [tab, setTab] = useState<SheetTab>(() => readSheetTab(station.stationuuid) ?? "info");
  const changeTab = (next: SheetTab): void => {
    setTab(next);
    writeSheetTab(station.stationuuid, next);
  };
  return (
    <div className='mt-3 flex min-h-0 flex-1 flex-col px-5'>
      <SegmentedControl
        label='Station sections'
        options={SHEET_TAB_OPTIONS}
        value={tab}
        onChange={changeTab}
        className='shrink-0'
      />
      <div className='mt-4 min-h-0 flex-1 overflow-y-auto pb-2'>
        {tab === "info" ? (
          <>
            <dl className='grid grid-cols-3 gap-2'>
              {[
                { label: "Votes", value: formatCount(station.votes) },
                { label: "Clicks 24h", value: formatCount(station.clickcount) },
                {
                  label: "Trend",
                  value: `${station.clicktrend >= 0 ? "+" : ""}${formatCount(Math.abs(station.clicktrend))}`,
                },
              ].map((stat) => (
                <div key={stat.label} className='rounded-2xl bg-muted/60 px-3 py-2.5 text-center'>
                  <dt className='text-xs font-medium text-muted-foreground'>{stat.label}</dt>
                  <dd className='text-lg font-semibold tabular-nums'>{stat.value}</dd>
                </div>
              ))}
            </dl>

            <dl className='mt-4 flex flex-col gap-2.5 text-sm'>
              {station.tags ? (
                <div className='flex gap-2'>
                  <dt className='w-20 shrink-0 font-semibold'>Genre</dt>
                  <dd className='min-w-0 flex-1 text-muted-foreground'>{formatTags(station.tags)}</dd>
                </div>
              ) : null}
              {station.language ? (
                <div className='flex gap-2'>
                  <dt className='w-20 shrink-0 font-semibold'>Language</dt>
                  <dd className='min-w-0 flex-1 text-muted-foreground'>
                    {formatTags(station.language)}
                    {station.languagecodes ? ` (${formatTags(station.languagecodes)})` : ""}
                  </dd>
                </div>
              ) : null}
              {station.countrycode || station.country ? (
                <div className='flex gap-2'>
                  <dt className='w-20 shrink-0 font-semibold'>Location</dt>
                  <dd className='flex min-w-0 flex-1 items-center gap-1.5 text-muted-foreground'>
                    <CountryFlag
                      code={station.countrycode}
                      name={formatCountryName(station.country, station.countrycode)}
                    />
                    <span className='min-w-0 flex-1 truncate'>
                      {[formatCountryName(station.country, station.countrycode), station.state, station.iso_3166_2]
                        .filter(Boolean)
                        .join(" · ")}
                      {station.geo_lat !== 0 && station.geo_long !== 0
                        ? ` — ${station.geo_lat.toFixed(2)}, ${station.geo_long.toFixed(2)}`
                        : ""}
                    </span>
                  </dd>
                </div>
              ) : null}
              {station.homepage ? (
                <div className='flex gap-2'>
                  <dt className='w-20 shrink-0 font-semibold'>Website</dt>
                  <dd className='min-w-0 flex-1'>
                    <a
                      href={station.homepage}
                      target='_blank'
                      rel='noreferrer'
                      className='inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline'>
                      Visit homepage <ExternalLink className='size-3.5' />
                    </a>
                  </dd>
                </div>
              ) : null}
              {bbcSounds ? (
                <div className='flex gap-2'>
                  <dt className='w-20 shrink-0 font-semibold'>Tracks</dt>
                  <dd className='min-w-0 flex-1'>
                    <a
                      href={bbcSounds}
                      target='_blank'
                      rel='noreferrer'
                      className='inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline'>
                      Live, schedule &amp; track history <ExternalLink className='size-3.5' />
                    </a>
                  </dd>
                </div>
              ) : null}
              {station.codec || station.bitrate > 0 || station.hls === 1 ? (
                <div className='flex gap-2'>
                  <dt className='w-20 shrink-0 font-semibold'>Audio</dt>
                  <dd className='min-w-0 flex-1 text-muted-foreground'>
                    {[
                      station.codec || null,
                      station.bitrate > 0 ? `${station.bitrate}k` : null,
                      station.hls === 1 ? "HLS" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </dd>
                </div>
              ) : null}
              <div className='flex gap-2'>
                <dt className='w-20 shrink-0 font-semibold'>Checked</dt>
                <dd className='flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground'>
                  <span>{formatChecked(station.lastcheckoktime_iso8601 || station.lastchangetime_iso8601)}</span>
                  <Badge variant={station.lastcheckok === 1 ? "secondary" : "destructive"}>
                    {station.lastcheckok === 1 ? "Online" : "Offline"}
                  </Badge>
                </dd>
              </div>
              <div className='flex gap-2'>
                <dt className='w-20 shrink-0 font-semibold'>Share</dt>
                <dd className='min-w-0 flex-1'>
                  <button
                    type='button'
                    onClick={() => void shareStation(station)}
                    aria-label={`Share ${station.name}`}
                    className='inline-flex cursor-pointer items-center gap-1 text-primary underline-offset-4 hover:underline'>
                    Share this station <Share2 className='size-3.5' />
                  </button>
                </dd>
              </div>
            </dl>
          </>
        ) : tab === "recent" ? (
          <RecentTracks stationuuid={station.stationuuid} />
        ) : (
          <StationStats stationuuid={station.stationuuid} />
        )}
      </div>
    </div>
  );
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
              <BaseDialog.Title className='mt-3 flex shrink-0 items-start gap-3 px-5'>
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

              <SheetTabs key={live.stationuuid} station={live} bbcSounds={bbcSounds} />

              <div className='mt-4 grid shrink-0 grid-cols-[1fr_1.5fr_1fr] gap-2 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]'>
                <Button
                  type='button'
                  variant='secondary'
                  onClick={() => {
                    toggleFavourite.mutate(live);
                  }}
                  aria-pressed={favourited}
                  aria-label={favourited ? `Remove ${live.name} from favourites` : `Save ${live.name} to favourites`}
                  className='h-12 rounded-full transition-colors'>
                  <Star
                    key={favourited ? "saved" : "save"}
                    className={cn("size-4 shrink-0 animate-scout-pop", favourited && "text-primary")}
                    fill='currentColor'
                  />
                </Button>
                <Button
                  type='button'
                  onClick={() => {
                    if (playing) stop();
                    else play(live);
                  }}
                  aria-label={playing ? `Stop ${live.name}` : `Play ${live.name}`}
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
                  onClick={vote}
                  disabled={alreadyVoted}
                  aria-label={`Vote for ${live.name}`}
                  className='h-12 rounded-full transition-colors'>
                  <ThumbsUp
                    key={alreadyVoted ? "voted" : "unvoted"}
                    className={cn("size-4 shrink-0 animate-scout-pop", alreadyVoted && "text-primary")}
                    fill='currentColor'
                  />
                </Button>
              </div>

              {player.status === "error" && !playing && player.station?.stationuuid === live.stationuuid ? (
                <p className='mt-4 shrink-0 px-5 text-center text-xs text-muted-foreground'>
                  Couldn&apos;t start this stream — it may be offline.
                </p>
              ) : null}
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
