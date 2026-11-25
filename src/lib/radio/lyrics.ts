/**
 * Full-song lyrics for the current StreamTitle, timing stripped and grouped
 * into stanzas.
 *
 * Untimed on purpose. A radio stream carries no playback position, titles
 * arrive a poll late, and the audio sits behind the station's encoder — no
 * client measurement can put a cursor on the line. What the timing can say
 * honestly is where the singer pauses: a gap between timestamps ends a stanza,
 * and the block renders those gaps as spacing instead of a scrolling karaoke
 * bar.
 */

/** One timed lyric line, in seconds from the start of the track. */
export interface LyricLine {
  at: number;
  text: string;
}

/** One stanza: the lines sung together, in order. */
export type LyricStanza = readonly string[];

/**
 * Silence between two timestamps that starts a new stanza, in seconds. Eight,
 * not four: in LRCLIB's own data, consecutive lines of one verse sit five or
 * six seconds apart, and a tighter gap shattered every verse into one-line
 * stanzas. Long instrumentals are what this is meant to catch.
 */
export const STANZA_GAP_SECONDS = 8;

const LRC_TIMESTAMP = /\[(?<minutes>\d{1,3}):(?<seconds>\d{2})(?:[.:](?<fraction>\d{1,3}))?\]/g;

/**
 * Parse an LRC document into sorted, non-empty timed lines. Metadata rows
 * (`[ar:…]`, `[ti:…]`) carry no numeric timestamp and drop out; a row may
 * carry several timestamps, one line each.
 */
export function parseLrc(raw: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const row of raw.split(/\r?\n/)) {
    const stamps = [...row.matchAll(LRC_TIMESTAMP)];
    if (stamps.length === 0) continue;
    const text = row.replaceAll(LRC_TIMESTAMP, "").trim();
    if (text === "") continue;
    for (const stamp of stamps) {
      const minutes = Number(stamp.groups?.minutes ?? "");
      const seconds = Number(stamp.groups?.seconds ?? "");
      const fractionPart = stamp.groups?.fraction;
      const fraction = fractionPart === undefined ? 0 : Number(fractionPart.padEnd(3, "0")) / 1000;
      if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || !Number.isFinite(fraction)) continue;
      lines.push({ at: minutes * 60 + seconds + fraction, text });
    }
  }
  return lines.toSorted((a, b) => a.at - b.at);
}

/**
 * Stanzas from a synced document: a gap of `gapSeconds` between consecutive
 * stamps ends the stanza, because that is where the singer stopped. The stamps
 * themselves are dropped — they are good enough for spacing, not for following
 * along. A row carrying several stamps (a chorus that recurs) lands in each
 * stanza it belongs to.
 */
export function lrcStanzas(raw: string, gapSeconds: number = STANZA_GAP_SECONDS): LyricStanza[] {
  const stanzas: string[][] = [];
  let current: string[] = [];
  let previousAt: number | null = null;
  for (const line of parseLrc(raw)) {
    if (previousAt !== null && current.length > 0 && line.at - previousAt >= gapSeconds) {
      stanzas.push(current);
      current = [];
    }
    current.push(line.text);
    previousAt = line.at;
  }
  if (current.length > 0) stanzas.push(current);
  return stanzas;
}

/**
 * Stanzas from a plain document: blank lines separate them, the rows inside
 * one keep their order, and runs of blanks collapse to a single break.
 */
export function plainStanzas(raw: string): LyricStanza[] {
  const stanzas: string[][] = [];
  let current: string[] = [];
  for (const row of raw.split(/\r?\n/)) {
    const text = row.trim();
    if (text === "") {
      if (current.length > 0) {
        stanzas.push(current);
        current = [];
      }
      continue;
    }
    current.push(text);
  }
  if (current.length > 0) stanzas.push(current);
  return stanzas;
}

/**
 * A line set apart from the lead vocal — a chorus marker (`[Chorus]`) or
 * another singer's interjection (`(Ooh, yeah)`). The block sets these in
 * italics and a lighter tone so the lead line still leads.
 */
export function isBracketLine(text: string): boolean {
  const first = text.trimStart().charAt(0);
  return first === "(" || first === "[";
}
