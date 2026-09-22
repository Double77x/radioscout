// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_STATION, type Station } from "@/lib/radio/types";
import { radioDb, summarizeListening } from "@/lib/radio/store";
import { checkpointListeningSession } from "@/lib/player/store";
import { pause, play, stop } from "@/hooks/use-player";

type AudioHandler = () => void;

/** Controllable `<audio>` stand-in: play resolves, pause fires handlers. */
class FakeAudio {
  static created: FakeAudio[] = [];
  src = "";
  volume = 1;
  preload = "";
  private attrs = new Map<string, string>();
  private handlers = new Map<string, Set<AudioHandler>>();
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

let nowMs = 0;

const T0 = new Date("2026-09-22T10:00:00Z").getTime();

const STATION: Station = {
  ...EMPTY_STATION,
  stationuuid: "session-1",
  name: "Session FM",
  url_resolved: "https://example.com/session.mp3",
  tags: "rock",
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), ms);
  });
}

/** Let the play path, bank write and dynamic imports settle. */
async function flush(): Promise<void> {
  await sleep(25);
  await sleep(25);
}

beforeEach(async () => {
  nowMs = T0;
  vi.spyOn(Date, "now").mockImplementation(() => nowMs);
  // The player owns one audio singleton per module lifetime — track every
  // element ever created and always drive the latest (do NOT reset here).
  const scope = globalThis as unknown as { Audio?: new () => FakeAudio; fetch?: typeof fetch };
  scope.Audio = FakeAudio;
  // Never touch the live directory — resolve falls back to the local URL.
  scope.fetch = (() => Promise.reject(new Error("offline"))) as typeof fetch;
  await radioDb.listening.clear();
  await radioDb.history.clear();
});

/** The player's live audio element (created on first play). */
function audio(): FakeAudio {
  const element = FakeAudio.created.at(-1);
  if (!element) throw new Error("audio element not created yet — play() first");
  return element;
}

afterEach(async () => {
  stop();
  await flush();
  await radioDb.listening.clear();
  await radioDb.history.clear();
  vi.restoreAllMocks();
});

describe("listening sessions", () => {
  it("banks audible seconds from playing to pause", async () => {
    play(STATION);
    await flush();
    audio().fire("playing");
    nowMs = T0 + 10_000;
    pause();
    await flush();
    const summary = await summarizeListening();
    expect(summary.totalSeconds).toBe(10);
    expect(summary.plays).toBe(1);
    expect(summary.stations[0]).toMatchObject({ stationuuid: "session-1", name: "Session FM" });
  });

  it("ignores taps below the audibility threshold", async () => {
    play(STATION);
    await flush();
    audio().fire("playing");
    nowMs = T0 + 3000;
    pause();
    await flush();
    const summary = await summarizeListening();
    expect(summary.totalSeconds).toBe(0);
    expect(summary.plays).toBe(0);
  });

  it("checkpoints without ending so background time keeps counting", async () => {
    play(STATION);
    await flush();
    audio().fire("playing");
    nowMs = T0 + 8000;
    checkpointListeningSession();
    await flush();
    nowMs = T0 + 15_000;
    pause();
    await flush();
    const summary = await summarizeListening();
    expect(summary.totalSeconds).toBe(15);
    expect(summary.plays).toBe(2);
  });
});
