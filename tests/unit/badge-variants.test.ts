import { describe, expect, it } from "vitest";
import { badgeVariants } from "@/components/ui/badge-variants";

describe("badgeVariants", () => {
  it("applies the base classes", () => {
    expect(badgeVariants()).toContain("inline-flex items-center rounded-full border");
  });

  it("uses the default variant when none provided", () => {
    expect(badgeVariants()).toContain("bg-primary text-primary-foreground");
  });

  it("applies the secondary variant", () => {
    expect(badgeVariants({ variant: "secondary" })).toContain("bg-secondary text-secondary-foreground");
  });

  it("applies the outline variant", () => {
    expect(badgeVariants({ variant: "outline" })).toContain("text-foreground");
  });
});
