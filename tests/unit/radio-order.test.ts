import { describe, expect, it } from "vitest";
import { formatCountryName, formatTags } from "@/lib/radio/format";

describe("formatTags", () => {
  it("spaces commas and capitalises each tag", () => {
    expect(formatTags("christian,christian music,contemporary christian,jesus")).toBe(
      "Christian, Christian music, Contemporary christian, Jesus",
    );
  });

  it("drops empties", () => {
    expect(formatTags("rock,, pop ,")).toBe("Rock, Pop");
  });
});

describe("formatCountryName", () => {
  it("prefers the ISO short name over the verbose raw string", () => {
    expect(formatCountryName("The United Kingdom Of Great Britain And Northern Ireland", "GB")).toBe("United Kingdom");
    expect(formatCountryName("The United States Of America", "US")).toBe("United States");
    expect(formatCountryName("Deutschland", "DE")).toBe("Germany");
  });

  it("tidies raw text when the code is missing", () => {
    expect(formatCountryName("The Netherlands", "")).toBe("Netherlands");
  });
});
