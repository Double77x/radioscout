import { Link, useRouter } from "@tanstack/react-router";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CenteredState, FullPageShell } from "@/components/shared/StateShell";

export function GlobalErrorComponent({ error }: { error: unknown }) {
  const router = useRouter();

  return (
    <FullPageShell>
      <div className='w-full max-w-md'>
        <CenteredState
          icon={<AlertTriangle className='size-10' />}
          iconWrapperClassName='border-destructive/20 bg-destructive/10 text-destructive'
          title='Something went wrong'
          description="An unexpected error occurred while processing your data. We've been notified and are working on it."
          actions={
            <>
              <Button variant='outline' className='w-full gap-2' onClick={() => router.invalidate()}>
                <RotateCcw className='size-4' />
                Try Again
              </Button>
              <Link to='/' className='w-full'>
                <Button className='w-full gap-2'>
                  <Home className='size-4' />
                  Return Home
                </Button>
              </Link>
            </>
          }
        />

        {import.meta.env.DEV && (
          <pre className='mt-6 max-h-40 overflow-auto rounded-lg border border-border bg-muted p-4 text-left font-mono text-xs'>
            {error instanceof Error ? error.message : String(error)}
          </pre>
        )}
      </div>
    </FullPageShell>
  );
}
