/**
 * Android hardware-back arbitration. The shell owns the OS listener, but
 * overlays it does not render (the settings flyout, for one) still have to
 * close before the press can navigate or leave the app. They register here
 * while open; the newest claim wins, so a nested overlay beats its parent.
 *
 * Handlers must be cheap and synchronous: returning `true` consumes the
 * press, `false` lets the next handler (then the shell) try.
 */

type BackHandler = () => boolean;

const handlers: BackHandler[] = [];

/** Register while an overlay is open; the returned function releases it. */
export function registerBackHandler(handler: BackHandler): () => void {
  handlers.push(handler);
  return () => {
    const index = handlers.lastIndexOf(handler);
    if (index !== -1) handlers.splice(index, 1);
  };
}

/** Run newest first; true when an overlay consumed the press. */
export function runBackHandlers(): boolean {
  for (let index = handlers.length - 1; index >= 0; index -= 1) {
    if (handlers[index]?.()) return true;
  }
  return false;
}
