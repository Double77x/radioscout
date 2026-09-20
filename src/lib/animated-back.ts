/**
 * Shared back-navigation plumbing for the animated back transition.
 *
 * Two paths funnel through one guarded commit so a finger swipe and the OS
 * back gesture can never double-navigate. Guard ownership is singular: the
 * final invoker (the frame's fly-out, or the direct fallback) routes through
 * `commitBack` exactly once — `playBackTransition` must NOT pre-wrap, or the
 * inner guard passes and the outer always swallows the navigation.
 */

const COMMIT_WINDOW_MS = 500;
let lastCommitAt = 0;

/** Run `commit` unless another back commit landed within the guard window. */
export function commitBack(commit: () => void, now: number = Date.now()): boolean {
  if (now - lastCommitAt < COMMIT_WINDOW_MS) return false;
  lastCommitAt = now;
  commit();
  return true;
}

export type BackAnimator = (commit: () => void) => void;

let animator: BackAnimator | null = null;

/** Mounted `SwipeBack` frame registers its fly-out; unmount clears it. */
export function registerBackAnimator(next: BackAnimator | null): () => void {
  animator = next;
  return () => {
    if (animator === next) animator = null;
  };
}

/** System/hardware back path — the frame's fly-out owns the single guard. */
export function playBackTransition(commit: () => void): void {
  if (animator) animator(commit);
  else commitBack(commit);
}
