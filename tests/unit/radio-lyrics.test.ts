import { describe, expect, it } from "vite-plus/test";
import { isBracketLine, lrcStanzas, parseLrc, plainStanzas } from "@/lib/radio/lyrics";
import {
  parseRetryAfter,
  pickLyricsRecord,
  recordStanzas,
  splitTrackTitle,
  type LyricsRecord,
} from "@/lib/radio/lrclib";

function record(overrides: Partial<LyricsRecord> = {}): LyricsRecord {
  return {
    trackName: "Risk It All",
    artistName: "Bruno Mars",
    instrumental: false,
    syncedLyrics: "[00:10.00]Line",
    plainLyrics: null,
    ...overrides,
  };
}

describe("isBracketLine", () => {
  it("flags chorus markers and interjections", () => {
    expect(isBracketLine("[Chorus]")).toBe(true);
    expect(isBracketLine("(Ooh, yeah)")).toBe(true);
    expect(isBracketLine("  (Ah-ah)")).toBe(true);
  });

  it("leaves lead lines and plain words alone", () => {
    expect(isBracketLine("I'd risk it all for you")).toBe(false);
    expect(isBracketLine("Chorus")).toBe(false);
    expect(isBracketLine("")).toBe(false);
  });
});

describe("parseRetryAfter", () => {
  it("reads delta-seconds", () => {
    expect(parseRetryAfter("2")).toBe(2000);
    expect(parseRetryAfter("0.5")).toBe(500);
    expect(parseRetryAfter("0")).toBe(0);
  });

  it("reads an HTTP date relative to now", () => {
    const now = Date.parse("2026-11-21T12:00:00Z");
    expect(parseRetryAfter("Fri, 21 Nov 2026 12:00:03 GMT", now)).toBe(3000);
    expect(parseRetryAfter("Fri, 21 Nov 2026 11:59:00 GMT", now)).toBe(0);
  });

  it("falls back when the header is missing, empty or unreadable", () => {
    const fallback = parseRetryAfter(null);
    expect(fallback).toBeGreaterThan(0);
    expect(parseRetryAfter("   ")).toBe(fallback);
    expect(parseRetryAfter("soon")).toBe(fallback);
  });
});

describe("splitTrackTitle", () => {
  it("splits the ICY artist - track shape", () => {
    expect(splitTrackTitle("Bruno Mars - Risk It All")).toEqual({ artist: "Bruno Mars", title: "Risk It All" });
    expect(splitTrackTitle("SALT-N-PEPA - Shoop")).toEqual({ artist: "SALT-N-PEPA", title: "Shoop" });
  });

  it("keeps further separators in the title", () => {
    expect(splitTrackTitle("Artist - Song - Extended Mix")).toEqual({ artist: "Artist", title: "Song - Extended Mix" });
  });

  it("treats a title with no separator as the track alone", () => {
    expect(splitTrackTitle("Just A Song")).toEqual({ artist: null, title: "Just A Song" });
  });

  it("collapses padding and trims a stray artist side", () => {
    expect(splitTrackTitle("  Bruno   Mars  -  Risk   It All  ")).toEqual({
      artist: "Bruno Mars",
      title: "Risk It All",
    });
    expect(splitTrackTitle(" - Shoop")).toEqual({ artist: null, title: "Shoop" });
  });
});

describe("parseLrc", () => {
  it("reads hundredths and milliseconds", () => {
    expect(parseLrc("[00:12.00]Hello\n[01:05.500]World")).toEqual([
      { at: 12, text: "Hello" },
      { at: 65.5, text: "World" },
    ]);
  });

  it("expands a row with several timestamps", () => {
    expect(parseLrc("[00:01.00][00:05.00]Hello")).toEqual([
      { at: 1, text: "Hello" },
      { at: 5, text: "Hello" },
    ]);
  });

  it("drops metadata rows, empty lines and the timestamps themselves", () => {
    expect(parseLrc("[ar:Bruno Mars]\n[00:03.00]   \n[00:04.00]Sung")).toEqual([{ at: 4, text: "Sung" }]);
  });

  it("sorts out-of-order rows", () => {
    expect(parseLrc("[00:09.00]Second\n[00:02.00]First").map((line) => line.text)).toEqual(["First", "Second"]);
  });
});

describe("lrcStanzas", () => {
  it("keeps lines inside the gap in one stanza", () => {
    expect(lrcStanzas("[00:01.00]One\n[00:03.00]Two\n[00:05.00]Three")).toEqual([["One", "Two", "Three"]]);
  });

  it("starts a stanza after a pause of the gap length", () => {
    expect(lrcStanzas("[00:01.00]One\n[00:02.00]Two\n[00:20.00]Three\n[00:21.00]Four")).toEqual([
      ["One", "Two"],
      ["Three", "Four"],
    ]);
  });

  it("reads a custom gap", () => {
    expect(lrcStanzas("[00:01.00]One\n[00:04.00]Two", 2)).toEqual([["One"], ["Two"]]);
  });

  it("repeats a chorus row in every stanza its stamps fall in", () => {
    expect(lrcStanzas("[00:01.00][00:30.00]Chorus\n[00:02.00]Verse")).toEqual([["Chorus", "Verse"], ["Chorus"]]);
  });

  it("returns nothing for a document with no timed rows", () => {
    expect(lrcStanzas("[ar:Someone]\nno stamps here")).toEqual([]);
  });
});

describe("plainStanzas", () => {
  it("splits on blank lines and trims the rows", () => {
    expect(plainStanzas("  First line  \n  Second line\n\n\n  Third\n\nFourth")).toEqual([
      ["First line", "Second line"],
      ["Third"],
      ["Fourth"],
    ]);
  });

  it("drops leading and trailing blanks", () => {
    expect(plainStanzas("\n\n  First\n\n")).toEqual([["First"]]);
  });

  it("returns nothing for blank input", () => {
    expect(plainStanzas("   \n\n  ")).toEqual([]);
    expect(plainStanzas("")).toEqual([]);
  });
});

describe("recordStanzas", () => {
  it("prefers the synced document for its stanza breaks", () => {
    const synced = record({
      syncedLyrics: "[00:01.00]One\n[00:02.00]Two\n[00:20.00]Three",
      plainLyrics: "One\nTwo\nThree",
    });
    expect(recordStanzas(synced)).toEqual([["One", "Two"], ["Three"]]);
  });

  it("takes the synced document even when the plain one lists more lines", () => {
    const sparse = record({ syncedLyrics: "[00:01.00]One", plainLyrics: "One\nTwo\nThree" });
    expect(recordStanzas(sparse)).toEqual([["One"]]);
  });

  it("uses plain when there is no synced document", () => {
    expect(recordStanzas(record({ syncedLyrics: null, plainLyrics: "One\n\nTwo" }))).toEqual([["One"], ["Two"]]);
  });

  it("returns nothing when the record carries no text", () => {
    expect(recordStanzas(record({ syncedLyrics: null, plainLyrics: null }))).toEqual([]);
  });
});

describe("pickLyricsRecord", () => {
  it("picks the exact artist and title", () => {
    const records = [record({ artistName: "Cover Band" }), record()];
    expect(pickLyricsRecord(records, "Bruno Mars - Risk It All")).toEqual(record());
  });

  it("skips instrumentals and records with neither text form", () => {
    const records = [
      record({ instrumental: true }),
      record({ syncedLyrics: null }),
      record({ artistName: "Bruno Mars", syncedLyrics: "[00:01.00]Right" }),
    ];
    expect(pickLyricsRecord(records, "Bruno Mars - Risk It All")?.syncedLyrics).toBe("[00:01.00]Right");
  });

  it("accepts a plain-only record", () => {
    const plain = record({ syncedLyrics: null, plainLyrics: "Sung words" });
    expect(pickLyricsRecord([plain], "Bruno Mars - Risk It All")).toEqual(plain);
  });

  it("matches punctuation and accent variants", () => {
    expect(
      pickLyricsRecord([record({ artistName: "Salt N Pepa", trackName: "Shoop" })], "SALT-N-PEPA - Shoop"),
    ).not.toBeNull();
    expect(
      pickLyricsRecord([record({ artistName: "Café del Mar", trackName: "Song" })], "Cafe del Mar - Song"),
    ).not.toBeNull();
  });

  it("matches a remastered ICY title against the plain database title", () => {
    const records = [record({ trackName: "Risk It All" })];
    expect(pickLyricsRecord(records, "Bruno Mars - Risk It All (Remastered)")).not.toBeNull();
  });

  it("rejects a different artist", () => {
    expect(pickLyricsRecord([record({ artistName: "Someone Else" })], "Bruno Mars - Risk It All")).toBeNull();
  });

  it("takes the first record with text when the title names no artist", () => {
    const records = [record({ artistName: "Whoever" })];
    expect(pickLyricsRecord(records, "Risk It All")).toEqual(records[0]);
  });

  it("returns null for an empty title", () => {
    expect(pickLyricsRecord([record()], "   ")).toBeNull();
  });
});
