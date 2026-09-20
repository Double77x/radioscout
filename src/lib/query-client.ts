import { QueryClient } from "@tanstack/react-query";

/**
 * Singleton query client shared by the app and the SSG prerender.
 *
 * Prerender hang guard: every query created during SSR schedules a `gcTime`
 * `setTimeout` in Node. With the client-side 10min `gcTime` that kept the
 * `vite build` process alive ~10min after "Prerendered 15 pages" (0% CPU,
 * looks hung forever). On the server the cache is discarded after each page
 * render anyway, so use `gcTime: 0` + no retries there — no long-lived
 * timers, the build process exits cleanly.
 */
const isServer = globalThis.window === undefined;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: isServer ? 0 : 1000 * 60 * 10,
      retry: isServer ? false : 2,
      refetchOnWindowFocus: false,
    },
  },
});
