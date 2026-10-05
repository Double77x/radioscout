/**
 * Last-active detail-sheet tab per station. Reopening a station lands where
 * the listener left it (usually Recent or Stats) instead of resetting to
 * Info every time. A plain JSON map — stations come and go, so it is capped
 * and the oldest entries drop first.
 */

export const SHEET_TAB_KEY = "radioscout:sheet-tab";

export const SHEET_TABS = ["info", "recent", "stats"] as const;

export type SheetTab = (typeof SHEET_TABS)[number];

/** Stored value → tab, collapsing garbage to null. Never throws. */
function sheetTabFrom(value: unknown): SheetTab | null {
  return value === "info" || value === "recent" || value === "stats" ? value : null;
}

/** Stations remembered (oldest first — insertion order). Never throws. */
function readTabMap(): Record<string, SheetTab> {
  try {
    if (globalThis.window === undefined) return {};
    const raw: unknown = JSON.parse(globalThis.localStorage?.getItem(SHEET_TAB_KEY) ?? "{}");
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
    const map: Record<string, SheetTab> = {};
    for (const [uuid, tab] of Object.entries(raw)) {
      const valid = sheetTabFrom(tab);
      if (valid) map[uuid] = valid;
    }
    return map;
  } catch {
    return {};
  }
}

/** Last tab opened for a station, or null when it never left Info. Never throws. */
export function readSheetTab(stationuuid: string): SheetTab | null {
  return readTabMap()[stationuuid] ?? null;
}

/** Remember the tab for a station (capped — oldest entries drop). Never throws. */
export function writeSheetTab(stationuuid: string, tab: SheetTab): void {
  try {
    if (globalThis.window === undefined) return;
    const map = readTabMap();
    delete map[stationuuid];
    map[stationuuid] = tab;
    for (const uuid of Object.keys(map).slice(0, Math.max(0, Object.keys(map).length - 100))) {
      delete map[uuid];
    }
    globalThis.localStorage?.setItem(SHEET_TAB_KEY, JSON.stringify(map));
  } catch {
    // Private mode etc — the tab just resets to Info next time.
  }
}
