import { describe, expect, it } from "vitest";
import { applyFilters, DEFAULT_FILTERS } from "../src/filters.js";
import type { RankedPaper } from "../src/types.js";

function paper(
  partial: Partial<RankedPaper> & Pick<RankedPaper, "id" | "title">,
): RankedPaper {
  return {
    abstract: "An abstract about the work.",
    year: 2020,
    venue: "NeurIPS",
    doi: "10.0/example",
    url: "https://example.com/p",
    source: "openalex",
    scored: true,
    relevance: 0.8,
    isReview: 0.1,
    centrality: 3,
    composite: 0.7,
    ...partial,
  };
}

const set: RankedPaper[] = [
  paper({
    id: "resnet",
    title: "Deep Residual Learning for Image Recognition",
    year: 2016,
    venue: "CVPR",
    source: "arxiv",
    relevance: 0.98,
    isReview: 0.05,
    centrality: 4,
    composite: 0.9,
  }),
  paper({
    id: "survey",
    title: "Deep Residual Learning: A Survey",
    year: 2022,
    venue: "Applied Sciences",
    source: "openalex",
    relevance: 0.9,
    isReview: 0.96,
    centrality: 3.5,
    composite: 0.85,
    doi: null,
  }),
  paper({
    id: "old",
    title: "Early convolutional networks",
    year: 2012,
    venue: "arXiv",
    source: "semantic_scholar",
    relevance: 0.4,
    isReview: 0.2,
    centrality: 1,
    composite: 0.35,
    url: null,
  }),
  paper({
    id: "undated",
    title: "Untitled preprint on residuals",
    year: null,
    venue: null,
    source: "related",
    relevance: 0.55,
    isReview: 0.1,
    centrality: 2,
    composite: 0.45,
  }),
];

describe("applyFilters", () => {
  it("keeps papers at the default relevance floor and sorts by composite", () => {
    const out = applyFilters(set, DEFAULT_FILTERS);
    expect(out.map((p) => p.id)).toEqual([
      "resnet",
      "survey",
      "undated",
      "old",
    ]);
  });

  it("drops below minRelevance and minCentrality", () => {
    const out = applyFilters(set, {
      ...DEFAULT_FILTERS,
      minRelevance: 0.7,
      minCentrality: 3.6,
    });
    expect(out.map((p) => p.id)).toEqual(["resnet"]);
  });

  it("filters year range and can exclude unknown years", () => {
    const withUnknown = applyFilters(set, {
      ...DEFAULT_FILTERS,
      yearFrom: 2015,
      yearTo: 2020,
      includeUnknownYear: true,
    });
    expect(withUnknown.map((p) => p.id).sort()).toEqual(["resnet", "undated"]);

    const noUnknown = applyFilters(set, {
      ...DEFAULT_FILTERS,
      yearFrom: 2015,
      yearTo: 2020,
      includeUnknownYear: false,
    });
    expect(noUnknown.map((p) => p.id)).toEqual(["resnet"]);
  });

  it("filters by source, kind, venue text, DOI, and URL", () => {
    const reviews = applyFilters(set, {
      ...DEFAULT_FILTERS,
      kind: "reviews",
      sources: ["openalex"],
    });
    expect(reviews.map((p) => p.id)).toEqual(["survey"]);

    const venue = applyFilters(set, {
      ...DEFAULT_FILTERS,
      venueQuery: "cvpr",
    });
    expect(venue.map((p) => p.id)).toEqual(["resnet"]);

    const doiOnly = applyFilters(set, {
      ...DEFAULT_FILTERS,
      requireDoi: true,
      sources: ["openalex"],
    });
    expect(doiOnly.map((p) => p.id)).toEqual([]);

    const urlOnly = applyFilters(set, {
      ...DEFAULT_FILTERS,
      requireUrl: true,
      minRelevance: 0.3,
    });
    expect(urlOnly.some((p) => p.id === "old")).toBe(false);
  });

  it("matches title or abstract text and sorts by year", () => {
    const text = applyFilters(set, {
      ...DEFAULT_FILTERS,
      textQuery: "survey",
    });
    expect(text.map((p) => p.id)).toEqual(["survey"]);

    const newest = applyFilters(set, {
      ...DEFAULT_FILTERS,
      sort: "year_desc",
      includeUnknownYear: false,
    });
    expect(newest.map((p) => p.id)).toEqual(["survey", "resnet", "old"]);
  });

  it("keeps unscored papers visible despite the relevance floor", () => {
    const waiting = paper({
      id: "waiting",
      title: "Not judged yet",
      scored: false,
      relevance: 0,
      centrality: 0,
      composite: 0,
    });
    const out = applyFilters([...set, waiting], DEFAULT_FILTERS);
    expect(out.some((p) => p.id === "waiting")).toBe(true);
    expect(out[out.length - 1].id).toBe("waiting");
  });
});
