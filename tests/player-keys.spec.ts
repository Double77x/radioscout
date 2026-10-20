import { test, expect, type Page } from "@playwright/test";

const STATION = {
  stationuuid: "cccccccc-3333-3333-3333-333333333333",
  name: "Keys FM",
  url: "https://example.com/keys.mp3",
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
};

/** Deterministic single-station directory — never hits the live servers. */
async function mockDirectory(page: Page) {
  await page.route(/https:\/\/.*\.api\.radio-browser\.info\/.*/, (route) => {
    const url = route.request().url();
    if (url.includes("/json/stats"))
      return route.fulfill({ json: { stations: 81_234, tags: 1, clicks: 1, languages: 1, countries: 1 } });
    return route.fulfill({ json: [STATION] });
  });
}

test.describe("Player volume keys", () => {
  test.beforeEach(async ({ page }) => {
    await mockDirectory(page);
    await page.route(STATION.url, (route) =>
      route.fulfill({ path: "tests/fixtures/silence-30s.wav", contentType: "audio/wav" }),
    );
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.locator(`button[aria-label="Play ${STATION.name}"]`).first().click();
    await expect(page.locator(`button[aria-label="Pause ${STATION.name}"]`).first()).toBeVisible({ timeout: 15_000 });
    // Fresh install: the dock mirrors the stored default volume.
    await expect(page.locator("#dock-volume")).toHaveValue("25");
  });

  test("a tap nudges one percent and reveals the overlay", async ({ page }) => {
    const volumeButton = page.getByRole("button", { name: "Volume", exact: true });
    await expect(volumeButton).toHaveAttribute("aria-expanded", "false");

    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#dock-volume")).toHaveValue("26");
    await expect(volumeButton).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator("#dock-volume")).toHaveValue("24");
  });

  test("a held key keeps stepping one percent per repeat", async ({ page }) => {
    await page.keyboard.down("ArrowRight");
    await expect(page.locator("#dock-volume")).toHaveValue("26");
    // A second `down` without an `up` is the OS repeat, i.e. a hold. The step
    // stays 1%: the repeat rate alone makes a hold move quickly.
    await page.keyboard.down("ArrowRight");
    await expect(page.locator("#dock-volume")).toHaveValue("27");
    await page.keyboard.up("ArrowRight");
  });

  test("arrows typed into search leave the volume alone", async ({ page }) => {
    await page.getByTestId("radio-search").click();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#dock-volume")).toHaveValue("25");
  });

  test("a focused slider keeps its own step, with no double-step", async ({ page }) => {
    const volumeButton = page.getByRole("button", { name: "Volume", exact: true });
    await volumeButton.click();
    await page.locator("#dock-volume").focus();

    await page.keyboard.down("ArrowRight");
    await expect(page.locator("#dock-volume")).toHaveValue("26");
    // The input owns the key while focused: one native step per event, with no
    // second step from the dock's global binding.
    await page.keyboard.down("ArrowRight");
    await expect(page.locator("#dock-volume")).toHaveValue("27");
    await page.keyboard.up("ArrowRight");
    await expect(volumeButton).toHaveAttribute("aria-expanded", "true");
  });
});
