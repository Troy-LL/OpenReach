import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Paper, RankedPaper } from "../src/types.js";
import { DEFAULT_BM25_CAP } from "../src/bm25.js";
import { DEFAULT_PAGE_SIZE } from "../src/pagination.js";
import * as session from "../src/session.js";

const { retrieveCandidatesMock } = vi.hoisted(() => ({
  retrieveCandidatesMock: vi.fn(),
}));

vi.mock("../src/retrieve.js", () => ({
  retrieveCandidates: retrieveCandidatesMock,
}));

vi.mock("../src/keys.js", () => ({
  hasApiKey: () => true,
}));

vi.mock("../src/intent.js", () => ({
  createClient: () => ({}),
  classifyIntent: async () => ({
    field: "cs",
    wantsReview: 0.1,
    wantsEmpirical: 0.2,
  }),
}));

vi.mock("../src/rerank.js", () => ({
  rerankPapers: vi.fn(
    async (
      _client: unknown,
      _question: string,
      batch: Paper[],
    ): Promise<RankedPaper[]> =>
      batch.map((p) => ({
        ...p,
        scored: true,
        method: 3,
        population: 3,
        evidence: 3,
        recency: 2,
        relevance: 0.9,
        isReview: 0,
        composite: 0.8,
      })),
  ),
}));

import { rerankPapers } from "../src/rerank.js";
import {
  clearRetrieveCache,
  findPapers,
  gateRetrieved,
} from "../src/search.js";

function paper(
  partial: Partial<Paper> & Pick<Paper, "id" | "title">,
): Paper {
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

describe("gateRetrieved", () => {
  it("caps the gated pool at exactly DEFAULT_BM25_CAP when many on-topic papers exist", () => {
    const query = "hierarchical residual neural networks";
    const many = Array.from({ length: 600 }, (_, i) =>
      paper({
        id: `on-${i}`,
        title: `Hierarchical residual neural network study ${i}`,
        abstract:
          "We study deep hierarchical residual networks for representation learning.",
        doi: `10.5555/residual.${i}`,
      }),
    );

    const gated = gateRetrieved(query, many);
    expect(gated.length).toBe(DEFAULT_BM25_CAP);
  });

  it("ranks on-topic papers above off-topic title and abstract matches", () => {
    const query = "transformer attention mechanism";
    const offTopic = paper({
      id: "off",
      title: "Italian pasta recipes for weeknight dinners",
      abstract: "Cooking techniques for sauces and noodles at home.",
    });
    const onTopic = paper({
      id: "on",
      title: "Attention Is All You Need: transformer mechanism",
      abstract:
        "We propose the transformer architecture built on multi-head attention.",
    });

    const gated = gateRetrieved(query, [offTopic, onTopic]);
    expect(gated[0].id).toBe("on");
    const offIndex = gated.findIndex((p) => p.id === "off");
    const onIndex = gated.findIndex((p) => p.id === "on");
    expect(onIndex).toBe(0);
    expect(offIndex).toBeGreaterThan(onIndex);
  });

  it("dedupes by DOI before BM25 cap so each DOI appears once", () => {
    const query = "hierarchical residual neural networks";
    const sharedDoi = "10.5555/residual.duplicate";
    const duplicateA = paper({
      id: "dup-openalex",
      title: "Hierarchical residual neural network analysis",
      abstract:
        "Deep hierarchical residual networks for representation learning.",
      doi: sharedDoi,
      source: "openalex",
    });
    const duplicateB = paper({
      id: "dup-s2",
      title: "Hierarchical Residual Neural Network Analysis",
      abstract:
        "Deep hierarchical residual networks for representation learning.",
      doi: `https://doi.org/${sharedDoi}`,
      source: "semantic_scholar",
    });

    const fillers = Array.from({ length: 600 }, (_, i) =>
      paper({
        id: `fill-${i}`,
        title: `Hierarchical residual neural network study ${i}`,
        abstract:
          "We study deep hierarchical residual networks for representation learning.",
        doi: `10.5555/residual.fill.${i}`,
      }),
    );

    const gated = gateRetrieved(query, [duplicateA, duplicateB, ...fillers]);
    const dois = gated
      .map((p) => p.doi)
      .filter((d): d is string => Boolean(d?.trim()));
    expect(gated.length).toBe(DEFAULT_BM25_CAP);
    expect(new Set(dois).size).toBe(gated.length);
    expect(dois.filter((d) => d.includes("residual.duplicate"))).toHaveLength(
      1,
    );
  });
});

describe("findPapers retrieve path", () => {
  beforeEach(() => {
    clearRetrieveCache();
    retrieveCandidatesMock.mockReset();
  });

  it("holds a 200–500 gated session pool and Jev-scores only the first page", async () => {
    const query =
      "residual hierarchical networks deep learning representation";
    const raw = Array.from({ length: 300 }, (_, i) =>
      paper({
        id: `p-${i}`,
        title: `Residual hierarchical network optimization ${i}`,
        abstract:
          "Deep residual hierarchical networks for representation learning.",
        doi: `10.5555/residual.session.${i}`,
        year: 2018 + (i % 5),
      }),
    );
    retrieveCandidatesMock.mockResolvedValue(raw);

    const scoreSpy = vi.spyOn(session, "scoreSessionIds");

    const result = await findPapers(query, {
      scoreFirst: DEFAULT_PAGE_SIZE,
    });

    expect(retrieveCandidatesMock).toHaveBeenCalled();
    expect(scoreSpy).toHaveBeenCalledTimes(1);
    const scoredIds = scoreSpy.mock.calls[0]?.[1] ?? [];
    expect(scoredIds).toHaveLength(DEFAULT_PAGE_SIZE);
    expect(result.papers.length).toBeGreaterThanOrEqual(200);
    expect(result.papers.length).toBeLessThanOrEqual(500);
    expect(result.pending).toBe(result.papers.length - DEFAULT_PAGE_SIZE);
    expect(scoredIds).toEqual(
      result.papers.slice(0, DEFAULT_PAGE_SIZE).map((p) => p.id),
    );

    scoreSpy.mockRestore();
  });

  it("drops papers outside splitQuery year window but keeps unknown years", async () => {
    const query = "transformer attention mechanism since 2020";
    retrieveCandidatesMock.mockResolvedValue([
      paper({
        id: "keep-2021",
        title: "Transformer attention mechanism for vision",
        abstract:
          "We propose multi-head attention in transformer architectures.",
        year: 2021,
      }),
      paper({
        id: "drop-2010",
        title: "Transformer attention mechanism historical note",
        abstract:
          "Early transformer attention mechanism ideas before modern NLP.",
        year: 2010,
      }),
      paper({
        id: "keep-null",
        title: "Transformer attention mechanism survey",
        abstract: "A survey of transformer attention mechanism variants.",
        year: null,
      }),
    ]);

    const result = await findPapers(query, { scoreFirst: 0 });
    const ids = result.papers.map((p) => p.id);
    expect(ids).toContain("keep-2021");
    expect(ids).toContain("keep-null");
    expect(ids).not.toContain("drop-2010");
  });

  it("raises wantsReview when the query asks for review only", async () => {
    retrieveCandidatesMock.mockResolvedValue([
      paper({
        id: "a",
        title: "Transformer attention mechanism survey",
        abstract: "A survey of transformer attention mechanism variants.",
        year: 2022,
      }),
    ]);

    const rerankMock = vi.mocked(rerankPapers);
    rerankMock.mockClear();

    const result = await findPapers(
      "transformer attention mechanism review only",
      { scoreFirst: 1 },
    );

    expect(result.intent?.wantsReview).toBeGreaterThanOrEqual(0.55);
    const intentArg = rerankMock.mock.calls[0]?.[3];
    expect(intentArg?.wantsReview).toBeGreaterThanOrEqual(0.55);
  });

  it("passes splitQuery facets as session context into rerankPapers", async () => {
    const query = "RCT survey for patients since 2020";
    retrieveCandidatesMock.mockResolvedValue([
      paper({
        id: "a",
        title: "RCT survey of patients in primary care",
        abstract: "Randomized trial surveying patients about outcomes.",
        year: 2022,
      }),
      paper({
        id: "b",
        title: "RCT survey patients mental health",
        abstract: "Survey of patients enrolled in randomized trials.",
        year: 2021,
      }),
    ]);

    const rerankMock = vi.mocked(rerankPapers);
    rerankMock.mockClear();

    const result = await findPapers(query, { scoreFirst: 1 });

    expect(rerankMock).toHaveBeenCalled();
    const contextArg = rerankMock.mock.calls[0]?.[4];
    expect(contextArg).toEqual({
      methodNeed: "RCT",
      populationNeed: "patients",
      recencyNeed: "recent",
    });

    const stored = await session.getSession(result.sessionId!);
    expect(stored?.context).toEqual(contextArg);

    rerankMock.mockClear();
  });

  it("skips Jev when scoreFirst is 0", async () => {
    retrieveCandidatesMock.mockResolvedValue([
      paper({
        id: "a",
        title: "Residual networks",
        abstract: "Hierarchical residuals in deep learning.",
      }),
    ]);

    const scoreSpy = vi
      .spyOn(session, "scoreSessionIds")
      .mockResolvedValue([]);

    await findPapers("residual networks", { scoreFirst: 0 });
    expect(scoreSpy).not.toHaveBeenCalled();

    scoreSpy.mockRestore();
  });
});
