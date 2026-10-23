import { useEffect, useRef } from "react";
import { useIsClient } from "@/hooks/use-is-client";
import { useMediaQuery } from "@/hooks/use-media-query";
import { usePersistentString } from "@/hooks/use-persistent-state";
import { usePlayer } from "@/hooks/use-player";
import { isNative } from "@/lib/capacitor";
import { getSpectrumAnalyser, getSpectrumVolume, setSpectrumTap } from "@/lib/player/engine";
import { createSpectrumReader } from "@/lib/player/spectrum";
import { VISUALISER_KEY, visualiserEnabled } from "@/lib/radio/visualiser";
import { cn } from "@/lib/utils";

/**
 * Spectrum wings: the audio's spectrum spilling into the fog either side of
 * the app frame, bottom-aligned with the dock and mirrored so the bass hugs
 * the frame. Opt-in from Settings → Audio, web only, laptop width and up, and
 * only visible while a station is playing or loading.
 *
 * The tint is `--primary`, so light/dark and every flavour carry through. The
 * default light palette pairs a pale mint with pale fog, so a pale primary on
 * a pale surface is darkened in HSL first (see `resolveTint`).
 */
const WIDE_QUERY = "(min-width: 1024px)";
const CALM_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Bars march outward in fixed steps until that would leave a wide wing short
 * of its fade; past that the step widens so the run fills the width without
 * exceeding the bar cap.
 */
const BAR_STEP = 14;
const BAR_WIDTH = 3;
const MAX_BARS = 40;
/** Baseline tick, as a share of the wing: what shows while a stream connects. */
const FLOOR = 0.02;
/** Backing-store cap: two device pixels per CSS pixel is already generous. */
const DPR_CAP = 2;
/**
 * Pale primaries are darkened in HSL, not blended into the foreground: the
 * blend preserves luminance but drains the hue, which turned Pantry mint grey.
 */
const LIFT_FLOOR = 0.7;
const LIFT_TARGET = 0.52;
/**
 * Spark caps: the tint lifted toward white, far enough to separate from the
 * bar but not so far that it reads as a white dot in every theme. On a dark
 * mint 0.3 is a pale mint rather than a specular highlight.
 */
const SPARK_LIFT = 0.3;

type Channels = readonly [number, number, number];

/** `#rgb`, `#rrggbb` or `rgb()` → channels, null for anything else. */
function channelsOf(value: string): Channels | null {
  const hex = value.startsWith("#") ? value.slice(1) : "";
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return [
      Number.parseInt(hex.slice(0, 2), 16),
      Number.parseInt(hex.slice(2, 4), 16),
      Number.parseInt(hex.slice(4, 6), 16),
    ];
  }
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    const [red, green, blue] = hex.split("");
    return [Number.parseInt(red + red, 16), Number.parseInt(green + green, 16), Number.parseInt(blue + blue, 16)];
  }
  const match = /^rgb\(\s*(?<red>\d+)[ ,]+(?<green>\d+)[ ,]+(?<blue>\d+)\s*\)$/.exec(value);
  const parts = match?.groups;
  if (!parts?.red || !parts.green || !parts.blue) return null;
  return [Number(parts.red), Number(parts.green), Number(parts.blue)];
}

/** sRGB channel → linear light, the piece `luminance` needs. */
function linear(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** sRGB relative luminance, for deciding whether a colour needs lifting. */
function luminance([red, green, blue]: Channels): number {
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

/** HSL lightness of a colour, 0 to 1. */
function lightnessOf([red, green, blue]: Channels): number {
  return (Math.max(red, green, blue) + Math.min(red, green, blue)) / 510;
}

/** Lift toward white, so a spark reads against the bar it caps. */
function lightened([red, green, blue]: Channels, mix: number): Channels {
  return [
    Math.round(red + (255 - red) * mix),
    Math.round(green + (255 - green) * mix),
    Math.round(blue + (255 - blue) * mix),
  ];
}

/** Hue-preserving darkening: keeps a pale primary's colour instead of greying it. */
function capLightness([red, green, blue]: Channels, target: number): Channels {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return [red, green, blue];

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue = (hue * 60 + 360) % 360;

  const chroma = (1 - Math.abs(2 * target - 1)) * saturation;
  const second = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const floor = target - chroma / 2;
  let outRed = 0;
  let outGreen = 0;
  let outBlue = 0;
  if (hue < 60) {
    outRed = chroma;
    outGreen = second;
  } else if (hue < 120) {
    outRed = second;
    outGreen = chroma;
  } else if (hue < 180) {
    outGreen = chroma;
    outBlue = second;
  } else if (hue < 240) {
    outGreen = second;
    outBlue = chroma;
  } else if (hue < 300) {
    outRed = second;
    outBlue = chroma;
  } else {
    outRed = chroma;
    outBlue = second;
  }
  return [
    Math.round((outRed + floor) * 255),
    Math.round((outGreen + floor) * 255),
    Math.round((outBlue + floor) * 255),
  ];
}

/**
 * The bar tint: `--primary`, darkened in HSL only when the primary and the
 * fog are both pale. Every other pairing already has contrast, so it passes
 * through untouched.
 */
function resolveTint(styles: CSSStyleDeclaration): Channels | null {
  const primary = channelsOf(styles.getPropertyValue("--primary").trim()) ?? channelsOf(styles.color);
  if (primary === null) return null;
  const surface = channelsOf(styles.getPropertyValue("--scout-fog").trim());
  if (surface === null || luminance(surface) < 0.55) return primary;
  if (lightnessOf(primary) <= LIFT_FLOOR) return primary;
  return capLightness(primary, LIFT_TARGET);
}

/** Loudest of the low bands — the part of the track that drives the shelf. */
function bassOf(levels: Float32Array): number {
  let peak = 0;
  const bands = Math.min(3, levels.length);
  for (let index = 0; index < bands; index += 1) peak = Math.max(peak, levels[index]);
  return peak;
}

/** Channel equality, so a re-read palette with the same colours is not a change. */
function sameChannels(a: Channels | null, b: Channels | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

/** Per-wing objects that outlive a frame: canvas, context and cached paint. */
interface Wing {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  mirrored: boolean;
  skin: WingSkin | null;
}

/**
 * Colour and gradients for one wing. They depend only on the tint and the
 * wing's size, so the frame loop reuses them instead of rebuilding two
 * gradients and their colour strings sixty times a second.
 */
interface WingSkin {
  width: number;
  height: number;
  tint: Channels;
  ramp: CanvasGradient;
  shelf: CanvasGradient;
  spark: string;
}

function wingOf(canvas: HTMLCanvasElement, mirrored: boolean): Wing | null {
  const ctx = canvas.getContext("2d");
  return ctx ? { canvas, ctx, mirrored, skin: null } : null;
}

function skinFor(wing: Wing, width: number, height: number, tint: Channels): WingSkin {
  const cached = wing.skin;
  if (cached && cached.width === width && cached.height === height && cached.tint === tint) return cached;

  const [red, green, blue] = tint;
  const solid = (alpha: number) => `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  // Bases stay solid, tips soften; the CSS mask trims the last stretch.
  const ramp = wing.ctx.createLinearGradient(0, height, 0, 0);
  ramp.addColorStop(0, solid(0.95));
  ramp.addColorStop(1, solid(0.32));
  // Alpha 1 → 0; the bass breathes through globalAlpha when it is painted.
  const shelf = wing.ctx.createLinearGradient(0, 0, width, 0);
  shelf.addColorStop(0, solid(1));
  shelf.addColorStop(1, solid(0));
  const [sparkRed, sparkGreen, sparkBlue] = lightened(tint, SPARK_LIFT);
  const skin = { width, height, tint, ramp, shelf, spark: `rgb(${sparkRed}, ${sparkGreen}, ${sparkBlue})` };
  wing.skin = skin;
  return skin;
}

/** Bars a wing of this width carries: one per step, capped to bound the work. */
function barCountFor(width: number): number {
  return Math.min(MAX_BARS, Math.max(1, Math.floor(width / BAR_STEP)));
}

function paintWing(
  wing: Wing,
  width: number,
  height: number,
  levels: Float32Array,
  peaks: Float32Array,
  tint: Channels | null,
  bass: number,
): void {
  const { canvas, ctx } = wing;
  if (width < 1 || height < 1) return;

  const dpr = Math.min(DPR_CAP, globalThis.devicePixelRatio || 1);
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  if (tint === null) {
    wing.skin = null;
    return;
  }
  // Drawing always runs from the frame edge outward; the left wing mirrors.
  if (wing.mirrored) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }

  const skin = skinFor(wing, width, height, tint);
  ctx.fillStyle = skin.ramp;

  const bars = Math.min(levels.length, barCountFor(width));
  const step = width / bars;
  const maxHeight = height - 4;
  for (let index = 0; index < bars; index += 1) {
    const x = Math.round(index * step + (step - BAR_WIDTH) / 2);
    // Outer bars fade, so the wing dissolves instead of ending on a hard edge.
    const fade = 1 - 0.88 * (x / width);
    const level = Math.max(FLOOR, levels[index] ?? 0);
    const barHeight = Math.max(2, level * maxHeight);
    const y = height - barHeight;

    ctx.globalAlpha = fade * 0.08;
    ctx.fillRect(x - 3, y, BAR_WIDTH + 6, barHeight);
    ctx.globalAlpha = fade;
    ctx.beginPath();
    ctx.roundRect(x, y, BAR_WIDTH, barHeight, BAR_WIDTH / 2);
    ctx.fill();

    const peak = peaks[index] ?? 0;
    if (peak > FLOOR + 0.04) {
      // The cap becomes a spark: a lighter core over a faint halo, so hits
      // leave a small mark in the air above the bar instead of a flat dash.
      // Both alphas ride globalAlpha, so neither allocates a colour string.
      const sparkY = height - peak * maxHeight - 2;
      const sparkX = x + BAR_WIDTH / 2;
      ctx.fillStyle = skin.spark;
      ctx.globalAlpha = fade * 0.26;
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, 2.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = fade * 0.95;
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, 1.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = skin.ramp;
    }
  }

  // The shelf the bars stand on: a hairline that fades outward with them and
  // warms with the bass, so the whole wing sits on the low end.
  ctx.globalAlpha = 0.14 + 0.32 * bass;
  ctx.fillStyle = skin.shelf;
  ctx.fillRect(0, height - 1, width, 1);
}

export function AppSpectrum() {
  const isClient = useIsClient();
  const wide = useMediaQuery(WIDE_QUERY);
  const calm = useMediaQuery(CALM_QUERY);
  const [optIn] = usePersistentString(VISUALISER_KEY, "0");
  const { status } = usePlayer();
  // Loading keeps the wings on screen through a station switch; nothing else
  // (idle, paused, error) shows them at all.
  const live = status === "playing" || status === "loading";
  const leftRef = useRef<HTMLCanvasElement>(null);
  const rightRef = useRef<HTMLCanvasElement>(null);

  const visible = isClient && !isNative() && wide && visualiserEnabled(optIn);

  // The engine reads this when it builds an element, so the analyser starts on
  // the next station instead of interrupting the one already playing.
  useEffect(() => {
    setSpectrumTap(visible);
    return () => {
      setSpectrumTap(false);
    };
  }, [visible]);

  // Canvas paint has no declarative form: one rAF loop owns both wings, writes
  // no React state, and stops on pause, reduced motion or unmount.
  useEffect(() => {
    const leftCanvas = leftRef.current;
    const rightCanvas = rightRef.current;
    if (!visible || !live || !leftCanvas || !rightCanvas) return undefined;

    const left = wingOf(leftCanvas, true);
    const right = wingOf(rightCanvas, false);
    if (!left || !right) return undefined;

    const reader = createSpectrumReader(MAX_BARS);
    let tint: Channels | null = null;
    let frame = 0;
    let handle = 0;

    // Keep the last array when the palette has not moved, so the cached
    // gradients survive a re-read instead of being rebuilt twice a second.
    const readTint = () => {
      const next = resolveTint(globalThis.getComputedStyle(leftCanvas));
      if (!sameChannels(tint, next)) tint = next;
    };
    // One layout read per frame feeds both wings and the reader's band count.
    const paint = (width: number, height: number) => {
      const bass = bassOf(reader.levels);
      paintWing(left, width, height, reader.levels, reader.peaks, tint, bass);
      paintWing(right, width, height, reader.levels, reader.peaks, tint, bass);
    };
    const paintStill = () => {
      const width = leftCanvas.clientWidth;
      const height = leftCanvas.clientHeight;
      const analyser = getSpectrumAnalyser();
      if (analyser) reader.read(analyser, getSpectrumVolume(), barCountFor(width));
      paint(width, height);
    };

    readTint();

    // Reduced motion: one honest still frame of the current spectrum.
    if (calm) {
      paintStill();
      return undefined;
    }

    const draw = () => {
      const width = leftCanvas.clientWidth;
      const height = leftCanvas.clientHeight;
      const analyser = getSpectrumAnalyser();
      if (analyser) reader.read(analyser, getSpectrumVolume(), barCountFor(width));
      // Theme and flavour can flip under the loop; re-read cheaply, not by frame.
      if (frame % 30 === 0) readTint();
      paint(width, height);
      frame += 1;
      handle = globalThis.requestAnimationFrame(draw);
    };
    handle = globalThis.requestAnimationFrame(draw);

    return () => {
      globalThis.cancelAnimationFrame(handle);
    };
  }, [visible, live, calm]);

  if (!visible) return null;

  return (
    <div
      aria-hidden='true'
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-0 hidden items-end justify-between transition-opacity duration-500 lg:flex",
        live ? "opacity-100" : "opacity-0",
      )}>
      <div className='h-[clamp(6rem,18vh,12rem)] w-[calc((100%-48rem)/2)] mask-[linear-gradient(to_top,black_72%,transparent)] xl:w-[calc((100%-56rem)/2)]'>
        <canvas ref={leftRef} className='block size-full' />
      </div>
      <div className='h-[clamp(6rem,18vh,12rem)] w-[calc((100%-48rem)/2)] mask-[linear-gradient(to_top,black_72%,transparent)] xl:w-[calc((100%-56rem)/2)]'>
        <canvas ref={rightRef} className='block size-full' />
      </div>
    </div>
  );
}
