import { Crown } from "lucide-react";
import type { ReactNode } from "react";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { StationListSkeleton } from "@/components/radio/StationSkeleton";
import { useBestOfBritish } from "@/hooks/use-best-of-british";
import type { Station } from "@/lib/radio/types";

/**
 * Curated "Best of British" shelf (uuid list in
 * `src/data/best-of-british.ts`). Renders rows through Home's `renderRow`
 * so play / favourite / detail behaviour matches every other list — this
 * component only owns the section chrome and the shelf query.
 */
export function BestOfBritish({ renderRow }: { renderRow: (station: Station) => ReactNode }) {
  const british = useBestOfBritish();

  return (
    <AccordionItem value='british' id='home-section-british' className='border-0'>
      <AccordionTrigger className='py-4 hover:no-underline'>
        <span className='flex items-center gap-3'>
          <span
            aria-hidden='true'
            className='grid size-10 place-items-center rounded-2xl bg-scout-ink text-scout-paper'>
            <Crown className='size-5' />
          </span>
          <span className='text-lg font-semibold tracking-tight'>Best of British</span>
          {british.data ? <Badge variant='secondary'>{british.data.length}</Badge> : null}
        </span>
      </AccordionTrigger>
      <AccordionContent aria-busy={!british.data && !british.isError}>
        {british.data ? (
          british.data.length > 0 ? (
            <ul className='flex flex-col gap-2'>{british.data.map((station) => renderRow(station))}</ul>
          ) : (
            <p className='text-sm text-muted-foreground'>No British stations available right now.</p>
          )
        ) : british.isError ? (
          <p role='alert' className='text-sm text-muted-foreground'>
            Couldn't reach the station directory. Check your connection and try again.
          </p>
        ) : (
          <StationListSkeleton />
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
