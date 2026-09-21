import { describe, expect, it } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  agentDemo,
  agentExport,
  agentMoreLike,
  agentScore,
  agentSearch,
  compactPaper,
} from "../src/agent.js";
import { DEMO_RESULT } from "../src/demo-data.js";
import { createOpenReachMcpServer } from "../src/mcp.js";
import type { Paper } from "../src/types.js";

const EXPECTED_TOOLS = [
  "demo_papers",
  "export_citations",
  "more_like_this",
  "score_papers",
  "search_papers",
];

function registeredToolNames(server: McpServer): string[] {
  const internal = server as unknown as {
    _registeredTools: Record<string, unknown>;
  };
  return Object.keys(internal._registeredTools).sort();
}

describe("OpenReach MCP", () => {
  it("registers the agent tool names", () => {
    const server = createOpenReachMcpServer({
      search: async () => DEMO_RESULT,
    });
    expect(registeredToolNames(server)).toEqual(EXPECTED_TOOLS);
  });

  it("search_papers path matches agentSearch", async () => {
    const deps = {
      search: async (q: string) => ({ ...DEMO_RESULT, question: q }),
    };
    const out = await agentSearch("skip connections", 0, deps);
    expect(out.papers[0].title).toContain("Residual");
  });

  it("score_papers path matches agentScore", async () => {
    const deps = {
      score: async (sessionId: string, ids: string[]) => ({
        sessionId,
        pending: 1,
        papers: DEMO_RESULT.papers.filter((p) => ids.includes(p.id)),
      }),
    };
    const out = await agentScore("s1", [DEMO_RESULT.papers[0].id], deps);
    expect(out.papers).toHaveLength(1);
  });

  it("more_like_this path matches agentMoreLike", async () => {
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
      moreLike: async (p: Paper) => ({
        ...DEMO_RESULT,
        question: `More like: ${p.title}`,
      }),
    };
    const out = await agentMoreLike(paper, deps);
    expect(out.question).toContain(seed.title);
  });

  it("export_citations path matches agentExport", () => {
    const paper = DEMO_RESULT.papers[0];
    const out = agentExport("apa", [
      {
        id: paper.id,
        title: paper.title,
        year: paper.year,
        venue: paper.venue,
        doi: paper.doi,
        url: paper.url,
      },
    ]);
    expect(out.text).toContain(paper.title);
  });

  it("demo_papers compacts DEMO_RESULT papers", () => {
    const demo = agentDemo();
    const compact = {
      ...demo,
      papers: demo.papers.map(compactPaper),
    };
    expect(compact.papers[0]).not.toHaveProperty("abstract");
    expect(compact.question).toContain("residual");
  });
});
