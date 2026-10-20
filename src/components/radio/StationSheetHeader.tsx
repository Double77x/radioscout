import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { StationArt } from "@/components/radio/StationArt";
import { formatCountryName } from "@/lib/radio/format";
import type { Station } from "@/lib/radio/types";

/** Artwork, identity and close control at the top of the sheet. */
export function StationSheetHeader({ station }: { station: Station }) {
  return (
    <BaseDialog.Title className='mt-3 flex shrink-0 items-start gap-3 px-5'>
      <StationArt
        key={station.favicon || station.stationuuid}
        src={station.favicon}
        className='size-14 rounded-2xl'
        iconClassName='size-6'
      />
      <span className='min-w-0 flex-1'>
        <span className='block text-xl leading-tight font-semibold tracking-tight text-balance'>{station.name}</span>
        <span className='mt-0.5 block truncate text-sm text-muted-foreground'>
          {[formatCountryName(station.country, station.countrycode), station.state].filter(Boolean).join(" · ") ||
            "Worldwide"}
        </span>
      </span>
      <BaseDialog.Close
        aria-label='Close details'
        className='grid size-11 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'>
        <X className='size-5' />
      </BaseDialog.Close>
    </BaseDialog.Title>
  );
}
