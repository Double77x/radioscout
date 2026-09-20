import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type SyntheticEvent } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Search, X } from "lucide-react";
import { SettingsMenu } from "@/components/scout/SettingsMenu";
import { Input } from "@/components/ui/input";
import { FOCUS_RADIO_SEARCH_EVENT } from "@/lib/focus-radio-search";
import { GENRE_FILTERS } from "@/lib/radio/genres";
import { formatStationCount } from "@/lib/radio/format";
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
  const searchRef = useRef<HTMLInputElement | null>(null);
  // Drag-to-scroll state for the chip rail (mouse only — touch keeps
  // native momentum scrolling). Refs only, no effects: pointer handlers
  // below own the whole gesture.
  const railRef = useRef<HTMLDivElement | null>(null);
  const railDrag = useRef<{ startX: number; startScroll: number } | null>(null);
  const railMoved = useRef(false);

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

  const setSearch = (next: { q?: string; tag?: string }) =>
    navigate({
      to: "/",
      search: { q: next.q || undefined, tag: next.tag === "all" ? undefined : next.tag },
      replace: true,
    });

  const clearSearch = () => {
    setSearch({ tag: genre });
    searchRef.current?.focus();
  };

  const onRailPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" || (event.pointerType === "mouse" && event.button !== 0)) return;
    const rail = railRef.current;
    if (!rail) return;
    railDrag.current = { startX: event.clientX, startScroll: rail.scrollLeft };
    railMoved.current = false;
  };

  const onRailPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = railDrag.current;
    const rail = railRef.current;
    if (!drag || !rail) return;
    const dx = event.clientX - drag.startX;
    if (!railMoved.current && Math.abs(dx) > 6) {
      // A real drag: capture so the trailing click lands on the rail
      // (where the capture-click guard swallows it) instead of a chip.
      railMoved.current = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    if (railMoved.current) rail.scrollLeft = drag.startScroll - dx;
  };

  const endRailDrag = () => {
    railDrag.current = null;
  };

  // Swallow the click that lands a real drag (capture runs before the
  // chip link sees it); plain clicks pass through untouched.
  const onRailClickCapture = (event: SyntheticEvent) => {
    if (!railMoved.current) return;
    railMoved.current = false;
    event.preventDefault();
    event.stopPropagation();
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
                ref={searchRef}
                type='search'
                autoComplete='off'
                placeholder={
                  totalStations === undefined
                    ? "Search stations…"
                    : `Search ${formatStationCount(totalStations)}+ stations…`
                }
                value={query}
                onChange={(event) => setSearch({ q: event.target.value, tag: genre })}
                className='h-12 rounded-full border-border bg-card pr-12 pl-11 text-base shadow-sm placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden'
              />
              {query === "" ? null : (
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

          <fieldset className='m-0 min-w-0 border-0 p-0'>
            <legend className='sr-only'>Filter by genre</legend>
            <div
              ref={railRef}
              onPointerDown={onRailPointerDown}
              onPointerMove={onRailPointerMove}
              onPointerUp={endRailDrag}
              onPointerCancel={endRailDrag}
              onClickCapture={onRailClickCapture}
              className='scout-no-scrollbar -mx-4 mt-3 flex cursor-grab gap-2 overflow-x-auto px-4 pb-1 select-none active:cursor-grabbing'>
              {GENRE_FILTERS.map((filter) => {
                const active = genre === filter.id;
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
                    search={{ tag: filter.id === "all" ? undefined : filter.id, q: query || undefined }}
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
