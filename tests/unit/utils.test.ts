import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("joins truthy class names with a space", () => {
    expect(cn("underline", "italic", "font-bold")).toBe("underline italic font-bold");
  });

  it("ignores falsy values", () => {
    expect(cn("underline", undefined, null, false, "italic", 0)).toBe("underline italic");
  });

  it("accepts arrays and nested arrays", () => {
    expect(cn(["underline", "italic"], "font-bold")).toBe("underline italic font-bold");
  });

  it("merges conflicting tailwind classes, keeping the last", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("keeps distinct utility classes", () => {
    expect(cn("text-red-500", "bg-blue-500")).toBe("text-red-500 bg-blue-500");
  });

  it("handles conditional objects", () => {
    expect(cn("bg-red-500", { "font-bold": true, hidden: false })).toBe("bg-red-500 font-bold");
  });

  it("returns an empty string for no inputs", () => {
    expect(cn()).toBe("");
  });
});
