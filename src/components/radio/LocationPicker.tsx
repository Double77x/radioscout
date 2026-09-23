import { useId, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { CountryFlag } from "@/components/radio/CountryFlag";
import { useIsClient } from "@/hooks/use-is-client";
import { usePersistentStrings } from "@/hooks/use-persistent-state";
import { COUNTRIES_KEY, displayCountryName } from "@/lib/radio/countries";
import type { DirectoryCountry } from "@/lib/radio/country-all";
import { POPULAR_COUNTRIES } from "@/lib/radio/country-popular";
import { cn } from "@/lib/utils";

/** Full directory lazy-loads on first open — never in the initial bundle. */
const loadDirectory = () => import("@/lib/radio/country-all");
/** Query client stays out of the initial bundle — loaded on demand. */
const loadQueryClient = () => import("@/lib/query-client");

/** Stable fallback for the persisted hook (referential stability matters). */
const WORLDWIDE: string[] = [];

/** Curated ISO per country name; selections outside the popular list resolve from the directory. */
const POPULAR_ISO = new Map(POPULAR_COUNTRIES.map((country) => [country.name, country.iso] as const));

interface CountryRow {
  name: string;
  iso: string;
}

function toggleMembership(current: string[], name: string): string[] {
  return current.includes(name) ? current.filter((entry) => entry !== name) : [...current, name];
}

function matchesQuery(name: string, iso: string, display: string, query: string): boolean {
  return name.includes(query) || display.includes(query) || (iso !== "" && iso.startsWith(query));
}

function haystackFor(country: { name: string; iso: string }): { name: string; iso: string; display: string } {
  return {
    name: country.name.toLowerCase(),
    iso: country.iso.toLowerCase(),
    display: displayCountryName(country.name).toLowerCase(),
  };
}

/** ISO for a selected country: popular shortlist first, directory once loaded, name-only otherwise. */
function isoFor(name: string, directory: DirectoryCountry[] | null): string {
  const popular = POPULAR_ISO.get(name);
  if (popular) return popular;
  if (!directory) return "";
  return directory.find((entry) => entry.name === name)?.iso ?? "";
}

/**
 * Station-country filter dropdown for Settings. Collapsed trigger with the
 * current selection; expanding reveals search + one virtualized multiselect
 * list (popular countries pinned first, full directory behind). In-flow
 * rather than floating so the settings popover never clips it.
 * Client-gated: the virtualizer measures DOM and must never run during SSG
 * prerender. Selections are exact directory names for `?country=`.
 */
export function LocationPicker() {
  const isClient = useIsClient();
  const [countries, setCountries] = usePersistentStrings(COUNTRIES_KEY, WORLDWIDE);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [directory, setDirectory] = useState<DirectoryCountry[] | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const searchId = useId();
  const panelId = useId();

  const select = (next: string[]) => {
    setCountries(next);
    // Keys already carry the countries, but favour instant consistency.
    void loadQueryClient().then(({ queryClient }) => queryClient.invalidateQueries({ queryKey: ["radio"] }));
  };

  const ensureDirectory = () => {
    if (directory !== null) return;
    void loadDirectory().then((mod) => setDirectory(mod.DIRECTORY_COUNTRIES));
  };

  const toggleOpen = () => {
    setOpen((prev) => {
      if (prev) setQuery("");
      return !prev;
    });
  };

  // Typing searches the whole directory — pull it in on first keystroke.
  // Idle shows the popular list only; the full chunk never loads otherwise.
  const onQuery = (value: string) => {
    setQuery(value);
    if (value.trim() !== "") ensureDirectory();
  };

  const trimmed = query.trim().toLowerCase();
  const selected = useMemo(() => new Set(countries), [countries]);
  const popularNames = useMemo(() => new Set(POPULAR_COUNTRIES.map((country) => country.name)), []);
  const rows = useMemo<CountryRow[]>(() => {
    const popular: CountryRow[] = POPULAR_COUNTRIES.filter((country) => {
      const hay = haystackFor(country);
      return trimmed === "" || matchesQuery(hay.name, hay.iso, hay.display, trimmed);
    });
    // Idle: popular list only. The full directory joins in for searches.
    if (trimmed === "" || directory === null) return popular;
    const rest: CountryRow[] = directory.flatMap((country) => {
      const hay = haystackFor(country);
      return popularNames.has(country.name) || !matchesQuery(hay.name, hay.iso, hay.display, trimmed)
        ? []
        : [{ name: country.name, iso: country.iso }];
    });
    return [...popular, ...rest];
  }, [directory, popularNames, trimmed]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 44,
    overscan: 8,
  });

  if (!isClient) {
    return <div aria-hidden='true' className='h-24 animate-pulse rounded-2xl bg-muted' />;
  }

  const summary =
    countries.length === 0
      ? "Worldwide — all countries"
      : countries.length === 1
        ? displayCountryName(countries[0] ?? "")
        : `${displayCountryName(countries[0] ?? "")} +${countries.length - 1}`;

  return (
    <div>
      {countries.length > 0 ? (
        <ul aria-label='Selected countries' className='flex flex-wrap gap-1.5'>
          {countries.map((name) => (
            <li key={name}>
              <button
                type='button'
                aria-label={`Remove ${name}`}
                onClick={() => select(toggleMembership(countries, name))}
                className='flex min-h-9 items-center gap-1.5 rounded-full bg-scout-ink pr-2.5 pl-3 text-xs font-semibold text-scout-paper transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'>
                <CountryFlag code={isoFor(name, directory)} name={displayCountryName(name)} />
                <span>{displayCountryName(name)}</span>
                <X className='size-3.5' />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type='button'
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggleOpen}
        className={cn(
          "flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          countries.length > 0 ? "mt-2 w-full" : "w-full",
        )}>
        <span className='min-w-0 flex-1 truncate text-left font-medium'>
          {countries.length === 0 ? "Worldwide — all countries" : summary}
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div id={panelId} className='mt-2 animate-dropdown-in rounded-2xl border border-border bg-card p-2'>
          <div className='relative'>
            <Search
              aria-hidden='true'
              className='pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground'
            />
            <label htmlFor={searchId} className='sr-only'>
              Search countries
            </label>
            <input
              id={searchId}
              type='search'
              autoComplete='off'
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              placeholder='Search 200+ countries…'
              className='h-10 w-full rounded-full border border-border bg-card pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-search-cancel-button]:hidden'
            />
          </div>

          <fieldset className='m-0 mt-1 min-w-0 border-0 p-0'>
            <legend className='sr-only'>Choose countries</legend>
            <div ref={scrollRef} className='h-60 overflow-y-auto overscroll-contain rounded-xl'>
              {rows.length === 0 ? (
                <p className='p-3 text-xs text-muted-foreground'>Nothing matches that.</p>
              ) : (
                <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
                  {virtualizer.getVirtualItems().map((item) => {
                    const country = rows[item.index];
                    if (!country) return null;
                    const active = selected.has(country.name);
                    return (
                      <button
                        key={country.name}
                        type='button'
                        aria-pressed={active}
                        onClick={() => select(toggleMembership(countries, country.name))}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: item.size,
                          transform: `translateY(${item.start}px)`,
                        }}
                        className={cn(
                          "flex items-center gap-2 px-2 text-left text-xs transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none",
                          active ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground",
                        )}>
                        <CountryFlag code={country.iso} name={displayCountryName(country.name)} />
                        <span className='min-w-0 flex-1 truncate'>{displayCountryName(country.name)}</span>
                        {active ? <Check className='size-3.5 shrink-0' /> : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </fieldset>
          <p className='px-2 pt-1.5 text-xs text-muted-foreground' aria-live='polite'>
            {trimmed === ""
              ? "Top countries — type to search 200+ countries"
              : directory === null
                ? "Searching the full directory…"
                : `${rows.length} match${rows.length === 1 ? "" : "es"}`}
          </p>
        </div>
      ) : null}
    </div>
  );
}
