import { useState } from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { useQuery } from "@tanstack/react-query";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsClient } from "@/hooks/use-is-client";
import { isNative } from "@/lib/capacitor";
import { checkApkUpdate, openApkDownload } from "@/lib/app-update";

/**
 * Sideload update prompt (APK only — no-op on web). One check per day;
 * offers the release APK when GitHub is newer than the installed build.
 * Query-owned (no fetch-in-effect); dismissal is session-local.
 */
export function AppUpdateDialog() {
  const isClient = useIsClient();
  const [dismissed, setDismissed] = useState(false);
  const update = useQuery({
    queryKey: ["native", "apk-update"],
    queryFn: checkApkUpdate,
    enabled: isClient && isNative(),
    staleTime: Infinity,
    retry: false,
  });

  const available = update.data ?? null;
  const open = available !== null && !dismissed;

  const download = () => {
    if (!available) return;
    setDismissed(true);
    void openApkDownload(available.url).catch(() => {
      setDismissed(false);
    });
  };

  return (
    <BaseDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) setDismissed(true);
      }}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className='fixed inset-0 z-200 bg-background/80 backdrop-blur-sm transition-opacity duration-200 animate-in fade-in data-ending-style:opacity-0 data-starting-style:opacity-0' />
        <BaseDialog.Popup className='fixed top-1/2 left-1/2 z-300 w-[min(22rem,calc(100vw-2rem))] -translate-1/2 rounded-3xl border border-border bg-card p-5 shadow-2xl transition duration-300 animate-in fade-in zoom-in-95 data-ending-style:opacity-0 data-ending-style:scale-95 data-starting-style:opacity-0 data-starting-style:scale-95'>
          <div className='flex items-start justify-between gap-3'>
            <BaseDialog.Title className='text-lg font-semibold tracking-tight'>Update available</BaseDialog.Title>
            <BaseDialog.Close
              aria-label='Later'
              className='grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'>
              <X className='size-4' />
            </BaseDialog.Close>
          </div>
          <BaseDialog.Description className='mt-1 text-sm text-muted-foreground'>
            RadioScout {available?.latest} is out — you have {available?.installed}. New app versions (unlike background
            fixes) need a fresh APK.
          </BaseDialog.Description>
          <div className='mt-4 grid grid-cols-2 gap-2'>
            <Button type='button' variant='secondary' onClick={() => setDismissed(true)} className='h-11 rounded-full'>
              Later
            </Button>
            <Button type='button' onClick={download} className='h-11 rounded-full'>
              <Download className='size-4' /> Download
            </Button>
          </div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
