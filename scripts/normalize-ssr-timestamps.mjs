import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = process.argv[2] ?? 'dist/client'
const rawEpoch = process.env.SOURCE_DATE_EPOCH
const epochSeconds = Number(rawEpoch)

if (!Number.isSafeInteger(epochSeconds) || epochSeconds < 0) {
  throw new Error('SOURCE_DATE_EPOCH must be a non-negative integer')
}

const timestamp = epochSeconds * 1000
let filesChanged = 0
let replacements = 0

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)

    if (entry.isDirectory()) {
      await visit(path)
      continue
    }

    if (!entry.isFile() || !entry.name.endsWith('.html')) continue

    const content = await readFile(path, 'utf8')
    if (!content.includes('$_TSR')) continue

    let replacementsForFile = 0
    const normalized = content.replace(/(\bu:\s*)\d+/g, (_, prefix) => {
      replacementsForFile += 1
      return `${prefix}${timestamp}`
    })

    if (replacementsForFile > 0) {
      await writeFile(path, normalized)
      filesChanged += 1
      replacements += replacementsForFile
    }
  }
}

await visit(root)
console.log(`Normalized ${replacements} SSR timestamps in ${filesChanged} HTML files`)
