import { useId, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { useClearListening, useListeningStats } from "@/hooks/use-radio";
import { formatListeningTime } from "@/lib/radio/format";
import type { DayBucket, DaypartBucket, ListeningStation, ListeningSummary } from "@/lib/radio/store";
import { cn } from "@/lib/utils";

/** Chart rows per breakdown (mobile-first: five fits a phone column). */
const TOP_ROWS = 5;
/** Fixed column height (px) — bars compute pixel geometry, never scaled radii. */
const DAY_COLUMN_PX = 96;
/** Trend column height (px) — bars compute pixel geometry, never scaled radii. */
const TREND_COLUMN_PX = 72;
/** Compact trend-row height (px) — small screens split strips into two rows
 * at half height, so the block keeps the same overall height. */
const TREND_ROW_PX = 36;
/** Row tints for the top-station bars (SVG `fill`). Full class names for Tailwind. */
const BAR_TONES = [
  "fill-primary",
  "fill-scout-ink",
  "fill-scout-butter",
  "fill-scout-blush",
  "fill-scout-sky",
] as const;

const VIEWS = [
  { id: "total", label: "Total" },
  { id: "daily", label: "Daily" },
  { id: "trend", label: "Trend" },
] as const;

type StatsView = (typeof VIEWS)[number]["id"];

const SORTS = [
  { id: "total", label: "Total" },
  { id: "sessions", label: "Sessions" },
  { id: "average", label: "Average" },
] as const;

type SortMode = (typeof SORTS)[number]["id"];

const TREND_RANGES = [
  { id: "days", label: "14 days" },
  { id: "weeks", label: "12 weeks" },
] as const;

type TrendRange = (typeof TREND_RANGES)[number]["id"];

/**
 * Listening charts for the home sections, toggled along the top: total time
 * per station (sortable, with a stacked share bar), average session per weekday,
 * streaks and records plus recent, weekly and daypart trends. Bars are plain
 * SVG rects in pixel geometry (no `viewBox` scaling, so corner radii stay
 * circular) and decorative (`aria-hidden`) — the adjacent HTML text carries
 * names and times for screen readers. Local-first: renders nothing until the
 * first session banks.
 */
export function ListeningStats() {
  const stats = useListeningStats();
  const clearListening = useClearListening();
  const [view, setView] = useState<StatsView>("total");
  const [confirmClear, setConfirmClear] = useState(false);

  if (stats.data.totalSeconds <= 0) return null;

  return (
    <div>
      <SegmentedControl label='Choose breakdown' options={VIEWS} value={view} onChange={setView} />

      <div className='mt-3'>
        {view === "total" ? (
          <TotalView stats={stats.data} />
        ) : view === "daily" ? (
          <DailyView stats={stats.data} />
        ) : (
          <TrendView stats={stats.data} />
        )}
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
        description='This erases total time, trends and top stations. History and favourites stay put.'
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
  const [sort, setSort] = useState<SortMode>("total");
  const cascadeId = useId();
  const ranked = stats.stations.toSorted((a, b) =>
    sort === "sessions"
      ? b.plays - a.plays || b.seconds - a.seconds
      : sort === "average"
        ? averageSession(b) - averageSession(a) || b.seconds - a.seconds
        : b.seconds - a.seconds,
  );
  const top = ranked.slice(0, TOP_ROWS);
  const total = modeTotal(stats, sort);
  const other = otherRow(top, stats, sort);
  const [cascade, setCascade] = useState(false);
  // Row geometry per layout. Standard bars scale against the biggest row;
  // cascade rows tile 0–100 by share (session counts in Sessions mode, time
  // otherwise), each starting where the previous share ended.
  const shareMetric = (station: ListeningStation): number => (sort === "sessions" ? station.plays : station.seconds);
  const rows: {
    key: string;
    name: string;
    label: string;
    display: number;
    share: number;
    tone: string;
  }[] = top.map((station, index) => {
    const row = stationRow(station, total, sort);
    return {
      key: station.stationuuid,
      name: station.name,
      label: row.label,
      display: row.value,
      share: total <= 0 ? 0 : (shareMetric(station) / total) * 100,
      tone: BAR_TONES[index] ?? BAR_TONES[0],
    };
  });
  if (other) {
    rows.push({
      key: "__other__",
      name: other.name,
      label: other.label,
      display: other.value,
      share: total <= 0 ? 0 : (other.share / total) * 100,
      tone: "fill-muted-foreground",
    });
  }
  const max = cascade ? 100 : Math.max(1, ...rows.map((row) => row.display));
  const starts = rows.map((_, index) => rows.slice(0, index).reduce((sum, row) => sum + row.share, 0));
  return (
    <div>
      <p className='text-sm text-muted-foreground' aria-live='polite'>
        <span className='font-semibold text-foreground'>{formatListeningTime(stats.totalSeconds)}</span>
        {" listening · "}
        {stats.plays} {stats.plays === 1 ? "session" : "sessions"}
      </p>
      <div className='mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2'>
        <SegmentedControl label='Sort top stations' options={SORTS} value={sort} onChange={setSort} density='compact' />
        <div className='flex min-h-7 items-center gap-2'>
          <Switch id={cascadeId} checked={cascade} onCheckedChange={setCascade} aria-label='Cascade bars' />
          <label htmlFor={cascadeId} className='cursor-pointer text-xs font-medium text-muted-foreground'>
            Cascade
          </label>
        </div>
      </div>
      <ul className='mt-3 flex flex-col gap-3'>
        {rows.map((row, index) => (
          <BarRow
            key={row.key}
            name={row.name}
            value={cascade ? row.share : row.display}
            max={max}
            offset={cascade ? (starts[index] ?? 0) : 0}
            valueLabel={row.label}
            barClass={row.tone}
          />
        ))}
      </ul>
    </div>
  );
}

/** Mean seconds per session (0 plays can't happen — every station has ≥1). */
function averageSession(station: ListeningStation): number {
  return station.seconds / Math.max(1, station.plays);
}

/** Bar value for the active sort: time, session count, or mean session. */
function sortValue(station: ListeningStation, sort: SortMode): number {
  return sort === "sessions"
    ? station.plays
    : sort === "average"
      ? Math.round(averageSession(station))
      : station.seconds;
}

/** Row caption for the active sort: time, session count, or mean session. */
function modeLabel(station: ListeningStation, sort: SortMode): string {
  if (sort === "sessions") return `${station.plays} ${station.plays === 1 ? "session" : "sessions"}`;
  const time = formatListeningTime(sortValue(station, sort));
  return sort === "average" ? `${time} avg` : time;
}

/** Share denominator for the active sort: session count, else total time
 * (an average has no meaningful share, so it keeps the time share). */
function modeTotal(stats: ListeningSummary, sort: SortMode): number {
  return sort === "sessions" ? stats.plays : stats.totalSeconds;
}

/** Share percent of the active metric, guarded against empty totals. */
function sharePct(value: number, total: number): number {
  return total <= 0 ? 0 : Math.round((value / total) * 100);
}

/** Row model for one station under the active sort (bar length + caption).
 * The percent always shares the sort's own denominator — session counts in
 * Sessions mode, total time otherwise (an average has no meaningful share,
 * so average rows keep their time share and sum to 100 with the rest). */
function stationRow(station: ListeningStation, total: number, sort: SortMode): { value: number; label: string } {
  const value = sortValue(station, sort);
  const share = sharePct(sort === "sessions" ? station.plays : station.seconds, total);
  return { value, label: `${modeLabel(station, sort)} (${share}%)` };
}

/** Muted "Other" row for everything outside the ranked top. Null when the
 * top accounts for every session. `share` backs the cascade position;
 * `value` is the displayed bar caption basis. */
function otherRow(
  top: ListeningStation[],
  stats: ListeningSummary,
  sort: SortMode,
): { name: string; value: number; label: string; share: number } | null {
  const topPlays = top.reduce((sum, station) => sum + station.plays, 0);
  const topSeconds = top.reduce((sum, station) => sum + station.seconds, 0);
  const otherPlays = stats.plays - topPlays;
  const otherSeconds = stats.totalSeconds - topSeconds;
  if (sort === "sessions") {
    if (otherPlays <= 0) return null;
    return {
      name: "Other sessions",
      value: otherPlays,
      label: `${otherPlays} ${otherPlays === 1 ? "session" : "sessions"} (${sharePct(otherPlays, stats.plays)}%)`,
      share: otherPlays,
    };
  }
  if (otherSeconds <= 0) return null;
  const timeShare = sharePct(otherSeconds, stats.totalSeconds);
  if (sort === "average") {
    const mean = Math.round(otherSeconds / Math.max(1, otherPlays));
    return {
      name: "Other stations",
      value: mean,
      label: `${formatListeningTime(mean)} avg (${timeShare}%)`,
      share: otherSeconds,
    };
  }
  return {
    name: "Other stations",
    value: otherSeconds,
    label: `${formatListeningTime(otherSeconds)} (${timeShare}%)`,
    share: otherSeconds,
  };
}

function DailyView({ stats }: { stats: ListeningSummary }) {
  const totalDays = stats.byDay.reduce((sum, bucket) => sum + bucket.days, 0);
  const averageDay = totalDays === 0 ? 0 : Math.round(stats.totalSeconds / totalDays);
  // Typical-week denominator: the seven daily averages sum to one average
  // week, so each column reads as that weekday's share of it.
  const typicalWeek = stats.byDay.reduce((sum, bucket) => sum + averageOf(bucket), 0);
  return (
    <div>
      <p className='text-sm text-muted-foreground' aria-live='polite'>
        <span className='font-semibold text-foreground'>{formatListeningTime(averageDay)}</span> average day
      </p>
      <div className='mt-3 flex items-stretch gap-1.5'>
        {stats.byDay.map((bucket) => (
          <DayColumn key={bucket.day} bucket={bucket} total={typicalWeek} />
        ))}
      </div>
    </div>
  );
}

/** Mean seconds banked per distinct date in the bucket (0 when unobserved). */
function averageOf(bucket: DayBucket): number {
  return bucket.days === 0 ? 0 : bucket.seconds / bucket.days;
}

function TrendView({ stats }: { stats: ListeningSummary }) {
  const recent = stats.byRecent;
  const recentSeconds = recent.reduce((sum, bucket) => sum + bucket.seconds, 0);
  const activeDays = recent.filter((bucket) => bucket.seconds > 0).length;
  const weeks = stats.byWeek;
  const weekSeconds = weeks.reduce((sum, bucket) => sum + bucket.seconds, 0);
  const activeWeeks = weeks.filter((bucket) => bucket.seconds > 0).length;
  const maxPart = Math.max(1, stats.totalSeconds);
  const [range, setRange] = useState<TrendRange>("days");
  const records = [
    {
      label: "Day streak",
      value: `${stats.streak.current} ${stats.streak.current === 1 ? "day" : "days"}`,
      sub: `longest ${stats.streak.longest}`,
    },
    {
      label: "Best day",
      value: stats.bestDay ? `${stats.bestDay.weekday} ${stats.bestDay.label} ${stats.bestDay.month}` : "–",
      sub: stats.bestDay ? formatListeningTime(stats.bestDay.seconds) : "–",
    },
    {
      label: "Longest session",
      value: formatListeningTime(stats.longestSession),
      sub: `${stats.plays} ${stats.plays === 1 ? "session" : "sessions"}`,
    },
  ];
  return (
    <div className='flex flex-col gap-5'>
      <section aria-label='Streaks and records'>
        {/* Compact layout (phones and tablets): full-width label/value rows. */}
        <dl className='flex flex-col gap-2 lg:hidden'>
          {records.map((record) => (
            <div
              key={record.label}
              className='flex items-baseline justify-between gap-3 rounded-2xl border border-border bg-card px-3 py-2'>
              <dt className='shrink-0 text-xs font-medium text-muted-foreground'>{record.label}</dt>
              <dd className='truncate text-sm font-semibold tabular-nums'>
                {record.value} <span className='font-normal text-muted-foreground'>· {record.sub}</span>
              </dd>
            </div>
          ))}
        </dl>
        {/* Wide layout: three cards with fixed-height rows. */}
        <div className='hidden grid-cols-3 gap-2 lg:grid'>
          {records.map((record) => (
            <StatCard key={record.label} label={record.label} value={record.value} sub={record.sub} />
          ))}
        </div>
      </section>

      <SegmentedControl
        label='Trend range'
        options={TREND_RANGES}
        value={range}
        onChange={setRange}
        density='compact'
      />

      {range === "days" ? (
        <section aria-label='Last 14 days'>
          <p className='text-sm text-muted-foreground' aria-live='polite'>
            <span className='font-semibold text-foreground'>{formatListeningTime(recentSeconds)}</span>
            {" in the last 14 days · "}
            {activeDays} of {recent.length} days active
          </p>
          {/* Compact layout: 2 rows of 7 at half height — roomier ordinal labels. */}
          <div className='mt-3 grid grid-cols-7 gap-x-0.5 gap-y-2 lg:hidden'>
            {recent.map((bucket, index) => (
              <TrendColumn
                key={bucket.date}
                label={bucket.label}
                sublabel={bucket.month}
                title={`${bucket.weekday} ${bucket.label} — ${formatListeningTime(bucket.seconds)} across ${bucket.plays} ${bucket.plays === 1 ? "session" : "sessions"}`}
                seconds={bucket.seconds}
                max={recentSeconds}
                isToday={index === recent.length - 1}
                height={TREND_ROW_PX}
              />
            ))}
          </div>
          {/* Wide layout: single row of 14 at full height. */}
          <div className='mt-3 hidden items-stretch gap-0.5 lg:flex'>
            {recent.map((bucket, index) => (
              <TrendColumn
                key={bucket.date}
                label={bucket.label}
                sublabel={bucket.month}
                title={`${bucket.weekday} ${bucket.label} — ${formatListeningTime(bucket.seconds)} across ${bucket.plays} ${bucket.plays === 1 ? "session" : "sessions"}`}
                seconds={bucket.seconds}
                max={recentSeconds}
                isToday={index === recent.length - 1}
                height={TREND_COLUMN_PX}
              />
            ))}
          </div>
          <ul className='sr-only'>
            {recent.map((bucket) => (
              <li key={bucket.date}>
                {bucket.weekday} {bucket.label} {bucket.month}: {formatListeningTime(bucket.seconds)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {range === "weeks" ? (
        <section aria-label='Last 12 weeks'>
          <p className='text-sm text-muted-foreground' aria-live='polite'>
            <span className='font-semibold text-foreground'>{formatListeningTime(weekSeconds)}</span>
            {" in the last 12 weeks · "}
            {activeWeeks} of {weeks.length} weeks active
          </p>
          {/* Compact layout: 2 rows of 6 at half height. */}
          <div className='mt-3 grid grid-cols-6 gap-x-0.5 gap-y-2 lg:hidden'>
            {weeks.map((bucket, index) => (
              <TrendColumn
                key={bucket.start}
                label={bucket.label}
                sublabel={bucket.month}
                title={`${bucket.range} — ${formatListeningTime(bucket.seconds)} across ${bucket.plays} ${bucket.plays === 1 ? "session" : "sessions"}`}
                seconds={bucket.seconds}
                max={weekSeconds}
                isToday={index === weeks.length - 1}
                inkBar={false}
                height={TREND_ROW_PX}
              />
            ))}
          </div>
          {/* Wide layout: single row of 12 at full height. */}
          <div className='mt-3 hidden items-stretch gap-0.5 lg:flex'>
            {weeks.map((bucket, index) => (
              <TrendColumn
                key={bucket.start}
                label={bucket.label}
                sublabel={bucket.month}
                title={`${bucket.range} — ${formatListeningTime(bucket.seconds)} across ${bucket.plays} ${bucket.plays === 1 ? "session" : "sessions"}`}
                seconds={bucket.seconds}
                max={weekSeconds}
                isToday={index === weeks.length - 1}
                inkBar={false}
                height={TREND_COLUMN_PX}
              />
            ))}
          </div>
          <ul className='sr-only'>
            {weeks.map((bucket) => (
              <li key={bucket.start}>
                {bucket.range}: {formatListeningTime(bucket.seconds)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label='When you listen'>
        <p className='text-sm text-muted-foreground'>When you listen</p>
        <ul className='mt-3 flex flex-col gap-3'>
          {stats.byPart.map((bucket) => (
            <DaypartRow key={bucket.id} bucket={bucket} max={maxPart} />
          ))}
        </ul>
      </section>
    </div>
  );
}

/** One record card: three fixed-height rows (label, value, sub) so the rows
 * stay aligned across cards when a caption wraps on small screens. */
function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className='min-w-0 rounded-2xl border border-border bg-card px-2 py-2.5 text-center lg:px-3'>
      <p className='flex min-h-8 items-center justify-center text-xs font-medium wrap-break-word text-muted-foreground'>
        {label}
      </p>
      <p className='mt-0.5 flex min-h-6 items-center justify-center text-base font-semibold wrap-break-word tabular-nums'>
        {value}
      </p>
      <p className='flex min-h-4 items-center justify-center text-xs wrap-break-word text-muted-foreground tabular-nums'>
        {sub}
      </p>
    </div>
  );
}

/** Horizontal bar row: HTML labels (readers) + decorative SVG bar (sight).
 * `offset` (same units as `value`/`max`) shifts the bar right so ranked rows
 * tile end to end in cascade mode. Plain list content — the caption carries
 * the numbers, so there is no popover to maintain. */
function BarRow({
  name,
  value,
  max,
  offset = 0,
  valueLabel,
  barClass,
}: {
  name: string;
  value: number;
  max: number;
  offset?: number;
  valueLabel?: string;
  barClass?: string;
}) {
  const width = Math.max(2, Math.min(100, (value / max) * 100));
  const x = Math.max(0, Math.min(100 - width, (offset / max) * 100));
  return (
    <li>
      <span className='flex items-baseline justify-between gap-2'>
        <span className='min-w-0 flex-1 truncate text-sm font-medium'>{name}</span>
        <span className='shrink-0 text-sm font-semibold text-muted-foreground tabular-nums'>
          {valueLabel ?? formatListeningTime(value)}
        </span>
      </span>
      <span className='mt-1 block' aria-hidden='true'>
        <svg className='block h-2 w-full'>
          <rect x={0} y={0} width='100%' height={8} rx={4} className='fill-muted' />
          <rect
            x={`${x}%`}
            y={0}
            width={`${width}%`}
            height={8}
            rx={4}
            className={cn("bar-swap", barClass ?? "fill-primary")}
          />
        </svg>
      </span>
    </li>
  );
}

/** One weekday column: the weekday's share of a typical week above a
 * fixed-height SVG bar. The native tooltip sits on the whole column so bar,
 * captions and the gaps between all trigger it. */
function DayColumn({ bucket, total }: { bucket: DayBucket; total: number }) {
  const average = averageOf(bucket);
  const barPx = average <= 0 || total <= 0 ? 0 : Math.max(8, (average / total) * DAY_COLUMN_PX);
  return (
    <div
      title={`${bucket.label} — ${formatListeningTime(Math.round(averageOf(bucket)))} average across ${bucket.days} ${bucket.days === 1 ? "day" : "days"}`}
      className='flex min-w-0 flex-1 flex-col items-center gap-1'>
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
      <abbr className='text-xs font-medium whitespace-nowrap text-muted-foreground no-underline'>{bucket.label}</abbr>
    </div>
  );
}

/** One trend column: raw seconds with a short caption below (the tooltip and
 * the screen-reader list carry the full date, time and session count). The
 * native tooltip sits on the whole column so bar, captions and the gaps
 * between all trigger it. */
function TrendColumn({
  label,
  sublabel,
  title,
  seconds,
  max,
  isToday,
  inkBar,
  height,
}: {
  label: string;
  /** Second caption line (week month) — omitted for plain date columns. */
  sublabel?: string;
  title: string;
  seconds: number;
  max: number;
  /** Emphasized caption (today / current week). */
  isToday: boolean;
  /** Ink the bar too — weeks stay primary and only lift the caption. */
  inkBar?: boolean;
  height: number;
}) {
  const barPx = seconds <= 0 ? 0 : Math.max(6, (seconds / max) * height);
  return (
    <div title={title} className='flex min-w-0 flex-1 flex-col items-center gap-1'>
      <svg aria-hidden='true' className='block w-full' style={{ height }}>
        <rect x={0} y={0} width='100%' height={height} rx={4} className='fill-muted' />
        {barPx > 0 ? (
          <rect
            x={0}
            y={height - barPx}
            width='100%'
            height={barPx}
            rx={Math.min(4, barPx / 2)}
            className={(inkBar ?? isToday) ? "fill-scout-ink" : "fill-primary"}
          />
        ) : null}
      </svg>
      <abbr
        className={cn(
          "text-center text-[10px] font-medium whitespace-nowrap tabular-nums no-underline",
          isToday ? "text-foreground" : "text-muted-foreground",
        )}>
        {label}
        {sublabel ? <span className='block text-muted-foreground'>{sublabel}</span> : null}
      </abbr>
    </div>
  );
}

/** One daypart row: label plus clock range (readers) over a decorative bar. */
function DaypartRow({ bucket, max }: { bucket: DaypartBucket; max: number }) {
  return <BarRow name={`${bucket.label} · ${bucket.range}`} value={bucket.seconds} max={max} />;
}
