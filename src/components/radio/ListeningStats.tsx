import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useClearListening, useListeningStats } from "@/hooks/use-radio";
import { formatListeningTime } from "@/lib/radio/format";
import type { DayBucket, ListeningSummary } from "@/lib/radio/store";
import { cn } from "@/lib/utils";

/** Chart rows per breakdown (mobile-first: five fits a phone column). */
const TOP_ROWS = 5;
/** Fixed column height (px) — bars compute pixel geometry, never scaled radii. */
const DAY_COLUMN_PX = 96;

const VIEWS = [
  { id: "total", label: "Total" },
  { id: "daily", label: "Daily" },
] as const;

type StatsView = (typeof VIEWS)[number]["id"];

/**
 * Listening charts for the home sections, toggled along the top: total time
 * per station, average session per weekday. Bars are plain SVG rects in
 * pixel geometry (no `viewBox` scaling, so corner radii stay circular) and
 * decorative (`aria-hidden`) — the adjacent HTML text carries names and
 * times for screen readers. Local-first: renders nothing until the first
 * session banks.
 */
export function ListeningStats() {
  const stats = useListeningStats();
  const clearListening = useClearListening();
  const [view, setView] = useState<StatsView>("total");
  const [confirmClear, setConfirmClear] = useState(false);

  if (stats.data.totalSeconds <= 0) return null;

  return (
    <div>
      <fieldset className='m-0 min-w-0 border-0 p-0'>
        <legend className='sr-only'>Choose breakdown</legend>
        <div className='grid grid-cols-2 gap-1 rounded-full border border-border bg-card p-1'>
          {VIEWS.map((option) => {
            const selected = view === option.id;
            return (
              <button
                key={option.id}
                type='button'
                aria-pressed={selected}
                onClick={() => setView(option.id)}
                className={cn(
                  "min-h-9 rounded-full text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  selected ? "bg-scout-ink text-scout-paper" : "text-muted-foreground hover:text-foreground",
                )}>
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className='mt-3'>
        {view === "total" ? <TotalView stats={stats.data} /> : <DailyView stats={stats.data} />}
      </div>

      <div className='mt-4 flex justify-center'>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          onClick={() => setConfirmClear(true)}
          className='min-w-36 rounded-full bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'>
          <Trash2 aria-hidden='true' />
          Clear stats
        </Button>
      </div>
      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title='Clear stats?'
        description='This erases total time, daily averages and top stations. History and favourites stay put.'
        confirmLabel='Clear'
        pending={clearListening.isPending}
        onConfirm={() => {
          clearListening.mutate();
          setConfirmClear(false);
        }}
      />
    </div>
  );
}

function TotalView({ stats }: { stats: ListeningSummary }) {
  const top = stats.stations.slice(0, TOP_ROWS);
  const max = Math.max(1, top[0]?.seconds ?? 1);
  return (
    <div>
      <p className='text-sm text-muted-foreground' aria-live='polite'>
        <span className='font-semibold text-foreground'>{formatListeningTime(stats.totalSeconds)}</span>
        {" listening · "}
        {stats.plays} {stats.plays === 1 ? "session" : "sessions"}
      </p>
      <ul className='mt-3 flex flex-col gap-3'>
        {top.map((station) => (
          <BarRow key={station.stationuuid} name={station.name} seconds={station.seconds} max={max} />
        ))}
      </ul>
    </div>
  );
}

function DailyView({ stats }: { stats: ListeningSummary }) {
  const totalDays = stats.byDay.reduce((sum, bucket) => sum + bucket.days, 0);
  const averageDay = totalDays === 0 ? 0 : Math.round(stats.totalSeconds / totalDays);
  const maxAvg = Math.max(1, ...stats.byDay.map((bucket) => averageOf(bucket)));
  return (
    <div>
      <p className='text-sm text-muted-foreground' aria-live='polite'>
        <span className='font-semibold text-foreground'>{formatListeningTime(averageDay)}</span> average day
      </p>
      <div className='mt-3 flex items-stretch gap-1.5'>
        {stats.byDay.map((bucket) => (
          <DayColumn key={bucket.day} bucket={bucket} maxAvg={maxAvg} />
        ))}
      </div>
    </div>
  );
}

/** Mean seconds banked per distinct date in the bucket (0 when unobserved). */
function averageOf(bucket: DayBucket): number {
  return bucket.days === 0 ? 0 : bucket.seconds / bucket.days;
}

/** Horizontal bar row: HTML labels (readers) + decorative SVG bar (sight). */
function BarRow({ name, seconds, max }: { name: string; seconds: number; max: number }) {
  const percent = Math.max(2, Math.min(100, (seconds / max) * 100));
  return (
    <li>
      <div className='flex items-baseline justify-between gap-2'>
        <span className='min-w-0 flex-1 truncate text-sm font-medium'>{name}</span>
        <span className='shrink-0 text-sm font-semibold text-muted-foreground tabular-nums'>
          {formatListeningTime(seconds)}
        </span>
      </div>
      <svg aria-hidden='true' className='mt-1 block h-2 w-full'>
        <rect x={0} y={0} width='100%' height={8} rx={4} className='fill-muted' />
        <rect x={0} y={0} width={`${percent}%`} height={8} rx={4} className='fill-primary' />
      </svg>
    </li>
  );
}

/** One weekday column: average day above a fixed-height SVG bar. */
function DayColumn({ bucket, maxAvg }: { bucket: DayBucket; maxAvg: number }) {
  const average = averageOf(bucket);
  const barPx = average <= 0 ? 0 : Math.max(8, (average / maxAvg) * DAY_COLUMN_PX);
  return (
    <div className='flex min-w-0 flex-1 flex-col items-center gap-1'>
      <span className='text-xs font-medium whitespace-nowrap text-muted-foreground tabular-nums'>
        {bucket.days === 0 ? "–" : formatListeningTime(Math.round(average))}
      </span>
      <svg aria-hidden='true' className='block w-full max-w-10' style={{ height: DAY_COLUMN_PX }}>
        <rect x={0} y={0} width='100%' height={DAY_COLUMN_PX} rx={4} className='fill-muted' />
        {barPx > 0 ? (
          <rect
            x={0}
            y={DAY_COLUMN_PX - barPx}
            width='100%'
            height={barPx}
            rx={Math.min(4, barPx / 2)}
            className='fill-primary'
          />
        ) : null}
      </svg>
      <abbr
        title={`${bucket.label} — ${formatListeningTime(Math.round(averageOf(bucket)))} average across ${bucket.days} ${bucket.days === 1 ? "day" : "days"}`}
        className='text-xs font-medium whitespace-nowrap text-muted-foreground no-underline'>
        {bucket.label}
      </abbr>
    </div>
  );
}
