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
}

export type NativePlaybackStatus = "playing" | "paused" | "loading" | "error";

export interface NativePlaybackEvent {
  status: NativePlaybackStatus;
  error?: string | null;
}

interface NativeAudioApi {
  play: (options: NativePlayOptions) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  setVolume: (options: { volume: number; muted: boolean }) => Promise<void>;
  setLeveling: (options: { enabled: boolean }) => Promise<void>;
  addListener: (
    event: "playbackStatus",
    callback: (event: NativePlaybackEvent) => void,
  ) => Promise<PluginListenerHandle>;
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

/** Null handle on web so subscribers can no-op without branching. */
export function onNativePlaybackStatus(
  callback: (event: NativePlaybackEvent) => void,
): Promise<PluginListenerHandle | null> {
  if (!isNative()) return Promise.resolve(null);
  return NativeAudio.addListener("playbackStatus", callback);
}
