import "dotenv/config";

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  agentExport,
  agentMoreLike,
  agentScore,
  agentSearch,
  demoAgentPayload,
  type AgentDeps,
} from "./agent.js";
import { hasApiKey, loadLocalKey } from "./keys.js";
import { publicErrorMessage } from "./public-error.js";
import type { Paper, PaperSource } from "./types.js";

export const MCP_LIVE_KEY_ERROR =
  "Live search and scoring need a TypeSafe key. Send X-Typesafe-Key (or Authorization: Bearer) on the remote MCP request. Local stdio can use TYPESAFE_API_KEY or data/typesafe.key.";

function liveKeyOrError(): CallToolResult | null {
  if (hasApiKey()) return null;
  return {
    isError: true,
    content: [{ type: "text", text: MCP_LIVE_KEY_ERROR }],
  };
}

async function runLiveTool(
  work: () => Promise<CallToolResult>,
  fallback: string,
): Promise<CallToolResult> {
  const denied = liveKeyOrError();
  if (denied) return denied;
  try {
    return await work();
  } catch (err) {
    return {
      isError: true,
      content: [{ type: "text", text: publicErrorMessage(err, fallback) }],
    };
  }
}

const PAPER_SOURCES = [
  "openalex",
  "semantic_scholar",
  "related",
  "arxiv",
  "europe_pmc",
  "crossref",
  "pubmed",
  "inspire",
  "eric",
  "doaj",
  "openaire",
  "biorxiv",
  "medrxiv",
  "plos",
] as const satisfies readonly PaperSource[];

function jsonToolResult(data: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
  };
}

function paperFromToolInput(input: {
  id: string;
  title: string;
  abstract?: string;
  year?: number;
  venue?: string | null;
  doi?: string | null;
  url?: string | null;
  source?: PaperSource;
  authors?: string[];
}): Paper {
  return {
    id: input.id,
    title: input.title,
    abstract: input.abstract ?? "",
    year: input.year ?? null,
    venue: input.venue ?? null,
    doi: input.doi ?? null,
    url: input.url ?? null,
    source: input.source ?? "openalex",
    authors: input.authors,
  };
}

export function createOpenReachMcpServer(deps: AgentDeps = {}): McpServer {
  const server = new McpServer({
    name: "openreach",
    version: "0.1.0",
  });

  server.registerTool(
    "search_papers",
    {
      description: "Retrieve and optionally score papers for a research question.",
      inputSchema: {
        question: z.string(),
        score_first: z.number().int().min(0).max(12).optional(),
      },
    },
    async (args) =>
      runLiveTool(async () => {
        const result = await agentSearch(
          args.question,
          args.score_first ?? 0,
          deps,
        );
        return jsonToolResult(result);
      }, "Search failed."),
  );

  server.registerTool(
    "score_papers",
    {
      description: "Jev-score specific paper ids from an existing search session.",
      inputSchema: {
        session_id: z.string(),
        ids: z.array(z.string()).min(1),
      },
    },
    async (args) =>
      runLiveTool(async () => {
        const result = await agentScore(args.session_id, args.ids, deps);
        return jsonToolResult(result);
      }, "Score failed."),
  );

  server.registerTool(
    "more_like_this",
    {
      description: "Find papers similar to a seed paper.",
      inputSchema: {
        id: z.string(),
        title: z.string(),
        abstract: z.string().optional(),
        year: z.number().optional(),
        venue: z.string().nullable().optional(),
        doi: z.string().nullable().optional(),
        url: z.string().nullable().optional(),
        source: z.enum(PAPER_SOURCES).optional(),
        authors: z.array(z.string()).optional(),
      },
    },
    async (args) =>
      runLiveTool(async () => {
        const result = await agentMoreLike(paperFromToolInput(args), deps);
        return jsonToolResult(result);
      }, "More-like failed."),
  );

  server.registerTool(
    "export_citations",
    {
      description: "Format papers as APA or BibTeX citations.",
      inputSchema: {
        format: z.enum(["apa", "bibtex"]),
        papers: z
          .array(
            z.object({
              id: z.string(),
              title: z.string(),
              year: z.number().nullable().optional(),
              venue: z.string().nullable().optional(),
              doi: z.string().nullable().optional(),
              url: z.string().nullable().optional(),
            }),
          )
          .min(1),
      },
    },
    async (args) => {
      const papers = args.papers.map((p) => ({
        id: p.id,
        title: p.title,
        year: p.year ?? null,
        venue: p.venue ?? null,
        doi: p.doi ?? null,
        url: p.url ?? null,
      }));
      const result = agentExport(args.format, papers);
      return jsonToolResult(result);
    },
  );

  server.registerTool(
    "demo_papers",
    {
      description: "Deterministic sample results without live retrieval or Jev.",
      inputSchema: {},
    },
    async () => {
      const demo = demoAgentPayload(deps);
      return jsonToolResult(demo);
    },
  );

  return server;
}

async function main(): Promise<void> {
  await loadLocalKey();
  const server = createOpenReachMcpServer();
  await server.connect(new StdioServerTransport());
}

const entry = process.argv[1]?.replace(/\\/g, "/") ?? "";
if (entry.endsWith("/src/mcp.ts") || entry.endsWith("/mcp.ts")) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
