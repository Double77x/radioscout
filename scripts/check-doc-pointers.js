import fs from "node:fs";
import path from "node:path";

/**
 * Documentation pointer policy. A moved or renamed doc leaves a path that
 * still reads correctly in a comment or a plan, so an agent follows it, finds
 * nothing, and either guesses or concludes the thing it was told about does not
 * exist. The reverse direction matters equally: a document nothing points at is
 * unreadable however good it is.
 *
 * Three checks:
 *  1. every `docs/….md` path named in a tracked file resolves on disk;
 *  2. every module contract is named by a source file or by `docs/README.md`;
 *  3. every document in `docs/` is named by the `docs/README.md` index.
 *
 * Fenced code blocks in markdown are exempt from (1), because a doc that shows
 * an example of a pointer is illustrating the shape rather than referencing a
 * file. Source files get no exemption: a path in a comment is meant to be
 * followed.
 *
 * Lives in `scripts/` rather than `tests/unit/` because it needs Node APIs, and
 * `tsconfig.app.json` deliberately excludes them from the unit-test project. It
 * runs in the build chain beside `apply-header-policy.js` for the same reason
 * that one is not a unit test: it validates the artefact, not a function.
 */

const ROOT = process.cwd();

/** Where a `docs/…` reference can legitimately live. */
const SCAN_ROOTS = [
  "src",
  "scripts",
  "functions",
  "docs",
  "tests",
  ".github",
  "public",
  "AGENTS.md",
  "README.md",
  "fallow.toml",
  "vite.config.ts",
  "toolchain.config.ts",
  "capacitor.config.ts",
  "package.json",
];

/** Directories that hold no documentation pointers and cost time to walk. */
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", ".wrangler", "coverage", "android", "fonts"]);

const TEXT_FILE = /\.(?<ext>ts|tsx|mjs|js|md|toml|json|ya?ml|txt)$/;
const DOC_PATH = /docs\/[A-Za-z0-9_./-]+\.md/g;
const FENCED_BLOCK = /```[\s\S]*?```/g;

/** Folders whose contents are documents, i.e. everything but the root notes.
 * @param {string} folder
 * @returns {string[]}
 */
function markdownFiles(folder) {
  const absolute = path.resolve(ROOT, folder);
  if (!fs.existsSync(absolute)) return [];
  return walk(absolute)
    .map((file) => path.relative(ROOT, file).split(path.sep).join("/"))
    .filter((file) => file.endsWith(".md"));
}

/** @param {string} absolute
 * @returns {string[]}
 */
function walk(absolute) {
  const stats = fs.statSync(absolute);
  if (stats.isFile()) return TEXT_FILE.test(absolute) ? [absolute] : [];
  return fs
    .readdirSync(absolute)
    .filter((entry) => !SKIP_DIRS.has(entry))
    .flatMap((entry) => walk(path.join(absolute, entry)));
}

/** @returns {string[]}
 */
function scannedFiles() {
  return SCAN_ROOTS.filter((entry) => fs.existsSync(path.resolve(ROOT, entry))).flatMap((entry) =>
    walk(path.resolve(ROOT, entry)),
  );
}

/** @param {string} file
 * @returns {string}
 */
function readForScan(file) {
  const raw = fs.readFileSync(file, "utf8");
  return file.endsWith(".md") ? raw.replace(FENCED_BLOCK, "") : raw;
}

const files = scannedFiles();
const texts = files.map((file) => readForScan(file));
const failures = [];

/** Last path segment, which is how the index and source headers name a doc.
 * @param {string} doc
 * @returns {string}
 */
function basenameOf(doc) {
  return doc.split("/").pop() ?? doc;
}

// 1. Every referenced path resolves.
for (const [position, file] of files.entries()) {
  for (const match of texts[position].match(DOC_PATH) ?? []) {
    if (!fs.existsSync(path.resolve(ROOT, match))) {
      failures.push(`${path.relative(ROOT, file)} -> ${match}`);
    }
  }
}

const index = fs.readFileSync(path.resolve(ROOT, "docs", "README.md"), "utf8");

// 2. Every module contract is reachable.
for (const doc of markdownFiles("docs/modules")) {
  if (doc === "docs/modules/README.md") continue;
  if (!texts.some((text) => text.includes(basenameOf(doc)))) failures.push(`unreferenced module doc: ${doc}`);
}

// 3. Every document is named by the index. Module contracts are exempt: they
//    are reached by following the pointer in the file header, which is the
//    point of them, and listing each one here would only make the index a
//    second place to forget. Check 2 covers them from the other direction.
const allDocs = new Set([
  ...markdownFiles("docs/standards"),
  ...markdownFiles("docs/architecture"),
  ...markdownFiles("docs/plans"),
  // The `docs` scan recurses, so it sweeps up the module contracts too. Keep
  // them out of the index check; check 2 holds them to a source pointer.
  ...markdownFiles("docs").filter((doc) => !doc.startsWith("docs/modules/")),
]);
for (const doc of allDocs) {
  if (doc === "docs/README.md") continue;
  if (!index.includes(basenameOf(doc))) failures.push(`not listed in docs/README.md: ${doc}`);
}

// 4. AGENTS.md stays inside its budget. The harness injects it into context on
//    every task, so its size is a running cost rather than a one-off read. It
//    sat at 45KB of decision history before that history moved to
//    docs/lineage.md, which is roughly 12k tokens per turn for prose an agent
//    reads only when tracing a decision. The budget is the mechanical half of
//    that split: it catches the regrowth a prose rule asking nicely would not.
const AGENTS_BUDGET = 12_000;
const agentsBytes = fs.statSync(path.resolve(ROOT, "AGENTS.md")).size;
if (agentsBytes > AGENTS_BUDGET) {
  failures.push(
    `AGENTS.md is ${agentsBytes} bytes, over the ${AGENTS_BUDGET}-byte budget — move the reasoning to docs/lineage.md and leave a line here`,
  );
}

// 5. Every standard is on the always-read list. The mandatory set is the whole
//    of docs/standards, and AGENTS.md has to name each file so an agent knows
//    what to read before it decides what the task involves. A standard nobody
//    is told to read is how STYLE_GUIDE.md spent months describing a different
//    application, so the two lists are held together mechanically rather than by
//    whoever remembers to update the instruction.
const agents = fs.readFileSync(path.resolve(ROOT, "AGENTS.md"), "utf8");
for (const doc of markdownFiles("docs/standards")) {
  if (!agents.includes(basenameOf(doc))) failures.push(`standard not on the AGENTS.md always-read list: ${doc}`);
}

// 6. Every lineage entry has an index line in AGENTS.md. AGENTS.md carries one
//    line per decision so the log is scannable without opening lineage.md, and
//    that correspondence is the thing worth checking — not the count, which
//    drifts every time either file is edited by hand.
const lineage = fs.readFileSync(path.resolve(ROOT, "docs", "lineage.md"), "utf8");
const entryRx = /^### (?<date>\d{4}-\d{2}-\d{2}) · (?<title>.+)$/gm;
let entryCount = 0;
for (let entry = entryRx.exec(lineage); entry !== null; entry = entryRx.exec(lineage)) {
  entryCount += 1;
  const { date, title } = entry.groups ?? {};
  if (date === undefined || title === undefined) continue;
  if (!agents.includes(`- ${date} — ${title}`)) {
    failures.push(`lineage entry not indexed in AGENTS.md: ${date} — ${title}`);
  }
}

if (failures.length > 0) {
  console.error(`❌ Doc pointers (${failures.length}):`);
  for (const failure of [...new Set(failures)].toSorted()) console.error(`   ${failure}`);
  process.exitCode = 1;
} else {
  const pct = Math.round((agentsBytes / AGENTS_BUDGET) * 100);
  console.log(
    `✅ Doc pointers (${files.length} files, ${allDocs.size} docs, ${markdownFiles("docs/standards").length} standards always-read, ${entryCount} lineage entries indexed, AGENTS.md ${agentsBytes}/${AGENTS_BUDGET} bytes = ${pct}%)`,
  );
}
