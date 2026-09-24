/**
 * Public build-flavor flag. F-Droid sets `VITE_DISTRIBUTION=fdroid` while
 * producing the web assets copied into its APK; every other build keeps the
 * existing sideload updater behavior.
 */
export function isFdroidDistribution(): boolean {
  return import.meta.env.VITE_DISTRIBUTION?.trim().toLowerCase() === "fdroid";
}
