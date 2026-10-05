import { describe, expect, it } from "vite-plus/test";
import indexCss from "@/styles/index.css?raw";
import { FLAVORS } from "@/lib/theme";

/**
 * Every flavour block must define the full SHADCN token set for both
 * schemes — a missing token silently inherits the default palette and the
 * theme reads as broken halfway down the page. Mechanical check, so a typo
 * in a variable name fails here instead of in a screenshot.
 */
const TOKENS = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "border",
  "input",
  "ring",
  "logo-tile",
  "surface-1",
  "surface-2",
  "surface-3",
] as const;

function blockFor(css: string, selector: string): string {
  const start = css.indexOf(selector);
  if (start === -1) return "";
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css.slice(open, close);
}

describe("flavour token completeness", () => {
  const css: string = indexCss;
  for (const flavor of FLAVORS) {
    if (flavor === "default") continue;
    for (const selector of [`:root[data-flavor="${flavor}"]`, `.dark[data-flavor="${flavor}"]`] as const) {
      it(`${flavor} ${selector.startsWith(".dark") ? "dark" : "light"} defines every token`, () => {
        const block = blockFor(css, selector);
        expect(block).not.toBe("");
        for (const token of TOKENS) {
          expect(block.includes(`--${token}:`), `${selector} is missing --${token}`).toBe(true);
        }
      });
    }
  }
});
