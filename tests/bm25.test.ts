import { describe, expect, it } from "vitest";
import {
  DEFAULT_BM25_CAP,
  DEFAULT_BM25_MIN_SCORE,
  bm25Score,
  gateByBm25,
  tokenize,
} from "../src/bm25.js";

describe("tokenize", () => {
  it("lowercases and splits on non-alphanumeric runs", () => {
    expect(tokenize("Hello, World!")).toEqual(["hello", "world"]);
    expect(tokenize("BM25-style pre-filter")).toEqual([
      "bm25",
      "style",
      "pre",
      "filter",
    ]);
  });

  it("drops empty segments", () => {
    expect(tokenize("   ---   ")).toEqual([]);
    expect(tokenize("a..b")).toEqual(["a", "b"]);
  });
});

describe("bm25Score", () => {
  it("ranks a title match above abstract-only buzzword overlap", () => {
    const query = "crispr gene editing therapeutic";
    const titleHit = bm25Score(
      query,
      "CRISPR Gene Editing for Therapeutic Use",
      "We discuss laboratory methods and controls.",
    );
    const abstractBuzz = bm25Score(
      query,
      "Annual Review of Molecular Biology",
      "crispr gene editing therapeutic applications in review.",
    );
    expect(titleHit).toBeGreaterThan(abstractBuzz);
  });
});

describe("gateByBm25", () => {
  it("sorts by score descending and respects cap", () => {
    const papers = [
      { id: "a", title: "Unrelated topic", abstract: "Nothing about the query." },
      {
        id: "b",
        title: "Neural networks survey",
        abstract: "A broad overview of models.",
      },
      {
        id: "c",
        title: "Neural networks for vision",
        abstract: "We study vision tasks.",
      },
    ];
    const query = "neural networks vision";
    const out = gateByBm25(query, papers, { cap: 2 });
    expect(out).toHaveLength(2);
    expect(out[0].id).toBe("c");
    expect(out[1].id).toBe("b");
    expect(out[0]).toBe(papers[2]);
    expect(out[1]).toBe(papers[1]);
  });

  it("exposes default cap and minScore constants", () => {
    expect(DEFAULT_BM25_CAP).toBe(400);
    expect(DEFAULT_BM25_MIN_SCORE).toBe(0);
  });

  it("drops papers below minScore when raised above zero", () => {
    const papers = [
      { title: "Quantum gravity", abstract: "Spacetime and loops." },
      { title: "Machine learning", abstract: "machine learning models." },
    ];
    const out = gateByBm25("machine learning", papers, { minScore: 0.01 });
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("Machine learning");
  });

  it("returns empty for empty query or empty papers", () => {
    const papers = [{ title: "A", abstract: "B" }];
    expect(gateByBm25("", papers)).toEqual([]);
    expect(gateByBm25("query", [])).toEqual([]);
  });

  it("keeps top cap papers when minScore is default zero", () => {
    const papers = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      title: `Paper ${i}`,
      abstract: "Shared vocabulary term.",
    }));
    const out = gateByBm25("vocabulary", papers, { cap: 3, minScore: 0 });
    expect(out).toHaveLength(3);
    expect(out.map((p) => p.id)).toEqual(["0", "1", "2"]);
  });
});
