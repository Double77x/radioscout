import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { version as appVersion } from "../../../package.json";
import { Download, Monitor, Moon, Settings as SettingsIcon, Sun, Upload } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { LanguagePicker } from "@/components/radio/LanguagePicker";
import { LocationPicker } from "@/components/radio/LocationPicker";
import { NormalizeSwitch } from "@/components/radio/NormalizeSwitch";
import { QualityPicker } from "@/components/radio/QualityPicker";
import { SleepTimerPicker } from "@/components/radio/SleepTimerPicker";
import { useSleepCountdown } from "@/hooks/use-sleep-countdown";
import { usePersistentString, usePersistentStrings } from "@/hooks/use-persistent-state";
import { LANGUAGES_KEY } from "@/lib/radio/languages";
import { COUNTRIES_KEY, displayCountryName } from "@/lib/radio/countries";
import { NORMALIZE_KEY, normalizeEnabled } from "@/lib/radio/normalize";
import { normalizeMinBitrate, QUALITY_KEY, qualityLabel } from "@/lib/radio/quality";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { SegmentedControl } from "@/components/ui/segmented-control";

/** Query client stays out of the initial bundle — loaded on demand. */
const loadQueryClient = () => import("@/lib/query-client");

/** Radio backup engine stays out of the initial bundle — loaded on demand. */
const loadRadioBackup = () => import("@/lib/radio/backup");
const loadPlayerPrefs = () => import("@/hooks/use-player");

const THEME_OPTIONS = [
  { id: "system", label: "System", Icon: Monitor },
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
] as const;

/** Stable fallbacks for the persisted hooks (referential stability matters). */
const WORLDWIDE_FALLBACK: string[] = [];
const ANY_QUALITY_FALLBACK = "0";
const LEVEL_OFF_FALLBACK = "0";

/** Settings flyout: radio data plus style, one scroll view, no tabs. */
export function SettingsMenu({ variant = "tab" }: { variant?: "tab" | "logo" }) {
  const [open, setOpen] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();
  // Tab variant: anchor the flyout to the whole nav bar (screen-centred) and
  // open upward — the cog sits right of centre, so trigger-anchoring skews right.
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [navAnchor, setNavAnchor] = useState<HTMLElement | null>(null);
  // Accordion trigger summaries — the collapsed flyout still shows active filters.
  const [languages] = usePersistentStrings(LANGUAGES_KEY, WORLDWIDE_FALLBACK);
  const [countries] = usePersistentStrings(COUNTRIES_KEY, WORLDWIDE_FALLBACK);
  const [quality] = usePersistentString(QUALITY_KEY, ANY_QUALITY_FALLBACK);
  const [normalize] = usePersistentString(NORMALIZE_KEY, LEVEL_OFF_FALLBACK);
  const sleepCountdown = useSleepCountdown();
  const audioSummary = `${normalizeEnabled(normalize) ? "On" : "Off"}${sleepCountdown ? ` · Sleep ${sleepCountdown}` : ""}`;
  const languageSummary =
    languages.length === 0
      ? "Worldwide"
      : languages.length === 1
        ? (languages[0] ?? "")
        : `${languages[0]} +${languages.length - 1}`;
  const locationSummary =
    countries.length === 0
      ? "Worldwide"
      : countries.length === 1
        ? displayCountryName(countries[0] ?? "")
        : `${displayCountryName(countries[0] ?? "")} +${countries.length - 1}`;
  const onOpenChange = (next: boolean) => {
    if (next && variant === "tab") setNavAnchor(triggerRef.current?.closest("nav") ?? null);
    setOpen(next);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        ref={triggerRef}
        aria-label='Settings'
        className={
          variant === "logo"
            ? "grid size-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-neutral-900 shadow-sm transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            : "grid size-12 place-items-center rounded-full text-muted-foreground transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-open:bg-scout-ink data-open:text-scout-paper"
        }>
        {variant === "logo" ? <Logo className='size-7' /> : <SettingsIcon className='size-5' />}
      </PopoverTrigger>
      <PopoverContent
        align={variant === "tab" ? "center" : "start"}
        side={variant === "tab" ? "top" : undefined}
        anchor={variant === "tab" ? navAnchor : undefined}
        className='max-h-[calc(100dvh-10rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto p-3 scrollbar-gutter-stable'>
        <div className='px-2 pt-1'>
          <PopoverTitle>Settings</PopoverTitle>
          <PopoverDescription>Radio data, filters, audio and style.</PopoverDescription>
        </div>

        <Accordion className='mt-1'>
          <AccordionItem value='data' className='border-0'>
            <AccordionTrigger className='px-2 py-3 text-sm font-semibold hover:no-underline'>Data</AccordionTrigger>
            <AccordionContent className='px-2'>
              <p className='pb-2 text-xs text-muted-foreground'>
                Saved stations, history, listening stats, volume, votes, languages, quality and audio leveling in one
                JSON file — move it between browser and APK.
              </p>
              <RadioDataSection />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value='languages' className='border-0'>
            <AccordionTrigger className='px-2 py-3 text-sm font-semibold hover:no-underline'>
              <span>Languages</span>
              <span className='ml-auto pr-2 text-xs font-medium text-muted-foreground capitalize'>
                {languageSummary}
              </span>
            </AccordionTrigger>
            <AccordionContent className='px-2'>
              <p className='pb-2 text-xs text-muted-foreground'>
                Filter search results and charts to these languages. Empty means worldwide.
              </p>
              <div className='rounded-2xl border border-border bg-card p-3'>
                <LanguagePicker />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value='location' className='border-0'>
            <AccordionTrigger className='px-2 py-3 text-sm font-semibold hover:no-underline'>
              <span>Location</span>
              <span className='ml-auto pr-2 text-xs font-medium text-muted-foreground'>{locationSummary}</span>
            </AccordionTrigger>
            <AccordionContent className='px-2'>
              <p className='pb-2 text-xs text-muted-foreground'>
                Filter search results and charts to stations in these countries. Empty means worldwide.
              </p>
              <div className='rounded-2xl border border-border bg-card p-3'>
                <LocationPicker />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value='quality' className='border-0'>
            <AccordionTrigger className='px-2 py-3 text-sm font-semibold hover:no-underline'>
              <span>Quality</span>
              <span className='ml-auto pr-2 text-xs font-medium normal-case text-muted-foreground'>
                {qualityLabel(normalizeMinBitrate(quality))}
              </span>
            </AccordionTrigger>
            <AccordionContent className='px-2'>
              <p className='pb-2 text-xs text-muted-foreground'>
                Minimum stream bitrate for search results and charts. Saved stations always show.
              </p>
              <QualityPicker />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value='audio' className='border-0'>
            <AccordionTrigger className='px-2 py-3 text-sm font-semibold hover:no-underline'>
              <span>Audio</span>
              <span className='ml-auto pr-2 text-xs font-medium normal-case text-muted-foreground'>{audioSummary}</span>
            </AccordionTrigger>
            <AccordionContent className='px-2'>
              <div className='rounded-2xl border border-border bg-card p-3'>
                <NormalizeSwitch />
              </div>
              <div className='mt-2 rounded-2xl border border-border bg-card p-3'>
                <SleepTimerPicker />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <section aria-labelledby='settings-style-heading' className='mt-1'>
          <h2 id='settings-style-heading' className='px-2 py-3 text-sm font-semibold'>
            Style
          </h2>
          <SegmentedControl
            label='Appearance'
            options={THEME_OPTIONS.map(({ id, label, Icon }) => ({
              id,
              label: (
                <>
                  <Icon className='size-4' aria-hidden='true' />
                  {label}
                </>
              ),
            }))}
            value={theme === "light" || theme === "dark" ? theme : "system"}
            onChange={(id) => setTheme(id)}
            optionClassName='min-h-11 flex-col gap-0.5'
          />
          <p className='px-2 pt-1.5 text-xs text-muted-foreground'>
            {theme === "system"
              ? `Following your device (currently ${resolvedTheme ?? "light"})`
              : `Locked to ${theme} mode`}
          </p>
        </section>

        <p className='px-2 pt-3 pb-1 text-center text-xs text-muted-foreground'>
          RadioScout{" "}
          <Link
            to='/legal/changelog'
            onClick={() => setOpen(false)}
            aria-label={`Changelog for version ${appVersion}`}
            className='underline underline-offset-4 hover:text-foreground'>
            v{appVersion}
          </Link>{" "}
          · Built By ❤️ Dan
        </p>
      </PopoverContent>
    </Popover>
  );
}

/** Radio export/import: favourites, history, stats, volume, votes, languages and quality in one JSON file. */
function RadioDataSection() {
  const [exportState, setExportState] = useState<"idle" | "working" | "shared" | "downloaded" | "error">("idle");
  const [importState, setImportState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onExport = () => {
    if (exportState === "working") return;
    setExportState("working");
    void loadRadioBackup().then(({ exportRadioBackup }) =>
      exportRadioBackup()
        .then((mode) => setExportState(mode))
        .catch(() => setExportState("error")),
    );
  };

  const onImportFile = (file: File | undefined) => {
    if (!file || importState === "working") return;
    setImportState("working");
    setImportError(null);
    file
      .text()
      .then((text: string): unknown => JSON.parse(text) as unknown)
      .then((json) => loadRadioBackup().then(({ restoreRadioBackup }) => restoreRadioBackup(json)))
      .then((prefs) =>
        Promise.all([loadPlayerPrefs().then(({ applyPlayerPrefs }) => applyPlayerPrefs(prefs)), loadQueryClient()]),
      )
      .then(([, { queryClient }]) => {
        queryClient.invalidateQueries({ queryKey: ["radio"] });
        setImportState("done");
        toast("Restore complete", { description: "Stations, history, stats, volume, filters and votes are back." });
      })
      .catch((error: unknown) => {
        setImportState("error");
        setImportError(
          error instanceof SyntaxError
            ? "That file isn't valid JSON."
            : error instanceof Error
              ? error.message
              : "Couldn't read that file.",
        );
      })
      .finally(() => {
        if (fileRef.current) fileRef.current.value = "";
      });
  };

  return (
    <div className='mt-2 flex flex-col gap-2 rounded-2xl border border-border bg-card p-3'>
      <button
        type='button'
        onClick={onExport}
        disabled={exportState === "working"}
        className='flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-scout-ink text-sm font-medium text-scout-paper transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60'>
        <Download className='size-4' />
        {exportState === "working" ? "Preparing…" : "Export radio data"}
      </button>
      <button
        type='button'
        onClick={() => fileRef.current?.click()}
        disabled={importState === "working"}
        className='flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-border text-sm font-medium transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60'>
        <Upload className='size-4' />
        {importState === "working" ? "Restoring…" : "Import radio data"}
      </button>
      <input
        ref={fileRef}
        type='file'
        accept='.json,application/json'
        aria-label='Restore file'
        className='sr-only'
        onChange={(event) => onImportFile(event.target.files?.[0])}
      />
      <p className='px-1 text-xs text-muted-foreground' aria-live='polite'>
        {importState === "error" && importError
          ? importError
          : importState === "done"
            ? "Restore complete — your stations are back."
            : exportState === "shared"
              ? "Use the share sheet to save the file."
              : exportState === "downloaded"
                ? "Downloaded as a JSON file."
                : exportState === "error"
                  ? "Export failed — try again."
                  : "Restoring replaces everything currently saved here."}
      </p>
    </div>
  );
}
