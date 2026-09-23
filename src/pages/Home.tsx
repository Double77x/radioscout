import { useEffect, useMemo, useState } from "react";
import { Link, getRouteApi } from "@tanstack/react-router";
import { ChartColumn, Heart, SearchX, Star, TextAlignStart, Trash2 } from "lucide-react";
import { SEO } from "@/components/Seo";
import { AppShell } from "@/components/scout/AppShell";
import { ListeningStats } from "@/components/radio/ListeningStats";
import { CountryFlag, hasCountryFlag } from "@/components/radio/CountryFlag";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { BestOfBritish } from "@/components/radio/BestOfBritish";
import { RadioHeader } from "@/components/radio/RadioHeader";
import { SavedStations } from "@/components/radio/SavedStations";
import { StationCard } from "@/components/radio/StationCard";
import { StationListSkeleton } from "@/components/radio/StationSkeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useIsClient } from "@/hooks/use-is-client";
import { usePersistentString, usePersistentStrings } from "@/hooks/use-persistent-state";
import { togglePlay, usePlayer } from "@/hooks/use-player";
import { useOpenStationDetail } from "@/hooks/use-station-detail";
import { formatListeningTime, formatTags } from "@/lib/radio/format";
import { LANGUAGES_KEY } from "@/lib/radio/languages";
import { COUNTRIES_KEY, displayCountryName } from "@/lib/radio/countries";
import { POPULAR_COUNTRIES } from "@/lib/radio/country-popular";
import { normalizeMinBitrate, QUALITY_KEY, qualityLabel } from "@/lib/radio/quality";
import {
  useClearHistory,
  useFavourites,
  useHistory,
  useListeningStats,
  useServerStats,
  useStationSearch,
  useToggleFavourite,
  useTopStations,
} from "@/hooks/use-radio";
import type { Station } from "@/lib/radio/types";

const routeApi = getRouteApi("/");

/** Selected countries as flag icons (display name text when no flag ships). */
function CountryFilterFlags({ countries }: { countries: string[] }) {
  return (
    <span className='flex shrink-0 items-center gap-1'>
      {countries.map((name) => {
        const iso = POPULAR_ISO_BY_NAME.get(name) ?? "";
        return iso !== "" && hasCountryFlag(iso) ? (
          <CountryFlag key={name} code={iso} name={displayCountryName(name)} />
        ) : (
          <span key={name} className='whitespace-nowrap'>
            {displayCountryName(name)}
          </span>
        );
      })}
    </span>
  );
}

const HOME_SECTIONS_KEY = "radioscout:home-sections";
const HOME_SECTIONS_DEFAULT = ["saved", "top", "british"];
const HOME_SECTION_IDS = new Set(["saved", "top", "british", "recent", "stats"]);
/** Hoisted: the persisted hook needs a referentially stable fallback. */
const LANGUAGES_FALLBACK: string[] = [];
const COUNTRIES_FALLBACK: string[] = [];
const QUALITY_FALLBACK = "0";
/** Exact directory name → bundled-flag ISO (selections outside the popular list show their name). */
const POPULAR_ISO_BY_NAME = new Map(POPULAR_COUNTRIES.map((country) => [country.name, country.iso] as const));

export default function HomePage() {
  const { q = "", tag = "all" } = routeApi.useSearch();
  const isClient = useIsClient();
  const openDetail = useOpenStationDetail();
  const [openSections, setOpenSections] = usePersistentStrings(HOME_SECTIONS_KEY, HOME_SECTIONS_DEFAULT);
  const visibleSections = openSections.filter((id) => HOME_SECTION_IDS.has(id));
  const [languages] = usePersistentStrings(LANGUAGES_KEY, LANGUAGES_FALLBACK);
  const [countries] = usePersistentStrings(COUNTRIES_KEY, COUNTRIES_FALLBACK);
  const [quality] = usePersistentString(QUALITY_KEY, QUALITY_FALLBACK);
  const minBitrate = normalizeMinBitrate(quality);
  const languageLabel = languages.length > 0 ? formatTags(languages.join(",")) : "";
  const countryLabel = countries.map((name) => displayCountryName(name)).join(", ");
  const qualitySetting = minBitrate > 0 ? qualityLabel(minBitrate) : "";
  const top = useTopStations("votes", languages, minBitrate, countries);
  // Matches RadioHeader's hydration gate: the prerender has no search state,
  // so a direct `/?q=` / `/?tag=` load renders home sections until the client
  // takes over instead of mismatching the results branch (React #418).
  const filtering = isClient && (q.trim() !== "" || tag !== "all");
  const search = useStationSearch(
    {
      name: q.trim() || undefined,
      tag: tag === "all" ? undefined : tag,
      limit: 50,
      languages,
      countries,
      minBitrate: minBitrate || undefined,
    },
    filtering,
  );
  const favourites = useFavourites();
  const history = useHistory();
  const listening = useListeningStats();
  const stats = useServerStats();
  const toggleFavourite = useToggleFavourite();
  const clearHistory = useClearHistory();
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const player = usePlayer();

  const favouriteIds = useMemo(() => new Set(favourites.data.map((row) => row.stationuuid)), [favourites.data]);

  // Cross-component signal from the command palette (`open-home-section`):
  // expand the section, then scroll it into view once the accordion paints.
  // A window event (not props) because the palette lives outside Home.
  useEffect(() => {
    const onOpenSection = (event: Event) => {
      const section = (event as CustomEvent<{ section?: unknown }>).detail?.section;
      if (typeof section !== "string" || !HOME_SECTION_IDS.has(section)) return;
      if (!openSections.includes(section)) setOpenSections([...openSections, section]);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.querySelector(`#home-section-${section}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
    };
    globalThis.addEventListener("open-home-section", onOpenSection);
    return () => globalThis.removeEventListener("open-home-section", onOpenSection);
  }, [openSections, setOpenSections]);

  const renderRow = (station: Station, key?: string) => (
    <StationCard
      key={key ?? station.stationuuid}
      station={station}
      playing={player.station?.stationuuid === station.stationuuid && player.status === "playing"}
      favourited={favouriteIds.has(station.stationuuid)}
      onPlay={togglePlay}
      onToggleFavourite={(item) => toggleFavourite.mutate(item)}
      onOpenDetail={openDetail}
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
                {search.data
                  ? `${search.data.length} found${languageLabel ? ` · ${languageLabel}` : ""}${countryLabel ? ` · ${countryLabel}` : ""}`
                  : "Searching…"}
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
                  <Link to='/' replace search={(prev) => ({ ...prev, q: undefined, tag: undefined })} className='mt-4'>
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
              <AccordionItem value='saved' id='home-section-saved' className='border-0'>
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

              <AccordionItem value='top' id='home-section-top' className='border-0'>
                <AccordionTrigger className='py-4 hover:no-underline'>
                  <span className='flex items-center gap-3'>
                    <span
                      aria-hidden='true'
                      className='grid size-10 place-items-center rounded-2xl bg-scout-blush text-scout-coal'>
                      <Heart className='size-5' />
                    </span>
                    <span className='text-lg font-semibold tracking-tight'>Most loved</span>
                    {top.data ? <Badge variant='secondary'>{top.data.length}</Badge> : null}
                    {languageLabel || countries.length > 0 || qualitySetting ? (
                      <span className='flex min-w-0 items-center gap-1.5 truncate text-xs font-medium text-muted-foreground'>
                        {languageLabel ? <span className='min-w-0 truncate'>{languageLabel}</span> : null}
                        {countries.length > 0 ? <CountryFilterFlags countries={countries} /> : null}
                        {qualitySetting ? <span className='shrink-0'>{qualitySetting}</span> : null}
                      </span>
                    ) : null}
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

              <BestOfBritish renderRow={renderRow} />

              {history.data.length > 0 ? (
                <AccordionItem value='recent' id='home-section-recent' className='border-0'>
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
                    <ul className='flex flex-col gap-2'>
                      {history.data.slice(0, 10).map((row) => renderRow(row.snapshot, `${row.id}-${row.played_at}`))}
                    </ul>
                    <div className='mt-4 flex justify-center'>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={() => setConfirmClearHistory(true)}
                        className='min-w-36 rounded-full bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'>
                        <Trash2 aria-hidden='true' />
                        Clear history
                      </Button>
                    </div>
                    <ConfirmDialog
                      open={confirmClearHistory}
                      onOpenChange={setConfirmClearHistory}
                      title='Clear history?'
                      description='This erases your recently played list. Saved stations and listening stats stay put.'
                      confirmLabel='Clear'
                      pending={clearHistory.isPending}
                      onConfirm={() => {
                        clearHistory.mutate();
                        setConfirmClearHistory(false);
                      }}
                    />
                  </AccordionContent>
                </AccordionItem>
              ) : null}

              {listening.data.totalSeconds > 0 ? (
                <AccordionItem value='stats' id='home-section-stats' className='border-0'>
                  <AccordionTrigger className='py-4 hover:no-underline'>
                    <span className='flex items-center gap-3'>
                      <span
                        aria-hidden='true'
                        className='grid size-10 place-items-center rounded-2xl bg-scout-mint text-scout-coal'>
                        <ChartColumn className='size-5' />
                      </span>
                      <span className='text-lg font-semibold tracking-tight'>Listening</span>
                      <span className='truncate text-xs font-medium text-muted-foreground'>
                        {formatListeningTime(listening.data.totalSeconds)}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ListeningStats />
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
