# Capacitor Plan — APK + iOS from this PWA

Status: decided — App name: **"RadioScout"**; App ID: **`io.github.double77x.radioscout`**; `android/` **committed**; **Android-first**, iOS deferred; **release-signed APK** via CI secrets (one keystore, held by the owner — never lose or rotate it). Goal: ship Android APK/AAB from the **same TanStack Start SSG artifact** (`dist/client`) that Cloudflare Pages already serves, with no fork of the web codebase.

## 1. Why Capacitor for this repo

- Output is already fully static (prerendered HTML + hashed JS/CSS, no server functions). Capacitor just wraps `dist/client` in a native WebView — no backend changes.
- Keeps one codebase: web PWA stays canonical, native is a build target (`pnpm build && cap sync`), not a rewrite. Alternatives rejected: TWA/PWABuilder (Android-only, no iOS shell, no native APIs), React Native rewrite (throws away SSG + Tailwind + Base UI work).
- Local-first data (Dexie/IndexedDB, `localStorage`) works inside the WebView with no migration; native plugins are progressive enhancements, not prerequisites.

## 2. Current baseline (what native reuses)

| Area           | Current state                                                                                                                    | Native implication                                                                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build output   | `vite build` → SSG to `dist/client` (`wrangler.toml:21`, prerender crawl filter `vite.config.ts:36`)                    | Capacitor`webDir: "dist/client"` — same artifact for Pages + native                                                                                  |
| Manifest/icons | `public/site.webmanifest`, 192/512 PNGs, SVG favicons, `__root.tsx:43` manifest link                                         | Reuse as source for`@capacitor/assets` icon/splash generation                                                                                         |
| Viewport/head  | `width=device-width, initial-scale=1.0` (`__root.tsx:12`), theme-color light/dark, PWA meta                                  | Must add`viewport-fit=cover`; StatusBar style driven from theme                                                                                       |
| Styling        | `?url` render-blocking CSS + inline critical CSS (`vite.config.ts:42`)                                                       | Works as-is in WebView; add safe-area insets for notch/gesture bar                                                                                      |
| Data           | Dexie IndexedDB (isolated`RadioDB`: favourites, history), `localStorage` theme                                               | Persists in WebView; no change for v1                                                                                                                   |
| Photos         | File`<input>` is gone with the inventory sheets — no photo capture left                                                       | Camera plugin removed (2026-09-20)                                                                                                                      |
| Headers/CSP    | `public/_headers` — restrictive `Permissions-Policy` + CSP                                                                  | `_headers` only applies on Pages, **not** in the WebView — do **not** add a `<meta>` CSP (would apply in WebView and break the bridge) |
| SW/offline     | `vite-plugin-pwa` in `package.json:72` but **not wired** in `vite.config.ts`; ROADMAP still lists "PWA offline pass" | Do the offline pass**web-only** first; native shell must not bundle a service worker in v1 (stale-HTML + `cap sync` conflicts)                  |
| Routing        | File routes +`createRouter` factory, history mode                                                                              | Works on Capacitor's`http://localhost` scheme; verify deep links + 404 (`$.tsx`) on device before adding custom scheme handling                     |

## 3. Target architecture

```
pnpm build          → dist/client (static HTML+assets)
  ├─ wrangler pages deploy → radioscout.pages.dev
  └─ npx cap sync          → android/ (committed) → APK/AAB
```

- Single helper `src/lib/capacitor.ts` (`isNative()`, `getPlatform()`) gates **all** native branches. No `if (android)` scattered in components.
- Web remains fully functional with zero plugins installed; every native call has a web fallback (file input, `navigator.share`, CSS haptics-none).
- No server functions, no edge compute, no new backend. The app is local-only (multi-device sync was dropped with the Supabase removal).

## 4. Implementation phases

### Phase 0 — Prerequisites (1 session)

- Node 24 + pnpm 10 (already in `wrangler.toml:25-26`), Android Studio (JDK 21, SDK 34+, `ANDROID_HOME`). No macOS/Xcode needed (Android-first, iOS deferred).
- Decided: display name **"RadioScout"**, App ID **`io.github.double77x.radioscout`**. Release signing key held by the owner (single keystore, CI secrets `ANDROID_KEYSTORE_*`); debug builds need no key.

### Phase 1 — Install + config (the only native scaffolding)

```bash
pnpm add @capacitor/core @capacitor/android @capacitor/app @capacitor/keyboard @capacitor/status-bar @capacitor/splash-screen @capacitor/share @capacitor/filesystem
pnpm add -D @capacitor/cli @capacitor/assets
# NOTE: `@capacitor/haptics` omitted — pnpm supply-chain policy
# blocks it ("High-risk trust downgrade ... possible package takeover").
# `@capacitor/android` is required — `cap add android` templates from it.
# Installed versions: Capacitor 8.x (core 8.5.1, android 8.5.1, cli 8.5.1).
# Camera/Network/Preferences removed 2026-09-20 (Scout inventory purge).
npx cap init "RadioScout" "io.github.double77x.radioscout" --web-dir dist/client
npx cap add android
# iOS deferred (Android-first): npx cap add ios on macOS when ready
```

`capacitor.config.ts` (repo root, committed):

```ts
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "io.github.double77x.radioscout",
  appName: "RadioScout",
  webDir: "dist/client", // MUST match wrangler pages_build_output_dir
  backgroundColor: "#eef1eb",
  android: { allowMixedContent: false },
  ios: { contentInset: "automatic", limitsNavigationsToAppBoundDomains: true },
  server: { androidScheme: "https", iosScheme: "https", cleartext: false },
  plugins: {
    SplashScreen: { launchShowDuration: 0 }, // hide programmatically after hydration
    Keyboard: { resize: "body", resizeOnFullScreen: true },
  },
};
export default config;
```

- Dev live-reload uses a **local untracked override** (`capacitor.config.local.ts` or env-injected `server.url` → `http://<LAN-IP>:8080` + `cleartext: true`), never committed. Matches existing `server.host: "::", port: 8080` in `vite.config.ts:20-24`.
- Commit `android/` + `ios/` after first successful `cap sync` (starter convention — reproducible builds, reviewable permission diffs). `.gitignore` only `android/app/build`, `ios/DerivedData`, keystores.
- Add `android:exported="true"` deep-link intent + iOS Associated Domains only in Phase 6 (deferred until URL scheme is needed).

### Phase 2 — Web-app adaptations (small, all behind `isNative()`)

New file `src/lib/capacitor.ts`:

```ts
import { Capacitor } from "@capacitor/core";
export const isNative = () => Capacitor.isNativePlatform();
export const getPlatform = () => Capacitor.getPlatform(); // "ios" | "android" | "web"
```

| Task                   | Where                                                             | Notes                                                                                                                                                    |
| ---------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `viewport-fit=cover` | `src/routes/__root.tsx:12` viewport meta                        | Required for edge-to-edge + safe-area                                                                                                                    |
| Safe-area CSS          | `src/styles/index.css` + `AppShell`/PlayerDock                | `env(safe-area-inset-*)` on dock padding and header; no hardcoded heights                                                                              |
| StatusBar sync         | `RootComponent` effect (`src/components/RootDocument.tsx:25`) | `Style.Dark/Light` follows `next-themes` resolved theme; overlay `false` so layout doesn't jump                                                    |
| Splash hide            | Same effect, after first paint                                    | `SplashScreen.hide()` once hydrated; keeps `launchShowDuration: 0` honest                                                                            |
| Android back button    | `App` listener in root effect                                   | `App.addListener("backButton", ...)` → `router.history.back()` when stack depth > 0, else `App.exitApp()`; must `removeAllListeners` on unmount |
| Keyboard               | No code (config only)                                             | `resize: body` keeps the dock visible; verify volume overlay on small Android                                                                          |
| Haptics/share          | Station favourite toggle, radio backup-export                     | Dropped for v1:`@capacitor/haptics` blocked by supply-chain policy; `Share` ships with radio backup export                                           |
| CommandPalette hotkeys | Already button-triggered; skip                                    | `⌘K` is desktop-only, no native work                                                                                                                  |

Estimated diff: ~3 files touched + 1 new helper. No route changes.

### Phase 3 — Icons + splash (automated)

- Source: `public/logo.svg` (light) + `public/logo-dark.svg` (dark splash background). Foreground padding ≥ 25% for adaptive icons.
- `npx @capacitor/assets generate --iconBackgroundColor "#257a4b" --splashBackgroundColor "#eef1eb"` (match manifest `theme_color`/`background_color`).
- Verify: adaptive-icon mask crop on Android, 1024pt App Store icon with no alpha, dark-mode splash.

### Phase 4 — Build scripts (`package.json`, seamless with existing)

```json
{
  "cap:sync": "npx cap sync",
  "cap:android": "pnpm build && npx cap sync android",
  "cap:ios": "pnpm build && npx cap sync ios",
  "cap:open:android": "npx cap open android",
  "cap:open:ios": "npx cap open ios",
  "build:android:apk": "pnpm cap:android && pnpm cap:version && cd android && .\\gradlew.bat assembleDebug",
  "build:android:aab": "pnpm cap:android && pnpm cap:version && cd android && .\\gradlew.bat bundleRelease"
}
```

(Windows `cmd.exe` needs `.\gradlew.bat`; Linux/macOS CI uses `./gradlew`.)

- Version single-source: `package.json:version` → `android/app/build.gradle` `versionCode/versionName` + Xcode `CFBundleShortVersionString` via a 20-line `scripts/cap-version.js` run in `cap:android`/`cap:ios` (bumps `versionCode` monotonically; `versionName` = package version).
- Quality gates unchanged: `pnpm lint && pnpm build` (+ `tsc -b`, `fallow audit`, vitest/playwright) must pass before any native build. Add `npx cap doctor` to the checklist.

### Phase 5 — Native capabilities

1. **Filesystem export:** radio backup JSON via `@capacitor/filesystem` + `Share` on native, download blob on web.
2. **Push (deferred):** needs a server — explicitly out of scope (local-only app).

### Phase 6 — Signing, release, CI

- Android: `assembleDebug` for local sideload testing; `v*` tags build `assembleRelease`, signed with the owner's keystore via CI secrets (`ANDROID_KEYSTORE_BASE64` → decoded to `$RUNNER_TEMP`, passwords/alias as secrets; `android/app/build.gradle` `signingConfigs.release` applies only when `ANDROID_KEYSTORE_FILE` is set, so local release builds stay unsigned). **Keystore drill (one-off, run by the owner):**
  ```bash
  keytool -genkeypair -v -keystore radioscout-release.jks -alias radioscout -keyalg RSA -keysize 2048 -validity 10000
  # back up radioscout-release.jks somewhere permanent — loss/rotation forces every user to reinstall
  gh secret set ANDROID_KEYSTORE_BASE64 < <(base64 -w0 radioscout-release.jks)
  gh secret set ANDROID_KEY_ALIAS -b radioscout
  gh secret set ANDROID_KEYSTORE_PASSWORD
  gh secret set ANDROID_KEY_PASSWORD
  ```

  (`*.jks` is gitignored.) First signed release should bump `package.json` (0.1.0 debug installs carry `versionCode` 100 under the debug signature, so they need a manual reinstall regardless — a new version keeps the timeline sane.)
- Minimal CI (`.github/workflows/release-apk.yml`): push a `v*` tag (must equal `package.json` version — the workflow fails fast otherwise) → Ubuntu build (`pnpm build` → `cap sync` → `cap:version` → keystore decode → `assembleRelease`) → `radioscout-vX.Y.Z.apk` attached to the GitHub Release with generated notes. Tag builds fail loudly if the keystore secret is missing. `workflow_dispatch` builds without publishing. Web Pages deploy workflow untouched.
- QA matrix before store: cold start < 2s on mid-range Android, rotation, gesture-nav insets, dark/light StatusBar, airplane-mode (all local flows work; only Open-Meteo weather degrades), Android back from every route, photo round-trip, 120Hz scroll on spaces grid.

## 5. Risks & repo-specific gotchas

- **Prerender is load-bearing:** native bundles whatever `dist/client` contains. Any new `useSearch`/`fetch`/virtualizer usage during SSR reintroduces the historic prerender hang (AGENTS.md checklist) — keep data client-gated, keep the `#`/`?` crawl filter.
- **`dist/` contention:** `cap sync` must run **after** `vite build` completes, never concurrently.
- **No `<meta>` CSP, no SW in v1:** both would apply inside the WebView and cause stale-content/bridge breakage. Offline PWA pass stays web-only.
- **Blob photos don't survive reinstalls:** IndexedDB Blobs persist across launches but not uninstalls — acceptable for v1, fixed by Filesystem export (Phase 5.3).
- **Hotkeys/palette, charts, tables:** desktop-oriented features degrade gracefully on mobile already (mobile-first shell, bar lists not canvas charts) — no native-specific rework.

## 6. Milestones

- [X] M0: `cap init/add/sync` runs, `cap doctor` clean (Capacitor 8.5.1, 7 plugins, `android/` committed-tracked, `pnpm lint/build` green)
- [X] M2: Safe-area + StatusBar + Splash + Keyboard verified in code (light/dark StatusBar sync, `viewport-fit=cover`, PlayerDock safe-area, keyboard `resize: body`) + shell-level top inset (`AppShell` `pt-[env(safe-area-inset-top)]` for Android 15+ edge-to-edge / iOS notch; self-zeroing on desktop) — on-device check pending reinstall
- [X] M3: `cap-version.js` + `cap:*`/`build:android:*` scripts green; `pnpm lint/build` + `cap sync` verified; Pages deploy unaffected. Release workflow `.github/workflows/release-apk.yml` written (tag-gated, version-guarded); device QA still open (see below)
- [X] M4: Filesystem + Share radio backup export (`src/lib/files.ts`, share sheet on native / download on web); unused Camera/Network/Preferences plugins removed (2026-09-20, `cap sync` clean at 7 plugins); radio-note icons + splash generated (`pnpm cap:assets`, 123 drawables)
- [X] M6: Interactive swipe-to-go-back (`src/components/scout/SwipeBack.tsx` + `src/lib/animated-back.ts`, `tests/unit/animated-back.test.ts`): left-edge drag follows the finger, release past a third/flick flies the pane off and commits `history.back()`; dialogs, form fields and scrollable chip rows keep their gestures; hardware/system back reuses the same fly-out via `playBackTransition`; 500ms commit guard kills finger+OS double-fire (single guard owner — a 2026-09-10 double-wrap bug swallowed OS-back navigation and is regression-tested). Touch-gated (desktop unaffected). Verify on device: flick, cancel mid-drag, swipe over chips row, OS gesture + hardware back
- [X] M1: Debug APK installs, launches to `/`, routes navigate, back button exits correctly — APK builds (`assembleDebug`, done 2026-09-10 with Studio-free SDK: winget `Microsoft.OpenJDK.21` + Google cmdline-tools + `android-36`/build-tools 36). On-device install + route/back-button QA still yours (no emulator run here). Scout-era milestones (M5/M7/M8 manuals/photos) dropped with the inventory purge.
- [ ] M9 (re-scoped 2026-09-20): OTA updates for sideloaded APKs run on zero services — version manifest lives in-repo (`public/ota/<channel>.json`, served by Pages), bundles ride GitHub Release assets (`ota-<channel>-<version>` tags, kept separate from the `v*` APK tags), version pick is client-side (`src/lib/ota.ts`), publish via `pnpm ota:publish` (builds/zips/uploads, keeps last 3 per channel, then you commit + push the manifest). First publish still yours (needs a public repo + `gh auth login`). Native-layer edits (manifest, plugins, Capacitor itself) still need a full APK regardless.
- [ ] M5 (later, out of v1): signed AAB → Play internal track (reuses the same release keystore); `cap add ios` → TestFlight

## 7. Open questions — resolved 2026-09-10

1. ~~App ID + display name~~ → **"RadioScout"** / `io.github.double77x.radioscout`. Open micro-decision: launcher label short `"Scout"` vs full title.
2. ~~Commit native projects?~~ → **Yes, commit `android/`+`ios/`.**
3. ~~Camera/Filesystem in v1?~~ → **Yes, both in v1** (overrides shell-only recommendation — expect a longer v1: permissions + Blob bridging + `_headers` change).
4. ~~iOS now or Android-first?~~ → **Android-first.**
5. ~~Signing scope?~~ → **Debug APK only;** release/AAB + TestFlight deferred.
