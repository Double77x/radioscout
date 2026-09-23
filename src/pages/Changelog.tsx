import { LegalLayout } from "@/components/layout/LegalLayout";
import { Prose } from "@/components/layout/Prose";
import { LEGAL_META } from "@/data/legal";

export default function ChangelogPage() {
  const meta = LEGAL_META.changelog;
  return (
    <LegalLayout title={meta.title} description={meta.description} keywords={meta.keywords}>
      <Prose>
        <div className='border-l-2 border-primary pb-2 pl-6'>
          <h2 className='text-2xl font-semibold'>v0.3.6 - Listening stats, smoother toggles, more playable stations</h2>
          <p className='mb-4 text-sm text-muted-foreground'>September 2026</p>
          <ul className='list-inside list-disc space-y-2 text-foreground'>
            <li>
              Listening section grows a Trend tab with last-14-days and last-12-weeks strips, daypart rhythm, day
              streaks and records (best day, longest session)
            </li>
            <li>
              Top stations sort by total, sessions or average, with tinted bars, share percentages, an Other stations
              row, an optional cascade layout and detail popovers on every bar
            </li>
            <li>
              Command palette (Ctrl+K) jumps straight to Saved, Most loved, Best of British, Recently played and
              Listening, expanding the section and scrolling to it
            </li>
            <li>Most loved header now shows the active quality floor next to the language filter</li>
            <li>
              Pill toggles glide a sliding indicator everywhere (listening, quality, theme), the settings flyout fades
              in and out, and bars animate between layouts
            </li>
            <li>
              Stations on verified https-upgrade hosts (BBC, Smooth and friends) are back in every list instead of being
              filtered out as HTTP-only
            </li>
            <li>Search box keeps your cursor while typing, no more jumping to the end mid-edit</li>
            <li>Settings gains Location, filtering top stations and search by station country just like languages</li>
            <li>
              New Best of British shelf under Most loved with the top UK stations (BBC, Kiss, Capital, Heart and more)
              in alphabetical order
            </li>
            <li>
              Station links can autoplay. A shared link opens the station and starts playback, handy for agentic AI play
              requests too
            </li>
            <li>Recent searches ride a tidy scrollable rail with a pinned Clear button</li>
            <li>Saved reorder drops land cleanly with no jump on release</li>
          </ul>
        </div>
        <div className='border-l-2 border-primary pb-2 pl-6'>
          <h2 className='text-2xl font-semibold'>v0.3.5 - Titles light up on Android</h2>
          <p className='mb-4 text-sm text-muted-foreground'>September 2026</p>
          <ul className='list-inside list-disc space-y-2 text-foreground'>
            <li>
              Stream titles now reach the dock — the bridge was calling a native method that doesn't exist, so every
              subscription failed silently
            </li>
            <li>
              Browser titles removed: too few stations broadcast usable metadata over the web path to justify the moving
              parts
            </li>
          </ul>
        </div>
        <div className='border-l-2 border-primary pb-2 pl-6'>
          <h2 className='text-2xl font-semibold'>v0.3.4 - Dance Wave fix and stream titles</h2>
          <p className='mb-4 text-sm text-muted-foreground'>September 2026</p>
          <ul className='list-inside list-disc space-y-2 text-foreground'>
            <li>
              Dance Wave! plays again on Android — its server redirects to an HTTP edge, which the player now follows on
              an allowlisted host
            </li>
            <li>
              The dock shows the live track title under the station name on Android (stations that broadcast titles)
            </li>
          </ul>
        </div>
        <div className='border-l-2 border-primary pb-2 pl-6'>
          <h2 className='text-2xl font-semibold'>v0.3.3 - Audible Android crossfade</h2>
          <p className='mb-4 text-sm text-muted-foreground'>September 2026</p>
          <ul className='list-inside list-disc space-y-2 text-foreground'>
            <li>
              Station switches on Android actually overlap now — the incoming player no longer steals audio focus and
              silences the old station mid-blend
            </li>
          </ul>
        </div>
        <div className='border-l-2 border-primary pb-2 pl-6'>
          <h2 className='text-2xl font-semibold'>v0.3.2 - Real crossfade on Android</h2>
          <p className='mb-4 text-sm text-muted-foreground'>September 2026</p>
          <ul className='list-inside list-disc space-y-2 text-foreground'>
            <li>
              Station switches on Android now truly crossfade — the old station fades out while the new one fades in,
              matching the browser
            </li>
            <li>Switches tapped in quick succession still blend instead of cutting</li>
          </ul>
        </div>
        <div className='border-l-2 border-primary pb-2 pl-6'>
          <h2 className='text-2xl font-semibold'>v0.3.1 - Android switching and pause fixes</h2>
          <p className='mb-4 text-sm text-muted-foreground'>September 2026</p>
          <ul className='list-inside list-disc space-y-2 text-foreground'>
            <li>
              Station switching on Android is now actually gapless — the handoff fires every time, not just sometimes
            </li>
            <li>Pausing during a switch keeps the old station paused instead of stranding the player</li>
            <li>Paused playback stays paused through network blips instead of spinning on tuning-in</li>
          </ul>
        </div>
        <div className='border-l-2 border-primary pb-2 pl-6'>
          <h2 className='text-2xl font-semibold'>v0.3.0 - Sleep timer, seamless switching and reconnects</h2>
          <p className='mb-4 text-sm text-muted-foreground'>September 2026</p>
          <ul className='list-inside list-disc space-y-2 text-foreground'>
            <li>Settings → Audio → Sleep timer fades out and pauses after a while, with the countdown in the dock</li>
            <li>Play, pause and station switches fade in and out instead of starting and stopping abruptly</li>
            <li>Switching stations is gapless: the old one plays until the new stream is ready, then blends over</li>
            <li>Dropped streams reconnect automatically with backoff instead of stranding on an error</li>
            <li>Recent searches under the search box for one-tap repeats</li>
            <li>Level volume no longer breathes with the music — it settles per station and stays there</li>
            <li>Fresh installs start at 25% volume instead of full blast</li>
          </ul>
        </div>
        <div className='border-l-2 border-primary pb-2 pl-6'>
          <h2 className='text-2xl font-semibold'>v0.2.2 - Android leveling and lockscreen fix</h2>
          <p className='mb-4 text-sm text-muted-foreground'>September 2026</p>
          <ul className='list-inside list-disc space-y-2 text-foreground'>
            <li>The Level volume switch now evens out stations in the Android player too</li>
            <li>Fixed lockscreen controls going missing when playback starts</li>
            <li>A compatibility notice names it if the system player cannot start</li>
          </ul>
        </div>
        <div className='border-l-2 border-primary pb-2 pl-6'>
          <h2 className='text-2xl font-semibold'>v0.2.1 - Level volume on web</h2>
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
