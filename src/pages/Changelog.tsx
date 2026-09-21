import { LegalLayout } from "@/components/layout/LegalLayout";
import { Prose } from "@/components/layout/Prose";
import { LEGAL_META } from "@/data/legal";

export default function ChangelogPage() {
  const meta = LEGAL_META.changelog;
  return (
    <LegalLayout title={meta.title} description={meta.description} keywords={meta.keywords}>
      <Prose>
        <div className='border-l-2 border-primary pb-2 pl-6'>
          <h2 className='text-2xl font-semibold'>v0.1.0 - Radio switcher</h2>
          <p className='mb-4 text-sm text-muted-foreground'>September 2026</p>
          <ul className='list-inside list-disc space-y-2 text-foreground'>
            <li>Mobile-first radio home: search, genre chips and Most loved / Saved / Recently played sections</li>
            <li>Stations browser with Top, Search, Saved and History plus the persistent player dock</li>
            <li>Radio backup export/import, zero-service OTA updates and the glass-note brand mark</li>
            <li>Quick Find palette across sections, installable PWA manifest</li>
          </ul>
        </div>
      </Prose>
    </LegalLayout>
  );
}
