import type { ReactNode } from "react";
import { SEO } from "@/components/Seo";
import { AppShell } from "@/components/scout/AppShell";
import { RadioHeader } from "@/components/radio/RadioHeader";
import { useFavourites, useServerStats } from "@/hooks/use-radio";

interface LegalLayoutProps {
  title: string;
  description: string;
  keywords?: string[];
  children: ReactNode;
}

/** Legal pages in the app frame: shared header, title, prose — player persists. */
export const LegalLayout = ({ title, description, keywords, children }: LegalLayoutProps) => {
  const { data: favourites } = useFavourites();
  const { data: stats } = useServerStats();

  return (
    <AppShell>
      <SEO
        title={title}
        description={description}
        keywords={keywords}
        breadcrumbItems={[
          { label: "Home", href: "/" },
          { label: title, href: "" },
        ]}
      />
      <main className='flex-1 pb-6'>
        <RadioHeader
          query=''
          genre='all'
          totalStations={stats?.stations}
          saved={favourites.length}
          autoFocus={false}
          searchable={false}
        />
        <div className='px-4 pt-5'>
          <h1 className='text-scout-title leading-tight font-semibold tracking-tight text-balance'>{title}</h1>
          <p className='mt-1 text-sm text-muted-foreground'>{description}</p>
        </div>
        <div className='mt-6 px-4'>{children}</div>
      </main>
    </AppShell>
  );
};
