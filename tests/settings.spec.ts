import { test, expect, type Page } from "@playwright/test";

const STATIONS = [
  {
    stationuuid: "11111111-1111-1111-1111-111111111111",
    name: "Test Jazz FM",
    url: "https://example.com/jazz.mp3",
    url_resolved: "",
    homepage: "",
    favicon: "",
    tags: "jazz",
    country: "Testland",
    countrycode: "TT",
    state: "",
    language: "english",
    codec: "MP3",
    bitrate: 128,
    hls: 0,
    votes: 10,
    clickcount: 5,
    clicktrend: 1,
    lastcheckok: 1,
  },
];

/** Deterministic station directory — never hits the live radio-browser servers. */
async function mockDirectory(page: Page) {
  await page.route(/https:\/\/.*\.api\.radio-browser\.info\/.*/, (route) => {
    const url = route.request().url();
    if (url.includes("/json/stations/topvote/")) return route.fulfill({ json: STATIONS });
    if (url.includes("/json/stations/search")) return route.fulfill({ json: STATIONS });
    if (url.includes("/json/stats"))
      return route.fulfill({ json: { stations: 81_234, tags: 1, clicks: 1, languages: 1, countries: 1 } });
    return route.fulfill({ json: [] });
  });
}

test.describe("Settings", () => {
  test.beforeEach(async ({ page }) => {
    await mockDirectory(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("flyout opens with data, language, quality and style sections, no tabs", async ({ page }) => {
    await page.locator("header").getByRole("button", { name: "Settings" }).click();
    const panel = page.getByRole("dialog", { name: "Settings" });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("tab")).toHaveCount(0);
    await expect(panel.getByRole("button", { name: "Data" })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Languages" })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Quality" })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Audio" })).toBeVisible();
    await expect(panel.getByRole("heading", { name: "Style" })).toBeVisible();
    await expect(panel.getByRole("button", { name: "System" })).toHaveAttribute("aria-pressed", "true");
  });

  test("quality filter hides stations below the minimum bitrate", async ({ page }) => {
    await expect(page.getByText("Test Jazz FM").first()).toBeVisible();
    await page.locator("header").getByRole("button", { name: "Settings" }).click();
    const panel = page.getByRole("dialog", { name: "Settings" });
    await panel.getByRole("button", { name: "Quality" }).click();
    await panel.getByRole("button", { name: "128 kbps+" }).click();
    await expect(panel.getByText("Only 128 kbps+ streams")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByText("Test Jazz FM").first()).toBeVisible();
    await page.locator("header").getByRole("button", { name: "Settings" }).click();
    await panel.getByRole("button", { name: "Quality" }).click();
    await panel.getByRole("button", { name: "192 kbps+" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByText("Test Jazz FM")).toHaveCount(0);
  });

  test("leveling switch flips and persists", async ({ page }) => {
    await page.locator("header").getByRole("button", { name: "Settings" }).click();
    const panel = page.getByRole("dialog", { name: "Settings" });
    await panel.getByRole("button", { name: "Audio" }).click();
    const toggle = panel.getByRole("switch", { name: "Level volume across stations" });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(panel.getByRole("button", { name: "Audio" })).toContainText("On");
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.locator("header").getByRole("button", { name: "Settings" }).click();
    const reopened = page.getByRole("dialog", { name: "Settings" });
    await reopened.getByRole("button", { name: "Audio" }).click();
    await expect(reopened.getByRole("switch", { name: "Level volume across stations" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await reopened.getByRole("switch", { name: "Level volume across stations" }).click();
    await expect(reopened.getByRole("switch", { name: "Level volume across stations" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });
  test("flyout also opens from the home logo", async ({ page }) => {
    await page.locator("header").getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  });

  test("data section exports radio backup as JSON", async ({ page }) => {
    await page.locator("header").getByRole("button", { name: "Settings" }).click();
    const panel = page.getByRole("dialog", { name: "Settings" });
    await panel.getByRole("button", { name: "Data" }).click();
    const downloadPromise = page.waitForEvent("download");
    await panel.getByRole("button", { name: "Export radio data" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^radioscout-backup-\d{4}-\d{2}-\d{2}\.json$/);
  });

  test("data section restores radio backup from JSON", async ({ page }) => {
    await page.locator("header").getByRole("button", { name: "Settings" }).click();
    const panel = page.getByRole("dialog", { name: "Settings" });
    await panel.getByRole("button", { name: "Data" }).click();
    await panel.locator('input[type="file"]').setInputFiles("tests/fixtures/radio-backup.json");
    await expect(panel.getByText("Restore complete — your stations are back.")).toBeVisible();
  });

  test("theme choice applies to the document", async ({ page }) => {
    await page.locator("header").getByRole("button", { name: "Settings" }).click();
    const panel = page.getByRole("dialog", { name: "Settings" });
    await panel.getByRole("button", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await panel.getByRole("button", { name: "Light" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });

  test("command palette navigates home", async ({ page }) => {
    await page.locator("header").getByRole("button", { name: "Quick find" }).click();
    await page.getByLabel("Search Scout").fill("Home");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/");
  });
});
