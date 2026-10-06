/**
 * Generate the Obtainium install deep link and README badge.
 *
 * Obtainium has no publish API. It is a pull-based client that reads a source
 * URL from the user's device, and it pulls straight from this repo's GitHub
 * Releases. `release-apk.yml` already publishes exactly what it needs on every
 * `v*` tag, so no workflow exists for Obtainium and no special tag is required.
 *
 * The only artefact here is the config: a JSON file submitted by hand to the
 * crowdsourced directory, and the same four fields encoded in an `obtainium://`
 * deep link. It carries no version, because Obtainium discovers releases live.
 *
 * The percent-encoding is the part that rots. It embeds `name` and `author`, so
 * a rename breaks a hand-written URI without anything looking wrong. Generate it.
 *
 * Usage: pnpm obtainium:links          # print badge and links
 *         pnpm obtainium:links --check  # fail if the README or config drifted
 *
 * `--check` exists because the listing blurb is deliberately not written twice:
 * it is reused verbatim from the F-Droid/Fastlane `short_description.txt`. Two
 * copies of a marketing string drift apart, so the check is what makes it a
 * single source of truth. `pnpm fdroid:check` covers the other half of that
 * contract, the length limits; this covers Obtainium's copy.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

/** Directory the crowdsourced Obtainium configs live in (see CONTRIBUTING.md there). */
const CONFIG_PATH = path.join("distribution", "obtainium", "io.github.double77x.radioscout.json");

/** Reused verbatim as the listing description — do not fork this string. */
const SHORT_DESCRIPTION_PATH = path.join("fastlane", "metadata", "android", "en-US", "short_description.txt");

/**
 * Where the badge lives, and how each surface should reference it.
 *
 * `src` is repo-relative on purpose. GitHub resolves it against the repo, so
 * the badge renders straight from the committed PNG with no Pages deploy. An
 * absolute `https://radioscout.pages.dev/...` URL 404s until the file is
 * actually deployed, which is exactly how this badge went missing once already.
 *
 * The badge sits in `image/README/`, next to the screenshot, rather than in
 * `public/`. Only the README uses it, and `public/` is copied into
 * `dist/client` on every build, so a file there would ship in the web bundle and
 * the APK for nothing.
 */
const BADGE_TARGETS = [{ file: "README.md", src: "./image/README/obtainium-badge.png" }];

/** Public redirect that tries the app link, then falls back to a store prompt. */
const REDIRECT_BASE = "https://apps.obtainium.imranr.dev/redirect?r=";

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  console.error(`[obtainium:links] ${message}`);
  process.exit(1);
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === "object" && value !== null;
}

const check = process.argv.includes("--check");

/** @type {unknown} */
const rawConfig = JSON.parse(fs.readFileSync(path.join(root, CONFIG_PATH), "utf8"));
if (!isRecord(rawConfig)) {
  fail(`${CONFIG_PATH} does not contain a JSON object.`);
}
const config = rawConfig;
const shortDescription = fs.readFileSync(path.join(root, SHORT_DESCRIPTION_PATH), "utf8").trim();

const descriptionEn = isRecord(config.description) ? config.description.en : undefined;
if (descriptionEn !== shortDescription) {
  fail(
    `Listing description drifted from ${SHORT_DESCRIPTION_PATH}.\n` +
      `  config:      ${JSON.stringify(descriptionEn)}\n` +
      `  short_desc:  ${JSON.stringify(shortDescription)}\n` +
      `Reuse the one-liner — edit ${SHORT_DESCRIPTION_PATH} and mirror it here.`,
  );
}

// `simple/` shape: a single `config` object, no `additionalSettings`.
//
// That is the whole point. Obtainium's defaults are correct here because
// `fdroid-reference.yml` publishes its reference APK as a prerelease, which
// Obtainium skips unless asked. The earlier `apkFilterRegEx` existed to
// insulate the listing from that release being a normal one; making it a
// prerelease removes the need for the filter, and the directory's own criteria
// ask for defaults wherever they work. See §4.2 of docs/plans/OBTAINIUM_PLAN.md.
const entry = config.config;
if (!isRecord(entry)) {
  fail(
    `${CONFIG_PATH} has no \`config\` object. This entry is meant for the directory's \`simple/\` bucket, which needs no custom settings.`,
  );
}
if (entry.additionalSettings) {
  fail(
    `${CONFIG_PATH} sets \`additionalSettings\`, which would move the listing to the \`complex/\` bucket. Confirm that is still wanted before shipping it.`,
  );
}

// Exactly what a deep-link import needs, and nothing more.
const importable = {
  id: entry.id,
  url: entry.url,
  author: entry.author,
  name: entry.name,
};

const deepLink = `obtainium://app/${encodeURIComponent(JSON.stringify(importable))}`;
const redirectLink = `${REDIRECT_BASE}${deepLink}`;

if (check) {
  const problems = [];
  for (const { file, src } of BADGE_TARGETS) {
    if (!fs.existsSync(path.join(root, src))) {
      problems.push(`${src} is missing, so the badge has nothing to render.`);
    }
    const absolute = path.join(root, file);
    if (!fs.existsSync(absolute)) {
      problems.push(`${file} is missing, so the badge has nowhere to render.`);
      continue;
    }
    const body = fs.readFileSync(absolute, "utf8");
    if (!body.includes(redirectLink)) {
      problems.push(
        `${file} does not contain the generated deep link. Run \`pnpm obtainium:links\` and paste the badge and its link definition.`,
      );
    }
    if (!body.includes(src)) {
      problems.push(`${file} does not reference ${src}.`);
    }
  }
  if (problems.length > 0) {
    for (const problem of problems) console.error(`[obtainium:links] ${problem}`);
    process.exit(1);
  }
  console.log("[obtainium:links] README deep link and listing description are in sync.");
  process.exit(0);
}

console.log("Paste the badge inline in a heading, and the link definition at the foot of the file:\n");
for (const { src } of BADGE_TARGETS) {
  // Plain markdown image syntax, no sizing attribute. GitHub strips `width` and
  // `height` from README images, so the committed asset is pre-scaled to its
  // display size (107x32) and the natural pixel size is what renders.
  // A reference link keeps the long deep link out of the heading.
  console.log(`### Install with Obtainium [![Get it on Obtainium](${src})][obtainium]\n\n[obtainium]: ${redirectLink}`);
}
console.log(`\nBare deep link (no third party, needs Obtainium installed):\n  ${deepLink}`);
console.log(`\nListing config: ${CONFIG_PATH}`);
console.log(`Directory:      ${REDIRECT_BASE}<encoded json>`);
