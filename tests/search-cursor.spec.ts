import { expect, test, type Page } from "@playwright/test";

/**
 * The search box is typed into faster than router navigations commit. The
 * box owns a local draft while focused (the URL updates underneath), so a
 * still-committing keystroke can never rewrite the field and yank the
 * cursor — while chips, clear and back/forward still flow in from the URL.
 *
 * These tests wait for the client-rendered station count first: typing into
 * pre-hydration SSR HTML would be wiped by React's first render.
 */
async function readySearch(page: Page) {
  await page.goto("/");
  await expect(page.getByText(/stations ·/)).toBeVisible({ timeout: 20_000 });
  const search = page.getByTestId("radio-search");
  await expect(search).toBeVisible();
  return search;
}

test("rapid mid-string typing keeps the cursor in place", async ({ page }) => {
  const search = await readySearch(page);
  await search.fill("hello");
  await expect(search).toHaveValue("hello");
  await search.press("Home");
  await search.press("ArrowRight");
  await search.press("ArrowRight");
  await search.press("x");
  await search.press("y");
  await search.press("z");
  await expect(search).toHaveValue("hexyzllo");
  const cursor = await search.evaluate((el: HTMLInputElement) => el.selectionStart);
  expect(cursor).toBe(5);
});

test("clear button empties the box", async ({ page }) => {
  const search = await readySearch(page);
  await search.fill("jazz");
  await expect(search).toHaveValue("jazz");
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(search).toHaveValue("");
});

test("genre chip keeps the typed text", async ({ page }) => {
  const search = await readySearch(page);
  await search.fill("jazz");
  await expect(search).toHaveValue("jazz");
  await page.getByRole("link", { name: "News" }).click();
  await expect(search).toHaveValue("jazz");
  await expect(page).toHaveURL(/tag=news/);
});
