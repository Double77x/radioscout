import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.argv[2] ?? "dist/client";
const rawEpoch = process.env.SOURCE_DATE_EPOCH;
const epochSeconds = Number(rawEpoch);

if (!Number.isSafeInteger(epochSeconds) || epochSeconds < 0) {
  throw new Error("SOURCE_DATE_EPOCH must be a non-negative integer");
}

const timestamp = epochSeconds * 1000;
let filesChanged = 0;
let replacements = 0;

/**
 * @param {string} directory
 * @returns {Promise<void>}
 */
async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      await visit(path);
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith(".html")) continue;

    const content = await readFile(path, "utf8");
    if (!content.includes("$_TSR")) continue;

    let replacementsForFile = 0;
    /** @type {(match: string, group: string, offset: number, input: string, groups: { prefix?: string } | undefined) => string} */
    const spliceTimestamp = (_match, _group, _offset, _input, groups) => {
      replacementsForFile += 1;
      return `${groups?.prefix ?? ""}${timestamp}`;
    };
    const normalized = content.replaceAll(/(?<prefix>\bu:\s*)\d+/g, spliceTimestamp);

    if (replacementsForFile > 0) {
      await writeFile(path, normalized);
      filesChanged += 1;
      replacements += replacementsForFile;
    }
  }
}

await visit(root);
console.log(`Normalized ${replacements} SSR timestamps in ${filesChanged} HTML files`);
