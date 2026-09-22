import { AudioLines } from "lucide-react";
import { usePersistentString } from "@/hooks/use-persistent-state";
import { normalizeMinBitrate, QUALITY_KEY, QUALITY_OPTIONS, qualityLabel } from "@/lib/radio/quality";
import { cn } from "@/lib/utils";

/** Query client stays out of the initial bundle — loaded on demand. */
const loadQueryClient = () => import("@/lib/query-client");

/** Stable fallback for the persisted hook (referential stability matters). */
const ANY_QUALITY = "0";

/**
 * Minimum-bitrate filter for Settings. Segmented control mirroring the
 * theme picker; unknown bitrates never match an active minimum. Directory
 * lists only — saved stations always show.
 */
export function QualityPicker() {
  const [quality, setQuality] = usePersistentString(QUALITY_KEY, ANY_QUALITY);
  const active = normalizeMinBitrate(quality);

  const select = (minBitrate: number) => {
    setQuality(String(normalizeMinBitrate(minBitrate)));
    // Keys already carry the minimum, but favour instant consistency.
    void loadQueryClient().then(({ queryClient }) => queryClient.invalidateQueries({ queryKey: ["radio"] }));
  };

  return (
    <div>
      <fieldset className='m-0 min-w-0 border-0 p-0'>
        <legend className='sr-only'>Minimum stream quality</legend>
        <div className='grid grid-cols-4 gap-1 rounded-full border border-border bg-card p-1'>
          {QUALITY_OPTIONS.map((option) => {
            const selected = active === option.minBitrate;
            return (
              <button
                key={option.minBitrate}
                type='button'
                aria-pressed={selected}
                aria-label={qualityLabel(option.minBitrate)}
                onClick={() => select(option.minBitrate)}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-full text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  selected ? "bg-scout-ink text-scout-paper" : "text-muted-foreground hover:text-foreground",
                )}>
                <AudioLines className='size-4' />
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>
      <p className='px-2 pt-1.5 text-xs text-muted-foreground'>
        {active > 0
          ? `Only ${qualityLabel(active)} streams — stations without bitrate info are hidden.`
          : "Showing every playable stream."}
      </p>
    </div>
  );
}
