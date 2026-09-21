import { describe, expect, it } from "vitest";
import type { Paper, RankedPaper } from "../src/types.js";
import {
  createBucketSessionBackend,
  createSearchSession,
  deserializeSession,
  getSession,
  runWithSessionBackend,
  scoreSessionIds,
  serializeSession,
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
  _context = {},
): Promise<RankedPaper[]> =>
  papers.map((p, i) => ({
    ...p,
    scored: true,
    method: 3,
    population: 3,
    evidence: 3,
    recency: 2,
    relevance: 0.9 - i * 0.1,
    isReview: 0.1,
    composite: 0.8 - i * 0.1,
  }));

describe("search session", () => {
  it("holds retrieved papers unscored until requested ids are judged", async () => {
    const id = await createSearchSession("residuals", [paper("a"), paper("b"), paper("c")]);
    const session = await getSession(id);
    expect(session).toBeDefined();
    expect(sessionPending(session!)).toBe(3);
    expect(sessionPapers(session!).every((p) => !p.scored)).toBe(true);

    const first = await scoreSessionIds(id, ["a", "b"], fakeScore);
    expect(first).toHaveLength(2);
    expect(first.every((p) => p.scored)).toBe(true);
    expect(sessionPending((await getSession(id))!)).toBe(1);

    const again = await scoreSessionIds(id, ["a"], fakeScore);
    expect(again).toHaveLength(0);

    await scoreSessionIds(id, ["c"], fakeScore);
    expect(sessionPending((await getSession(id))!)).toBe(0);
  });

  it("rejects an unknown session", async () => {
    await expect(
      scoreSessionIds("missing", ["a"], fakeScore),
    ).rejects.toThrow(/expired/i);
  });

  it("round-trips a session through a text bucket", async () => {
    const map = new Map<string, string>();
    const backend = createBucketSessionBackend({
      get: async (id) => map.get(id) ?? null,
      put: async (id, value) => {
        map.set(id, value);
      },
      delete: async (id) => {
        map.delete(id);
      },
    });

    await runWithSessionBackend(backend, async () => {
      const id = await createSearchSession("residuals", [paper("a")]);
      const stored = deserializeSession(map.get(id) ?? "");
      expect(stored?.question).toBe("residuals");
      expect(serializeSession(stored!).length).toBeGreaterThan(10);
      const session = await getSession(id);
      expect(session?.papers.get("a")?.title).toBe("Title a");
    });
  });
});
