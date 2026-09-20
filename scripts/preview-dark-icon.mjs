// Dev-only: render the forced-dark favicon variant for inspection.
import { readFile } from "node:fs/promises";
import sharp from "sharp";

const svg = await readFile("public/favicon.svg", "utf8");
const dark = svg
  .replaceAll("url(#scout_body)", "url(#scout_body_dark)")
  .replaceAll('class="bot-eyes"', 'style="display:block"');
await sharp(Buffer.from(dark))
  .resize(512, 512)
  .png()
  .toFile("C:/Users/Dan/AppData/Local/Temp/opencode/scout-dark-preview2.png");
console.log("dark preview ok");
