import { describe, expect, it } from "vitest";
import type { RankedPaper } from "../src/types.js";
import { unscoredIds } from "../src/page-scoring.js";

function paper(id: string, scored: boolean): RankedPaper {
  return {
    id,
    title: `Paper ${id}`,
    abstract: "",
    year: 2024,
    venue: null,
    doi: null,
    url: null,
    source: "openalex",
    scored,
    method: 0,
    population: 0,
    evidence: 0,
    recency: 0,
    isReview: 0,
    relevance: 0,
    composite: 0,
  };
}

describe("unscoredIds", () => {
  it("returns empty array for empty input", () => {
    expect(unscoredIds([])).toEqual([]);
  });

  it("returns empty array when all papers are scored", () => {
    expect(unscoredIds([paper("a", true), paper("b", true)])).toEqual([]);
  });

  it("returns ids where scored is false", () => {
    expect(
      unscoredIds([
        paper("a", true),
        paper("b", false),
        paper("c", false),
        paper("d", true),
      ]),
    ).toEqual(["b", "c"]);
  });

  it("preserves order of unscored ids", () => {
    expect(
      unscoredIds([
        paper("z", false),
        paper("y", false),
        paper("x", true),
        paper("w", false),
      ]),
    ).toEqual(["z", "y", "w"]);
  });
});
