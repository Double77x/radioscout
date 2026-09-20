import { describe, expect, it, vi } from "vitest";
import type * as AnimatedBack from "@/lib/animated-back";

// Fresh module per test (isolates the commit-guard timestamp) with frozen
// wall-clock: nested commits land in the same millisecond, like production.
// A loader (not a shared `let`) hands each test its own binding, so there is
// no uninitialized module state to trip over.
async function freshModule(): Promise<typeof AnimatedBack> {
  vi.resetModules();
  vi.spyOn(Date, "now").mockReturnValue(5_000_000);
  const mod = await import("@/lib/animated-back");
  return mod;
}

describe("commitBack", () => {
  it("runs the commit once", async () => {
    const mod = await freshModule();
    const commit = vi.fn();
    expect(mod.commitBack(commit, 1000)).toBe(true);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("drops a second commit inside the guard window (finger + OS double-fire)", async () => {
    const mod = await freshModule();
    const commit = vi.fn();
    mod.commitBack(commit, 2000);
    expect(mod.commitBack(commit, 2100)).toBe(false);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("allows a later commit after the window", async () => {
    const mod = await freshModule();
    const commit = vi.fn();
    mod.commitBack(commit, 3000);
    expect(mod.commitBack(commit, 3600)).toBe(true);
    expect(commit).toHaveBeenCalledTimes(2);
  });
});

describe("playBackTransition", () => {
  it("commits directly with no frame mounted", async () => {
    const mod = await freshModule();
    const commit = vi.fn();
    mod.registerBackAnimator(null);
    mod.playBackTransition(commit);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("delegates to the mounted frame animator, then falls back after unregister", async () => {
    const mod = await freshModule();
    const commit = vi.fn();
    const animator = vi.fn((next: () => void) => next());
    const unregister = mod.registerBackAnimator(animator);
    mod.playBackTransition(commit);
    expect(animator).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledTimes(1);
    unregister();
    // Advance past the guard window so the fallback commit is a fresh one.
    vi.spyOn(Date, "now").mockReturnValue(5_001_000);
    const late = vi.fn();
    mod.playBackTransition(late);
    expect(animator).toHaveBeenCalledTimes(1);
    expect(late).toHaveBeenCalledTimes(1);
  });

  it("does not double-guard the OS path (animator commits through commitBack)", async () => {
    const mod = await freshModule();
    const commit = vi.fn();
    // Mirrors SwipeBack.flyOut: the animator owns the single guard.
    mod.registerBackAnimator((next: () => void) => {
      mod.commitBack(next);
    });
    mod.playBackTransition(commit);
    expect(commit).toHaveBeenCalledTimes(1);
  });
});
