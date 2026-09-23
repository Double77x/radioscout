import { describe, expect, it } from "vitest";
import { COMMAND_STATIC_ITEMS, FOOTER_LEGAL_LINKS, FOOTER_PRODUCT_LINKS } from "@/data/navigation";

/**
 * Quick Find registry contract (see ARCHITECTURE.md §1.4): every footer
 * link and every home section must be reachable from the palette.
 * Add the entry in `src/data/navigation.ts` first — this suite fails
 * until the registry, not the test, is updated.
 */
describe("command palette registry", () => {
  it("has unique ids", () => {
    const ids = COMMAND_STATIC_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every item a title, category, icon, synonyms and a destination", () => {
    for (const item of COMMAND_STATIC_ITEMS) {
      expect(item.title.trim()).not.toBe("");
      expect(item.synonyms.length).toBeGreaterThan(0);
      expect(item.icon).toBeDefined();
      expect(item.to ?? item.href).toBeDefined();
    }
  });

  it("exposes every footer link", () => {
    const destinations = new Set(COMMAND_STATIC_ITEMS.map((item) => item.to ?? item.href));
    for (const link of [...FOOTER_PRODUCT_LINKS, ...FOOTER_LEGAL_LINKS]) {
      expect(destinations.has(link.to)).toBe(true);
    }
  });

  it("exposes every home section (add new sections here too)", () => {
    const sections = new Map<string, (typeof COMMAND_STATIC_ITEMS)[number]>();
    for (const item of COMMAND_STATIC_ITEMS) {
      if (item.to?.startsWith("/#home-section-")) {
        sections.set(item.to.slice("/#home-section-".length), item);
      }
    }
    // Mirrors HOME_SECTION_IDS in src/pages/Home.tsx — keep both in sync.
    for (const id of ["saved", "top", "british", "recent", "stats"]) {
      expect(sections.has(id)).toBe(true);
    }
  });
});
