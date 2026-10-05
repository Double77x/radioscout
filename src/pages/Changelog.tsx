import { LegalLayout } from "@/components/layout/LegalLayout";
import { Prose } from "@/components/layout/Prose";
import { LEGAL_META } from "@/data/legal";

interface ChangelogEntry {
  version: string;
  title: string;
  date: string;
  points: string[];
}

/** Newest first. One entry per release — the markup below stays identical. */
const ENTRIES: ChangelogEntry[] = [
  {
    version: "0.4.1",
    title: "Offline on the web",
    date: "October 2026",
    points: [
      "The web app keeps working without a connection: the shell, favourites, history and charts stay readable offline, and a new version offers a one-tap reload. Playback still needs the internet — live streams are never cached.",
    ],
  },
  {
    version: "0.4.0",
    title: "Colour themes and a rebuilt station sheet",
    date: "October 2026",
    points: [
      "Four colour themes — Gruvbox, Nord, Sunset Horizon and Catppuccin — sit alongside light, dark and automatic in Settings → Style, in both schemes. Your pick saves on-device and travels with backups.",
      "Station sheets are rebuilt around Info, Recent and Stats tabs at a fixed height: details and links, the songs you have heard with relative times, and your own listening charts for that station alone. The sheet remembers which tab you left open per station.",
      "Heard songs also surface on Recently played rows (desktop), with a per-station clear, and votes now count instantly on the sheet and every row together.",
      "BBC titles reach the Android app reliably again, and filtered searches gain a back arrow to home.",
    ],
  },
  {
    version: "0.3.13",
    title: "Artwork that respects your privacy",
    date: "October 2026",
    points: [
      "Station logos now load through a privacy proxy rather than straight from each broadcaster's website. Scrolling the station lists used to leave those sites free to read and store their own cookies — including location guesses and ad IDs on roughly half the stations. Nothing is stored now, so the cookie policy is accurate as written.",
      "Cover art stops breaking when a proxy declines to serve an image: rows that used to sit on a blank placeholder, or fall back to a generic tile, now show the real logo.",
    ],
  },
  {
    version: "0.3.12",
    title: "BBC song names on the Android app",
    date: "October 2026",
    points: [
      "BBC song and show names reach the dock, notification, lock screen and car on the Android app too, with no settings switch to turn on.",
    ],
  },
  {
    version: "0.3.11",
    title: "BBC song names and Firefox HLS playback",
    date: "October 2026",
    points: [
      "BBC stations show live song and show names: HLS streams carry no broadcast titles, so the app reads the BBC's own now-playing feeds — tracks while music plays, the on-air programme otherwise",
      "Station details gain a Tracks row for BBC stations linking to the live page with schedule and track history",
      "Firefox plays BBC and other HLS stations directly instead of asking for the Android app, and polls smarter so show changes land within seconds",
    ],
  },
  {
    version: "0.3.10",
    title: "Lock-screen song titles stick",
    date: "October 2026",
    points: [
      "Fixes song titles on the lock screen and car display: every title update echoed back as a station change and wiped the song, pinning both on the station name. Titles now stick until the next song arrives.",
    ],
  },
  {
    version: "0.3.9",
    title: "Skip that survives lock and doze",
    date: "October 2026",
    points: [
      "Car skip buttons run a service-side favourites loop, so next and previous stay on every station and keep working with the phone locked. The app follows along and catches up on unlock.",
      "Loop items re-anchor their station name as the favourites turn, so the car never shows a stale song over the new station.",
    ],
  },
  {
    version: "0.3.8",
    title: "Car titles and skip buttons",
    date: "October 2026",
    points: [
      "Live titles reach the car too: the Android media session republishes on every track change (song as title, station as artist), so Bluetooth, Android Auto and the lock screen follow the song instead of repeating the station name.",
      "Steering-wheel and headset skip buttons step through Saved favourites in list order, wrapping both directions. Skipping from idle starts the first saved station; with fewer than two saved the press stays silent.",
    ],
  },
  {
    version: "0.3.7",
    title: "Live song titles, ticker subtitles, Xtra Hot",
    date: "October 2026",
    points: [
      "Live song titles return to the web player as an opt-in switch under Settings → Audio (off by default). The dock subtitle follows the station's StreamTitle and updates as tracks change. The APK keeps its native titles with no switch needed.",
      "Long subtitles scroll as a slow ticker on compact screens, static everywhere else.",
      "Xtra Hot joins the Best of British shelf.",
    ],
  },
  {
    version: "0.3.6",
    title: "Listening stats, smoother toggles, more playable stations",
    date: "September 2026",
    points: [
      "Listening section grows a Trend tab with last-14-days and last-12-weeks strips, daypart rhythm, day streaks and records (best day, longest session)",
      "Top stations sort by total, sessions or average, with tinted bars, share percentages, an Other stations row, an optional cascade layout and detail popovers on every bar",
      "Command palette (Ctrl+K) jumps straight to Saved, Most loved, Best of British, Recently played and Listening, expanding the section and scrolling it into view",
      "Most loved header now shows the active quality floor next to the language filter",
      "Pill toggles glide a sliding indicator everywhere (listening, quality, theme), the settings flyout fades in and out, and bars animate between layouts",
      "Stations on verified https-upgrade hosts (BBC, Smooth and friends) are back in every list instead of being filtered out as HTTP-only",
      "Search box keeps your cursor while typing, no more jumping to the end mid-edit",
      "Settings gains Location, filtering top stations and search by station country just like languages",
      "New Best of British shelf under Most loved with the top UK stations (BBC, Kiss, Capital, Heart and more) in alphabetical order",
      "Station links can autoplay. A shared link opens the station and starts playback, handy for agentic AI play requests too",
      "Recent searches ride a tidy scrollable rail with a pinned Clear button",
      "Saved reorder drops land cleanly with no jump on release",
    ],
  },
  {
    version: "0.3.5",
    title: "Titles light up on Android",
    date: "September 2026",
    points: [
      "Stream titles now reach the dock — the bridge was calling a native method that doesn't exist, so every subscription failed silently",
      "Browser titles removed: too few stations broadcast usable metadata over the web path to justify the moving parts",
    ],
  },
  {
    version: "0.3.4",
    title: "Dance Wave fix and stream titles",
    date: "September 2026",
    points: [
      "Dance Wave! plays again on Android — its server redirects to an HTTP edge, which the player now follows on an allowlisted host",
      "The dock shows the live track title under the station name on Android (stations that broadcast titles)",
    ],
  },
  {
    version: "0.3.3",
    title: "Audible Android crossfade",
    date: "September 2026",
    points: [
      "Station switches on Android actually overlap now — the incoming player no longer steals audio focus and silences the old station mid-blend",
    ],
  },
  {
    version: "0.3.2",
    title: "Real crossfade on Android",
    date: "September 2026",
    points: [
      "Station switches on Android now truly crossfade — the old station fades out while the new one fades in, matching the browser",
      "Switches tapped in quick succession still blend instead of cutting",
    ],
  },
  {
    version: "0.3.1",
    title: "Android switching and pause fixes",
    date: "September 2026",
    points: [
      "Station switching on Android is now actually gapless — the handoff fires every time, not just sometimes",
      "Pausing during a switch keeps the old station paused instead of stranding the player",
      "Paused playback stays paused through network blips instead of spinning on tuning-in",
    ],
  },
  {
    version: "0.3.0",
    title: "Sleep timer, seamless switching and reconnects",
    date: "September 2026",
    points: [
      "Settings → Audio → Sleep timer fades out and pauses after a while, with the countdown in the dock",
      "Play, pause and station switches fade in and out instead of starting and stopping abruptly",
      "Switching stations is gapless: the old one plays until the new stream is ready, then blends over",
      "Dropped streams reconnect automatically with backoff instead of stranding on an error",
      "Recent searches under the search box for one-tap repeats",
      "Level volume no longer breathes with the music — it settles per station and stays there",
      "Fresh installs start at 25% volume instead of full blast",
    ],
  },
  {
    version: "0.2.2",
    title: "Android leveling and lockscreen fix",
    date: "September 2026",
    points: [
      "The Level volume switch now evens out stations in the Android player too",
      "Fixed lockscreen controls going missing when playback starts",
      "A compatibility notice names it if the system player cannot start",
    ],
  },
  {
    version: "0.2.1",
    title: "Level volume on web",
    date: "September 2026",
    points: [
      "The Level volume switch now evens out stations in the Android player too",
      "A compatibility notice names it when the system player cannot start",
    ],
  },
  {
    version: "0.2.0",
    title: "Level volume",
    date: "September 2026",
    points: [
      "Settings → Audio → Level volume evens out loudness differences between stations (web player)",
      "Adaptive gain rides quiet stations up and loud ones down",
      "The volume slider stays the master control",
      "Streams that block audio analysis fall back to direct playback automatically",
      "The toggle travels with radio backup export/import",
    ],
  },
  {
    version: "0.1.9",
    title: "Discover and stats",
    date: "September 2026",
    points: [
      "Surprise shuffle in the player dock: catalog browse plus one-tap random station",
      "Filtered charts stay full — language and quality filters page until all 50 load",
      "Settings tidied into Data, Languages and Quality sections with active filters summarized",
      "Minimum-bitrate quality filter for search results and charts",
      "Listening section with total time and daily-average charts",
      "Sessions bank even if the app is killed",
      "Clear history and Clear stats ask first, with centered muted pill buttons",
    ],
  },
  {
    version: "0.1.8",
    title: "Lockscreen controls",
    date: "September 2026",
    points: ["Android asks for notification permission on first play, so pause and resume show on the lockscreen"],
  },
  {
    version: "0.1.7",
    title: "OTA updates and language filter",
    date: "September 2026",
    points: [
      "Language filter in Settings: top-40 quick picks plus the full searchable directory, applied to Most loved and search results",
      "Filter choices save on-device and travel with radio backup export/import",
      "Empty means worldwide",
      "Over-the-air updates for the Android app: new versions download and apply on next launch, no store update needed",
    ],
  },
  {
    version: "0.1.0",
    title: "Radio switcher",
    date: "September 2026",
    points: [
      "Mobile-first radio home: search, genre chips and Most loved / Saved / Recently played sections",
      "Stations browser with Top, Search, Saved and History plus the persistent player dock",
      "Radio backup export/import, zero-service OTA updates and the glass-note brand mark",
      "Quick Find palette across sections, installable PWA manifest",
    ],
  },
];

export default function ChangelogPage() {
  const meta = LEGAL_META.changelog;
  return (
    <LegalLayout title={meta.title} description={meta.description} keywords={meta.keywords}>
      <Prose>
        {ENTRIES.map((entry) => (
          <div key={entry.version} className='border-l-2 border-primary pb-2 pl-6'>
            <h2 className='text-2xl font-semibold'>
              v{entry.version} - {entry.title}
            </h2>
            <p className='mb-4 text-sm text-muted-foreground'>{entry.date}</p>
            <ul className='list-inside list-disc space-y-2 text-foreground'>
              {entry.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
        ))}
      </Prose>
    </LegalLayout>
  );
}
