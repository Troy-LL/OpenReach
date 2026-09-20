import { describe, expect, it } from "vitest";
import { dedupePapers } from "../src/dedupe.js";
import { compositeScore, filterAndSort } from "../src/score.js";
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

describe("dedupePapers", () => {
  it("merges the same DOI from two sources and keeps the abstract", () => {
    const a = paper({
      id: "oa:1",
      title: "Attention Is All You Need",
      doi: "10.5555/3295222.3295349",
      abstract: "",
      source: "openalex",
    });
    const b = paper({
      id: "s2:1",
      title: "Attention is All You Need",
      doi: "https://doi.org/10.5555/3295222.3295349",
      abstract: "We propose the Transformer.",
      source: "semantic_scholar",
    });

    const out = dedupePapers([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].abstract).toBe("We propose the Transformer.");
  });

  it("merges near-identical titles when DOI is missing", () => {
    const a = paper({
      id: "1",
      title: "Deep Residual Learning for Image Recognition!",
      abstract: "We present residual networks.",
    });
    const b = paper({
      id: "2",
      title: "Deep Residual Learning for Image Recognition",
      abstract: "We present residual networks.",
      source: "semantic_scholar",
    });

    expect(dedupePapers([a, b])).toHaveLength(1);
  });

  it("drops papers without abstracts and respects the cap", () => {
    const papers = Array.from({ length: 5 }, (_, i) =>
      paper({
        id: String(i),
        title: `Paper ${i}`,
        abstract: i === 0 ? "" : `Abstract ${i}`,
        doi: `10.0/${i}`,
      }),
    );

    const out = dedupePapers(papers, 2);
    expect(out).toHaveLength(2);
    expect(out.every((p) => p.abstract.length > 0)).toBe(true);
  });
});

describe("compositeScore / filterAndSort", () => {
  it("weights relevance highest and can boost reviews", () => {
    const base = compositeScore(0.8, 0, 2, false);
    const withReview = compositeScore(0.8, 1, 2, true);
    expect(withReview).toBeGreaterThan(base);
  });

  it("filters below threshold and sorts by composite", () => {
    const ranked: RankedPaper[] = [
      {
        ...paper({ id: "low", title: "Low", abstract: "a" }),
        scored: true,
        relevance: 0.2,
        isReview: 0,
        centrality: 4,
        composite: 0.9,
      },
      {
        ...paper({ id: "mid", title: "Mid", abstract: "a" }),
        scored: true,
        relevance: 0.5,
        isReview: 0,
        centrality: 1,
        composite: 0.4,
      },
      {
        ...paper({ id: "hi", title: "Hi", abstract: "a" }),
        scored: true,
        relevance: 0.9,
        isReview: 0,
        centrality: 3,
        composite: 0.8,
      },
    ];

    const out = filterAndSort(ranked);
    expect(out.map((p) => p.id)).toEqual(["hi", "mid"]);
  });
});
