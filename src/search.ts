import { guessField } from "./field-guess.js";
import { classifyIntent, createClient } from "./intent.js";
import { hasApiKey } from "./keys.js";
import { splitQuery, type QueryFacets } from "./query-split.js";
import { rerankPapers } from "./rerank.js";
import { cachedRetrieveCandidates } from "./retrieve-cache.js";
import {
  FindOptions,
  RETRIEVE_LIMITS,
  gateRetrieved,
} from "./gate.js";
import {
  createSearchSession,
  getSession,
  scoreSessionIds,
  sessionPapers,
  sessionPending,
  DEFAULT_INTENT,
} from "./session.js";
import type { Intent, Paper, RankedPaper, ScoreContext, SearchResult } from "./types.js";

export type { SearchResult } from "./types.js";
export type { FindOptions };
export { RETRIEVE_LIMITS, gateRetrieved };
export { clearRetrieveCache, retrieveCacheSize, runWithRetrieveBucket } from "./retrieve-cache.js";

function scoreContextFromFacets(facets: QueryFacets): ScoreContext {
  return {
    methodNeed: facets.method,
    populationNeed: facets.population,
    recencyNeed: facets.recency,
  };
}

function applyConstraints(intent: Intent, facets: QueryFacets): Intent {
  if (facets.constraints !== "review only") {
    return intent;
  }
  return {
    ...intent,
    wantsReview: Math.max(intent.wantsReview, 0.55),
  };
}

async function resultFromSession(sessionId: string): Promise<SearchResult> {
  const session = await getSession(sessionId);
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
  const papers = sessionPapers(session);
  const pending = sessionPending(session);
  return {
    question: session.question,
    intent: session.intent,
    topics: [],
    papers,
    sessionId,
    pending,
  };
}

async function retrieve(
  question: string,
  field: Intent["field"],
): Promise<Paper[]> {
  const facets = splitQuery(question);
  const raw = await cachedRetrieveCandidates(question, {
    ...RETRIEVE_LIMITS,
    field,
  });
  return gateRetrieved(question, raw, facets);
}

async function resolveIntent(question: string, facets: QueryFacets): Promise<Intent> {
  if (!hasApiKey()) {
    return applyConstraints(DEFAULT_INTENT, facets);
  }
  const classified = await classifyIntent(createClient(), question);
  return applyConstraints(classified, facets);
}

export async function findPapers(
  question: string,
  options: FindOptions = {},
): Promise<SearchResult> {
  const trimmed = question.trim();
  if (!trimmed) {
    throw new Error("Question is required.");
  }

  const facets = splitQuery(trimmed);
  const context = scoreContextFromFacets(facets);
  const field = guessField(trimmed);
  const [papers, intent] = await Promise.all([
    retrieve(trimmed, field),
    resolveIntent(trimmed, facets),
  ]);
  const sessionId = await createSearchSession(trimmed, papers, context, intent);
  const scoreFirst = options.scoreFirst ?? 0;

  if (scoreFirst > 0 && papers.length > 0) {
    if (!hasApiKey()) {
      throw new Error("Add a TypeSafe key first.");
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

export async function scoreVisiblePapers(
  sessionId: string,
  ids: string[],
): Promise<{ papers: RankedPaper[]; pending: number; sessionId: string }> {
  if (!hasApiKey()) {
    throw new Error("Add a TypeSafe key first.");
  }
  const session = await getSession(sessionId);
  const intent = session?.intent ?? DEFAULT_INTENT;
  const client = createClient();
  const scored = await scoreSessionIds(sessionId, ids, (q, batch, ctx) =>
    rerankPapers(client, q, batch, intent, ctx),
  );
  const next = await getSession(sessionId);
  return {
    papers: scored,
    pending: next ? sessionPending(next) : 0,
    sessionId,
  };
}

export { findMoreLikeThis, seedQueryFromPaper } from "./more-like.js";
