import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Search, X } from "lucide-react";
import { SettingsMenu } from "@/components/scout/SettingsMenu";
import { Input } from "@/components/ui/input";
import { useDragScroll } from "@/hooks/use-drag-scroll";
import { useIsClient } from "@/hooks/use-is-client";
import { usePersistentStrings } from "@/hooks/use-persistent-state";
import { FOCUS_RADIO_SEARCH_EVENT } from "@/lib/focus-radio-search";
import { GENRE_FILTERS } from "@/lib/radio/genres";
import { formatStationCount } from "@/lib/radio/format";
import { clearRecentSearches, RECENT_SEARCHES_KEY, recordRecentSearch } from "@/lib/radio/recent-searches";
import { cn } from "@/lib/utils";

interface RadioHeaderProps {
  query: string;
  genre: string;
  /** Directory total (undefined while loading) + local saved count. */
  totalStations?: number;
  saved: number;
  /** Focus search on mount for fine pointers. Off on secondary pages. */
  autoFocus?: boolean;
  /** Show the search field and genre chips. Off on secondary pages. */
  searchable?: boolean;
}

function openPalette() {
  globalThis.dispatchEvent(new Event("open-command-palette"));
}

/** Hoisted: the persisted hook needs a referentially stable fallback. */
const RECENT_SEARCHES_FALLBACK: string[] = [];

/** Greeting header, station search and genre chips. Same skeleton as HomeHeader. */
export function RadioHeader({
  query,
  genre,
  totalStations,
  saved,
  autoFocus = true,
  searchable = true,
}: RadioHeaderProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isClient = useIsClient();
  // Prerendered HTML has no search state, so a direct load of a shared
  // `/?q=` / `/?tag=` URL would hydrate mismatched (active chip, input
  // value) and throw React #418. Render the default search UI until the
  // client takes over — one silent extra render, only for param URLs.
  const shownQuery = isClient ? query : "";
  const shownGenre = isClient ? genre : "all";
  const [recentSearches] = usePersistentStrings(RECENT_SEARCHES_KEY, RECENT_SEARCHES_FALLBACK);
  const searchRef = useRef<HTMLInputElement | null>(null);
  // The box is typed into faster than router navigations commit: driving
  // `value` straight from the URL lets a still-committing keystroke rewrite
  // the field mid-word and collapse the cursor. So the draft owns the box
  // while focused, and the URL is pushed underneath on every keystroke
  // (results stay live); the effect below adopts URL edits that came from
  // anywhere else (chips, clear, back/forward, palette jumps).
  const [draft, setDraft] = useState(shownQuery);
  const pushedRef = useRef(shownQuery);
  // Recents only make sense on the client with an empty box: while typing,
  // results own the space below. Gated on `isClient` like the query above
  // so the prerender never mismatches hydration.
  const showRecents = isClient && searchable && draft === "" && recentSearches.length > 0;
  // Drag-to-scroll rails (genre chips + recent searches; mouse only — touch
  // keeps native momentum scrolling). Hook refs only, no effects: the
  // handlers own the whole gesture. Destructured (not dotted) so the
  // react-doctor refs rule sees plain identifiers, not ref member access.
  const { ref: genreRef, handlers: genreHandlers } = useDragScroll<HTMLDivElement>();
  const { ref: recentsRef, handlers: recentsHandlers } = useDragScroll<HTMLDivElement>();

  // Search is the app's front door: focus it on load for precise pointers
  // (touch devices keep the keyboard down), and on `focus-radio-search`
  // events (dock Browse button). A focus subscription by nature.
  // eslint-disable-next-line react-doctor/effect-needs-cleanup
  useEffect(() => {
    if (autoFocus && globalThis.matchMedia?.("(pointer: fine)").matches) searchRef.current?.focus();
    const onFocusSearch = () => searchRef.current?.focus();
    globalThis.addEventListener(FOCUS_RADIO_SEARCH_EVENT, onFocusSearch);
    return () => globalThis.removeEventListener(FOCUS_RADIO_SEARCH_EVENT, onFocusSearch);
  }, [autoFocus]);

  // Adopt URL edits from elsewhere (chips, clear button, back/forward,
  // palette section jumps) — but never while the user is mid-keystroke, or
  // a lagging commit yanks the cursor. A subscription-by-nature exception
  // alongside the focus one above: the URL is written from many owners.
  useEffect(() => {
    if (document.activeElement !== searchRef.current && query !== pushedRef.current) {
      pushedRef.current = query;
      setDraft(query);
    }
  }, [query]);

  const setSearch = (next: { q?: string; tag?: string }) =>
    navigate({
      to: "/",
      search: (prev) => ({
        q: next.q || undefined,
        tag: next.tag === "all" ? undefined : next.tag,
        station: prev.station,
      }),
      replace: true,
    });

  const clearSearch = () => {
    pushedRef.current = "";
    setDraft("");
    setSearch({ tag: shownGenre });
    searchRef.current?.focus();
  };

  return (
    <header className='px-4 pt-5'>
      <div className='flex items-center gap-3'>
        <SettingsMenu variant='logo' />
        <div className='min-w-0 flex-1'>
          <p className='text-xs font-semibold tracking-widest text-muted-foreground uppercase'>RadioScout · On air</p>
          <p className='truncate text-sm font-medium' aria-busy={totalStations === undefined}>
            {totalStations === undefined ? (
              <span
                aria-hidden='true'
                className='inline-block h-4 w-36 animate-pulse rounded-full bg-muted align-middle motion-reduce:animate-none'
              />
            ) : (
              `${formatStationCount(totalStations)} stations · ${saved} saved`
            )}
          </p>
        </div>
        {pathname === "/" ? null : (
          <Link
            to='/'
            aria-label='Back to home'
            className='grid size-12 shrink-0 place-items-center rounded-full border border-border bg-card text-muted-foreground transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'>
            <ArrowLeft className='size-5' />
          </Link>
        )}
        <button
          type='button'
          onClick={openPalette}
          aria-label='Quick find'
          className='grid size-12 shrink-0 place-items-center rounded-full border border-border bg-card text-muted-foreground transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'>
          <Search className='size-5' />
        </button>
      </div>

      {searchable ? (
        <>
          <h1 className='mt-5 text-scout-title leading-tight font-semibold tracking-tight text-balance'>On air.</h1>
          <p className='mt-1 text-sm text-muted-foreground'>Free worldwide radio — find a station in seconds.</p>

          <search className='mt-4 block'>
            <label htmlFor='radio-search' className='sr-only'>
              Search stations by name
            </label>
            <div className='relative'>
              <Search
                aria-hidden='true'
                className='pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground'
              />
              <Input
                id='radio-search'
                data-testid='radio-search'
                ref={searchRef}
                type='search'
                autoComplete='off'
                placeholder={
                  totalStations === undefined
                    ? "Search stations…"
                    : `Search ${formatStationCount(totalStations)}+ stations…`
                }
                value={draft}
                onChange={(event) => {
                  const next = event.target.value;
                  pushedRef.current = next;
                  setDraft(next);
                  setSearch({ q: next, tag: shownGenre });
                }}
                onBlur={() => {
                  recordRecentSearch(draft);
                  // Converge a box left stale by an in-flight commit.
                  if (query !== pushedRef.current) {
                    pushedRef.current = query;
                    setDraft(query);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") recordRecentSearch(draft);
                }}
                className='h-12 rounded-full border-border bg-card pr-12 pl-11 text-base shadow-sm placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden'
              />
              {draft === "" ? null : (
                <button
                  type='button'
                  onClick={clearSearch}
                  aria-label='Clear search'
                  className='absolute top-1/2 right-1 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-border bg-card text-muted-foreground transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'>
                  <X className='size-6' />
                </button>
              )}
            </div>
          </search>

          {showRecents ? (
            <section aria-label='Recent searches' className='mt-3 flex items-center gap-2'>
              <div
                ref={recentsRef}
                {...recentsHandlers}
                className='scout-no-scrollbar scout-mask-fade-r flex min-w-0 flex-1 cursor-grab items-center gap-2 overflow-x-auto pb-1 select-none active:cursor-grabbing'>
                {recentSearches.map((term) => (
                  <button
                    key={term}
                    type='button'
                    onClick={() => {
                      recordRecentSearch(term);
                      pushedRef.current = term;
                      setDraft(term);
                      setSearch({ q: term, tag: shownGenre });
                    }}
                    className='shrink-0 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'>
                    {term}
                  </button>
                ))}
              </div>
              <button
                type='button'
                onClick={clearRecentSearches}
                aria-label='Clear recent searches'
                className='-ml-12 shrink-0 rounded-full bg-background py-2 pr-2 pl-12 text-sm font-medium whitespace-nowrap text-muted-foreground transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'>
                Clear
              </button>
            </section>
          ) : null}

          <fieldset className='m-0 min-w-0 border-0 p-0'>
            <legend className='sr-only'>Filter by genre</legend>
            <div
              ref={genreRef}
              {...genreHandlers}
              className='scout-no-scrollbar -mx-4 mt-3 flex cursor-grab gap-2 overflow-x-auto px-4 pb-1 select-none active:cursor-grabbing'>
              {GENRE_FILTERS.map((filter) => {
                const active = shownGenre === filter.id;
                return active ? (
                  <span
                    key={filter.id}
                    className='shrink-0 rounded-full bg-scout-ink px-5 py-3 text-sm font-semibold text-scout-paper'>
                    {filter.label}
                  </span>
                ) : (
                  <Link
                    key={filter.id}
                    to='/'
                    draggable={false}
                    search={(prev) => ({
                      tag: filter.id === "all" ? undefined : filter.id,
                      q: draft || undefined,
                      station: prev.station,
                    })}
                    replace
                    className={cn(
                      "shrink-0 rounded-full border border-border bg-card px-5 py-3 text-sm font-medium text-muted-foreground transition hover:text-foreground",
                    )}>
                    {filter.label}
                  </Link>
                );
              })}
            </div>
          </fieldset>
        </>
      ) : null}
    </header>
  );
}
