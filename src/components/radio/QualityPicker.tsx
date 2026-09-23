import { AudioLines } from "lucide-react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { usePersistentString } from "@/hooks/use-persistent-state";
import { normalizeMinBitrate, QUALITY_KEY, QUALITY_OPTIONS, qualityLabel } from "@/lib/radio/quality";

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
      <SegmentedControl
        label='Minimum stream quality'
        options={QUALITY_OPTIONS.map((option) => ({
          id: String(option.minBitrate),
          ariaLabel: qualityLabel(option.minBitrate),
          label: (
            <>
              <AudioLines className='size-4' aria-hidden='true' />
              {option.label}
            </>
          ),
        }))}
        value={String(active)}
        onChange={(id) => select(Number(id))}
        optionClassName='min-h-11 flex-col gap-0.5'
      />
      <p className='px-2 pt-1.5 text-xs text-muted-foreground'>
        {active > 0
          ? `Only ${qualityLabel(active)} streams — stations without bitrate info are hidden.`
          : "Showing every playable stream."}
      </p>
    </div>
  );
}
