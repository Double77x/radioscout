import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  pending?: boolean;
}

/**
 * Destructive-action guard (clear history/stats): a compact centered dialog,
 * same tokens as the other Base UI dialogs. Cancel is the easy target —
 * confirming takes a deliberate second tap. Closes itself on backdrop,
 * Escape or Cancel; the caller closes it when the action fires.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  pending = false,
}: ConfirmDialogProps) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className='fixed inset-0 z-200 bg-background/80 backdrop-blur-sm transition-opacity duration-200 animate-in fade-in data-ending-style:opacity-0 data-starting-style:opacity-0' />
        <div className='fixed inset-0 z-300 grid place-items-center p-4'>
          <BaseDialog.Popup className='w-full max-w-xs rounded-3xl border border-border bg-card p-5 shadow-2xl transition duration-200 animate-in zoom-in-95 fade-in data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0'>
            <BaseDialog.Title className='text-lg font-semibold tracking-tight'>{title}</BaseDialog.Title>
            <BaseDialog.Description className='mt-1 text-sm text-muted-foreground'>
              {description}
            </BaseDialog.Description>
            <div className='mt-4 flex gap-2'>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
                className='h-11 flex-1 rounded-full'>
                Cancel
              </Button>
              <Button
                type='button'
                variant='destructive'
                disabled={pending}
                onClick={onConfirm}
                className='h-11 flex-1 rounded-full'>
                {pending ? "Clearing…" : confirmLabel}
              </Button>
            </div>
          </BaseDialog.Popup>
        </div>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
