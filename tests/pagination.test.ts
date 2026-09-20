import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  clampPage,
  paginate,
  totalPages,
} from "../src/pagination.js";

describe("DEFAULT_PAGE_SIZE", () => {
  it("is 8", () => {
    expect(DEFAULT_PAGE_SIZE).toBe(8);
  });
});

describe("totalPages", () => {
  it("returns at least 1 when there are zero items", () => {
    expect(totalPages(0)).toBe(1);
  });

  it("returns 1 when items fit exactly in one page at default size", () => {
    expect(totalPages(8)).toBe(1);
  });

  it("returns 2 when one item spills past the first page", () => {
    expect(totalPages(9)).toBe(2);
  });
});

describe("clampPage", () => {
  it("clamps below 1 to page 1", () => {
    expect(clampPage(0, 3)).toBe(1);
  });

  it("clamps above totalPages to the last page", () => {
    expect(clampPage(999, 3)).toBe(3);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 17 }, (_, i) => `item-${i + 1}`);

  it("returns the first page slice with default page size", () => {
    const slice = paginate(items, 1);
    expect(slice.items).toEqual(items.slice(0, 8));
    expect(slice.page).toBe(1);
    expect(slice.pageSize).toBe(8);
    expect(slice.totalItems).toBe(17);
    expect(slice.totalPages).toBe(3);
    expect(slice.startIndex).toBe(0);
    expect(slice.endIndex).toBe(8);
  });

  it("returns the last page slice with correct indices", () => {
    const slice = paginate(items, 3);
    expect(slice.items).toEqual(["item-17"]);
    expect(slice.page).toBe(3);
    expect(slice.startIndex).toBe(16);
    expect(slice.endIndex).toBe(17);
  });

  it("clamps out-of-range page numbers", () => {
    const low = paginate(items, 0);
    expect(low.page).toBe(1);
    expect(low.items).toEqual(items.slice(0, 8));

    const high = paginate(items, 999);
    expect(high.page).toBe(3);
    expect(high.items).toEqual(["item-17"]);
  });

  it("uses DEFAULT_PAGE_SIZE when pageSize is zero or negative", () => {
    const zero = paginate(items, 1, 0);
    expect(zero.pageSize).toBe(8);
    expect(zero.items).toHaveLength(8);

    const negative = paginate(items, 1, -5);
    expect(negative.pageSize).toBe(8);
    expect(negative.items).toHaveLength(8);
  });

  it("returns an empty first page for an empty array", () => {
    const slice = paginate([], 1);
    expect(slice.items).toEqual([]);
    expect(slice.page).toBe(1);
    expect(slice.pageSize).toBe(8);
    expect(slice.totalItems).toBe(0);
    expect(slice.totalPages).toBe(1);
    expect(slice.startIndex).toBe(0);
    expect(slice.endIndex).toBe(0);
  });
});
