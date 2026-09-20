import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

// Hoisted: useSyncExternalStore requires stable snapshot identities, otherwise
// React re-snapshots every render ("getServerSnapshot should be cached").
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/** True only on the client. Gates browser-only queries during SSG prerender. */
export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
