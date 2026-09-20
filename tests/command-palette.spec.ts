import { test, expect } from "@playwright/test";

test.describe("Quick Find Command Palette (TanStack Hotkeys)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("opens via Quick find button in the header", async ({ page }) => {
    const searchBtn = page.getByRole("button", { name: "Quick find" }).first();
    await expect(searchBtn).toBeVisible();
    await searchBtn.click();

    const input = page.getByPlaceholder("Type a command or search...");
    await expect(input).toBeVisible();
    await expect(page.getByRole("button", { name: /Home/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Changelog/i })).toBeVisible();
  });

  test("opens via keyboard shortcut Mod+K and closes via Escape", async ({ page }) => {
    await page.keyboard.press("Control+k");
    const input = page.getByPlaceholder("Type a command or search...");
    await expect(input).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(input).toBeHidden();
  });

  test("filters sections with fuzzy search and navigates with keyboard", async ({ page }) => {
    await page.keyboard.press("Control+k");
    const input = page.getByPlaceholder("Type a command or search...");
    await expect(input).toBeVisible();

    // Type query
    await input.fill("home");
    const item = page.getByRole("button", { name: /Home/i }).first();
    await expect(item).toBeVisible();

    // Press Enter to navigate
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/");
  });

  test("cycles through items with ArrowDown and ArrowUp keys", async ({ page }) => {
    await page.keyboard.press("Control+k");
    const input = page.getByPlaceholder("Type a command or search...");
    await expect(input).toBeVisible();

    const items = page.locator("[data-selected]");
    await expect(items.nth(0)).toHaveAttribute("data-selected", "true");

    // Arrow down to 2nd item
    await page.keyboard.press("ArrowDown");
    await expect(items.nth(1)).toHaveAttribute("data-selected", "true");
    await expect(items.nth(0)).toHaveAttribute("data-selected", "false");

    // Arrow down to 3rd item
    await page.keyboard.press("ArrowDown");
    await expect(items.nth(2)).toHaveAttribute("data-selected", "true");

    // Arrow up back to 2nd item
    await page.keyboard.press("ArrowUp");
    await expect(items.nth(1)).toHaveAttribute("data-selected", "true");
  });
});
