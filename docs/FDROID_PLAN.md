# F-Droid Assessment + Plan — RadioScout

> Verdict: feasible with no blockers. Three small repo changes, one metadata
> file, one merge request. No new APK needed for any of it — and once listed,
> F-Droid itself becomes the update channel for those users (our Capgo OTA
> stays for sideload/GitHub users, dormant in the F-Droid build).

## 1. Audit (2026-09-23, all verified in-tree)

| Requirement | State |
|---|---|
| FLOSS license | MIT `LICENSE` at repo root ✓ |
| Tracking / proprietary SDKs | None. No `google-services.json` (the conditional plugin hook in `android/app/build.gradle:76-83` never fires), no Firebase/Crashlytics/ads. Deps: Capacitor (MIT), Capgo updater (MPL-2.0 — FOSS, fine), AndroidX + Media3 + Guava (Apache) |
| Self-update policy ([Inclusion Policy §5](https://f-droid.org/en/docs/Inclusion_Policy/): no auto-update downloads without explicit user consent — cf. the WireGuard #3110 precedent) | **Needs the gating change below.** Our Capgo OTA auto-downloads the bundle, then toasts restart. On an F-Droid install that bypasses store checks with no opt-in |
| Reproducible versioning | `scripts/cap-version.js` encodes semver → versionCode monotonically (0.3.5 → 305). **BUT** the committed `android/app/build.gradle` still says 202/0.2.2 — F-Droid's update checker scrapes build files without running build code, so releases must commit the synced file (process change, §2.3) |
| Capacitor-on-F-Droid precedent | Exists: GraphHopper Maps Capacitor wrapper ships on F-Droid (`com.graphhopper.maps`), building web assets + gradle in-recipe |
| Store listing assets | Missing: no `fastlane/` or `metadata/en-US` in repo (needed for description/screenshots) |

## 2. Repo changes (all small, all web-layer — still no APK rebuild)

### 2.1 F-Droid distribution flag (the only code change)

F-Droid builds must have **two** update paths silenced (both bypass the store):

1. **Capgo OTA** — already dormant when `VITE_OTA_URL` is unset (`src/lib/ota.ts:7`, `NativeShell.tsx:38`). A clean F-Droid checkout has no `.env`, so it is dormant by accident today; make it deliberate.
2. **`AppUpdateDialog`** — currently live on *every* native build (`enabled: isClient && isNative()`, `AppUpdateDialog.tsx:21`): it polls GitHub `releases/latest` and offers a browser APK download. On an F-Droid install that means prompting users to sideload a differently-signed APK over the store install — must be off.

Introduce one build-time flag, e.g. `VITE_DISTRIBUTION=fdroid`, and gate both paths on it:

- `NativeShell` OTA check: skip when distribution is `fdroid` (belt-and-braces over the unset URL).
- `AppUpdateDialog`: `enabled: isClient && isNative() && import.meta.env.VITE_DISTRIBUTION !== "fdroid"`.

Default (unset) keeps today's behavior everywhere else. Unit-test the gate predicate; no e2e change (existing specs run with the flag unset).

### 2.2 Commit the synced `android/app/build.gradle` at release time

`pnpm cap:version` already computes versionCode/versionName from `package.json`; add it to the release checklist and commit the result. F-Droid's tag scraper then sees the true `versionCode`/`versionName`, and `UpdateCheckMode: Tags` (`v*` tags already exist for APK releases) detects new versions with no metadata edits.

### 2.3 Pin the package manager

Add `"packageManager": "pnpm@12.3.4"` to `package.json` so Corepack resolves pnpm identically everywhere, including the F-Droid container (recipe runs `corepack enable && pnpm install`).

### 2.4 Optional hardening (not blocking)

- Remove the dead `google-services` conditional (`android/build.gradle:11`, `android/app/build.gradle:76-83`): no `google-services.json` exists and push is unplanned — one less question from reviewers.
- `VITE_OTA_URL` is currently only documented as commented in `wrangler.toml:32`; no change needed for F-Droid (absence = dormant), noted here so nobody "fixes" it later.

## 3. F-Droid side (their infra, our merge request)

Draft `metadata/io.github.double77x.radioscout.yml` (in a fork of `fdroiddata`, MR titled `New App: RadioScout`):

```yaml
Categories: [Multimedia]
License: MIT
SourceCode: https://github.com/Double77x/radioscout
IssueTracker: https://github.com/Double77x/radioscout/issues
Changelog: https://github.com/Double77x/radioscout/blob/main/src/pages/Changelog.tsx
AutoUpdateMode: Version v%v
UpdateCheckMode: Tags
CurrentVersion: 0.3.5
CurrentVersionCode: 305
Builds:
  - versionName: 0.3.5
    versionCode: 305
    commit: v0.3.5
    subdir: android
    gradle: [yes]
    prebuild:
      - corepack enable
      - pnpm install
      - pnpm build
      - npx cap sync android
      - node scripts/cap-version.js
```

Notes for the MR: `prebuild` order mirrors our own `build:android:apk` chain minus signing (F-Droid signs with its keys); `VITE_DISTRIBUTION=fdroid` + empty `VITE_OTA_URL` exported in the recipe environment; `output` left default (gradle `radioscout-release.apk` rename already handled in `build.gradle:12-16` — confirm the recipe's `output:` glob matches or drop the rename for this flavor).

Upstream listing assets (Triple-T, preferred by reviewers): `metadata/en-US/{short_description.txt (≤50 chars), full_description.txt, images/{icon.png, phoneScreenshots/}, changelogs/<vercode>.txt (≤500 chars)}` — screenshots can reuse Play-store art when it exists.

Anti-features expected: none (no tracking, no non-free services in the F-Droid flavor — radio-browser directory + GitHub file hosting don't trigger `NonFreeNet`; reviewers have the final word).

## 4. Migration warning (communicate, don't code)

F-Droid signs with **its own key**, so the store build cannot update over a sideloaded/GitHub APK (same `applicationId`, different signature): switching channels means **uninstall → reinstall**, which wipes the WebView's IndexedDB (favourites, history, prefs). The existing Settings → Data backup export/import (`src/lib/radio/backup.ts`, versioned envelope) is the migration path — call it out in the F-Droid description's first line and in the GitHub release notes that first ship alongside the listing.

## 5. Validation before submitting

1. Land §2.1–2.3 + listing assets on main, tag normally.
2. Locally reproduce the F-Droid build per the [Quick Start Guide](https://f-droid.org/en/docs/Submitting_to_F-Droid_Quick_Start_Guide) (their Docker container): `fdroid lint` + `fdroid build io.github.double77x.radioscout` with network unplugged mid-build if you want to prove no hidden downloads — plus a boot smoke test of the resulting APK (OTA check must not fire, update dialog must not appear).
3. Submit the fdroiddata MR; expect review rounds (respond, don't argue policy). Post-listing, new `v*` tags are picked up automatically with a few days' lag — keep publishing Capgo OTA in parallel for sideload users; the two channels never interact (F-Droid builds ignore the manifest).

## 6. Effort

Half a day for §2 + assets, plus review latency on the F-Droid side (days to weeks, mostly waiting). No native work, no new APK, no backend.
