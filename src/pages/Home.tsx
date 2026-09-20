import { useMemo } from "react";
import { Link, getRouteApi } from "@tanstack/react-router";
import { Heart, SearchX, Star, TextAlignStart } from "lucide-react";
import { SEO } from "@/components/Seo";
import { AppShell } from "@/components/scout/AppShell";
import { RadioHeader } from "@/components/radio/RadioHeader";
import { SavedStations } from "@/components/radio/SavedStations";
import { StationCard } from "@/components/radio/StationCard";
import { StationListSkeleton } from "@/components/radio/StationSkeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePersistentStrings } from "@/hooks/use-persistent-state";
import { togglePlay, usePlayer } from "@/hooks/use-player";
import { openStationDetail } from "@/hooks/use-station-detail";
import {
  useClearHistory,
  useFavourites,
  useHistory,
  useServerStats,
  useStationSearch,
  useToggleFavourite,
  useTopStations,
} from "@/hooks/use-radio";
import type { Station } from "@/lib/radio/types";

const routeApi = getRouteApi("/");

const HOME_SECTIONS_KEY = "radioscout:home-sections";
const HOME_SECTIONS_DEFAULT = ["saved", "top"];
const HOME_SECTION_IDS = new Set(["saved", "top", "recent"]);

export default function HomePage() {
  const { q = "", tag = "all" } = routeApi.useSearch();
  const [openSections, setOpenSections] = usePersistentStrings(HOME_SECTIONS_KEY, HOME_SECTIONS_DEFAULT);
  const visibleSections = openSections.filter((id) => HOME_SECTION_IDS.has(id));
  const top = useTopStations("votes");
  const filtering = q.trim() !== "" || tag !== "all";
  const search = useStationSearch(
    { name: q.trim() || undefined, tag: tag === "all" ? undefined : tag, limit: 50 },
    filtering,
  );
  const favourites = useFavourites();
  const history = useHistory();
  const stats = useServerStats();
  const toggleFavourite = useToggleFavourite();
  const clearHistory = useClearHistory();
  const player = usePlayer();

  const favouriteIds = useMemo(() => new Set(favourites.data.map((row) => row.stationuuid)), [favourites.data]);

  const renderRow = (station: Station, key?: string) => (
    <StationCard
      key={key ?? station.stationuuid}
      station={station}
      playing={player.station?.stationuuid === station.stationuuid && player.status === "playing"}
      favourited={favouriteIds.has(station.stationuuid)}
      onPlay={togglePlay}
      onToggleFavourite={(item) => toggleFavourite.mutate(item)}
      onOpenDetail={openStationDetail}
    />
  );

  return (
    <AppShell>
      <SEO
        title='RadioScout — free worldwide radio'
        description='RadioScout is a free worldwide radio player — top stations, genre search, favourites and history, on the web and Android.'
        keywords={["radio", "internet radio", "radio-browser", "free radio", "music", "pwa"]}
      />
      <main className='flex-1 pb-6'>
        <RadioHeader query={q} genre={tag} totalStations={stats.data?.stations} saved={favourites.data.length} />

        {filtering ? (
          <section aria-label='Search results' aria-busy={!search.data} className='scroll-mt-4 px-4 pt-5'>
            <div className='flex items-baseline justify-between'>
              <h2 className='text-lg font-semibold tracking-tight'>Results</h2>
              <p className='text-xs font-medium text-muted-foreground'>
                {search.data ? `${search.data.length} found` : "Searching…"}
              </p>
            </div>
            {search.data ? (
              search.data.length > 0 ? (
                <ul className='mt-3 flex flex-col gap-2'>{search.data.map((station) => renderRow(station))}</ul>
              ) : (
                <div className='mt-3 flex flex-col items-center rounded-scout-card border border-dashed border-border bg-card px-6 py-10 text-center'>
                  <span className='grid size-12 place-items-center rounded-full bg-muted text-muted-foreground'>
                    <SearchX className='size-6' />
                  </span>
                  <p className='mt-3 font-semibold'>Nothing matches that</p>
                  <p className='mt-1 text-sm text-muted-foreground'>Try a different word, or clear the filters.</p>
                  <Link to='/' replace className='mt-4'>
                    <Button className='h-12 rounded-full px-6'>Clear search</Button>
                  </Link>
                </div>
              )
            ) : (
              <StationListSkeleton rows={4} className='mt-3' />
            )}
          </section>
        ) : (
          <>
            <Accordion multiple value={visibleSections} onValueChange={setOpenSections} className='px-4'>
              <AccordionItem value='saved' className='border-0'>
                <AccordionTrigger className='py-4 hover:no-underline'>
                  <span className='flex items-center gap-3'>
                    <span
                      aria-hidden='true'
                      className='grid size-10 place-items-center rounded-2xl bg-scout-butter text-scout-coal'>
                      <Star className='size-5' />
                    </span>
                    <span className='text-lg font-semibold tracking-tight'>Saved</span>
                    {favourites.data.length > 0 ? <Badge variant='secondary'>{favourites.data.length}</Badge> : null}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <SavedStations />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value='top' className='border-0'>
                <AccordionTrigger className='py-4 hover:no-underline'>
                  <span className='flex items-center gap-3'>
                    <span
                      aria-hidden='true'
                      className='grid size-10 place-items-center rounded-2xl bg-scout-blush text-scout-coal'>
                      <Heart className='size-5' />
                    </span>
                    <span className='text-lg font-semibold tracking-tight'>Most loved</span>
                    {top.data ? <Badge variant='secondary'>{top.data.length}</Badge> : null}
                  </span>
                </AccordionTrigger>
                <AccordionContent aria-busy={!top.data && !top.isError}>
                  {top.data ? (
                    <ul className='flex flex-col gap-2'>{top.data.map((station) => renderRow(station))}</ul>
                  ) : top.isError ? (
                    <p role='alert' className='text-sm text-muted-foreground'>
                      Couldn't reach the station directory. Check your connection and try again.
                    </p>
                  ) : (
                    <StationListSkeleton />
                  )}
                </AccordionContent>
              </AccordionItem>

              {history.data.length > 0 ? (
                <AccordionItem value='recent' className='border-0'>
                  <AccordionTrigger className='py-4 hover:no-underline'>
                    <span className='flex items-center gap-3'>
                      <span
                        aria-hidden='true'
                        className='grid size-10 place-items-center rounded-2xl bg-scout-sky text-scout-coal'>
                        <TextAlignStart className='size-5' />
                      </span>
                      <span className='text-lg font-semibold tracking-tight'>Recently played</span>
                      <Badge variant='secondary'>{Math.min(history.data.length, 10)}</Badge>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={() => clearHistory.mutate()}
                      disabled={clearHistory.isPending}
                      className='mb-2 rounded-full'>
                      Clear history
                    </Button>
                    <ul className='flex flex-col gap-2'>
                      {history.data.slice(0, 10).map((row) => renderRow(row.snapshot, `${row.id}-${row.played_at}`))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ) : null}
            </Accordion>
          </>
        )}
      </main>
    </AppShell>
  );
}
