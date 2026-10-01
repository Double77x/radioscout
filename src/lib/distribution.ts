/**
 * Public build-flavor flag. F-Droid sets `VITE_DISTRIBUTION=fdroid` while
 * producing the web assets copied into its APK; every other build keeps the
 * existing sideload updater behavior.
 */
import { envString } from "./utils";
export function isFdroidDistribution(): boolean {
  return envString("VITE_DISTRIBUTION")?.trim().toLowerCase() === "fdroid";
}
