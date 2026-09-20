// Dev-only: capture the settings flyout.
import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto("http://localhost:8080", { waitUntil: "networkidle" });
await page.getByRole("navigation").getByRole("button", { name: "Settings" }).click();
await page.getByRole("dialog", { name: "Settings" }).waitFor();
await page.waitForTimeout(400);
await page.screenshot({ path: "C:\\Users\\Dan\\AppData\\Local\\Temp\\opencode\\scout-settings.png" });
await browser.close();
console.log("captured settings");
