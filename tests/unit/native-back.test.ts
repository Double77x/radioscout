import { describe, expect, it, vi } from "vite-plus/test";
import type * as NativeBack from "@/lib/native-back";

// Fresh module per test: the registry is process-global, so a shared import
// would leak a handler from one case into the next.
function freshModule(): Promise<typeof NativeBack> {
  vi.resetModules();
  return import("@/lib/native-back");
}

describe("runBackHandlers", () => {
  it("reports no claim with nothing registered", async () => {
    const mod = await freshModule();
    expect(mod.runBackHandlers()).toBe(false);
  });

  it("lets the newest handler win", async () => {
    const mod = await freshModule();
    const older = vi.fn(() => true);
    const newer = vi.fn(() => true);
    mod.registerBackHandler(older);
    mod.registerBackHandler(newer);
    expect(mod.runBackHandlers()).toBe(true);
    expect(newer).toHaveBeenCalledTimes(1);
    expect(older).not.toHaveBeenCalled();
  });

  it("falls through a handler that does not claim the press", async () => {
    const mod = await freshModule();
    const outer = vi.fn(() => true);
    const inner = vi.fn(() => false);
    mod.registerBackHandler(outer);
    mod.registerBackHandler(inner);
    expect(mod.runBackHandlers()).toBe(true);
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).toHaveBeenCalledTimes(1);
  });

  it("releases a handler on cleanup and tolerates a second release", async () => {
    const mod = await freshModule();
    const handler = vi.fn(() => true);
    const release = mod.registerBackHandler(handler);
    release();
    release();
    expect(mod.runBackHandlers()).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it("keeps a re-registered handler even when an old release runs late", async () => {
    const mod = await freshModule();
    const first = vi.fn(() => true);
    const second = vi.fn(() => true);
    const releaseFirst = mod.registerBackHandler(first);
    mod.registerBackHandler(second);
    releaseFirst();
    expect(mod.runBackHandlers()).toBe(true);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
