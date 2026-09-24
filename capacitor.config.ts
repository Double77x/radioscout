import type { CapacitorConfig } from "@capacitor/cli";

declare const process: {
  env?: Record<string, string | undefined>;
};

const isFdroidBuild = process.env?.VITE_DISTRIBUTION?.trim().toLowerCase() === "fdroid";

/**
 * Capacitor native shell. `webDir` MUST stay in sync with
 * `pages_build_output_dir` in wrangler.toml — one SSG artifact
 * (`dist/client`) serves both Cloudflare Pages and the native apps.
 *
 * Dev live-reload: create `capacitor.config.local.ts` (gitignored) with
 * `server.url` pointing at your LAN dev server — never commit it.
 */
const config: CapacitorConfig = {
  appId: "io.github.double77x.radioscout",
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
    // The native plugin checks Capgo before JavaScript can run. Disable that
    // automatic path for store-managed builds; NativeShell's manual manifest
    // check remains enabled for sideload builds.
    CapacitorUpdater: {
      autoUpdate: !isFdroidBuild,
      ...(isFdroidBuild ? { statsUrl: "" } : {}),
    },
  },
};

export default config;
