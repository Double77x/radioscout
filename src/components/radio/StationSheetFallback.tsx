import { Dialog as BaseDialog } from "@base-ui/react/dialog";

/** Stale shared link: the detail fetch settled without a station. */
export function StationSheetMissing() {
  return (
    <div className='px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center'>
      <span aria-hidden='true' className='mx-auto block h-1 w-10 rounded-full bg-border' />
      <BaseDialog.Title className='mt-3 text-lg font-semibold tracking-tight'>
        Couldn't open that station
      </BaseDialog.Title>
      <BaseDialog.Description className='mt-1 text-sm text-muted-foreground'>
        The link may be stale, or the station was removed from the directory.
      </BaseDialog.Description>
      <BaseDialog.Close className='mt-4 h-11 w-full rounded-full bg-secondary font-semibold text-secondary-foreground transition hover:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'>
        Close
      </BaseDialog.Close>
    </div>
  );
}

/** Shared-link fetch in flight; the card stays the same height as the loaded sheet. */
export function StationSheetLoading() {
  return (
    <div
      aria-busy='true'
      className='px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-pulse motion-reduce:animate-none'>
      <span aria-hidden='true' className='mx-auto block h-1 w-10 rounded-full bg-border' />
      <BaseDialog.Title className='sr-only'>Loading station…</BaseDialog.Title>
      <BaseDialog.Description className='sr-only'>The shared station is loading.</BaseDialog.Description>
      <div className='mt-3 flex items-start gap-3'>
        <span aria-hidden='true' className='size-14 shrink-0 rounded-2xl bg-muted' />
        <span aria-hidden='true' className='min-w-0 flex-1'>
          <span className='block h-6 w-3/4 rounded-full bg-muted' />
          <span className='mt-2 block h-4 w-1/2 rounded-full bg-muted' />
        </span>
      </div>
      <div aria-hidden='true' className='mt-4 grid grid-cols-3 gap-2'>
        {[0, 1, 2].map((index) => (
          <span key={index} className='h-16 rounded-2xl bg-muted/60' />
        ))}
      </div>
    </div>
  );
}
