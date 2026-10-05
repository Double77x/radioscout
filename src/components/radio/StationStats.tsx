import { useStationListeningStats } from "@/hooks/use-radio";
import { formatListeningTime } from "@/lib/radio/format";
import { DailyView, TrendView } from "@/components/radio/ListeningStats";

/**
 * Per-station listening stats for the detail sheet's stats tab: total time
 * plus the same daily-rhythm and trend charts as the home section, minus
 * the cross-station ranking (meaningless for one station). Forced compact —
 * the sheet never exceeds phone width, so the `lg:` wide layouts would
 * squeeze 14 columns into ~430px on desktop.
 */
export function StationStats({ stationuuid }: { stationuuid: string }) {
  const { data } = useStationListeningStats(stationuuid);
  if (!data || data.totalSeconds <= 0) {
    return (
      <p className='mt-1 text-sm text-muted-foreground'>
        No listening time banked for this station yet — play it and the charts build themselves.
      </p>
    );
  }
  return (
    <div className='flex flex-col gap-5'>
      <p className='text-sm text-muted-foreground' aria-live='polite'>
        <span className='font-semibold text-foreground'>{formatListeningTime(data.totalSeconds)}</span>
        {" listening · "}
        {data.plays} {data.plays === 1 ? "session" : "sessions"}
      </p>
      <section aria-label='Daily rhythm'>
        <DailyView stats={data} />
      </section>
      <section aria-label='Trends'>
        <TrendView stats={data} compact />
      </section>
    </div>
  );
}
