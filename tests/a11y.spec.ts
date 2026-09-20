import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Let staggered enter animations finish before auditing: axe blends the
 * mid-animation opacity into its contrast math, so scanning early reports
 * transient 4.2s for text that rests at 5.1+. The audit target is the
 * resting state. Resolves instantly on routes without enter animations.
 */
async function settleEnterAnimations(page: Page) {
  await page.waitForFunction(
    () => [...document.querySelectorAll(".animate-scout-enter")].every((el) => getComputedStyle(el).opacity === "1"),
    undefined,
    { timeout: 10_000 },
  );
}

const routes = ["/", "/legal/privacy", "/legal/terms", "/legal/cookies", "/legal/security", "/legal/changelog"];

for (const path of routes) {
  test(`a11y: ${path} has no serious violations`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await settleEnterAnimations(page);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .exclude(".visually-hidden")
      .analyze();

    const serious = results.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""));
    if (serious.length > 0) {
      console.log(JSON.stringify(serious, null, 2));
    }
    expect(serious, `a11y violations on ${path}: ${serious.map((v) => v.id).join(", ")}`).toEqual([]);
  });
}

test("a11y: dark mode has no serious violations", async ({ page }) => {
  test.setTimeout(60_000);
  for (const path of ["/", "/radio"]) {
    await page.goto(path);
    await page.emulateMedia({ colorScheme: "dark" });
    await page.waitForLoadState("networkidle");
    await settleEnterAnimations(page);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .exclude(".visually-hidden")
      .analyze();

    const serious = results.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""));
    if (serious.length > 0) {
      console.log(path, JSON.stringify(serious, null, 2));
    }
    expect(serious, `dark a11y violations on ${path}: ${serious.map((v) => v.id).join(", ")}`).toEqual([]);
  }
});

test("a11y: switches have accessible names", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  // Scout home has no switches today; if none, skip gracefully
  const switches = page.getByRole("switch");
  const count = await switches.count();
  if (count === 0) return;
  for (let i = 0; i < count; i++) {
    const s = switches.nth(i);
    await expect(s).toHaveAttribute("aria-checked", /true|false/);
    const name = await s.evaluate(
      (el) =>
        (el as HTMLElement).textContent || el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || "",
    );
    const labelledBy = await s.getAttribute("aria-labelledby");
    const ariaLabel = await s.getAttribute("aria-label");
    const hasName = Boolean(name) || Boolean(labelledBy) || Boolean(ariaLabel);
    expect(
      hasName || (await s.evaluate((el) => Boolean(document.querySelector(`label[for="${el.id}"]`)))),
    ).toBeTruthy();
  }
});
