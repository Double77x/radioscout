import { test, expect } from "@playwright/test";

// Temporary verification for quick-resume: play -> reload -> paused, no hydration errors.

const STATION = {
  stationuuid: "44444444-4444-4444-4444-444444444444",
  name: "Resume FM",
  url: "https://example.com/resume.mp3",
  url_resolved: "https://example.com/resume.mp3",
  homepage: "",
  favicon: "",
  tags: "test",
  country: "Testland",
  countrycode: "TT",
  state: "",
  language: "english",
  codec: "MP3",
  bitrate: 128,
  hls: 0,
  votes: 5,
  clickcount: 1,
  clicktrend: 0,
  lastcheckok: 1,
};

test("quick resume returns paused after reload", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") problems.push(msg.text().slice(0, 400));
  });
  page.on("pageerror", (err) => problems.push(String(err).slice(0, 400)));
  await page.route(/https:\/\/.*\.api\.radio-browser\.info\/.*/, (route) => route.fulfill({ json: [STATION] }));
  // Stream bytes from a committed fixture via fulfill({ path }): fully
  // Range-correct without any Node globals (specs are DOM-typed, so no
  // Buffer). The resolver is left unmocked so play() falls back to the
  // row's own https URL, exactly like production.
  await page.route("https://example.com/resume.mp3", (route) =>
    route.fulfill({ path: "tests/fixtures/silence-30s.wav", contentType: "audio/wav" }),
  );

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator('button[aria-label="Play Resume FM"]').first().click();
  await expect(page.locator('button[aria-label="Pause Resume FM"]').first()).toBeVisible({ timeout: 15_000 });
  const stored = await page.evaluate(() => globalThis.localStorage.getItem("radioscout:last-station"));
  expect(stored ?? "").toContain("Resume FM");

  await page.reload({ waitUntil: "domcontentloaded" });
  // Restored paused: dock offers Play (not Pause) with a "Paused" subtitle.
  await expect(page.locator('button[aria-label="Play Resume FM"]').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Resume FM").first()).toBeVisible();
  const dockRegion = page.getByRole("region", { name: "Player" });
  await expect(dockRegion.getByText("Paused")).toBeVisible();

  // Resume playback from the restored row.
  await page.locator('button[aria-label="Play Resume FM"]').first().click();
  await expect(page.locator('button[aria-label="Pause Resume FM"]').first()).toBeVisible({ timeout: 15_000 });

  const hydration = problems.filter((t) => /hydrat|Minified React|418|useState is not defined/i.test(t));
  expect(hydration).toEqual([]);
});
