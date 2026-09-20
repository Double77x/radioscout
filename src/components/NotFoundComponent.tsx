import { Link } from "@tanstack/react-router";
import { Home, Search, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/Seo";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CenteredState } from "@/components/shared/StateShell";

export const NotFoundComponent = () => {
  return (
    <div className='flex min-h-screen flex-col bg-background text-foreground'>
      <SEO title='Page Not Found' description="The page you're looking for doesn't exist." />
      <Navbar />

      <main className='flex flex-1 items-center justify-center p-6'>
        <CenteredState
          kicker={
            <div className='relative mb-2'>
              <h1 className='text-9xl leading-none font-semibold text-muted/20 select-none'>404</h1>
              <div className='absolute inset-0 flex items-center justify-center'>
                <div className='flex size-24 rotate-12 items-center justify-center rounded-3xl border border-scout-pine/30 bg-scout-mint/40 shadow-inner'>
                  <Search className='size-12 -rotate-12 text-scout-pine' />
                </div>
              </div>
            </div>
          }
          title='Lost in the data?'
          description="We couldn't find the page you're looking for. It might have been moved, deleted, or never existed in the first place."
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
                  Back to Home
                </Button>
              </Link>
            </>
          }
        />
      </main>

      <Footer />
    </div>
  );
};
