// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { EMPTY_STATION, type Station } from "@/lib/radio/types";
import { radioDb } from "@/lib/radio/store";
import { MAX_RECONNECT_ATTEMPTS, RECONNECT_DELAYS_MS } from "@/lib/radio/reconnect";
import { getSnapshot, subscribe } from "@/lib/player/store";
import { pause, play, stop } from "@/hooks/use-player";

type AudioHandler = () => void;

/** Controllable `<audio>` stand-in: play resolves, events fire on demand. */
class FakeAudio {
  static created: FakeAudio[] = [];
  src = "";
  readonly volume = 1;
  muted = false;
  ended = false;
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
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

/** The most recently staged element. */
function latest(): FakeAudio {
  const element = FakeAudio.created.at(-1);
  if (!element) throw new Error("audio element not created yet — play() first");
  return element;
}

function installStubs(): void {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- mutable record view of a global for stub install/restore
  const scope = globalThis as unknown as { Audio?: new () => FakeAudio; fetch?: typeof fetch };
  scope.Audio = FakeAudio;
  // Never touch the live directory — resolve falls back to the local URL.
  scope.fetch = () => Promise.reject(new Error("offline"));
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
async function startPlaying(station: Station = STATION): Promise<{ staged: FakeAudio }> {
  const base = FakeAudio.created.length;
  play(station);
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

  // A transport that dies without a `waiting` first (CDN closed socket,
  // MEDIA_ERR_NETWORK) used to leave the dock on `playing` over silence.
  it("retries an error that arrives while still playing", async () => {
    const { staged } = await startPlaying();
    const base = FakeAudio.created.length;
    staged.fire("error");
    await settle();
    await vi.advanceTimersByTimeAsync(RECONNECT_DELAYS_MS[0]);
    await settle();
    expect(FakeAudio.created).toHaveLength(base + 1);
  });

  // Silent stall: no `error` ever arrives, so the deadline is the only signal.
  it("retries a stall that never errors", async () => {
    const { staged } = await startPlaying();
    const base = FakeAudio.created.length;
    staged.fire("stalled");
    await settle();
    // Inside the 2s deadline (`DROP_STALL_MS`) nothing stages yet.
    await vi.advanceTimersByTimeAsync(1999);
    await settle();
    expect(FakeAudio.created).toHaveLength(base);
    // Past it the retry runs at once — no first backoff slot to sit out.
    await vi.advanceTimersByTimeAsync(1);
    await settle();
    expect(FakeAudio.created).toHaveLength(base + 1);
  });

  // A dead transport re-reports `waiting`/`stalled` for as long as the browser
  // keeps waiting on it. Re-arming the deadline on each report would let a
  // stream that never returns hold its own recovery off indefinitely.
  it("a repeated stall report does not push the deadline out", async () => {
    const { staged } = await startPlaying();
    const base = FakeAudio.created.length;
    staged.fire("stalled");
    await settle();
    await vi.advanceTimersByTimeAsync(1000);
    staged.fire("stalled");
    await settle();
    // 2s after the *first* report, not the second.
    await vi.advanceTimersByTimeAsync(999);
    await settle();
    expect(FakeAudio.created).toHaveLength(base);
    await vi.advanceTimersByTimeAsync(1);
    await settle();
    expect(FakeAudio.created).toHaveLength(base + 1);
  });

  // A stall is the socket dying, not the station: the URL that was delivering
  // seconds ago is the one to replay, so the retry must not ask the directory.
  it("a stall retries the known URL without asking the directory", async () => {
    const { staged } = await startPlaying();
    let lookups = 0;
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- mutable record view of a global for stub install
    const scope = globalThis as unknown as { fetch?: typeof fetch };
    scope.fetch = () => {
      lookups += 1;
      return Promise.reject(new Error("offline"));
    };
    staged.fire("stalled");
    await settle();
    await vi.advanceTimersByTimeAsync(2000);
    await settle();
    expect(lookups).toBe(0);
    expect(latest().src).toBe(staged.src);
  });

  it("a stall that recovers inside the grace period never reconnects", async () => {
    const { staged } = await startPlaying();
    const base = FakeAudio.created.length;
    staged.fire("waiting");
    await settle();
    await vi.advanceTimersByTimeAsync(1000);
    staged.fire("playing");
    await settle();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(FakeAudio.created).toHaveLength(base);
  });

  // A live stream has no end: the server closing the response must recover,
  // not park the dock on `paused`.
  it("retries a server-side close instead of pausing", async () => {
    const { staged } = await startPlaying();
    const base = FakeAudio.created.length;
    staged.fire("ended");
    await settle();
    await vi.advanceTimersByTimeAsync(RECONNECT_DELAYS_MS[0]);
    await settle();
    expect(FakeAudio.created).toHaveLength(base + 1);
  });

  // The shape media-internals shows on radio.co: the server ends the
  // response (`av_read_frame(): End of file`), the pipeline reports kEnded,
  // and the element fires `pause` — with `ended` already true — one task
  // before `ended`. The dock must never park on a Play button for it.
  it("a server close fires pause then ended without parking on paused", async () => {
    const { staged } = await startPlaying();
    const base = FakeAudio.created.length;
    const statuses: string[] = [];
    const unsubscribe = subscribe(() => {
      const { status } = getSnapshot();
      if (statuses.at(-1) !== status) statuses.push(status);
    });
    staged.ended = true;
    staged.fire("pause");
    await settle();
    expect(getSnapshot().status).not.toBe("paused");
    staged.fire("ended");
    await settle();
    await vi.advanceTimersByTimeAsync(RECONNECT_DELAYS_MS[0]);
    await settle();
    expect(statuses).not.toContain("paused");
    expect(FakeAudio.created).toHaveLength(base + 1);
    unsubscribe();
  });

  // The drop media-internals shows on radio.co: the host ends the response
  // (`av_read_frame(): End of file`) and the element drains its last second of
  // buffer before firing `ended`. Nothing is left to protect, so the first
  // retry runs at once instead of waiting out the 2s slot.
  it("a clean close retries immediately instead of waiting out the first slot", async () => {
    const { staged } = await startPlaying();
    const base = FakeAudio.created.length;
    staged.ended = true;
    staged.fire("ended");
    await settle();
    // Staged without advancing the clock at all.
    expect(FakeAudio.created).toHaveLength(base + 1);
    expect(getSnapshot().status).toBe("loading");
    latest().fire("playing");
    await settle();
    expect(getSnapshot().status).toBe("playing");
    expect(getSnapshot().error).toBeNull();
  });

  // The URL that just played is the one to replay: a `/json/url/<uuid>`
  // lookup measured 2.36s in a real close, longer than the wait it replaced,
  // so the immediate attempt must not make it.
  it("a clean close replays the known URL without asking the directory", async () => {
    const { staged } = await startPlaying();
    let lookups = 0;
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- mutable record view of a global for stub install
    const scope = globalThis as unknown as { fetch?: typeof fetch };
    scope.fetch = () => {
      lookups += 1;
      return Promise.reject(new Error("offline"));
    };
    staged.ended = true;
    staged.fire("ended");
    await settle();
    expect(lookups).toBe(0);
    // Same stream, so the retry reuses the source that was already playing.
    expect(latest().src).toBe(staged.src);
  });

  // An immediate retry against a dead host must not become an instant loop:
  // a failure hands back to the table's second slot.
  it("a failed immediate retry falls back to the table's next slot", async () => {
    const { staged } = await startPlaying();
    staged.ended = true;
    staged.fire("ended");
    await settle();
    latest().fire("error");
    await settle();
    const count = FakeAudio.created.length;
    await vi.advanceTimersByTimeAsync(RECONNECT_DELAYS_MS[1] - 1);
    await settle();
    expect(FakeAudio.created).toHaveLength(count);
    await vi.advanceTimersByTimeAsync(1);
    await settle();
    expect(FakeAudio.created).toHaveLength(count + 1);
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

  // Cellular drops are the case this exists for: the wait is armed, the radio
  // finds signal again, and the replay should not have to sit out the delay.
  it("an online event replays an armed wait without advancing timers", async () => {
    const { staged } = await startPlaying();
    const base = FakeAudio.created.length;
    staged.fire("waiting");
    staged.fire("error");
    await settle();
    expect(FakeAudio.created).toHaveLength(base);
    globalThis.dispatchEvent(new Event("online"));
    await settle();
    // Staged immediately — no RECONNECT_DELAYS_MS[0] advanced.
    expect(FakeAudio.created).toHaveLength(base + 1);
  });

  // The shape the Capital sessions actually hit: the stream goes quiet and
  // never reports anything louder than a stall. This walks the whole detour
  // through the public snapshot — playing → loading → playing, same station —
  // and then drops a second time, so a recovery that only works once fails.
  it("recovers a silent drop end to end, twice in a row", async () => {
    const { staged } = await startPlaying();
    const statuses: string[] = [];
    const unsubscribe = subscribe(() => {
      const { status } = getSnapshot();
      if (statuses.at(-1) !== status) statuses.push(status);
    });
    /** Stall, wait out the deadline, then the immediate retry. */
    const drop = async (element: FakeAudio): Promise<void> => {
      element.fire("stalled");
      await settle();
      const before = FakeAudio.created.length;
      // Inside the 2s deadline nothing stages and nothing gives up.
      await vi.advanceTimersByTimeAsync(1999);
      await settle();
      expect(FakeAudio.created).toHaveLength(before);
      await vi.advanceTimersByTimeAsync(1);
      await settle();
      expect(FakeAudio.created).toHaveLength(before + 1);
    };
    const url = staged.src;
    await drop(staged);
    const firstRetry = latest();
    expect(firstRetry).not.toBe(staged);
    // Same stream, same station, dock on `loading` while the retry tunes.
    expect(firstRetry.src).toBe(url);
    expect(getSnapshot().status).toBe("loading");
    expect(getSnapshot().station?.stationuuid).toBe(STATION.stationuuid);
    firstRetry.fire("playing");
    await settle();
    expect(getSnapshot().status).toBe("playing");
    expect(getSnapshot().error).toBeNull();
    // A second silent drop recovers too: `playing` reset the sequence.
    await drop(firstRetry);
    const secondRetry = latest();
    expect(secondRetry).not.toBe(firstRetry);
    secondRetry.fire("playing");
    await settle();
    expect(getSnapshot().status).toBe("playing");
    expect(statuses).toEqual(["loading", "playing", "loading", "playing"]);
    unsubscribe();
  });

  // The listener is wired for the app's lifetime, so it fires constantly with
  // nothing pending. It must not start a sequence or disturb the snapshot.
  it("an online event with no wait in flight changes nothing", async () => {
    const { staged } = await startPlaying();
    staged.fire("playing");
    await settle();
    const count = FakeAudio.created.length;
    globalThis.dispatchEvent(new Event("online"));
    await settle();
    expect(FakeAudio.created).toHaveLength(count);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(FakeAudio.created).toHaveLength(count);
  });
});
