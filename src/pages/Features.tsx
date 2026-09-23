import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  AudioWaveform,
  BellRing,
  Bookmark,
  ChartColumn,
  Command,
  DatabaseBackup,
  Download,
  Gauge,
  Heart,
  History,
  Languages,
  MoonStar,
  Play,
  Radio,
  RefreshCw,
  Search,
  Shuffle,
  Smartphone,
  Star,
  Timer,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { LegalLayout } from "@/components/layout/LegalLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";

type Platform = "Web + APK" | "APK only";

interface FeatureCard {
  Icon: LucideIcon;
  tint: string;
  title: string;
  body: string;
  platform: Platform;
}

interface FeatureGroup {
  eyebrow: string;
  heading: string;
  lede: string;
  cards: FeatureCard[];
}

const TINTS = [
  "bg-scout-butter",
  "bg-scout-mint",
  "bg-scout-sky",
  "bg-scout-lilac",
  "bg-scout-blush",
  "bg-scout-sage",
] as const;

const GROUPS: FeatureGroup[] = [
  {
    eyebrow: "Discover",
    heading: "Find a station in seconds",
    lede: "The whole radio-browser.info directory, filtered to streams that actually play.",
    cards: [
      {
        Icon: Radio,
        tint: TINTS[1],
        title: "Worldwide directory",
        body: "The top 50 stations by votes plus full-text search with up to 50 results, in one catalogue on web and APK.",
        platform: "Web + APK",
      },
      {
        Icon: Search,
        tint: TINTS[0],
        title: "Search + genre chips",
        body: "Name search with shareable URLs (/?q=, /?tag=), a one-tap genre rail and recent searches under the search box.",
        platform: "Web + APK",
      },
      {
        Icon: Languages,
        tint: TINTS[2],
        title: "Language filter",
        body: "Top-40 quick picks plus the full directory list. Empty means worldwide; applies to charts and results.",
        platform: "Web + APK",
      },
      {
        Icon: Gauge,
        tint: TINTS[5],
        title: "Quality filter",
        body: "A minimum bitrate cutoff for search and Most loved. Saved stations always show, whatever their bitrate.",
        platform: "Web + APK",
      },
    ],
  },
  {
    eyebrow: "Library",
    heading: "Stays on your device",
    lede: "Favourites, history and stats live in IndexedDB on your device. No accounts, no sync, and it works offline.",
    cards: [
      {
        Icon: Star,
        tint: TINTS[0],
        title: "Saved favourites",
        body: "Pin stations to the top of home and drag them into order. The order survives restarts and comes along in backups.",
        platform: "Web + APK",
      },
      {
        Icon: History,
        tint: TINTS[2],
        title: "Recently played",
        body: "Your recent plays, latest first and capped at ten. Clearing asks first and never touches Saved.",
        platform: "Web + APK",
      },
      {
        Icon: ChartColumn,
        tint: TINTS[1],
        title: "Listening stats",
        body: "Total time and daily averages, banked when the tab hides or the app goes to the background, even if it gets killed.",
        platform: "Web + APK",
      },
      {
        Icon: Heart,
        tint: TINTS[4],
        title: "Votes + details",
        body: "Station sheets with art, tags, a country flag, and voting with a tap. Every station gets a shareable link.",
        platform: "Web + APK",
      },
    ],
  },
  {
    eyebrow: "Player",
    heading: "A dock that stays out of the way",
    lede: "Gapless switches, levelled loudness and a sleep timer, with the same controls everywhere.",
    cards: [
      {
        Icon: Play,
        tint: TINTS[1],
        title: "Gapless switching",
        body: "The old station plays until the new stream is ready, then blends over. Rapid taps still crossfade.",
        platform: "Web + APK",
      },
      {
        Icon: Volume2,
        tint: TINTS[2],
        title: "Volume + leveling",
        body: "Overlay slider with mute, plus Level volume that rides quiet stations up and loud ones down.",
        platform: "Web + APK",
      },
      {
        Icon: Timer,
        tint: TINTS[0],
        title: "Sleep timer",
        body: "Fades out and pauses after the time you pick, with the countdown in the dock.",
        platform: "Web + APK",
      },
      {
        Icon: Shuffle,
        tint: TINTS[3],
        title: "Surprise shuffle",
        body: "One tap plays a random station from the catalogue, next to the browse button in the empty dock.",
        platform: "Web + APK",
      },
      {
        Icon: Bookmark,
        tint: TINTS[0],
        title: "Quick resume",
        body: "Reopens with your last station loaded and ready, so the music is one tap away.",
        platform: "Web + APK",
      },
      {
        Icon: AudioWaveform,
        tint: TINTS[4],
        title: "Auto-reconnect",
        body: "Dropped streams retry with backoff instead of getting stuck on an error. Paused stays paused.",
        platform: "Web + APK",
      },
      {
        Icon: BellRing,
        tint: TINTS[5],
        title: "Lockscreen controls",
        body: "MediaSession controls on web and notification controls on Android, with live track titles on stations that broadcast them.",
        platform: "Web + APK",
      },
    ],
  },
  {
    eyebrow: "Personal",
    heading: "Tuned to you",
    lede: "Theme, quick-find and a backup file that moves your whole setup between browser and APK.",
    cards: [
      {
        Icon: MoonStar,
        tint: TINTS[3],
        title: "System theme",
        body: "Light, dark, or follow your device. A script in the page head sets it before first paint, so there is no flash.",
        platform: "Web + APK",
      },
      {
        Icon: Command,
        tint: TINTS[5],
        title: "Quick Find",
        body: "A fuzzy palette across sections, pages and theme actions on Mod+K. No mouse needed.",
        platform: "Web + APK",
      },
      {
        Icon: DatabaseBackup,
        tint: TINTS[2],
        title: "Radio backup",
        body: "One JSON file holds favourites, history, stats, volume, votes and filters. Download it on web, or send it through the share sheet in the Android app.",
        platform: "Web + APK",
      },
      {
        Icon: Download,
        tint: TINTS[4],
        title: "Installable app",
        body: "Add it to your home screen from the browser and open it full-screen like any other app.",
        platform: "Web + APK",
      },
    ],
  },
  {
    eyebrow: "Android",
    heading: "Same app, native shell",
    lede: "The static build ships inside a Capacitor APK with background audio and zero-service updates.",
    cards: [
      {
        Icon: Smartphone,
        tint: TINTS[1],
        title: "Background audio",
        body: "A native service keeps audio playing with the screen off, and follows redirects onto allowlisted HTTP edges.",
        platform: "APK only",
      },
      {
        Icon: ArrowLeft,
        tint: TINTS[2],
        title: "Back gesture and button",
        body: "Edge-swipe or the hardware back button steps back through pages, and exits the app at home.",
        platform: "APK only",
      },
      {
        Icon: RefreshCw,
        tint: TINTS[0],
        title: "OTA updates",
        body: "New bundles download from GitHub Releases and apply on next launch. No store update needed.",
        platform: "APK only",
      },
    ],
  },
];

/**
 * Product tour: every core capability across the web app and the APK,
 * in the same AppShell + LegalLayout frame as the other reading pages.
 */
export default function FeaturesPage() {
  return (
    <LegalLayout
      title='Features'
      description='Everything RadioScout does: discovery, library, player, personal setup and the Android shell.'
      keywords={["features", "radio player", "android apk", "sleep timer", "crossfade", "backup", "ota updates"]}>
      <div className='space-y-10'>
        {GROUPS.map((group, groupIndex) => (
          <section key={group.eyebrow} aria-labelledby={`features-${group.eyebrow.toLowerCase()}`}>
            <p className='text-xs font-semibold tracking-widest text-muted-foreground uppercase'>{group.eyebrow}</p>
            <h2
              id={`features-${group.eyebrow.toLowerCase()}`}
              className='mt-1 text-xl font-semibold tracking-tight text-balance'>
              {group.heading}
            </h2>
            <p className='mt-1 text-sm text-muted-foreground'>{group.lede}</p>
            <ul className='mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2'>
              {group.cards.map((card, cardIndex) => (
                <li
                  key={card.title}
                  style={{ animationDelay: `${(groupIndex * 4 + cardIndex) * 60}ms` }}
                  className='animate-scout-enter rounded-scout-card border border-border bg-card p-5'>
                  <span className='flex items-center justify-between gap-2'>
                    <span
                      aria-hidden='true'
                      className={`grid size-10 place-items-center rounded-2xl text-scout-coal ${card.tint}`}>
                      <card.Icon className='size-5' />
                    </span>
                    <Badge variant='secondary'>{card.platform}</Badge>
                  </span>
                  <h3 className='mt-3 font-semibold tracking-tight'>{card.title}</h3>
                  <p className='mt-1 text-sm leading-relaxed text-muted-foreground'>{card.body}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section
          aria-label='Get started'
          className='animate-scout-enter rounded-scout-card border border-border bg-surface-1 p-5 text-center sm:p-6'>
          <h2 className='text-lg font-semibold tracking-tight'>Ready to listen?</h2>
          <p className='mx-auto mt-1 max-w-md text-sm text-muted-foreground'>
            Free worldwide radio on the web and Android. The same stations and favourites in both, carried in one backup
            file.
          </p>
          <div className='mt-4 flex flex-col justify-center gap-2 sm:flex-row'>
            <Link to='/'>
              <Button className='h-12 w-full rounded-full px-6 sm:w-auto'>Start listening</Button>
            </Link>
            <a href={siteConfig.links.releases} target='_blank' rel='noopener noreferrer'>
              <Button variant='outline' className='h-12 w-full rounded-full px-6 sm:w-auto'>
                Get the Android app
              </Button>
            </a>
          </div>
          <p className='mt-4 text-xs text-muted-foreground'>
            Missing a station?{" "}
            <Link to='/adding-stations' className='underline underline-offset-4 hover:text-foreground'>
              Add it via the directory
            </Link>
            .
          </p>
        </section>
      </div>
    </LegalLayout>
  );
}
