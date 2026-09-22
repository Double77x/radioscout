import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { isNative } from "@/lib/capacitor";

export interface NativePlayOptions {
  url: string;
  title: string;
  artist: string;
  artwork: string;
  volume: number;
  muted: boolean;
  /** Loudness leveling for the service-side processor (APK only). */
  leveling: boolean;
  /**
   * Gapless handoff: the service is mid-station, so enqueue behind the live
   * item and advance when buffered instead of cutting over. Ignored unless
   * the player holds exactly one playing/buffering item.
   */
  handoff: boolean;
}

export type NativePlaybackStatus = "playing" | "paused" | "loading" | "error";

export interface NativePlaybackEvent {
  status: NativePlaybackStatus;
  error?: string | null;
}

/** Now-playing title parsed from stream metadata (ICY/ID3/Vorbis, APK only). */
export interface NativeTrackEvent {
  title: string;
}

interface NativeAudioApi {
  play: (options: NativePlayOptions) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  setVolume: (options: { volume: number; muted: boolean }) => Promise<void>;
  setLeveling: (options: { enabled: boolean }) => Promise<void>;
  /** Native sleep-timer arm in seconds (`0` clears); survives WebView throttle. */
  setSleepTimer: (options: { seconds: number }) => Promise<void>;
  addListener: {
    (event: "playbackStatus", callback: (event: NativePlaybackEvent) => void): Promise<PluginListenerHandle>;
    (event: "trackUpdate", callback: (event: NativeTrackEvent) => void): Promise<PluginListenerHandle>;
  };
}

/**
 * Capacitor `NativeAudio` bridge (Media3 foreground service, APK only).
 * Importing is SSR-safe; every call rejects on web and callers fall back
 * to `<audio>`. Only call guarded by `isNative()`.
 */
const NativeAudio = registerPlugin<NativeAudioApi>("NativeAudio");

/** `false` on web/prerender — never await a bridge method there. */
export function canUseNativeAudio(): boolean {
  return isNative();
}

export function nativePlay(options: NativePlayOptions): Promise<void> {
  return NativeAudio.play(options);
}

export function nativePause(): Promise<void> {
  return NativeAudio.pause();
}

export function nativeResume(): Promise<void> {
  return NativeAudio.resume();
}

export function nativeStop(): Promise<void> {
  return NativeAudio.stop();
}

export function nativeSetVolume(volume: number, muted: boolean): Promise<void> {
  return NativeAudio.setVolume({ volume, muted });
}

/** Flip the service-side leveling processor (APK only — no-op on web). */
export function nativeSetLeveling(enabled: boolean): Promise<void> {
  if (!isNative()) return Promise.resolve();
  return NativeAudio.setLeveling({ enabled });
}

/**
 * Arm the service-side sleep deadline (APK only — no-op on web). The plugin
 * pauses itself when it fires, so the timer survives screen-off WebView
 * throttling; the web timeout stays armed as the fallback for `<audio>` mode.
 */
export function nativeSetSleepTimer(seconds: number): Promise<void> {
  if (!isNative()) return Promise.resolve();
  return NativeAudio.setSleepTimer({ seconds });
}

/** Null handle on web so subscribers can no-op without branching. */
export function onNativePlaybackStatus(
  callback: (event: NativePlaybackEvent) => void,
): Promise<PluginListenerHandle | null> {
  if (!isNative()) return Promise.resolve(null);
  return NativeAudio.addListener("playbackStatus", callback);
}

/**
 * Stream now-playing titles (APK only — the browser cannot read ICY/ID3
 * metadata through `<audio>`, and most stations omit the CORS headers a
 * manual fetch would need). Null handle on web like the status listener.
 */
export function onNativeTrackUpdate(callback: (event: NativeTrackEvent) => void): Promise<PluginListenerHandle | null> {
  if (!isNative()) return Promise.resolve(null);
  return NativeAudio.addListener("trackUpdate", callback);
}
