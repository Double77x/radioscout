import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { subscribeRadioliseTitle } from "@/lib/radio/radiolise-socket";

/** Minimal WebSocket stand-in: records sends, replays server frames. */
class FakeSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static instances: FakeSocket[] = [];
  sent: string[] = [];
  readyState = FakeSocket.CONNECTING;
  closed = false;
  private readonly handlers = new Map<string, ((event: unknown) => void)[]>();
  url: string;

  constructor(url: string) {
    this.url = url;
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

function events() {
  return {
    titles: [] as string[],
    errors: [] as string[],
    closes: [] as boolean[],
  };
}

describe("subscribeRadioliseTitle", () => {
  afterEach(() => {
    FakeSocket.instances = [];
    vi.unstubAllGlobals();
  });

  it("subscribes on open and forwards normalised titles", () => {
    vi.stubGlobal("WebSocket", FakeSocket);
    const seen = events();
    const sub = subscribeRadioliseTitle("http://example.com/s.mp3", {
      onTitle: (title) => {
        seen.titles.push(title);
      },
      onStationError: (type) => {
        seen.errors.push(type);
      },
      onClose: (expected) => {
        seen.closes.push(expected);
      },
    });
    expect(sub).not.toBeNull();
    const socket = FakeSocket.instances[0];
    socket.serverOpen();
    expect(socket.sent).toEqual([JSON.stringify({ action: "subscribe", data: { url: "http://example.com/s.mp3" } })]);
    socket.serverMessage(JSON.stringify({ action: "setTitle", data: { title: "Nova - Ramp" } }));
    expect(seen.titles).toEqual(["Nova - Ramp"]);
  });

  it("normalises a stuffed title and drops ad markers", () => {
    vi.stubGlobal("WebSocket", FakeSocket);
    const seen = events();
    subscribeRadioliseTitle("http://example.com/s.mp3", {
      onTitle: (title) => {
        seen.titles.push(title);
      },
      onStationError: (type) => {
        seen.errors.push(type);
      },
      onClose: (expected) => {
        seen.closes.push(expected);
      },
    });
    const socket = FakeSocket.instances[0];
    socket.serverOpen();
    socket.serverMessage(
      JSON.stringify({ action: "setTitle", data: { title: 'Bruno Mars - text="Risk It All" song_spot="M"' } }),
    );
    socket.serverMessage(
      JSON.stringify({ action: "setTitle", data: { title: ' - text="Spot Block End" length="00:00:00"' } }),
    );
    expect(seen.titles).toEqual(["Bruno Mars - Risk It All"]);
  });

  it("routes station errors and ignores malformed frames", () => {
    vi.stubGlobal("WebSocket", FakeSocket);
    const seen = events();
    subscribeRadioliseTitle("http://example.com/s.mp3", {
      onTitle: (title) => {
        seen.titles.push(title);
      },
      onStationError: (type) => {
        seen.errors.push(type);
      },
      onClose: (expected) => {
        seen.closes.push(expected);
      },
    });
    const socket = FakeSocket.instances[0];
    socket.serverOpen();
    socket.serverMessage("not-json");
    socket.serverMessage(JSON.stringify({ action: "unknown" }));
    socket.serverMessage(JSON.stringify({ action: "reportError", data: { type: "serverUnreachable" } }));
    expect(seen.titles).toEqual([]);
    expect(seen.errors).toEqual(["serverUnreachable"]);
  });

  it("unsubscribes before closing and reports the close as expected", () => {
    vi.stubGlobal("WebSocket", FakeSocket);
    const seen = events();
    const sub = subscribeRadioliseTitle("http://example.com/s.mp3", {
      onTitle: (title) => {
        seen.titles.push(title);
      },
      onStationError: (type) => {
        seen.errors.push(type);
      },
      onClose: (expected) => {
        seen.closes.push(expected);
      },
    });
    const socket = FakeSocket.instances[0];
    socket.serverOpen();
    sub?.unsubscribe();
    expect(socket.sent).toContain(JSON.stringify({ action: "unsubscribe" }));
    expect(socket.closed).toBe(true);
    expect(seen.closes).toEqual([true]);
    // Late frames after our own teardown are ignored.
    socket.serverMessage(JSON.stringify({ action: "setTitle", data: { title: "Nova - Ramp" } }));
    expect(seen.titles).toEqual([]);
  });

  it("reports an unexpected close so the caller can reconnect", () => {
    vi.stubGlobal("WebSocket", FakeSocket);
    const seen = events();
    subscribeRadioliseTitle("http://example.com/s.mp3", {
      onTitle: (title) => {
        seen.titles.push(title);
      },
      onStationError: (type) => {
        seen.errors.push(type);
      },
      onClose: (expected) => {
        seen.closes.push(expected);
      },
    });
    const socket = FakeSocket.instances[0];
    socket.serverOpen();
    socket.close();
    expect(seen.closes).toEqual([false]);
  });

  it("yields null where WebSocket is unavailable so the caller polls", () => {
    vi.stubGlobal("WebSocket", undefined);
    const seen = events();
    const sub = subscribeRadioliseTitle("http://example.com/s.mp3", {
      onTitle: (title) => {
        seen.titles.push(title);
      },
      onStationError: (type) => {
        seen.errors.push(type);
      },
      onClose: (expected) => {
        seen.closes.push(expected);
      },
    });
    expect(sub).toBeNull();
  });
});
