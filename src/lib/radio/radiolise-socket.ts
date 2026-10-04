import { isRecord } from "@/lib/utils";
import { normalizeStreamTitle } from "./icy";

export const RADIOLISE_SOCKET_URL = "wss://backend.radiolise.com/api/data-service";

/** Open the push socket; null when the constructor throws (locked-down CSP). */
function openSocket(): WebSocket | null {
  try {
    return new globalThis.WebSocket(RADIOLISE_SOCKET_URL);
  } catch {
    return null;
  }
}

/** Parse one socket frame; undefined when it is not JSON. */
function parseSocketPayload(data: unknown): unknown {
  try {
    return JSON.parse(String(data)) as unknown;
  } catch {
    return undefined;
  }
}

/** Station-level verdicts the server can report (see `@radiolise/common`). */
export interface RadioliseSocketEvents {
  /** A live title. Already normalised — apply it like a probed one. */
  onTitle: (title: string) => void;
  /** Station-level verdict. The subscription is over; fall back to polling. */
  onStationError: (type: string) => void;
  /** Transport dropped. `expected` is true for our own teardown. */
  onClose: (expected: boolean) => void;
}

export interface RadioliseSubscription {
  /** True while the underlying socket is open. */
  isOpen: () => boolean;
  /** Unsubscribe and close. Marks any later close as expected. */
  unsubscribe: () => void;
}

/**
 * Push title subscription over the Radiolise WebSocket
 * (`subscribe`/`unsubscribe`, `setTitle` on every upstream publish).
 *
 * This is their designed path — the docs prefer it over REST polling, and
 * polling with the URL in the query string lands in their server logs. One
 * socket per play: subscribe on arm, `unsubscribe()` on supersede/stop, and
 * the engine reconnects on unexpected drops. Repeated identical titles (the
 * server re-publishes aggressively, measured every ~0.5s) are forwarded as
 * they arrive; dedupe stays with the caller's apply step.
 *
 * Station errors end the subscription — the socket is closed as expected
 * and the caller falls back to polling, which is the right carrier for a
 * stable per-station verdict. Never throws: an unavailable WebSocket
 * (SSR, unit tests) yields null and the caller polls instead.
 */
export function subscribeRadioliseTitle(url: string, events: RadioliseSocketEvents): RadioliseSubscription | null {
  // oxlint-disable-next-line unicorn/no-typeof-undefined -- DOM lib declares WebSocket as always present but it is absent outside browsers; typeof keeps tsc from flagging an always-false comparison
  if (typeof globalThis.WebSocket === "undefined") return null;
  const socket = openSocket();
  if (socket === null) return null;
  let expected = false;
  socket.addEventListener("open", () => {
    if (expected) return;
    socket.send(JSON.stringify({ action: "subscribe", data: { url } }));
  });
  socket.addEventListener("message", (event: MessageEvent) => {
    if (expected) return;
    const payload = parseSocketPayload(event.data);
    if (!isRecord(payload)) return;
    if (payload.action === "setTitle" && isRecord(payload.data) && typeof payload.data.title === "string") {
      const title = normalizeStreamTitle(payload.data.title);
      if (title !== "") events.onTitle(title);
      return;
    }
    if (payload.action === "reportError" && isRecord(payload.data) && typeof payload.data.type === "string") {
      events.onStationError(payload.data.type);
    }
  });
  socket.addEventListener("close", () => {
    events.onClose(expected);
  });
  return {
    isOpen: () => socket.readyState === WebSocket.OPEN,
    unsubscribe: () => {
      expected = true;
      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ action: "unsubscribe" }));
        }
      } catch {
        // Closing anyway below.
      }
      socket.close();
    },
  };
}
