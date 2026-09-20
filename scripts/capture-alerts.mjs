// Dev-only: capture the alerts flyout.
import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto("http://localhost:8082", { waitUntil: "networkidle" });
const bell = page.getByRole("button", { name: /need attention|Notifications/ });
await bell.click();
await page.waitForTimeout(500);
await page.screenshot({ path: "C:\\Users\\Dan\\AppData\\Local\\Temp\\opencode\\scout-alerts.png" });
await browser.close();
console.log("captured alerts");
