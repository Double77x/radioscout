import { useState } from "react";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control";
import { RecentTracks } from "@/components/radio/RecentTracks";
import { StationInfoTab } from "@/components/radio/StationInfoTab";
import { StationStats } from "@/components/radio/StationStats";
import { readSheetTab, writeSheetTab, type SheetTab } from "@/lib/radio/sheet-tab";
import type { Station } from "@/lib/radio/types";

const SHEET_TAB_OPTIONS: readonly SegmentedOption<SheetTab>[] = [
  { id: "info", label: "Info" },
  { id: "recent", label: "Recent" },
  { id: "stats", label: "Stats" },
];

/**
 * Tabbed sheet body, keyed by stationuuid at the call site. The last tab
 * persists per station, so reopening lands where the listener left it.
 * Transport actions stay outside (always reachable); Info owns the badges,
 * tiles and directory rows, Recent the song history, Stats the
 * station-scoped listening charts. Only the panel scrolls — header, tabs
 * and actions stay put, so swapping sections never moves the card.
 */
export function StationSheetTabs({ station, bbcSounds }: { station: Station; bbcSounds: string | null }) {
  const [tab, setTab] = useState<SheetTab>(() => readSheetTab(station.stationuuid) ?? "info");
  const changeTab = (next: SheetTab): void => {
    setTab(next);
    writeSheetTab(station.stationuuid, next);
  };
  return (
    <div className='mt-3 flex min-h-0 flex-1 flex-col px-5'>
      <SegmentedControl
        label='Station sections'
        options={SHEET_TAB_OPTIONS}
        value={tab}
        onChange={changeTab}
        className='shrink-0'
      />
      <div className='mt-4 min-h-0 flex-1 overflow-y-auto pb-2'>
        {tab === "info" ? (
          <StationInfoTab station={station} bbcSounds={bbcSounds} />
        ) : tab === "recent" ? (
          <RecentTracks stationuuid={station.stationuuid} />
        ) : (
          <StationStats stationuuid={station.stationuuid} />
        )}
      </div>
    </div>
  );
}
