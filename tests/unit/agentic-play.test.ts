import { describe, expect, it } from "vitest";
import { normalizeAlias, resolveAlias } from "@/data/station-aliases";
import { parsePlayRequest } from "@/hooks/use-agentic-play";

describe("normalizeAlias", () => {
  it("lowercases and hyphenates names", () => {
    expect(normalizeAlias("BBC Radio 1")).toBe("bbc-radio-1");
    expect(normalizeAlias("  Kisstory ")).toBe("kisstory");
    expect(normalizeAlias("Radio_X")).toBe("radio-x");
  });

  it("strips diacritics and punctuation", () => {
    expect(normalizeAlias("Café del Mar!")).toBe("cafe-del-mar");
  });

  it("renders empty input as empty", () => {
    expect(normalizeAlias("   ")).toBe("");
  });
});

describe("resolveAlias", () => {
  it("resolves curated stations case-insensitively", () => {
    expect(resolveAlias("kisstory")).toBe("Kisstory");
    expect(resolveAlias("KISSTORY")).toBe("Kisstory");
    expect(resolveAlias("bbc radio 1")).toBe("BBC Radio 1");
    expect(resolveAlias("bbc-radio-1")).toBe("BBC Radio 1");
  });

  it("resolves natural directory names from user favourites", () => {
    expect(resolveAlias("BBC Radio 4 Extra")).toBe("BBC Radio 4 Extra");
    expect(resolveAlias("BBC Radio 6 Music")).toBe("BBC Radio 6 Music");
    expect(resolveAlias("BBC Radio 1 Anthems")).toBe("BBC Radio 1 Anthems");
    expect(resolveAlias("BBC Radio 1 Dance")).toBe("BBC Radio 1 Dance");
    expect(resolveAlias("BBC Live News")).toBe("BBC Live News");
    expect(resolveAlias("KISSTORY R&B")).toBe("KISSTORY R&B");
    expect(resolveAlias("kisstory-rnb")).toBe("KISSTORY R&B");
    expect(resolveAlias("Capital FM London")).toBe("Capital FM");
    expect(resolveAlias("Heart 80s")).toBe("Heart 80s");
    expect(resolveAlias("Smooth Chill")).toBe("Smooth Chill");
    expect(resolveAlias("Dance Wave!")).toBe("Dance Wave");
    expect(resolveAlias("Gold")).toBe("Gold");
    expect(resolveAlias("MANGORADIO")).toBe("MANGORADIO");
  });

  it("returns null for unknown names and blanks", () => {
    expect(resolveAlias("some-obscure-pirate")).toBeNull();
    expect(resolveAlias("   ")).toBeNull();
  });
});

describe("parsePlayRequest", () => {
  const UUID = "123e4567-e89b-12d3-a456-426614174000";

  it("returns none when no play param", () => {
    expect(parsePlayRequest("?q=kisstory")).toEqual({ kind: "none", value: "", keepStation: false });
    expect(parsePlayRequest("")).toEqual({ kind: "none", value: "", keepStation: false });
  });

  it("plays an exact uuid from ?play=", () => {
    expect(parsePlayRequest(`?play=${UUID}`)).toEqual({ kind: "uuid", value: UUID, keepStation: false });
  });

  it("plays the sheet station for ?station=&play=1", () => {
    expect(parsePlayRequest(`?station=${UUID}&play=1`)).toEqual({ kind: "uuid", value: UUID, keepStation: true });
    expect(parsePlayRequest(`?station=${UUID}&play=true`)).toEqual({
      kind: "uuid",
      value: UUID,
      keepStation: true,
    });
  });

  it("treats alias and free-text values as search", () => {
    expect(parsePlayRequest("?play=kisstory")).toEqual({ kind: "search", value: "kisstory", keepStation: false });
    expect(parsePlayRequest("?play=BBC%20Radio%201")).toEqual({
      kind: "search",
      value: "BBC Radio 1",
      keepStation: false,
    });
  });
});
