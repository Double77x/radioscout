import { useRef, useState } from "react";
import { version as appVersion } from "../../../package.json";
import { Download, Monitor, Moon, Settings as SettingsIcon, Sun, Upload } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { LanguagePicker } from "@/components/radio/LanguagePicker";
import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";

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

type ThemeChoice = (typeof THEME_OPTIONS)[number]["id"];

/** Settings flyout: radio data plus style, one scroll view, no tabs. */
export function SettingsMenu({ variant = "tab" }: { variant?: "tab" | "logo" }) {
  const [open, setOpen] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();
  // Tab variant: anchor the flyout to the whole nav bar (screen-centred) and
  // open upward — the cog sits right of centre, so trigger-anchoring skews right.
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [navAnchor, setNavAnchor] = useState<HTMLElement | null>(null);
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
        className='max-h-[calc(100dvh-10rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto p-3'>
        <div className='px-2 pt-1'>
          <PopoverTitle>Settings</PopoverTitle>
          <PopoverDescription>Radio data and style.</PopoverDescription>
        </div>

        <section aria-labelledby='settings-data-heading' className='mt-2'>
          <h2
            id='settings-data-heading'
            className='px-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase'>
            Data
          </h2>
          <p className='px-2 pt-1 pb-2 text-xs text-muted-foreground'>
            Saved stations, history, volume, votes and languages in one JSON file — move it between browser and APK.
          </p>
          <RadioDataSection />
        </section>

        <section aria-labelledby='settings-language-heading' className='mt-5'>
          <h2
            id='settings-language-heading'
            className='px-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase'>
            Languages
          </h2>
          <p className='px-2 pt-1 pb-2 text-xs text-muted-foreground'>
            Filter search results and charts to these languages. Empty means worldwide.
          </p>
          <div className='rounded-2xl border border-border bg-card p-3'>
            <LanguagePicker />
          </div>
        </section>

        <section aria-labelledby='settings-style-heading' className='mt-5'>
          <h2
            id='settings-style-heading'
            className='px-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase'>
            Style
          </h2>
          <fieldset className='mx-0 min-w-0 border-0 p-0'>
            <legend className='sr-only'>Appearance</legend>
            <div className='mt-2 grid grid-cols-3 gap-1 rounded-full border border-border bg-card p-1'>
              {THEME_OPTIONS.map(({ id, label, Icon }) => {
                const selected = theme === id;
                return (
                  <button
                    key={id}
                    type='button'
                    aria-pressed={selected}
                    onClick={() => setTheme(id as ThemeChoice)}
                    className={cn(
                      "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-full text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      selected ? "bg-scout-ink text-scout-paper" : "text-muted-foreground hover:text-foreground",
                    )}>
                    <Icon className='size-4' />
                    {label}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <p className='px-2 pt-1.5 text-xs text-muted-foreground'>
            {theme === "system"
              ? `Following your device (currently ${resolvedTheme ?? "light"})`
              : `Locked to ${theme} mode`}
          </p>
        </section>

        <p className='px-2 pt-3 pb-1 text-center text-xs text-muted-foreground'>
          RadioScout v{appVersion} · Built By ❤️ Dan
        </p>
      </PopoverContent>
    </Popover>
  );
}

/** Radio export/import: favourites, history, volume, votes and languages in one JSON file. */
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
        toast("Restore complete", { description: "Saved stations, history, volume and languages are back." });
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
