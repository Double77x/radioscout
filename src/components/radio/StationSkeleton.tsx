import { cn } from "@/lib/utils";

/**
 * Card-shaped loading placeholders that mirror `StationCard` geometry
 * (min-h-16 row, play circle, art tile, two text lines, star) so lists
 * swap from skeleton to content with no layout shift. Decorative —
 * always `aria-hidden`; the section owns the busy announcement.
 */
export function StationCardSkeleton() {
  return (
    <li
      aria-hidden='true'
      className='flex min-h-16 animate-pulse items-center gap-2 rounded-3xl border border-border bg-card p-3 pr-2 motion-reduce:animate-none'>
      <span className='size-10 shrink-0 rounded-full bg-muted' />
      <span className='size-9 shrink-0 rounded-xl bg-muted' />
      <span className='min-w-0 flex-1'>
        <span className='block h-4 w-3/5 rounded-full bg-muted' />
        <span className='mt-1.5 block h-3 w-2/5 rounded-full bg-muted opacity-70' />
      </span>
      <span className='size-10 shrink-0 rounded-full bg-muted' />
    </li>
  );
}

/** Skeleton station list. `rows` should match the section's typical count. */
export function StationListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <ul aria-hidden='true' className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: rows }, (_, key) => (
        <StationCardSkeleton key={key} />
      ))}
    </ul>
  );
}
