import {
  formatApaList,
  formatBibtexList,
  type Citeable,
} from "./cite.js";
import { DEMO_RESULT } from "./demo-data.js";
import {
  findMoreLikeThis,
  findPapers,
  scoreVisiblePapers,
} from "./search.js";
import type { Paper, RankedPaper, SearchResult } from "./types.js";

export type AgentDeps = {
  search?: typeof findPapers;
  score?: typeof scoreVisiblePapers;
  moreLike?: typeof findMoreLikeThis;
  demo?: () => SearchResult;
};

export function compactPaper(paper: RankedPaper): {
  id: string;
  title: string;
  year: number | null;
  venue: string | null;
  doi: string | null;
  url: string | null;
  source: RankedPaper["source"];
  authors?: string[];
  scored: boolean;
  method: number;
  population: number;
  evidence: number;
  recency: number;
  isReview: number;
  relevance: number;
  composite: number;
} {
  return {
    id: paper.id,
    title: paper.title,
    year: paper.year,
    venue: paper.venue,
    doi: paper.doi,
    url: paper.url,
    source: paper.source,
    authors: paper.authors,
    scored: paper.scored,
    method: paper.method,
    population: paper.population,
    evidence: paper.evidence,
    recency: paper.recency,
    isReview: paper.isReview,
    relevance: paper.relevance,
    composite: paper.composite,
  };
}

export type AgentSearchPayload = {
  question: string;
  sessionId: string | null;
  pending: number;
  intent: SearchResult["intent"];
  papers: ReturnType<typeof compactPaper>[];
};

function toAgentPayload(result: SearchResult): AgentSearchPayload {
  return {
    question: result.question,
    sessionId: result.sessionId,
    pending: result.pending,
    intent: result.intent,
    papers: result.papers.map(compactPaper),
  };
}

export async function agentSearch(
  question: string,
  scoreFirst = 0,
  deps?: AgentDeps,
): Promise<AgentSearchPayload> {
  const trimmed = question.trim();
  if (!trimmed) {
    throw new Error("Question is required.");
  }
  const search = deps?.search ?? findPapers;
  const result = await search(trimmed, { scoreFirst });
  return toAgentPayload(result);
}

export async function agentScore(
  sessionId: string,
  ids: string[],
  deps?: AgentDeps,
): Promise<{
  sessionId: string;
  pending: number;
  papers: ReturnType<typeof compactPaper>[];
}> {
  const score = deps?.score ?? scoreVisiblePapers;
  const result = await score(sessionId, ids);
  return {
    sessionId: result.sessionId,
    pending: result.pending,
    papers: result.papers.map(compactPaper),
  };
}

export async function agentMoreLike(
  paper: Paper,
  deps?: AgentDeps,
): Promise<AgentSearchPayload> {
  const moreLike = deps?.moreLike ?? findMoreLikeThis;
  const result = await moreLike(paper, { scoreFirst: 0 });
  return toAgentPayload(result);
}

export function agentExport(
  format: "apa" | "bibtex",
  papers: Citeable[],
): { format: "apa" | "bibtex"; text: string } {
  const text =
    format === "apa" ? formatApaList(papers) : formatBibtexList(papers);
  return { format, text };
}

export function agentDemo(): SearchResult {
  return DEMO_RESULT;
}

export function demoAgentPayload(deps?: AgentDeps): AgentSearchPayload {
  const result = deps?.demo?.() ?? DEMO_RESULT;
  return toAgentPayload(result);
}
