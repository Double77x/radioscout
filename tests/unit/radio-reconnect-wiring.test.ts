// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_STATION, type Station } from "@/lib/radio/types";
import { radioDb } from "@/lib/radio/store";
import { MAX_RECONNECT_ATTEMPTS, RECONNECT_DELAYS_MS } from "@/lib/radio/reconnect";
import { pause, play, stop } from "@/hooks/use-player";

type AudioHandler = () => void;

/** Controllable `<audio>` stand-in: play resolves, events fire on demand. */
class FakeAudio {
  static created: FakeAudio[] = [];
  src = "";
  volume = 1;
  muted = false;
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

const STATION: Station = {
  ...EMPTY_STATION,
  stationuuid: "reconnect-1",
  name: "Drop FM",
  url_resolved: "https://example.com/drop.mp3",
  tags: "rock",
};

const OTHER: Station = {
  ...EMPTY_STATION,
  stationuuid: "reconnect-2",
  name: "Other FM",
  url_resolved: "https://example.com/other.mp3",
  tags: "jazz",
};

/** Flush the play path's promise chain without touching the fake clock. */
async function settle(): Promise<void> {
  for (let index = 0; index < 30; index += 1) await Promise.resolve();
}

/** Real-timer sleep (the warm-up below needs the live clock). */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), ms);
  });
}

/** The most recently staged element. */
function latest(): FakeAudio {
  const element = FakeAudio.created.at(-1);
  if (!element) throw new Error("audio element not created yet — play() first");
  return element;
}

function installStubs(): void {
  const scope = globalThis as unknown as { Audio?: new () => FakeAudio; fetch?: typeof fetch };
  scope.Audio = FakeAudio;
  // Never touch the live directory — resolve falls back to the local URL.
  scope.fetch = (() => Promise.reject(new Error("offline"))) as typeof fetch;
}

beforeEach(async () => {
  installStubs();
  await radioDb.listening.clear();
  await radioDb.history.clear();
  FakeAudio.created.length = 0;
  // Warm-up on real timers: the first play transforms + caches the dynamic
  // import graph (api/store), which never resolves under a fake clock.
  // Lands at idle so every test starts from the same state.
  play(STATION);
  await sleep(600);
  latest().fire("playing");
  await sleep(100);
  stop();
  await sleep(100);
  FakeAudio.created.length = 0;
  vi.useFakeTimers();
});

afterEach(async () => {
  vi.useRealTimers();
  stop();
  await radioDb.listening.clear();
  await radioDb.history.clear();
  vi.restoreAllMocks();
});

/**
 * Cold start through handoff. The live singleton persists across tests, so
 * every count below is relative: a fresh `play()` stages exactly one new
 * (incoming) element.
 */
async function startPlaying(): Promise<{ staged: FakeAudio }> {
  const base = FakeAudio.created.length;
  play(STATION);
  await settle();
  expect(FakeAudio.created).toHaveLength(base + 1);
  const staged = latest();
  staged.fire("playing");
  await settle();
  return { staged };
}

describe("drop reconnect", () => {
  it("stillborn load failures never retry", async () => {
    const base = FakeAudio.created.length;
    play(STATION);
    await settle();
    expect(FakeAudio.created).toHaveLength(base + 1);
    latest().fire("error");
    await settle();
    const count = FakeAudio.created.length;
    await vi.advanceTimersByTimeAsync(120_000);
    expect(FakeAudio.created).toHaveLength(count);
  });

  it("retries a mid-play drop, then lands the recovery", async () => {
    const { staged } = await startPlaying();
    const base = FakeAudio.created.length;
    staged.fire("waiting");
    staged.fire("error");
    await settle();
    // First wait armed — the retry stages a fresh incoming element.
    await vi.advanceTimersByTimeAsync(RECONNECT_DELAYS_MS[0]);
    await settle();
    expect(FakeAudio.created).toHaveLength(base + 1);
    // Recovery lands the handoff; the loop ends (nothing more stages).
    latest().fire("playing");
    await settle();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(FakeAudio.created).toHaveLength(base + 1);
  });

  it("gives up after the table runs out", async () => {
    const { staged } = await startPlaying();
    const base = FakeAudio.created.length;
    staged.fire("waiting");
    staged.fire("error");
    await settle();
    // One staged incoming per attempt, each failing.
    for (const delay of RECONNECT_DELAYS_MS) {
      await vi.advanceTimersByTimeAsync(delay);
      await settle();
      latest().fire("error");
      await settle();
    }
    expect(FakeAudio.created).toHaveLength(base + MAX_RECONNECT_ATTEMPTS);
    // Exhausted — advancing further stages nothing.
    await vi.advanceTimersByTimeAsync(300_000);
    expect(FakeAudio.created).toHaveLength(base + MAX_RECONNECT_ATTEMPTS);
  });

  it("a manual pause takes over from an armed wait", async () => {
    const { staged } = await startPlaying();
    staged.fire("waiting");
    staged.fire("error");
    await settle();
    pause();
    await settle();
    const count = FakeAudio.created.length;
    await vi.advanceTimersByTimeAsync(120_000);
    expect(FakeAudio.created).toHaveLength(count);
  });

  it("a manual play abandons the loop for the new station", async () => {
    const { staged } = await startPlaying();
    staged.fire("waiting");
    staged.fire("error");
    await settle();
    play(OTHER);
    await settle();
    const count = FakeAudio.created.length;
    await vi.advanceTimersByTimeAsync(RECONNECT_DELAYS_MS[0] + 1000);
    // Only the new station's own staged incoming exists — no retry replay.
    expect(FakeAudio.created).toHaveLength(count);
  });
});
