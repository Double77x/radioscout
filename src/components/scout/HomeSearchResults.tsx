import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { SearchX } from "lucide-react";
import { StationListSkeleton } from "@/components/radio/StationSkeleton";
import { Button } from "@/components/ui/button";
import type { Station } from "@/lib/radio/types";

interface HomeSearchResultsProps {
  stations: Station[] | undefined;
  languageLabel: string;
  countryLabel: string;
  renderRow: (station: Station) => ReactNode;
}

/** Filtered search branch: count strip, result rows, or an empty/skeleton state. */
export function HomeSearchResults({ stations, languageLabel, countryLabel, renderRow }: HomeSearchResultsProps) {
  return (
    <section aria-label='Search results' aria-busy={!stations} className='scroll-mt-4 px-4 pt-5'>
      <div className='flex items-baseline justify-between'>
        <h2 className='text-lg font-semibold tracking-tight'>Results</h2>
        <p className='text-xs font-medium text-muted-foreground'>
          {stations
            ? `${stations.length} found${languageLabel ? ` · ${languageLabel}` : ""}${countryLabel ? ` · ${countryLabel}` : ""}`
            : "Searching…"}
        </p>
      </div>
      {stations ? (
        stations.length > 0 ? (
          <ul className='mt-3 flex flex-col gap-2'>{stations.map((station) => renderRow(station))}</ul>
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
  );
}
