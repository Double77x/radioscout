import { Link } from "@tanstack/react-router";
import { Home, RadioTower, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LegalLayout } from "@/components/layout/LegalLayout";
import { CenteredState } from "@/components/shared/StateShell";

export const NotFoundComponent = () => {
  return (
    <LegalLayout
      title='Dead air.'
      description='Nothing on this frequency. The page moved, was deleted, or never existed.'
      keywords={["404", "page not found"]}>
      <CenteredState
        kicker={
          <div className='relative mb-2'>
            <p className='text-9xl leading-none font-semibold text-muted/20 select-none'>404</p>
            <div className='absolute inset-0 flex items-center justify-center'>
              <div className='flex size-24 rotate-12 items-center justify-center rounded-3xl border border-scout-pine/30 bg-scout-mint/40 shadow-inner'>
                <RadioTower className='size-12 -rotate-12 text-scout-pine' />
              </div>
            </div>
          </div>
        }
        title='Tune back in.'
        description='This frequency is just static. Head home and pick a station that actually plays.'
        className='space-y-8'
        titleClassName='text-3xl'
        actions={
          <>
            <Button variant='outline' className='h-11 w-full gap-2 sm:w-48' onClick={() => globalThis.history.back()}>
              <ArrowLeft className='size-4' />
              Go Back
            </Button>
            <Link to='/' className='w-full sm:w-auto'>
              <Button className='h-11 w-full gap-2 sm:w-48'>
                <Home className='size-4' />
                Back on air
              </Button>
            </Link>
          </>
        }
      />
    </LegalLayout>
  );
};
