// Dev-only: capture the add sheet (scrolls, shows scrollbar styling).
import { chromium } from "@playwright/test";

const scheme = process.argv[2] === "dark" ? "dark" : "light";
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  colorScheme: scheme,
});
await page.goto("http://localhost:8081", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Add an item" }).click();
await page.getByRole("dialog", { name: "Add to Scout" }).waitFor();
await page.getByRole("combobox", { name: "Warranty month" }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `C:\\Users\\Dan\\AppData\\Local\\Temp\\opencode\\scout-sheet-${scheme}.png` });
await browser.close();
console.log(`captured sheet ${scheme}`);
