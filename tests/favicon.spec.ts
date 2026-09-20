import { test } from "@playwright/test";

/** Short hex digest without node:crypto (browser-native Web Crypto). */
async function digest(bytes: Uint8Array): Promise<string> {
  const copy = Uint8Array.from(bytes);
  const hash = await crypto.subtle.digest("SHA-256", copy);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

/** The SVG mark is adaptive (`prefers-color-scheme` in `public/favicon.svg`) —
//  fail if a future edit renders it identically in both schemes. Compared
//  within one run, so no cross-machine pixel baseline to go stale. */
test("favicon adapts to the color scheme", async ({ browser }) => {
  const digests: Record<string, string> = {};
  for (const scheme of ["light", "dark"] as const) {
    const context = await browser.newContext({ colorScheme: scheme });
    const page = await context.newPage();
    await page.goto("/favicon.svg");
    await page.waitForLoadState("networkidle");
    const shot = await page.screenshot();
    digests[scheme] = await digest(shot);
    await context.close();
  }
  test.expect(digests.light === digests.dark, "favicon renders identically in light and dark").toBe(false);
});
