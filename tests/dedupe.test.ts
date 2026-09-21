import { describe, expect, it } from "vitest";
import { dedupePapers } from "../src/dedupe.js";
import type { Paper } from "../src/types.js";

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

  it("keeps same title in different years as separate papers", () => {
    const a = paper({
      id: "1",
      title: "Annual Survey of Machine Learning",
      year: 2019,
      abstract: "Survey for 2019.",
    });
    const b = paper({
      id: "2",
      title: "Annual Survey of Machine Learning",
      year: 2020,
      abstract: "Survey for 2020.",
    });

    expect(dedupePapers([a, b])).toHaveLength(2);
  });

  it("merges same normalized title when both years are missing", () => {
    const a = paper({
      id: "1",
      title: "Untitled Year Collision",
      year: null,
      abstract: "First abstract.",
    });
    const b = paper({
      id: "2",
      title: "Untitled Year Collision",
      year: null,
      abstract: "Second abstract.",
      source: "semantic_scholar",
    });

    const out = dedupePapers([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].abstract).toBe("First abstract.");
  });

  it("prefers url then venue when abstracts match", () => {
    const shared = {
      title: "Shared Metadata Paper",
      abstract: "Same abstract.",
      year: 2021,
    };
    const noUrl = paper({
      id: "1",
      ...shared,
      url: null,
      venue: null,
    });
    const withUrl = paper({
      id: "2",
      ...shared,
      url: "https://example.org/paper",
      venue: null,
      source: "semantic_scholar",
    });
    expect(dedupePapers([noUrl, withUrl])[0].url).toBe(
      "https://example.org/paper",
    );

    const noVenue = paper({
      id: "3",
      ...shared,
      url: "https://example.org/a",
      venue: null,
    });
    const withVenue = paper({
      id: "4",
      ...shared,
      url: "https://example.org/a",
      venue: "NeurIPS",
      source: "semantic_scholar",
    });
    expect(dedupePapers([noVenue, withVenue])[0].venue).toBe("NeurIPS");
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
