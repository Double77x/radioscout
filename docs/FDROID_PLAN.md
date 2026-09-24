# F-Droid Readiness Plan — RadioScout

> **Status (2026-09-24):** repository-side readiness work is complete,
> including normal/F-Droid web builds, an unsigned release APK, and real
> `fdroidserver` `readmeta` / `rewritemeta` / `checkupdates` / `lint` checks
> against the recipe template. No `fdroiddata` merge request exists yet.
> Remaining steps are to push the completed commit, replace the placeholder
> commit in the recipe, run the official F-Droid container build, boot-test its
> APK, and submit the metadata.

## 1. Release contract

F-Droid signs and distributes its own APK. That creates one hard rule for the
F-Droid build: it must not silently download or stage an update outside the
store.

RadioScout has two sideload update paths:

1. Capgo OTA bundles checked by `runOtaUpdateCheck()` in `NativeShell.tsx`.
2. The GitHub APK prompt checked by `checkApkUpdate()` and rendered by
   `AppUpdateDialog.tsx`.

The F-Droid recipe sets the public build flag `VITE_DISTRIBUTION=fdroid` while
running `pnpm build`. `src/lib/distribution.ts` makes both paths stand down.
Normal web, sideload, and release-APK builds do not set the flag and retain
their existing behavior.

The build-time flag is intentional even though a clean checkout normally has
no OTA environment variables: an F-Droid build must not depend on ignored local
`.env` files to remain store-safe.

## 2. Repository changes

### 2.1 Store-owned updates

- `src/lib/distribution.ts` exposes the single F-Droid flavor predicate.
- `NativeShell.tsx` returns before any Capgo app-ready call, manifest fetch, or
  bundle download when the predicate is true.
- `checkApkUpdate()` returns before install inspection or GitHub access, so the
  existing `AppUpdateDialog` receives no update and remains closed. The dialog
  component itself is unchanged.
- Unit tests cover the flavor predicate and prove the APK checker does not call
  `fetch` in the F-Droid flavor.

### 2.2 Reproducible version metadata

`package.json` is the release version source. `scripts/cap-version.js` encodes
stable semantic versions as:

```text
versionCode = major * 10000 + minor * 100 + patch
```

For `0.3.6`, that is `306`. The committed `android/app/build.gradle` must carry
both values because F-Droid reads source files directly instead of running the
project's version script.

The release flow is therefore:

```bash
# 1. edit package.json version
pnpm cap:version
pnpm fdroid:check
# 2. commit package.json + android/app/build.gradle + metadata together
# 3. tag that commit vX.Y.Z and push the tag
```

The release workflow also runs `pnpm cap:version` and fails if it changes the
committed Gradle file. A tag can no longer hide stale Android metadata.

### 2.3 FOSS-only Android build

The unused Google Services Gradle plugin and its conditional application hook
were removed. The project has no `google-services.json`, Firebase, Crashlytics,
ads, or proprietary Android SDK dependency. Capacitor, Capgo updater, AndroidX,
Media3, and Guava are free-software dependencies.

The Capgo updater code remains in the shared project but is unreachable in the
F-Droid flavor. F-Droid maintainers make the final decision on whether the
disabled optional integration or the app's network APIs require an Anti-Feature.

### 2.4 Isolated F-Droid package-manager version

The repository's existing pnpm 10 workflow configuration is unchanged. The
F-Droid recipe installs exact `pnpm@10.34.5` in its own build environment rather
than relying on whichever package manager happens to be installed globally.

### 2.5 Listing metadata

Fastlane/Triple-T-compatible files live at:

```text
fastlane/metadata/android/en-US/
├── title.txt
├── short_description.txt
├── full_description.txt
├── changelogs/306.txt
└── images/
    ├── icon.png
    └── phoneScreenshots/{1,2}.png
```

`pnpm fdroid:check` verifies all required files, text limits, PNG validity,
portrait screenshot dimensions, and the changelog filename/versionCode link.

## 3. `fdroiddata` recipe template

Create `metadata/io.github.double77x.radioscout.yml` in a fork of `fdroiddata`
only after the repository-side work has been merged.

- Replace the all-zero commit with the **full 40-character merge commit hash**.
- Do not move or replace the existing `v0.3.6` tag. It points to a commit whose
  Gradle file still says versionCode `202`; F-Droid's tag scanner therefore
  rejects it as older than the corrected `306` build. The initial submission
  uses `UpdateCheckMode: Static`. The next release should be `v0.3.7` with
  committed versionCode `307`, after which tag-based auto-update can be enabled.
- `prebuild` and `build` command lists are joined into one shell, so `cd ..`
  persists until the explicit `cd android` at the end.

```yaml
Categories:
  - Multimedia
License: MIT
AuthorName: Double77x
WebSite: https://radioscout.pages.dev
SourceCode: https://github.com/Double77x/radioscout
IssueTracker: https://github.com/Double77x/radioscout/issues
Changelog: https://github.com/Double77x/radioscout/blob/main/src/pages/Changelog.tsx

RepoType: git
Repo: https://github.com/Double77x/radioscout.git

Builds:
  - versionName: 0.3.6
    versionCode: 306
    # REQUIRED: replace after merging the repository-side F-Droid work.
    commit: 0000000000000000000000000000000000000000
    subdir: android
    sudo:
      - apt-get update
      - apt-get install -y nodejs npm
      - npm install --global pnpm@10.34.5
    gradle: yes
    prebuild:
      - cd ..
      - pnpm install --frozen-lockfile
    scandelete:
      - node_modules
    build:
      - cd ..
      - VITE_DISTRIBUTION=fdroid pnpm build
      - npx cap sync android
      - cd android

UpdateCheckMode: Static
CurrentVersion: 0.3.6
CurrentVersionCode: 306

MaintainerNotes: |-
  The web bundle must be built with VITE_DISTRIBUTION=fdroid. That build flag
  disables both the Capgo OTA path and the GitHub APK update prompt so F-Droid
  remains the only update channel for this build.
```

Why this shape:

- `scandelete: node_modules` removes dependency binaries flagged by the source
  scanner while retaining the JavaScript modules needed by the later `build`
  commands.
- The web build and Capacitor sync run in `build`, after scanning, matching
  existing Capacitor recipes in `fdroiddata`.
- F-Droid's own `gradlew-fdroid` runs `assembleRelease` and finds the single
  renamed `radioscout-release.apk` in the standard Gradle output directory, so
  no custom `output:` glob is needed.
- `UpdateCheckMode: Static` is deliberate for the initial submission. The
  already-published `v0.3.6` tag still contains versionCode `202`; asking
  F-Droid to compare it with the corrected `306` build fails with
  `current version is newer`. Moving a published tag would break release
  provenance, so the first listing stays static.

## 4. Validation

### 4.1 Repository checks

Run from a normal full checkout:

```bash
pnpm install --frozen-lockfile
pnpm fdroid:check
pnpm test:unit
pnpm lint
pnpm build
VITE_DISTRIBUTION=fdroid pnpm build
cd android && ./gradlew assembleRelease --no-daemon
```

The release APK must report:

```text
package: name='io.github.double77x.radioscout' versionCode='306' versionName='0.3.6'
```

### 4.2 Official F-Droid checks

After replacing the placeholder commit, follow the current
[Submitting to F-Droid Quick Start Guide](https://f-droid.org/en/docs/Submitting_to_F-Droid_Quick_Start_Guide/)
in separate temporary directories for `fdroidserver`, `fdroiddata`, and the app
checkout. At minimum run:

```bash
fdroid readmeta
fdroid rewritemeta io.github.double77x.radioscout
fdroid checkupdates --allow-dirty io.github.double77x.radioscout
fdroid lint io.github.double77x.radioscout
fdroid build io.github.double77x.radioscout
```

**Never use `git sparse-checkout` on the RadioScout working repository to obtain
fdroidserver files.** That mode hides unrelated tracked files behind
`skip-worktree` while ordinary `git status` can still look deceptively clean.
Clone or mount fdroidserver outside the app checkout instead.

### 4.3 APK smoke test

Install the F-Droid-built APK on a clean Android device or emulator and verify:

- the app boots and radio playback works;
- no GitHub APK update dialog appears;
- no Capgo OTA bundle is staged or announced;
- package version is `0.3.6` / `306`;
- switching from the GitHub-signed APK is documented as uninstall + reinstall.

## 5. Submission and future updates

1. Merge the repository-side readiness branch.
2. Capture its full commit hash and replace the placeholder in the recipe.
3. Pass `fdroid lint`, `fdroid build`, and the APK smoke test.
4. Open a `New App: RadioScout` merge request in `fdroiddata`.
5. Keep the initial listing on `UpdateCheckMode: Static` until a correctly
   stamped release tag exists (`v0.3.7` / `307`).
6. At that point, replace `UpdateCheckMode: Static` with:

   ```yaml
   AutoUpdateMode: Version
   UpdateCheckMode: Tags ^v[0-9.]+$
   UpdateCheckData: 'android/app/build.gradle|versionCode\s(\d+)||v([\d.]+)'
   ```

7. For every future native release: bump `package.json`, run `pnpm cap:version`,
   add/update the versionCode changelog, commit both, then tag `vX.Y.Z`.
8. Keep Capgo OTA enabled for GitHub/sideload installs; the F-Droid flavor stays
   store-managed.

F-Droid and the GitHub APK use different signing keys. Moving an existing
install between them requires uninstall/reinstall, so users should export their
data from **Settings → Data backup** first.
