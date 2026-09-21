import { describe, expect, it } from "vitest";
import {
  agentDemo,
  agentExport,
  agentMoreLike,
  agentScore,
  agentSearch,
  compactPaper,
} from "../src/agent.js";
import { DEMO_RESULT } from "../src/demo-data.js";
import type { Paper, SearchResult } from "../src/types.js";

describe("agent handlers", () => {
  it("compactPaper exposes ranking fields", () => {
    const paper = DEMO_RESULT.papers[0];
    const compact = compactPaper(paper);
    expect(compact.id).toBe(paper.id);
    expect(compact.title).toBe(paper.title);
    expect(compact.composite).toBe(paper.composite);
    expect(compact.scored).toBe(true);
    expect(compact).not.toHaveProperty("abstract");
  });

  it("agentSearch throws on empty question", async () => {
    await expect(agentSearch("  ")).rejects.toThrow(/question/i);
  });

  it("agentSearch uses injected search and default scoreFirst 0", async () => {
    let capturedScoreFirst: number | undefined;
    const deps = {
      search: async (q: string, opts?: { scoreFirst?: number }) => {
        capturedScoreFirst = opts?.scoreFirst;
        return { ...DEMO_RESULT, question: q };
      },
    };
    const out = await agentSearch("residual nets", undefined, deps);
    expect(capturedScoreFirst).toBe(0);
    expect(out.question).toBe("residual nets");
    expect(out.papers).toHaveLength(DEMO_RESULT.papers.length);
    expect(out.papers[0].title).toContain("Residual");
  });

  it("agentSearch forwards scoreFirst", async () => {
    let capturedScoreFirst: number | undefined;
    const deps = {
      search: async (_q: string, opts?: { scoreFirst?: number }) => {
        capturedScoreFirst = opts?.scoreFirst;
        return DEMO_RESULT;
      },
    };
    await agentSearch("q", 5, deps);
    expect(capturedScoreFirst).toBe(5);
  });

  it("agentScore uses injected score", async () => {
    const deps = {
      score: async (sessionId: string, ids: string[]) => ({
        sessionId,
        pending: 2,
        papers: DEMO_RESULT.papers.filter((p) => ids.includes(p.id)),
      }),
    };
    const out = await agentScore("sess-1", ["arxiv:1512.03385"], deps);
    expect(out.sessionId).toBe("sess-1");
    expect(out.pending).toBe(2);
    expect(out.papers).toHaveLength(1);
  });

  it("agentMoreLike uses injected moreLike", async () => {
    const seed = DEMO_RESULT.papers[0];
    const paper: Paper = {
      id: seed.id,
      title: seed.title,
      abstract: seed.abstract,
      year: seed.year,
      venue: seed.venue,
      doi: seed.doi,
      url: seed.url,
      source: seed.source,
    };
    const deps = {
      moreLike: async (p: Paper) =>
        ({ ...DEMO_RESULT, question: `More like: ${p.title}` }) as SearchResult,
    };
    const out = await agentMoreLike(paper, deps);
    expect(out.question).toContain("More like:");
    expect(out.papers.length).toBeGreaterThan(0);
  });

  it("agentExport formats APA and BibTeX", () => {
    const paper = DEMO_RESULT.papers[0];
    const cite = {
      id: paper.id,
      title: paper.title,
      year: paper.year,
      venue: paper.venue,
      doi: paper.doi,
      url: paper.url,
    };
    const apa = agentExport("apa", [cite]);
    expect(apa.format).toBe("apa");
    expect(apa.text).toContain(paper.title);
    const bib = agentExport("bibtex", [cite]);
    expect(bib.format).toBe("bibtex");
    expect(bib.text).toMatch(/^@\w+\{/);
  });

  it("agentDemo returns DEMO_RESULT unchanged", () => {
    expect(agentDemo()).toBe(DEMO_RESULT);
  });
});
