import { test, expect } from "@playwright/test";

test.describe("Route smoke tests", () => {
  test("home page renders the radio sections", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "On air." })).toBeVisible();
    await expect(page.getByRole("button", { name: /Saved/ }).first()).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
  });

  test("stations browser lives on the home page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "On air." })).toBeVisible();
  });

  for (const route of [
    { path: "/legal/privacy", title: "Privacy Policy" },
    { path: "/legal/terms", title: "Terms of Service" },
    { path: "/legal/cookies", title: "Cookie Policy" },
    { path: "/legal/security", title: "Security" },
    { path: "/legal/changelog", title: "Changelog" },
  ]) {
    test(`legal page ${route.path} renders ${route.title}`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page.getByRole("heading", { level: 1, name: route.title })).toBeVisible();
      await expect(page.getByRole("region", { name: "Player" })).toBeVisible();
    });
  }

  test("unknown route renders the not-found page", async ({ page }) => {
    await page.goto("/this-route-does-not-exist");
    await expect(page.getByText("404", { exact: true }).first()).toBeVisible();
  });
});
