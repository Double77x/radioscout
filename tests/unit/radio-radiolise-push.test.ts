// @vitest-environment jsdom
// oxlint-disable max-classes-per-file -- both fakes are local to this harness: one audio element, one socket
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { EMPTY_STATION, type Station } from "@/lib/radio/types";
import { radioDb } from "@/lib/radio/store";
import { TITLES_KEY } from "@/lib/radio/titles";
import { getSnapshot } from "@/lib/player/store";
import { play, stop } from "@/hooks/use-player";

type AudioHandler = () => void;

/** Controllable `<audio>` stand-in: play resolves, pause fires handlers. */
class FakeAudio {
  static created: FakeAudio[] = [];
  src = "";
  readonly volume = 1;
  readonly preload = "";
  private readonly attrs = new Map<string, string>();
  private readonly handlers = new Map<string, Set<AudioHandler>>();
  constructor() {
    FakeAudio.created.push(this);
  }
  load(): void {}
  play(): Promise<void> {
    return Promise.resolve();
  }
  pause(): void {
    this.fire("pause");
  }
  addEventListener(type: string, handler: AudioHandler): void {
    const set = this.handlers.get(type) ?? new Set<AudioHandler>();
    set.add(handler);
    this.handlers.set(type, set);
  }
  removeEventListener(type: string, handler: AudioHandler): void {
    this.handlers.get(type)?.delete(handler);
  }
  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }
  removeAttribute(name: string): void {
    this.attrs.delete(name);
  }
  fire(type: string): void {
    for (const handler of this.handlers.get(type) ?? []) handler();
  }
}

/** Minimal WebSocket stand-in: records sends, replays server frames. */
class FakeSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static instances: FakeSocket[] = [];
  sent: string[] = [];
  readyState = FakeSocket.CONNECTING;
  closed = false;
  private readonly handlers = new Map<string, ((event: unknown) => void)[]>();

  constructor() {
    FakeSocket.instances.push(this);
  }

  addEventListener(type: string, handler: (event: unknown) => void): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
    this.readyState = 3;
    for (const handler of this.handlers.get("close") ?? []) handler({});
  }

  serverOpen(): void {
    this.readyState = FakeSocket.OPEN;
    for (const handler of this.handlers.get("open") ?? []) handler({});
  }

  serverMessage(data: unknown): void {
    for (const handler of this.handlers.get("message") ?? []) handler({ data });
  }
}

const STATION: Station = {
  ...EMPTY_STATION,
  stationuuid: "push-1",
  name: "Push FM",
  url_resolved: "https://example.com/push.mp3",
  tags: "rock",
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

/** Let the play path's resolves, dynamic imports and probe chain settle. */
async function flush(): Promise<void> {
  await sleep(25);
  await sleep(25);
}

function audio(): FakeAudio {
  const element = FakeAudio.created.at(-1);
  if (!element) throw new Error("audio element not created yet — play() first");
  return element;
}

function latestSocket(): FakeSocket {
  const socket = FakeSocket.instances.at(-1);
  if (!socket) throw new Error("push socket not created yet — is Titles on?");
  return socket;
}

beforeEach(async () => {
  FakeSocket.instances = [];
  // The engine owns one audio element per module lifetime — track every one
  // ever created and always drive the latest. Titles are opt-in, so every
  // test starts with the switch on unless it removes the key itself.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- mutable record view of a global for stub install/restore
  const scope = globalThis as unknown as { Audio?: new () => FakeAudio };
  scope.Audio = FakeAudio;
  globalThis.localStorage.setItem(TITLES_KEY, "1");
  vi.stubGlobal("WebSocket", FakeSocket);
  // Never touch the live directory — resolve falls back to the local URL.
  vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
  await radioDb.listening.clear();
  await radioDb.history.clear();
});

afterEach(async () => {
  stop();
  await flush();
  vi.useRealTimers();
  globalThis.localStorage.removeItem(TITLES_KEY);
  await radioDb.listening.clear();
  await radioDb.history.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Radiolise push persistence", () => {
  it("applies a pushed title to the player snapshot", async () => {
    play(STATION);
    await flush();
    const socket = latestSocket();
    socket.serverOpen();
    expect(socket.sent).toEqual([
      JSON.stringify({ action: "subscribe", data: { url: "https://example.com/push.mp3" } }),
    ]);
    socket.serverMessage(JSON.stringify({ action: "setTitle", data: { title: "Nova - Ramp" } }));
    expect(getSnapshot().track).toBe("Nova - Ramp");
  });

  it("stands the poll down while the socket is open", async () => {
    const ticks: (() => void)[] = [];
    const realSetInterval = globalThis.setInterval;
    vi.stubGlobal("setInterval", (callback: () => void, ms?: number) => {
      if (ms === 20_000) ticks.push(callback);
      return realSetInterval(callback, ms);
    });
    const fetchSpy = vi.fn(() => Promise.reject(new Error("offline")));
    vi.stubGlobal("fetch", fetchSpy);
    play(STATION);
    await flush();
    audio().fire("playing");
    latestSocket().serverOpen();
    expect(ticks).toHaveLength(1);
    const before = fetchSpy.mock.calls.length;
    ticks[0]?.();
    await flush();
    expect(fetchSpy).toHaveBeenCalledTimes(before);
  });

  it("reopens the socket after an unexpected drop", async () => {
    play(STATION);
    await flush();
    audio().fire("playing");
    const first = latestSocket();
    first.serverOpen();
    vi.useFakeTimers();
    try {
      first.close();
      await vi.advanceTimersByTimeAsync(1999);
      expect(FakeSocket.instances).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(FakeSocket.instances).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ends the subscription on a station error without reconnecting", async () => {
    play(STATION);
    await flush();
    audio().fire("playing");
    const socket = latestSocket();
    socket.serverOpen();
    vi.useFakeTimers();
    try {
      socket.serverMessage(JSON.stringify({ action: "reportError", data: { type: "serverUnreachable" } }));
      expect(socket.closed).toBe(true);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(FakeSocket.instances).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("tears the socket down on stop as an expected close", async () => {
    play(STATION);
    await flush();
    const socket = latestSocket();
    socket.serverOpen();
    stop();
    expect(socket.sent).toContain(JSON.stringify({ action: "unsubscribe" }));
    expect(socket.closed).toBe(true);
  });

  it("opens no socket while titles are switched off", async () => {
    globalThis.localStorage.removeItem(TITLES_KEY);
    play(STATION);
    await flush();
    expect(FakeSocket.instances).toHaveLength(0);
  });
});
