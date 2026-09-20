import { describe, expect, it } from "vitest";
import { buttonVariants } from "@/components/ui/button-variants";

describe("buttonVariants", () => {
  it("applies the base classes", () => {
    expect(buttonVariants()).toContain("inline-flex items-center justify-center");
  });

  it("uses default variants when none provided", () => {
    const result = buttonVariants();
    expect(result).toContain("bg-primary text-primary-foreground");
    expect(result).toContain("h-10 px-4 py-2");
  });

  it("applies the destructive variant", () => {
    expect(buttonVariants({ variant: "destructive" })).toContain("bg-destructive text-destructive-foreground");
  });

  it("applies the size variant", () => {
    expect(buttonVariants({ size: "sm" })).toContain("h-9 rounded-md px-3");
  });

  it("combines variant and size", () => {
    const result = buttonVariants({ variant: "outline", size: "lg" });
    expect(result).toContain("border-hairline-inset bg-surface-2");
    expect(result).toContain("h-11 rounded-md px-8");
  });
});
