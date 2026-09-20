import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor native shell. `webDir` MUST stay in sync with
 * `pages_build_output_dir` in wrangler.toml — one SSG artifact
 * (`dist/client`) serves both Cloudflare Pages and the native apps.
 *
 * Dev live-reload: create `capacitor.config.local.ts` (gitignored) with
 * `server.url` pointing at your LAN dev server — never commit it.
 */
const config: CapacitorConfig = {
  appId: "gq.danread.radioscout",
  appName: "RadioScout",
  webDir: "dist/client",
  backgroundColor: "#eef1eb",
  android: {
    allowMixedContent: false,
  },
  server: {
    androidScheme: "https",
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
    // OTA needs no server config: the Capgo plugin only stages/applies
    // bundles (`download`/`next`/`notifyAppReady` in NativeShell) while
    // version selection reads the in-repo manifest + GitHub Release zips
    // (`src/lib/ota.ts`, published by `pnpm ota:publish`). Nothing here.
  },
};

export default config;
