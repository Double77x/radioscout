import { useState } from "react";
import { Radio } from "lucide-react";
import { cn } from "@/lib/utils";

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
  if (src === "" || failed) {
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
      src={src}
      alt=''
      loading='lazy'
      decoding='async'
      onError={() => setFailed(true)}
      className={cn("shrink-0 object-cover", className)}
    />
  );
}
