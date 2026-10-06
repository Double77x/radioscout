# Obtainium Integration Plan — RadioScout

> **Status (2026-09-27):** the repository side is complete. The listing config,
> README badge and drift guard all exist, and no CI job does. No PR to the
> crowdsourced directory has been opened yet (see §5).

## 1. What Obtainium is

**It is not a store you push releases into.** There is no upload API, no
submission endpoint and no CI plugin. Obtainium is a pull-based client that
runs on the *user's* device and polls the source URL for new releases.

So "CI/CD into Obtainium" splits into two unrelated jobs:

1. **Make the GitHub Release legible to Obtainium.** This is the whole
   integration, and `release-apk.yml` already satisfied it before any of this
   work existed (§3).
2. **Publish a one-tap install config.** The only artefact resembling a store
   submission, a single JSON file submitted by hand or synced by CI (§5).

The feature request for a repo-provided manifest
([Obtainium#2598](https://github.com/ImranR98/Obtainium/issues/2598)) is open
and unimplemented, so there is no "commit `obtainium.json` and get listed"
route. Badging plus the `obtainium://` deep link is the supported equivalent.

## 2. The install surface

- `distribution/obtainium/io.github.double77x.radioscout.json`, the listing
  config, copied by hand into the directory repo (§5). The filename is the
  package id, which is what the directory keys its files on.
- `scripts/obtainium-links.mjs` (`pnpm obtainium:links`), which generates the
  README badge block and the percent-encoded deep link. The encoding embeds
  `name` and `author`, so a rename breaks a hand-written URI. Generate it.
- `pnpm obtainium:links --check`, which fails when the README deep link or the
  listing blurb drifts. Nothing runs it automatically; run it before submitting
  or after touching either file.
- `image/README/obtainium-badge.png`, committed rather than hotlinked from
  `raw.githubusercontent.com`, per Obtainium's `BADGING.md`. It sits beside the
  README screenshot rather than in `public/`, since only the README uses it and
  `public/` is copied into `dist/client` on every build. The README references
  it as `./image/README/obtainium-badge.png` so it renders from the repo without
  waiting on a Pages deploy.
- The badge is pre-cut to its 107x32 display size (trimmed of the source PNG's
  transparent padding first). GitHub strips `width` and `height` from README
  images, so a sizing attribute in the markdown is silently ignored, which is
  how the badge first rendered at its full 646px. The committed file is the
  artefact; there is no generator script.

### The description is not duplicated

`description.en` is **verbatim** `fastlane/metadata/android/en-US/short_description.txt`.
Two copies of a marketing string drift, so `--check` asserts they match and
`pnpm fdroid:check` enforces the length limits. One string, two consumers.

## 3. Compatibility audit

Confirmed by reading `lib/app_sources/github.dart`, not just the wiki.

| Requirement | RadioScout | Verdict |
| --- | --- | --- |
| Public repo (unauthenticated API) | `private: false` | ok |
| Release asset ending `.apk` | `radioscout-v0.3.6.apk` | ok |
| Stable signing key for in-place updates | `ANDROID_KEYSTORE_*`, one keystore | ok |
| `targetSdk` recent enough for silent installs | `targetSdkVersion = 36` | ok (Android 12+) |
| Monotonic `versionCode` | `cap-version.js` → `306` | ok |
| Universal APK (no splits, no AAB) | single `assembleRelease` output | ok |
| Tag version parses to a standard format | `v0.3.6` → Android reports `0.3.6` | ok, Obtainium strips the `v` |
| Package ID discoverable | `applicationId "io.github.double77x.radioscout"` | ok, `tryInferringAppId` reads that line from `android/app/build.gradle` |

**Marginal CI work for basic functionality: zero.** Anyone could add
`https://github.com/Double77x/radioscout` in Obtainium and get working
background updates before this plan existed.

## 4. Release-layout hazards

Two releases in this repo are not the sideload APK, and Obtainium's default
settings exclude neither. The config handles both.

### 4.1 OTA prereleases: safe by default, do not "fix" it

`publish-ota.mjs` creates `ota-<channel>-<version>` releases with
`--prerelease` and a `.zip` asset. Two hazards, both already handled upstream:

- `includePrereleases` defaults to **`false`** (form item `value: false`, read
  as `additionalSettings['includePrereleases'] == true`), so the OTA releases
  stay invisible. Obtainium's own `APP_CRITERIA.md` advises leaving it off.
- Even so, `_selectGitHubTargetRelease` skips any release with no matching APK
  (`if (filteredApks.isEmpty … ) continue;`), and `includeZips` defaults to
  `false`, so a `.zip` never counts as an APK. With the `i > releaseSkipped`
  guard, the walk falls through to the newest release that has one.

**Never enable `includePrereleases` on this config.** A comment at the
`--prerelease` line in `scripts/publish-ota.mjs` records why.

### 4.2 The F-Droid reference APK: excluded by being a prerelease

`fdroid-reference.yml` publishes `radioscout-fdroid-<version>-<code>.apk` on an
`fdroid-reference-*` release, for F-Droid reproducible-build verification. That
build is the F-Droid flavor, with its update channels compiled out, so it must
never reach a sideload user.

`includePrereleases` defaults to `false`, so the fix is to mark the reference
release a prerelease, which `fdroid-reference.yml` now does. The asset stays
publicly downloadable by direct URL, so reproducible-build verification is
unaffected, and `releases/latest` now resolves to the sideload release rather
than to the reference build.

Simulating Obtainium's selection against this repo's live releases:

| Scenario | Result |
| --- | --- |
| Today, before the change (reference a normal release) | `v0.3.6` ok, by version tie-break |
| After `prerelease: true` | `v0.3.6` ok, prereleases skipped |
| Reference bumped to a higher version, still a prerelease | `v0.3.6` ok |
| Reference prerelease, but `includePrereleases: true` | **F-Droid build** |

The third row is the case an `apkFilterRegEx` used to cover, and it is now
covered by the prerelease flag instead. That is what lets the config ship in the
directory's `simple/` bucket with no `additionalSettings` at all, which is what
their `APP_CRITERIA.md` asks for: leave options at their defaults unless needed.

The one remaining failure mode is a config that opts into `includePrereleases`.
The row below is the standing warning about it, and §7 explains why the config
must never set it.

## 5. Directory submission

Target: `ImranR98/apps.obtainium.imranr.dev` →
`public/data/apps/simple/io.github.double77x.radioscout.json`.

Submitted by hand, once. The `simple/` bucket is the one for entries that need
nothing but the default settings, which is now this entry's case (§4.2).

Their criteria, and how this entry sits against them:

- Official first-party sources only. This repo qualifies, and it is not a fork.
- Leave options at their defaults unless needed. This entry sets none, so there
  is nothing to justify.
- Search open and closed PRs and issues before opening anything.
- `icon` is `https://radioscout.pages.dev/web-app-manifest-512x512.png`, which
  resolves 200 `image/png`. Their `npm run validate` checks icons and nulls the
  dead ones, so a self-hosted URL beats a hotlinked one.
- `categories: ["music"]`, checked against their `public/data/categories.json`.
  Unknown slugs are dropped silently and fall back to `other`.

One PR covers this app. Their contributing guide asks contributors to batch
rather than open a PR per app, which is about volume, not about a single new
entry.

Expect a slow first review. The repo is new with few stars, and they scrutinise
sources that are not yet well known. Nothing is blocked meanwhile.

## 6. Why there is no workflow

There is no Obtainium CI job, and there should not be one. Two reasons.

**There is nothing to automate.** The config is static: it holds no version,
only a pointer at this repo, because Obtainium discovers releases live. An
earlier draft had a job that copied it to the directory repo. After the first
run it wrote byte-identical JSON and exited, so it automated a repair that takes
30 seconds by hand and may never be needed. The cost was a standing
write-scoped PAT to a third-party repository, kept next to the release-signing
secrets. That is a bad trade for a maybe.

**Obtainium pulls straight from the releases.** `release-apk.yml` already
publishes everything it needs on every `v*` tag: a universal APK with a stable
signature, a monotonic `versionCode`, and a tag whose version matches what
Android reports. The GitHub source reads `/releases`, and a release is already
tag-backed, so there is no separate tag to add. An extra Obtainium tag would
make things worse, because it would create a second release carrying a duplicate
of the same APK at the same version, which is a version tie. Every selection
lever Obtainium has is config-side (`includePrereleases`,
`filterReleaseTitlesByRegEx`, `filterReleaseNotesByRegEx`, `apkFilterRegEx`),
so a tag cannot tell it what to pick.

If the listing is ever deleted, edited or rejected upstream, re-open the PR by
hand. That is a 30-second, zero-credential operation.

`release-apk.yml` and `publish-ota.yml` are untouched by any of this. The only
pipeline change is one added input in `fdroid-reference.yml`, which is a
separate workflow on a separate tag.

## 7. Known frictions we do not control

- **Rate limits.** Obtainium uses the GitHub API, and unauthenticated requests
  are capped at 60 per hour per IP. Users tracking many apps need their own
  fine-grained token. The README says so; there is nothing to fix server-side.
- **Signing keys differ per source.** Obtainium, a manual APK install and
  F-Droid each use a different key, so moving between them means uninstalling.
  This is the same three-way warning `FDROID_PLAN.md` §5 already gives for GitHub
  against F-Droid. Users should export **Settings → Data backup** first.
- **Three update paths coexist.** The release APK leaves `VITE_DISTRIBUTION`
  unset, so Capgo OTA and the in-app `checkApkUpdate()` prompt are both live and
  Obtainium is a third. Nothing is broken, since a full-APK upgrade can arrive by
  either route, but it is redundant. A `VITE_DISTRIBUTION=obtainium` flavor that
  kept Capgo, a 600 KB web delta, and silenced the in-app APK prompt would make
  Obtainium the only route for a full upgrade. Left alone for now: nothing is
  broken, and adding a flavor is a bigger change than the problem warrants.
  Revisit if users report confusion.

## 8. Left untouched on purpose

To keep the F-Droid submission and the manual install path intact:

- `release-apk.yml`, `publish-ota.yml`, `fdroid-check.yml`, `capacitor.config.ts`,
  `android/**`, `src/**` and `fastlane/**` are unmodified.
- No new `VITE_DISTRIBUTION` flavor (§7).
- No dependency changes, so `pnpm install --frozen-lockfile` in the F-Droid
  recipe resolves exactly as before.
- The F-Droid recipe's `commit:` pin holds either way round, because the recipe
  never reads a file added here, and the `fdroid-reference.yml` change touches no
  step the recipe depends on.
- Nothing here reaches `dist/client`. The badge lives in `image/README/`, not
  `public/`, so it is not copied into the web bundle or the APK, and neither the
  sitemap nor `_headers` changes.

### The one pipeline change, and why it is safe for F-Droid

`fdroid-reference.yml` gained `prerelease: true` on its release step. That
affects the reference asset only, and nothing in the F-Droid submission reads
it:

- The `fdroiddata` recipe builds from source against a pinned `commit:`. It
  references no release, no download URL and no prerelease flag.
- Reproducible-build verification compares hashes, and `prerelease` changes no
  bytes of the APK.
- Prerelease assets stay publicly downloadable by direct URL, so a maintainer
  can still fetch the reference build.
- `/releases/latest` excludes prereleases, so it now resolves to the sideload
  release. That is the behaviour `publish-ota.mjs` already relies on.
- The recipe's `sed` steps that strip the Capgo module from
  `capacitor.settings.gradle` and `capacitor.build.gradle` are untouched, and
  the reference APK is still built with the Capgo module removed.

The one thing to do after this lands: the existing `fdroid-reference-0.3.6-306`
release is still a normal release. Flip it once, without a rebuild, via

```bash
gh release edit fdroid-reference-0.3.6-306 --prerelease
```

Until then the tie-break in §4.2 still resolves correctly, so this is tidiness
rather than a live fix.
