// Dev-only design capture: deterministic screenshots with animations frozen.
// Usage: pnpm exec node scripts/screenshot.mjs <url> <output> [dark]
import { chromium } from "@playwright/test";

const [url, out, scheme] = process.argv.slice(2);
if (!url || !out) {
  console.error("Usage: screenshot.mjs <url> <output> [dark]");
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  colorScheme: scheme === "dark" ? "dark" : "light",
  deviceScaleFactor: 2,
});
await page.goto(url, { waitUntil: "networkidle" });
await page.addStyleTag({
  content: "*,*::before,*::after{animation:none!important;transition:none!important}",
});
await page.waitForTimeout(400);
await page.screenshot({ path: out });
await browser.close();
console.log(`captured ${out}`);
