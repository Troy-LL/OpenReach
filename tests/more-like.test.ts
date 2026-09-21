import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Paper, RankedPaper } from "../src/types.js";
import { DEFAULT_PAGE_SIZE } from "../src/pagination.js";
import * as session from "../src/session.js";
import { seedQueryFromPaper } from "../src/more-like.js";

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

import { clearRetrieveCache, findMoreLikeThis } from "../src/search.js";

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

describe("seedQueryFromPaper", () => {
  it("uses title words and venue when present", () => {
    const seed = paper({
      id: "s1",
      title: "Attention Is All You Need",
      venue: "NeurIPS",
    });
    expect(seedQueryFromPaper(seed)).toBe(
      "Attention Is All You Need NeurIPS",
    );
  });

  it("omits empty tokens and venue when absent", () => {
    const seed = paper({
      id: "s2",
      title: "  Deep   Learning  ",
      venue: null,
    });
    expect(seedQueryFromPaper(seed)).toBe("Deep Learning");
  });
});

describe("findMoreLikeThis", () => {
  beforeEach(() => {
    clearRetrieveCache();
    retrieveCandidatesMock.mockReset();
  });

  it("excludes the seed by doi, scores only scoreFirst, pending is pool minus scored", async () => {
    const seed = paper({
      id: "seed-id",
      title: "Transformer attention mechanism study",
      abstract: "We study multi-head attention in transformers for NLP.",
      doi: "10.5555/seed.paper",
      venue: "ACL",
      year: 2021,
    });

    const related = Array.from({ length: 20 }, (_, i) =>
      paper({
        id: `rel-${i}`,
        title: `Transformer attention mechanism follow-up ${i}`,
        abstract:
          "Multi-head attention and transformer architecture for language.",
        doi: `10.5555/related.${i}`,
        year: 2020 + (i % 3),
      }),
    );

    const seedDuplicate = paper({
      id: "seed-dup-id",
      title: "Transformer attention mechanism study",
      abstract: seed.abstract,
      doi: "https://doi.org/10.5555/seed.paper",
      year: 2021,
    });

    retrieveCandidatesMock.mockResolvedValue([seed, seedDuplicate, ...related]);

    const scoreSpy = vi.spyOn(session, "scoreSessionIds");

    const result = await findMoreLikeThis(seed, {
      scoreFirst: DEFAULT_PAGE_SIZE,
    });

    expect(retrieveCandidatesMock).toHaveBeenCalled();
    const poolIds = result.papers.map((p) => p.id);
    expect(poolIds).not.toContain("seed-id");
    expect(poolIds).not.toContain("seed-dup-id");

    expect(scoreSpy).toHaveBeenCalledTimes(1);
    const scoredIds = scoreSpy.mock.calls[0]?.[1] ?? [];
    expect(scoredIds).toHaveLength(DEFAULT_PAGE_SIZE);
    expect(result.pending).toBe(result.papers.length - DEFAULT_PAGE_SIZE);
    expect(result.question).toBe(`More like: ${seed.title}`);

    const stored = session.getSession(result.sessionId!);
    expect(stored?.context).toMatchObject({
      likeTitle: seed.title,
      likeAbstract: seed.abstract,
      recencyNeed: "any",
    });

    scoreSpy.mockRestore();
  });
});
