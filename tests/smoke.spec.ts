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
  {
    stationuuid: "22222222-2222-2222-2222-222222222222",
    name: "Test Rock FM",
    url: "https://example.com/rock.mp3",
    url_resolved: "",
    homepage: "",
    favicon: "",
    tags: "rock",
    country: "Testland",
    countrycode: "TT",
    state: "",
    language: "english",
    codec: "AAC",
    bitrate: 64,
    hls: 0,
    votes: 7,
    clickcount: 3,
    clicktrend: 0,
    lastcheckok: 1,
  },
];

/** Deterministic station directory — never hits the live radio-browser servers. */
async function mockDirectory(page: Page) {
  await page.route(/https:\/\/.*\.api\.radio-browser\.info\/.*/, (route) => {
    const url = route.request().url();
    if (url.includes("/json/stations/topvote/")) return route.fulfill({ json: STATIONS });
    if (url.includes("/json/stations/search")) {
      const params = new URL(url).searchParams;
      const name = params.get("name") ?? "";
      const tag = params.get("tag") ?? "";
      const rows = STATIONS.filter(
        (station) =>
          (name === "" || station.name.toLowerCase().includes(name.toLowerCase())) &&
          (tag === "" || station.tags.includes(tag)),
      );
      return route.fulfill({ json: rows });
    }
    return route.fulfill({ json: [] });
  });
}

test.describe("RadioScout home", () => {
  test.beforeEach(async ({ page }) => {
    await mockDirectory(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("radio home renders header, search, top stations and player dock", async ({ page }) => {
    await expect(page.getByText("RadioScout · On air")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "On air." })).toBeVisible();
    await expect(page.getByLabel("Search stations by name")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Most loved" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Play Test Jazz FM" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Play Test Rock FM" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Player" })).toBeVisible();
    await expect(page.getByText("Nothing playing")).toBeVisible();
  });

  test("search filters stations from the URL", async ({ page }) => {
    await page.getByLabel("Search stations by name").fill("jazz");
    await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Play Test Jazz FM" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Play Test Rock FM" })).toBeHidden();
    await expect(page).toHaveURL(/q=jazz/);
  });

  test("genre chips filter the list", async ({ page }) => {
    await page.getByRole("link", { name: "Rock", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Play Test Rock FM" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Play Test Jazz FM" })).toBeHidden();
    await expect(page).toHaveURL(/tag=rock/);
  });

  test("genre chips drag to scroll from the chip itself", async ({ page }) => {
    const rail = page.locator("fieldset div").first();
    const chip = page.getByRole("link", { name: "Pop", exact: true });
    const box = await chip.boundingBox();
    if (!box) throw new Error("Pop chip has no bounding box");
    const before = await rail.evaluate((el) => el.scrollLeft);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x - 160, box.y + box.height / 2, { steps: 12 });
    await page.mouse.up();
    // A real drag scrolls instead of navigating.
    await expect.poll(() => rail.evaluate((el) => el.scrollLeft), { timeout: 5000 }).not.toBe(before);
    await expect(page).not.toHaveURL(/tag=pop/);
  });

  test("empty search offers a reset", async ({ page }) => {
    await page.getByLabel("Search stations by name").fill("no such thing here");
    await expect(page.getByText("Nothing matches that")).toBeVisible();
    await page.getByRole("link", { name: "Clear search" }).click();
    await expect(page.getByRole("button", { name: "Play Test Jazz FM" })).toBeVisible();
  });

  test("starring a station pins it to Saved", async ({ page }) => {
    await page.getByRole("button", { name: "Save Test Jazz FM to favourites" }).click();
    await expect(page.getByRole("heading", { name: "Saved" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Play Test Jazz FM" }).first()).toBeVisible();
  });

  test("saved stations reorder by drag handle", async ({ page }) => {
    await page.getByRole("button", { name: "Save Test Rock FM to favourites" }).click();
    await page.getByRole("button", { name: "Save Test Jazz FM to favourites" }).click();
    // Collapse Most loved so only Saved rows are on screen.
    await page.getByRole("button", { name: /Most loved/ }).click();
    const plays = page.getByRole("button", { name: /Play Test (?<station>Jazz|Rock) FM/ });
    await expect(plays.nth(0)).toHaveAttribute("aria-label", "Play Test Jazz FM");
    // Let the save toasts clear — their dismiss shifts the list mid-drag.
    await expect(page.getByText("Saved to favourites")).toHaveCount(0);

    await page.getByRole("button", { name: "Reorder Test Jazz FM" }).hover();
    await page.mouse.down();
    // The grabbed row lifts (scale + shadow) while the drag is active.
    const lifted = page.locator('li[data-uuid="11111111-1111-1111-1111-111111111111"]');
    await expect.poll(() => lifted.evaluate((el) => getComputedStyle(el).scale), { timeout: 5000 }).toBe("1.04");
    const target = await plays.nth(1).boundingBox();
    if (!target) throw new Error("saved Rock row has no bounding box");
    await page.mouse.move(target.x + target.width / 2, target.y + target.height + 48, { steps: 12 });
    // ...and it actually travels with the pointer (independent `translate`
    // property, clear of the mount animation's transform fill).
    await expect
      .poll(() => lifted.evaluate((el) => getComputedStyle(el).translate), { timeout: 5000 })
      .not.toBe("none");
    await page.mouse.up();

    await expect(plays.nth(0)).toHaveAttribute("aria-label", "Play Test Rock FM");
  });

  test("saved stations reorder dragging from the row body", async ({ page }) => {
    await page.getByRole("button", { name: "Save Test Rock FM to favourites" }).click();
    await page.getByRole("button", { name: "Save Test Jazz FM to favourites" }).click();
    await page.getByRole("button", { name: /Most loved/ }).click();
    const plays = page.getByRole("button", { name: /Play Test (?<station>Jazz|Rock) FM/ });
    await expect(plays.nth(0)).toHaveAttribute("aria-label", "Play Test Jazz FM");
    await expect(page.getByText("Saved to favourites")).toHaveCount(0);

    // Press on the row art (not a button, not the grip) and drag down.
    const row = page.locator('li[data-uuid="11111111-1111-1111-1111-111111111111"]');
    const box = await row.boundingBox();
    if (!box) throw new Error("saved Jazz row has no bounding box");
    await page.mouse.move(box.x + 80, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 80, box.y + box.height + 96, { steps: 12 });
    await page.mouse.up();

    await expect(plays.nth(0)).toHaveAttribute("aria-label", "Play Test Rock FM");
  });

  test("player dock renders on home", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("region", { name: "Player" })).toBeVisible();
    await expect(page.getByText("Nothing playing")).toBeVisible();
  });

  test("listening stats render banked sessions as charts", async ({ page }) => {
    // No real audio in headless runs — seed two sessions straight into
    // IndexedDB, then reload so the stats query picks them up.
    await page.evaluate(() => {
      const request = indexedDB.open("scout-radio");
      return new Promise<void>((resolve, reject) => {
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("success", () => {
          const db = request.result;
          const tx = db.transaction("listening", "readwrite");
          const sessions = [
            { stationuuid: "stats-1", name: "Stats FM", started_at: new Date().toISOString(), seconds: 600 },
            { stationuuid: "stats-2", name: "News FM", started_at: new Date().toISOString(), seconds: 300 },
          ];
          for (const session of sessions) tx.objectStore("listening").add(session);
          tx.addEventListener("complete", () => {
            db.close();
            resolve();
          });
          tx.addEventListener("error", () => reject(tx.error));
        });
      });
    });
    await page.reload();
    await page.waitForLoadState("networkidle");
    const section = page.getByRole("button", { name: /Listening/ });
    await expect(section).toBeVisible();
    await section.click();
    await expect(page.getByText("Stats FM")).toBeVisible();
    await expect(page.getByText("News FM")).toBeVisible();
    await page.getByRole("button", { name: "Daily", exact: true }).click();
    await expect(page.getByText("average day")).toBeVisible();
    await expect(page.getByText("Mon", { exact: true })).toBeVisible();
  });

  test("clearing stats asks first and erases the charts", async ({ page }) => {
    await page.evaluate(() => {
      const request = indexedDB.open("scout-radio");
      return new Promise<void>((resolve, reject) => {
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("success", () => {
          const db = request.result;
          const tx = db.transaction("listening", "readwrite");
          tx.objectStore("listening").add({
            stationuuid: "stats-1",
            name: "Stats FM",
            started_at: new Date().toISOString(),
            seconds: 600,
          });
          tx.addEventListener("complete", () => {
            db.close();
            resolve();
          });
          tx.addEventListener("error", () => reject(tx.error));
        });
      });
    });
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /Listening/ }).click();
    await expect(page.getByText("Stats FM")).toBeVisible();
    await page.getByRole("button", { name: "Clear stats" }).click();
    const dialog = page.getByRole("dialog", { name: "Clear stats?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Clear", exact: true }).click();
    await expect(page.getByText("Stats FM")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Listening/ })).toHaveCount(0);
  });

  test("clearing history asks first and empties recently played", async ({ page }) => {
    await page.evaluate(() => {
      const request = indexedDB.open("scout-radio");
      return new Promise<void>((resolve, reject) => {
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("success", () => {
          const db = request.result;
          const tx = db.transaction("history", "readwrite");
          tx.objectStore("history").add({
            stationuuid: "11111111-1111-1111-1111-111111111111",
            snapshot: {
              stationuuid: "11111111-1111-1111-1111-111111111111",
              name: "Test Jazz FM",
              url: "https://example.com/jazz.mp3",
              tags: "jazz",
              country: "Testland",
              countrycode: "TT",
              language: "english",
              codec: "MP3",
              bitrate: 128,
            },
            played_at: new Date().toISOString(),
          });
          tx.addEventListener("complete", () => {
            db.close();
            resolve();
          });
          tx.addEventListener("error", () => reject(tx.error));
        });
      });
    });
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /Recently played/ }).click();
    await page.getByRole("button", { name: "Clear history" }).click();
    const dialog = page.getByRole("dialog", { name: "Clear history?" });
    await expect(dialog).toBeVisible();
    // Backing out keeps everything.
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: /Recently played/ })).toBeVisible();
    await page.getByRole("button", { name: "Clear history" }).click();
    await dialog.getByRole("button", { name: "Clear", exact: true }).click();
    await expect(page.getByRole("button", { name: /Recently played/ })).toHaveCount(0);
  });

  test("station details open in a bottom sheet", async ({ page }) => {
    await page.getByRole("button", { name: "Details for Test Jazz FM" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Test Jazz FM").first()).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Play now" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Share Test Jazz FM" })).toBeVisible();
    await dialog.getByRole("button", { name: "Close details" }).click();
    await expect(dialog).toBeHidden();
  });

  test("voting bumps the count in the sheet", async ({ page }) => {
    await page.getByRole("button", { name: "Details for Test Jazz FM" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Test Jazz FM").first()).toBeVisible();
    await expect(dialog.getByText("10", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Vote +1" }).click();
    await expect(dialog.getByText("11", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Voted ✓" })).toBeDisabled();
  });

  test("dead station links explain instead of stranding", async ({ page }) => {
    await page.goto("/?station=does-not-exist");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Couldn't open that station")).toBeVisible();
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();
  });

  test("opening details keeps the list scroll position", async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, 300));
    const y = await page.evaluate(() => window.scrollY);
    expect(y).toBeGreaterThan(0);
    // A button already fully in view, so the click itself moves nothing —
    // any scroll change comes from the navigation.
    const details = page.getByRole("button", { name: /Details for Test/ });
    const height = await page.evaluate(() => window.innerHeight);
    const count = await details.count();
    let target = null;
    for (let index = 0; index < count; index++) {
      const box = await details.nth(index).boundingBox();
      if (box && box.y >= 0 && box.y + box.height <= height) {
        target = details.nth(index);
        break;
      }
    }
    expect(target).not.toBeNull();
    await target?.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Play now" })).toBeVisible();
    await expect(page).toHaveURL(/station=/);
    // Let the navigation's scroll restoration run before measuring.
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => window.scrollY)).toBe(y);
    await dialog.getByRole("button", { name: "Close details" }).click();
    await expect(dialog).toBeHidden();
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => window.scrollY)).toBe(y);
  });
});

test.describe("Runtime warnings", () => {
  test("hydration emits no snapshot warnings", async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") problems.push(message.text());
    });
    page.on("pageerror", (error) => problems.push(String(error)));
    await mockDirectory(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.goto("/legal/privacy");
    await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL("/");
    const snapshotWarnings = problems.filter((text) => /getServerSnapshot|infinite loop/i.test(text));
    expect(snapshotWarnings).toEqual([]);
  });
});
