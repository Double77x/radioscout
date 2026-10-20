import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { applyPlayerPrefs } from "@/hooks/use-player";

/** Query client stays out of the initial bundle — loaded on demand. */
const loadQueryClient = () => import("@/lib/query-client");

/** Radio backup engine stays out of the initial bundle — loaded on demand. */
const loadRadioBackup = () => import("@/lib/radio/backup");

/** Radio export/import: favourites, history, stats, volume, votes, languages, quality and theme in one JSON file. */
export function RadioDataSection() {
  const [exportState, setExportState] = useState<"idle" | "working" | "shared" | "downloaded" | "error">("idle");
  const [importState, setImportState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onExport = () => {
    if (exportState === "working") return;
    setExportState("working");
    void loadRadioBackup().then(({ exportRadioBackup }) =>
      exportRadioBackup()
        .then((mode) => {
          setExportState(mode);
        })
        .catch(() => {
          setExportState("error");
        }),
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
      .then((prefs) => {
        applyPlayerPrefs(prefs);
        return loadQueryClient();
      })
      .then(({ queryClient }) => {
        void queryClient.invalidateQueries({ queryKey: ["radio"] });
        setImportState("done");
        toast("Restore complete", {
          description: "Stations, history, stats, volume, filters, votes and theme are back.",
        });
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
        onChange={(event) => {
          onImportFile(event.target.files?.[0]);
        }}
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
