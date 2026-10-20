import { ExternalLink, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CountryFlag } from "@/components/radio/CountryFlag";
import { formatCount } from "@/lib/format";
import { formatCountryName, formatTags } from "@/lib/radio/format";
import { shareStation } from "@/lib/radio/share";
import type { Station } from "@/lib/radio/types";

function formatChecked(iso: string): string {
  const match = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/.exec(iso);
  if (!match?.groups?.year || !match.groups.month || !match.groups.day) return "unknown";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[Number(match.groups.month) - 1];
  if (!month) return "unknown";
  return `${Number(match.groups.day)} ${month} ${match.groups.year}`;
}

/** Directory facts and links for the Info tab. */
export function StationInfoTab({ station, bbcSounds }: { station: Station; bbcSounds: string | null }) {
  return (
    <>
      <dl className='grid grid-cols-3 gap-2'>
        {[
          { label: "Votes", value: formatCount(station.votes) },
          { label: "Clicks 24h", value: formatCount(station.clickcount) },
          {
            label: "Trend",
            value: `${station.clicktrend >= 0 ? "+" : ""}${formatCount(Math.abs(station.clicktrend))}`,
          },
        ].map((stat) => (
          <div key={stat.label} className='rounded-2xl bg-muted/60 px-3 py-2.5 text-center'>
            <dt className='text-xs font-medium text-muted-foreground'>{stat.label}</dt>
            <dd className='text-lg font-semibold tabular-nums'>{stat.value}</dd>
          </div>
        ))}
      </dl>

      <dl className='mt-4 flex flex-col gap-2.5 text-sm'>
        {station.tags ? (
          <div className='flex gap-2'>
            <dt className='w-20 shrink-0 font-semibold'>Genre</dt>
            <dd className='min-w-0 flex-1 text-muted-foreground'>{formatTags(station.tags)}</dd>
          </div>
        ) : null}
        {station.language ? (
          <div className='flex gap-2'>
            <dt className='w-20 shrink-0 font-semibold'>Language</dt>
            <dd className='min-w-0 flex-1 text-muted-foreground'>
              {formatTags(station.language)}
              {station.languagecodes ? ` (${formatTags(station.languagecodes)})` : ""}
            </dd>
          </div>
        ) : null}
        {station.countrycode || station.country ? (
          <div className='flex gap-2'>
            <dt className='w-20 shrink-0 font-semibold'>Location</dt>
            <dd className='flex min-w-0 flex-1 items-center gap-1.5 text-muted-foreground'>
              <CountryFlag code={station.countrycode} name={formatCountryName(station.country, station.countrycode)} />
              <span className='min-w-0 flex-1 truncate'>
                {[formatCountryName(station.country, station.countrycode), station.state, station.iso_3166_2]
                  .filter(Boolean)
                  .join(" · ")}
                {station.geo_lat !== 0 && station.geo_long !== 0
                  ? ` — ${station.geo_lat.toFixed(2)}, ${station.geo_long.toFixed(2)}`
                  : ""}
              </span>
            </dd>
          </div>
        ) : null}
        {station.homepage ? (
          <div className='flex gap-2'>
            <dt className='w-20 shrink-0 font-semibold'>Website</dt>
            <dd className='min-w-0 flex-1'>
              <a
                href={station.homepage}
                target='_blank'
                rel='noreferrer'
                className='inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline'>
                Visit homepage <ExternalLink className='size-3.5' />
              </a>
            </dd>
          </div>
        ) : null}
        {bbcSounds ? (
          <div className='flex gap-2'>
            <dt className='w-20 shrink-0 font-semibold'>Tracks</dt>
            <dd className='min-w-0 flex-1'>
              <a
                href={bbcSounds}
                target='_blank'
                rel='noreferrer'
                className='inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline'>
                Live, schedule &amp; track history <ExternalLink className='size-3.5' />
              </a>
            </dd>
          </div>
        ) : null}
        {station.codec || station.bitrate > 0 || station.hls === 1 ? (
          <div className='flex gap-2'>
            <dt className='w-20 shrink-0 font-semibold'>Audio</dt>
            <dd className='min-w-0 flex-1 text-muted-foreground'>
              {[
                station.codec || null,
                station.bitrate > 0 ? `${station.bitrate}k` : null,
                station.hls === 1 ? "HLS" : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </dd>
          </div>
        ) : null}
        <div className='flex gap-2'>
          <dt className='w-20 shrink-0 font-semibold'>Checked</dt>
          <dd className='flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground'>
            <span>{formatChecked(station.lastcheckoktime_iso8601 || station.lastchangetime_iso8601)}</span>
            <Badge variant={station.lastcheckok === 1 ? "secondary" : "destructive"}>
              {station.lastcheckok === 1 ? "Online" : "Offline"}
            </Badge>
          </dd>
        </div>
        <div className='flex gap-2'>
          <dt className='w-20 shrink-0 font-semibold'>Share</dt>
          <dd className='min-w-0 flex-1'>
            <button
              type='button'
              onClick={() => void shareStation(station)}
              aria-label={`Share ${station.name}`}
              className='inline-flex cursor-pointer items-center gap-1 text-primary underline-offset-4 hover:underline'>
              Share this station <Share2 className='size-3.5' />
            </button>
          </dd>
        </div>
      </dl>
    </>
  );
}
