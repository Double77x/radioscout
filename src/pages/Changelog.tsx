import { LegalLayout } from "@/components/layout/LegalLayout";
import { Prose } from "@/components/layout/Prose";
import { LEGAL_META } from "@/data/legal";

export default function ChangelogPage() {
  const meta = LEGAL_META.changelog;
  return (
    <LegalLayout title={meta.title} description={meta.description} keywords={meta.keywords}>
      <Prose>
        <div className='border-l-2 border-primary pb-2 pl-6'>
          <h2 className='text-2xl font-semibold'>v0.2.1 - Level volume on Android</h2>
          <p className='mb-4 text-sm text-muted-foreground'>September 2026</p>
          <ul className='list-inside list-disc space-y-2 text-foreground'>
            <li>The Level volume switch now evens out stations in the Android player too</li>
            <li>A compatibility notice names it when the system player cannot start</li>
          </ul>
        </div>
        <div className='border-l-2 border-primary pb-2 pl-6'>
          <h2 className='text-2xl font-semibold'>v0.2.0 - Level volume</h2>
          <p className='mb-4 text-sm text-muted-foreground'>September 2026</p>
          <ul className='list-inside list-disc space-y-2 text-foreground'>
            <li>Settings → Audio → Level volume evens out loudness differences between stations (web player)</li>
            <li>Adaptive gain rides quiet stations up and loud ones down</li>
            <li>The volume slider stays the master control</li>
            <li>Streams that block audio analysis fall back to direct playback automatically</li>
            <li>The toggle travels with radio backup export/import</li>
          </ul>
        </div>
        <div className='border-l-2 border-primary pb-2 pl-6'>
          <h2 className='text-2xl font-semibold'>v0.1.9 - Discover and stats</h2>
          <p className='mb-4 text-sm text-muted-foreground'>September 2026</p>
          <ul className='list-inside list-disc space-y-2 text-foreground'>
            <li>Surprise shuffle in the player dock: catalog browse plus one-tap random station</li>
            <li>Filtered charts stay full — language and quality filters page until all 50 load</li>
            <li>Settings tidied into Data, Languages and Quality sections with active filters summarized</li>
            <li>Minimum-bitrate quality filter for search results and charts</li>
            <li>Listening section with total time and daily-average charts</li>
            <li>Sessions bank even if the app is killed</li>
            <li>Clear history and Clear stats ask first, with centered muted pill buttons</li>
          </ul>
        </div>
        <div className='border-l-2 border-primary pb-2 pl-6'>
          <h2 className='text-2xl font-semibold'>v0.1.8 - Lockscreen controls</h2>
          <p className='mb-4 text-sm text-muted-foreground'>September 2026</p>
          <ul className='list-inside list-disc space-y-2 text-foreground'>
            <li>Android asks for notification permission on first play, so pause and resume show on the lockscreen</li>
          </ul>
        </div>
        <div className='border-l-2 border-primary pb-2 pl-6'>
          <h2 className='text-2xl font-semibold'>v0.1.7 - OTA updates and language filter</h2>
          <p className='mb-4 text-sm text-muted-foreground'>September 2026</p>
          <ul className='list-inside list-disc space-y-2 text-foreground'>
            <li>
              Language filter in Settings: top-40 quick picks plus the full searchable directory, applied to Most loved
              and search results
            </li>
            <li>Filter choices save on-device and travel with radio backup export/import</li>
            <li>Empty means worldwide</li>
            <li>
              Over-the-air updates for the Android app: new versions download and apply on next launch, no store update
              needed
            </li>
          </ul>
        </div>
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
