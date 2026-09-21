import { describe, expect, it } from "vitest";
import {
  compositeScore,
  EVIDENCE_LEGENDS,
  filterAndSort,
  legendFor,
  METHOD_LEGENDS,
  POPULATION_LEGENDS,
  RECENCY_LEGENDS,
  topicRelevance,
  WEIGHTS,
} from "../src/score.js";
import type { Paper, RankedPaper } from "../src/types.js";

function paper(partial: Partial<Paper> & Pick<Paper, "id" | "title">): Paper {
  return {
    abstract: "",
    year: 2020,
    venue: null,
    doi: null,
    url: null,
    source: "openalex",
    ...partial,
  };
}

describe("topicRelevance", () => {
  it("averages normalized method and population", () => {
    expect(topicRelevance(4, 4)).toBe(1);
    expect(topicRelevance(0, 0)).toBe(0);
    expect(topicRelevance(4, 0)).toBe(0.5);
  });
});

describe("compositeScore", () => {
  const dims = {
    method: 4,
    population: 4,
    evidence: 4,
    recency: 4,
    isReview: 0,
  };

  it("uses policy weights on normalized dimensions", () => {
    const full = compositeScore(dims, false);
    expect(full).toBeCloseTo(
      WEIGHTS.method +
        WEIGHTS.population +
        WEIGHTS.evidence +
        WEIGHTS.recency,
      5,
    );
  });

  it("can boost reviews when intent prefers them", () => {
    const base = compositeScore(dims, false);
    const withReview = compositeScore({ ...dims, isReview: 1 }, true);
    expect(withReview - base).toBeCloseTo(WEIGHTS.reviewBonus, 5);
  });
});

describe("legendFor", () => {
  it("clamps to nearest legend index 0–4", () => {
    expect(legendFor(METHOD_LEGENDS, -1)).toBe(METHOD_LEGENDS[0]);
    expect(legendFor(METHOD_LEGENDS, 0)).toBe(METHOD_LEGENDS[0]);
    expect(legendFor(METHOD_LEGENDS, 1.4)).toBe(METHOD_LEGENDS[1]);
    expect(legendFor(METHOD_LEGENDS, 3.6)).toBe(METHOD_LEGENDS[4]);
    expect(legendFor(METHOD_LEGENDS, 9)).toBe(METHOD_LEGENDS[4]);
  });

  it("exports five legends per dimension", () => {
    for (const levels of [
      METHOD_LEGENDS,
      POPULATION_LEGENDS,
      EVIDENCE_LEGENDS,
      RECENCY_LEGENDS,
    ]) {
      expect(levels).toHaveLength(5);
    }
  });
});

describe("filterAndSort", () => {
  it("filters below threshold and sorts by composite", () => {
    const ranked: RankedPaper[] = [
      {
        ...paper({ id: "low", title: "Low", abstract: "a" }),
        scored: true,
        method: 4,
        population: 4,
        evidence: 4,
        recency: 4,
        relevance: 0.2,
        isReview: 0,
        composite: 0.9,
      },
      {
        ...paper({ id: "mid", title: "Mid", abstract: "a" }),
        scored: true,
        method: 2,
        population: 2,
        evidence: 2,
        recency: 2,
        relevance: 0.5,
        isReview: 0,
        composite: 0.4,
      },
      {
        ...paper({ id: "hi", title: "Hi", abstract: "a" }),
        scored: true,
        method: 3,
        population: 3,
        evidence: 3,
        recency: 3,
        relevance: 0.9,
        isReview: 0,
        composite: 0.8,
      },
    ];

    const out = filterAndSort(ranked);
    expect(out.map((p) => p.id)).toEqual(["hi", "mid"]);
  });
});
