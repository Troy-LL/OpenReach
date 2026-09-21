import { classifyIntent, createClient } from "./intent.js";
import { hasApiKey } from "./keys.js";
import {
  FindOptions,
  RETRIEVE_LIMITS,
  gateRetrieved,
} from "./gate.js";
import { splitQuery } from "./query-split.js";
import { rerankPapers } from "./rerank.js";
import { retrieveCandidates } from "./retrieve.js";
import {
  DEFAULT_INTENT,
  createSearchSession,
  getSession,
  scoreSessionIds,
  sessionPapers,
  sessionPending,
} from "./session.js";
import type { Intent, Paper, ScoreContext, SearchResult } from "./types.js";

function normalizeDoi(doi: string): string {
  return doi
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
    .replace(/^10\.48550\/arxiv\./i, "arxiv:");
}

function isSeedPaper(candidate: Paper, seed: Paper): boolean {
  if (candidate.id === seed.id) {
    return true;
  }
  const seedDoi = seed.doi?.trim();
  const candidateDoi = candidate.doi?.trim();
  if (seedDoi && candidateDoi) {
    return normalizeDoi(seedDoi) === normalizeDoi(candidateDoi);
  }
  return false;
}

export function seedQueryFromPaper(paper: Paper): string {
  const tokens = [
    ...paper.title.split(/\s+/).filter((t) => t.length > 0),
    ...(paper.venue?.split(/\s+/).filter((t) => t.length > 0) ?? []),
  ];
  return tokens.join(" ");
}

function resultFromSession(sessionId: string): SearchResult {
  const session = getSession(sessionId);
  if (!session) {
    return {
      question: "",
      intent: null,
      topics: [],
      papers: [],
      sessionId: null,
      pending: 0,
    };
  }
  return {
    question: session.question,
    intent: session.intent,
    topics: [],
    papers: sessionPapers(session),
    sessionId,
    pending: sessionPending(session),
  };
}

async function resolveIntent(question: string): Promise<Intent> {
  if (!hasApiKey()) {
    return DEFAULT_INTENT;
  }
  return classifyIntent(createClient(), question);
}

export async function findMoreLikeThis(
  seed: Paper,
  options: FindOptions = {},
): Promise<SearchResult> {
  const seedQuery = seedQueryFromPaper(seed);
  const facets = splitQuery(`${seed.title} ${seed.abstract}`);
  const [raw, classified] = await Promise.all([
    retrieveCandidates(seedQuery, RETRIEVE_LIMITS),
    resolveIntent(seedQuery),
  ]);
  const remaining = raw.filter((p) => !isSeedPaper(p, seed));
  const papers = gateRetrieved(seedQuery, remaining);

  const context: ScoreContext = {
    likeTitle: seed.title,
    likeAbstract: seed.abstract,
    methodNeed: facets.method,
    populationNeed: facets.population,
    recencyNeed: "any",
  };

  const intent: Intent =
    facets.constraints === "review only"
      ? { ...classified, wantsReview: Math.max(classified.wantsReview, 0.55) }
      : classified;

  const question = `More like: ${seed.title}`;
  const sessionId = createSearchSession(question, papers, context, intent);
  const scoreFirst = options.scoreFirst ?? 0;

  if (scoreFirst > 0 && papers.length > 0) {
    if (!hasApiKey()) {
      throw new Error(
        "Add a TypeSafe key first. It stays on this machine.",
      );
    }
    const client = createClient();
    await scoreSessionIds(
      sessionId,
      papers.slice(0, scoreFirst).map((p) => p.id),
      (q, batch, ctx) => rerankPapers(client, q, batch, intent, ctx),
    );
  }

  return resultFromSession(sessionId);
}
