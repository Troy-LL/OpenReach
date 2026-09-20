import { describe, expect, it } from "vitest";
import type { Paper, RankedPaper } from "../src/types.js";
import {
  createSearchSession,
  getSession,
  scoreSessionIds,
  sessionPapers,
  sessionPending,
} from "../src/session.js";

function paper(id: string): Paper {
  return {
    id,
    title: `Title ${id}`,
    abstract: `Abstract ${id}`,
    year: 2020,
    venue: null,
    doi: null,
    url: null,
    source: "openalex",
  };
}

const fakeScore = async (
  _question: string,
  papers: Paper[],
): Promise<RankedPaper[]> =>
  papers.map((p, i) => ({
    ...p,
    scored: true,
    relevance: 0.9 - i * 0.1,
    isReview: 0.1,
    centrality: 3,
    composite: 0.8 - i * 0.1,
  }));

describe("search session", () => {
  it("holds retrieved papers unscored until requested ids are judged", async () => {
    const id = createSearchSession("residuals", [paper("a"), paper("b"), paper("c")]);
    const session = getSession(id);
    expect(session).toBeDefined();
    expect(sessionPending(session!)).toBe(3);
    expect(sessionPapers(session!).every((p) => !p.scored)).toBe(true);

    const first = await scoreSessionIds(id, ["a", "b"], fakeScore);
    expect(first).toHaveLength(2);
    expect(first.every((p) => p.scored)).toBe(true);
    expect(sessionPending(getSession(id)!)).toBe(1);

    const again = await scoreSessionIds(id, ["a"], fakeScore);
    expect(again).toHaveLength(0);

    await scoreSessionIds(id, ["c"], fakeScore);
    expect(sessionPending(getSession(id)!)).toBe(0);
  });

  it("rejects an unknown session", async () => {
    await expect(
      scoreSessionIds("missing", ["a"], fakeScore),
    ).rejects.toThrow(/expired/i);
  });
});
