/**
 * Player hook + public import surface. The state machine lives in
 * `lib/player/engine` (single-owner singletons); this module only binds it
 * to React via `useSyncExternalStore` and re-exports the engine surface so
 * existing import paths keep working. The re-export list is intentionally
 * explicit — and covered by a scoped `ignoreExports` exception in
 * `fallow.toml` — so the facade can never silently drift from the engine.
 */
import { useSyncExternalStore } from "react";
import { getServerSnapshot, getSnapshot, subscribe, type PlayerSnapshot } from "@/lib/player/store";
import { cancelSleepTimer, play, setSleepTimer, setVolume, stop, toggle, toggleMute } from "@/lib/player/engine";
import type { Station } from "@/lib/radio/types";

export function usePlayer(): PlayerSnapshot & {
  play: (station: Station, options?: { fromReconnect?: boolean }) => void;
  toggle: () => void;
  stop: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setSleepTimer: (minutes: number) => void;
  cancelSleepTimer: () => void;
} {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { ...snap, play, toggle, stop, setVolume, toggleMute, setSleepTimer, cancelSleepTimer };
}

export {
  applyPlayerPrefs,
  cancelSleepTimer,
  pause,
  play,
  resume,
  setNormalization,
  setSleepTimer,
  setVolume,
  stop,
  toggle,
  toggleMute,
  togglePlay,
} from "@/lib/player/engine";
