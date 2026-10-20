import { describe, expect, it } from "vite-plus/test";
import {
  ROW_GAP,
  arrayMoveId,
  overIndexFor,
  resolveDrop,
  rowOuterStyle,
  topOfOrder,
  type DragState,
} from "@/lib/radio/drag-reorder";

const state: DragState = {
  id: "b",
  fromIndex: 1,
  startY: 100,
  ids: ["a", "b", "c"],
  tops: [0, 58, 126],
  heights: [50, 60, 50],
};

describe("drag reorder geometry", () => {
  it("finds the landing gap, skipping the dragged row", () => {
    expect(overIndexFor(10, 0, state, 3)).toBe(0);
    expect(overIndexFor(500, 0, state, 3)).toBe(3);
  });

  it("lands before the first row when the pointer is above it", () => {
    const fromLast: DragState = { ...state, id: "c", fromIndex: 2 };
    expect(overIndexFor(10, 0, fromLast, 3)).toBe(0);
  });

  it("moves an id into the requested gap", () => {
    expect(arrayMoveId(["a", "b", "c"], 0, 2)).toEqual(["b", "a", "c"]);
    expect(arrayMoveId(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(arrayMoveId(["a", "b", "c"], 1, 2)).toEqual(["a", "b", "c"]);
  });

  it("measures the top of an id in a proposed order", () => {
    expect(topOfOrder(["c", "a", "b"], "a", state)).toBe(50 + ROW_GAP);
    expect(topOfOrder(["c", "a", "b"], "b", state)).toBe(50 + ROW_GAP + 50 + ROW_GAP);
  });

  it("resolves a drop into the committed order and settle offset", () => {
    expect(resolveDrop(state, 100, 0, ["a", "b", "c"], 3, 0)).toEqual({
      order: ["a", "c", "b"],
      settleDy: 58 - (50 + ROW_GAP + 50 + ROW_GAP),
    });
  });

  it("returns null when the dragged id left the list", () => {
    expect(resolveDrop({ ...state, id: "gone" }, 100, 0, ["a", "b", "c"], 3, 0)).toBeNull();
  });

  it("styles each visual state without mixing transforms", () => {
    expect(rowOuterStyle({ dragging: true, dragDy: 12, settleDy: null, shift: 0, frozen: false })).toMatchObject({
      translate: "0 12px",
      zIndex: 10,
    });
    expect(rowOuterStyle({ dragging: false, dragDy: 0, settleDy: null, shift: 8, frozen: false })).toEqual({
      translate: "0 8px",
    });
    expect(rowOuterStyle({ dragging: false, dragDy: 0, settleDy: null, shift: 0, frozen: true })).toEqual({
      transitionProperty: "none",
    });
    expect(rowOuterStyle({ dragging: false, dragDy: 0, settleDy: null, shift: 0, frozen: false })).toBeUndefined();
  });
});
