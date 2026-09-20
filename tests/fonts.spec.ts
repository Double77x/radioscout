import { test, expect } from "@playwright/test";

test("fonts: critical weights are preloaded with correct attributes", async ({ page }) => {
  await page.goto("/graph");
  await page.waitForLoadState("networkidle");

  const preloads = await page.evaluate(() =>
    [...document.querySelectorAll('link[rel="preload"][as="font"]')].map((l) => ({
      href: l.getAttribute("href"),
      as: l.getAttribute("as"),
      type: l.getAttribute("type"),
      crossorigin: l.getAttribute("crossorigin"),
    })),
  );

  // Should have at least 2 critical weights preloaded in initial HTML (now in index.html)
  expect(preloads.length).toBeGreaterThanOrEqual(2);
  for (const p of preloads) {
    expect(p.as).toBe("font");
    expect(p.type).toBe("font/woff2");
    // crossorigin must be present (anonymous) for font preload to be used
    expect(p.crossorigin).not.toBeNull();
    expect(p.href).toMatch(/poppins-.*\.woff2/);
  }
});

test("fonts: no unused preload warning - fonts are actually used", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  // Check that Poppins is the computed font for the heading
  const font = await page.evaluate(() => {
    const h1 = document.querySelector("h1");
    return h1 ? getComputedStyle(h1).fontFamily : "";
  });
  expect(font).toMatch(/Poppins/i);
});
