import { test, expect, type Page } from "@playwright/test";

const STATION_A = {
  stationuuid: "aaaaaaaa-1111-1111-1111-111111111111",
  name: "Handoff A FM",
  url: "https://example.com/handoff-a.mp3",
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

const STATION_B = {
  stationuuid: "bbbbbbbb-2222-2222-2222-222222222222",
  name: "Handoff B FM",
  url: "https://example.com/handoff-b.mp3",
  url_resolved: "",
  homepage: "",
  favicon: "",
  tags: "rock",
  country: "Testland",
  countrycode: "TT",
  state: "",
  language: "english",
  codec: "MP3",
  bitrate: 128,
  hls: 0,
  votes: 9,
  clickcount: 4,
  clicktrend: 0,
  lastcheckok: 1,
};

/** Deterministic two-station directory — never hits the live servers. */
async function mockDirectory(page: Page) {
  await page.route(/https:\/\/.*\.api\.radio-browser\.info\/.*/, (route) => {
    const url = route.request().url();
    if (url.includes("/json/stats"))
      return route.fulfill({ json: { stations: 81_234, tags: 1, clicks: 1, languages: 1, countries: 1 } });
    return route.fulfill({ json: [STATION_A, STATION_B] });
  });
}

test.describe("Station handoff", () => {
  test.beforeEach(async ({ page }) => {
    await mockDirectory(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("switching blends to the new station with no error", async ({ page }) => {
    for (const url of ["https://example.com/handoff-a.mp3", "https://example.com/handoff-b.mp3"]) {
      await page.route(url, (route) =>
        route.fulfill({ path: "tests/fixtures/silence-30s.wav", contentType: "audio/wav" }),
      );
    }
    await expect(page.getByText("Handoff A FM").first()).toBeVisible();
    await page.locator('button[aria-label="Play Handoff A FM"]').first().click();
    await expect(page.locator('button[aria-label="Pause Handoff A FM"]').first()).toBeVisible({ timeout: 15_000 });

    // Tapping B stages a preload while A keeps playing, then blends over.
    await page.locator('button[aria-label="Play Handoff B FM"]').first().click();
    await expect(page.locator('button[aria-label="Pause Handoff B FM"]').first()).toBeVisible({ timeout: 15_000 });
    const dock = page.getByRole("region", { name: "Player" });
    await expect(dock.getByText("Handoff B FM")).toBeVisible();
  });

  test("a failed switch keeps the old station playing", async ({ page }) => {
    await page.route("https://example.com/handoff-a.mp3", (route) =>
      route.fulfill({ path: "tests/fixtures/silence-30s.wav", contentType: "audio/wav" }),
    );
    await page.route("https://example.com/handoff-b.mp3", (route) => route.abort());
    await expect(page.getByText("Handoff A FM").first()).toBeVisible();
    await page.locator('button[aria-label="Play Handoff A FM"]').first().click();
    await expect(page.locator('button[aria-label="Pause Handoff A FM"]').first()).toBeVisible({ timeout: 15_000 });

    // B fails during preload: A never stops, the dock reverts, a toast names it.
    await page.locator('button[aria-label="Play Handoff B FM"]').first().click();
    await expect(page.getByText("Couldn't start that station")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('button[aria-label="Pause Handoff A FM"]').first()).toBeVisible();
    const dock = page.getByRole("region", { name: "Player" });
    await expect(dock.getByText("Handoff A FM")).toBeVisible();
  });
});
