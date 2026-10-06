import { useState, type SyntheticEvent } from "react";
import { Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { ddgArtworkUrl, isDdgPlaceholder, wsrvArtworkUrl } from "@/lib/radio/artwork";

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
 *
 * Square contract: callers size with square classes (`size-9` etc) and the
 * `aspect-square` below reserves the box (plus `width`/`height`) so
 * lazy-loaded art never shifts layout. Non-square art must not use this.
 */
export function StationArt({ src, className, fallbackClassName, iconClassName }: StationArtProps) {
  // Proxy chain, never direct: wsrv primary (it reports failures honestly, so
  // a missing image logs one 404 and nothing worse), DDG fallback (it
  // rasterises the `.ico` files wsrv cannot decode), tile when both fail.
  // `no-referrer` still hides the page URL from the proxies. A proxy that
  // starts setting cookies would leak silently, which is why `img-src` in
  // `public/_headers` names exactly the two proxy hosts.
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const primary = wsrvArtworkUrl(src);
  const fallback = ddgArtworkUrl(src);
  const current = stage === 0 ? primary : fallback;
  // Stage 0 is the wsrv primary, stage 1 the DDG fallback, stage 2 gives up.
  // Shared by every failure path below.
  const advance = () => {
    setStage((previous) => (previous === 0 ? 1 : 2));
  };
  // Only the DDG leg can hand back a decodable placeholder instead of an
  // error (a 260x180 SVG with a 400), so it must be caught on success, not
  // via `onError`. The test is deliberately NOT gated on `stage`: a browser
  // HTTP-cache hit can serve the already-decoded placeholder straight to the
  // wsrv attempt, and a stage check would let it through. wsrv never emits
  // the placeholder, so the exact-dimension test stays safe at both stages.
  const checkLoaded = (node: HTMLImageElement) => {
    if (isDdgPlaceholder(node.naturalWidth, node.naturalHeight)) advance();
  };
  // `onLoad` hands a SyntheticEvent; the shared check wants the element.
  const onLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    checkLoaded(event.currentTarget);
  };
  // Belt-and-braces for a genuine decode failure: an error that lands BEFORE
  // React attaches `onError` fires with no listener and never repeats, so
  // check the node at commit as well. Braced because a returned value from a
  // ref callback is a React 19 error.
  const catchAlreadyFailed = (node: HTMLImageElement | null) => {
    if (node === null || !node.complete) return;
    // `complete` at commit means the load resolved before React registered
    // its listeners (cached instant decode), so `onLoad`/`onError` never ran
    // for this attempt. Re-apply both verdicts here: dead if there are no
    // pixels, placeholder if DDG refused.
    if (node.naturalWidth === 0) advance();
    else checkLoaded(node);
  };
  if (current === "" || stage === 2) {
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
      ref={catchAlreadyFailed}
      src={current}
      alt=''
      width={48}
      height={48}
      loading='lazy'
      decoding='async'
      draggable={false}
      referrerPolicy='no-referrer'
      onLoad={onLoad}
      onError={advance}
      className={cn("aspect-square shrink-0 object-cover", className)}
    />
  );
}
