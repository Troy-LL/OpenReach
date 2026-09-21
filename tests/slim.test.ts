import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { DEMO_RESULT } from "../src/demo-data.js";
import { API_ABSTRACT_CHARS, slimPaper } from "../src/slim.js";
import type { SearchResult } from "../src/types.js";

describe("slimPaper", () => {
  it("leaves short abstracts alone and caps long ones", () => {
    expect(API_ABSTRACT_CHARS).toBe(480);
    const short = { ...DEMO_RESULT.papers[0], abstract: "short" };
    expect(slimPaper(short).abstract).toBe("short");
    const long = {
      ...DEMO_RESULT.papers[0],
      abstract: "x".repeat(API_ABSTRACT_CHARS + 40),
    };
    expect(slimPaper(long).abstract).toHaveLength(API_ABSTRACT_CHARS);
  });
});

describe("HTTP JSON slimming", () => {
  it("truncates long abstracts on search, score, and more-like", async () => {
    const long = "y".repeat(API_ABSTRACT_CHARS + 80);
    const fat: SearchResult = {
      ...DEMO_RESULT,
      papers: [{ ...DEMO_RESULT.papers[0], abstract: long }],
    };
    const app = createApp({
      search: async (question) => ({ ...fat, question }),
      scoreVisible: async (sessionId, ids) => ({
        sessionId,
        pending: 0,
        papers: fat.papers.filter((p) => ids.includes(p.id)),
      }),
      moreLike: async (paper) => ({
        ...fat,
        question: `More like: ${paper.title}`,
      }),
    });

    const search = await app.request("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "skip connections" }),
    });
    expect(search.status).toBe(200);
    const searchBody = (await search.json()) as SearchResult;
    expect(searchBody.papers[0].abstract).toHaveLength(API_ABSTRACT_CHARS);

    const score = await app.request("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "sess-1",
        ids: [DEMO_RESULT.papers[0].id],
      }),
    });
    expect(score.status).toBe(200);
    const scoreBody = (await score.json()) as { papers: { abstract: string }[] };
    expect(scoreBody.papers[0].abstract).toHaveLength(API_ABSTRACT_CHARS);

    const more = await app.request("/api/more-like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paper: { id: "x", title: "Residual networks", abstract: long },
      }),
    });
    expect(more.status).toBe(200);
    const moreBody = (await more.json()) as SearchResult;
    expect(moreBody.papers[0].abstract).toHaveLength(API_ABSTRACT_CHARS);
  });
});
