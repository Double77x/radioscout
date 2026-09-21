import { z } from "zod";
import { isNative } from "@/lib/capacitor";
import { downloadBlob, shareFile } from "@/lib/files";
import { readPlayerPrefs, type PlayerPrefs } from "@/lib/radio/prefs";
import { normalizeLanguages, readLanguages, writeLanguages } from "@/lib/radio/languages";
import { radioDb, type FavouriteRow, type HistoryRow, type RadioDB } from "@/lib/radio/store";
import { stationSchema } from "@/lib/radio/types";
import { readVotedIds, writeVotedIds } from "@/lib/radio/votes";

/** v2 adds the content-language filter (`languages`, defaults to worldwide). */
export const RADIO_BACKUP_VERSION = 2 as const;

/**
 * Versioned envelope for everything RadioScout keeps locally. New feature
 * state joins as new top-level keys (never renames) so old restores keep
 * working and new restores on old builds fail loudly, not silently.
 */
const favouriteRowSchema = z.object({
  stationuuid: z.string().min(1),
  snapshot: stationSchema,
  saved_at: z.string(),
  sort: z.number(),
});

const historyRowSchema = z.object({
  id: z.number().optional(),
  stationuuid: z.string().min(1),
  snapshot: stationSchema,
  played_at: z.string(),
});

const prefsSchema = z.object({
  volume: z.number().min(0).max(1),
  muted: z.boolean(),
});

const radioBackupSchema = z.object({
  app: z.literal("radioscout"),
  version: z.number().int(),
  exportedAt: z.string(),
  favourites: favouriteRowSchema.array(),
  history: historyRowSchema.array(),
  prefs: prefsSchema,
  voted: z.string().array(),
  // Absent in v1 backups — worldwide by default, never a restore failure.
  languages: z.string().array().optional().default([]),
});

export type RadioBackupPayload = {
  app: "radioscout";
  version: typeof RADIO_BACKUP_VERSION;
  exportedAt: string;
  favourites: FavouriteRow[];
  history: HistoryRow[];
  prefs: PlayerPrefs;
  voted: string[];
  languages: string[];
};

export function radioBackupFilename(now: Date = new Date()): string {
  return `radioscout-backup-${now.toISOString().split("T")[0]}.json`;
}

/** Snapshot everything worth keeping into a portable payload. */
export async function collectRadioBackup(database: RadioDB = radioDb): Promise<RadioBackupPayload> {
  const [favourites, history] = await Promise.all([
    database.favourites.toArray(),
    database.history.orderBy("id").toArray(),
  ]);
  return {
    app: "radioscout",
    version: RADIO_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    favourites,
    history,
    prefs: readPlayerPrefs(),
    voted: readVotedIds(),
    languages: readLanguages(),
  };
}

/**
 * Validate + replace local radio state. Throws a human-readable Error for
 * foreign files and newer envelope versions. Returns the prefs so the
 * caller can apply them to the live player.
 */
export async function restoreRadioBackup(payload: unknown, database: RadioDB = radioDb): Promise<PlayerPrefs> {
  const parsed = radioBackupSchema.safeParse(payload);
  if (!parsed.success) throw new Error("That file isn't a RadioScout backup.");
  if (parsed.data.version > RADIO_BACKUP_VERSION) {
    throw new Error("That backup needs a newer RadioScout — update first, then restore.");
  }
  const { favourites, history, prefs, voted, languages } = parsed.data;
  await database.transaction("rw", [database.favourites, database.history], async () => {
    await database.favourites.clear();
    await database.history.clear();
    await database.favourites.bulkPut(favourites);
    const withoutIds = history.map(({ id: _dropped, ...row }) => row);
    await database.history.bulkPut(withoutIds);
  });
  writeVotedIds(voted);
  writeLanguages(normalizeLanguages(languages));
  return prefs;
}

/** Share sheet on native, file download on web. Mirrors the household backup. */
export async function exportRadioBackup(database: RadioDB = radioDb): Promise<"shared" | "downloaded"> {
  const payload = await collectRadioBackup(database);
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const filename = radioBackupFilename();
  if (isNative()) {
    await shareFile(filename, blob);
    return "shared";
  }
  downloadBlob(filename, blob);
  return "downloaded";
}
