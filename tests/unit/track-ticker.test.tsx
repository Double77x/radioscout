// @vitest-environment jsdom
import { describe, expect, it } from "vite-plus/test";
import { render, screen } from "@testing-library/react";
import { TrackTicker } from "@/components/radio/TrackTicker";

describe("TrackTicker", () => {
  it("renders text exactly once, statically, when nothing overflows", () => {
    render(<TrackTicker text='Ken Peel - Groundhog Day' className='text-xs' />);
    // getByText throws on zero or multiple matches: proves the single,
    // non-duplicated static render (jsdom has no layout, so the marquee
    // path cannot trigger here).
    expect(screen.getByText("Ken Peel - Groundhog Day")).toBeVisible();
  });
});
