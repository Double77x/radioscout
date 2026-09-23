import { useState } from "react";
import { Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { upgradeInsecureUrl } from "@/lib/radio/types";

interface StationArtProps {
  src: string;
  /** img classes (size + rounding per context). */
  className?: string;
  /** Fallback tile classes — defaults to a muted rounded tile. */
  fallbackClassName?: string;
  iconClassName?: string;
}

/**
 * Station artwork with a seamless lucide fallback. Remount per `key`
 * (pass `key={station.favicon || station.stationuuid}`) so a previous
 * load error never hides a new station's art.
 */
export function StationArt({ src, className, fallbackClassName, iconClassName }: StationArtProps) {
  const [failed, setFailed] = useState(false);
  // Secure pages auto-upgrade (or block) `http://` artwork with a console
  // warning per image — upgrade at the source instead. `no-referrer` keeps
  // the page URL out of favicon requests and dodges hotlink blocks that key
  // on `Referer`. Dead origins (e.g. a suspended host) still fail, and the
  // fallback tile below covers them — the browser-level 4xx log for those
  // cannot be suppressed from JS.
  const safeSrc = upgradeInsecureUrl(src);
  if (safeSrc === "" || failed) {
    return (
      <span
        aria-hidden='true'
        className={cn(
          "grid shrink-0 place-items-center bg-muted text-muted-foreground",
          fallbackClassName ?? className,
        )}>
        <Radio className={iconClassName ?? "size-5"} strokeWidth={1.5} />
      </span>
    );
  }
  return (
    <img
      src={safeSrc}
      alt=''
      loading='lazy'
      decoding='async'
      draggable={false}
      referrerPolicy='no-referrer'
      onError={() => setFailed(true)}
      className={cn("shrink-0 object-cover", className)}
    />
  );
}
