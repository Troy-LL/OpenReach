import { TtlLruCache } from "./cache.js";
import { dedupePapers } from "./dedupe.js";
import { createClient } from "./intent.js";
import { hasApiKey } from "./keys.js";
import { rerankPapers } from "./rerank.js";
import { retrieveCandidates } from "./retrieve.js";
import {
  createSearchSession,
  getSession,
  retrieveCacheKey,
  scoreSessionIds,
  sessionPapers,
  sessionPending,
} from "./session.js";
import type { Intent, Paper, RankedPaper, SearchResult } from "./types.js";

export type { SearchResult } from "./types.js";

const retrieveCache = new TtlLruCache<Paper[]>(80, 10 * 60 * 1000);
const NEUTRAL_INTENT: Intent = {
  field: "other",
  wantsReview: 0,
  wantsEmpirical: 0,
};

export function retrieveCacheSize(): number {
  return retrieveCache.size;
}

export function clearRetrieveCache(): void {
  retrieveCache.clear();
}

export interface FindOptions {
  /** How many papers to Jev-score immediately. UI uses 0; CLI uses a small page. */
  scoreFirst?: number;
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
  const papers = sessionPapers(session);
  const pending = sessionPending(session);
  return {
    question: session.question,
    intent: null,
    topics: [],
    papers,
    sessionId: pending > 0 ? sessionId : sessionId,
    pending,
  };
}

async function retrieve(question: string): Promise<Paper[]> {
  const key = retrieveCacheKey(question);
  const cached = retrieveCache.get(key);
  if (cached) return cached;

  const raw = await retrieveCandidates(question, {
    keywordLimit: 40,
    arxivLimit: 40,
    europePmcLimit: 40,
    crossrefLimit: 40,
    pubmedLimit: 40,
    inspireLimit: 30,
    ericLimit: 30,
    doajLimit: 30,
    openaireLimit: 30,
    preprintLimit: 30,
    plosLimit: 30,
    relatedLimit: 25,
    topicPaperLimit: 12,
  });
  const papers = dedupePapers(raw, 180);
  retrieveCache.set(key, papers);
  return papers;
}

export async function findPapers(
  question: string,
  options: FindOptions = {},
): Promise<SearchResult> {
  const trimmed = question.trim();
  if (!trimmed) {
    throw new Error("Question is required.");
  }

  const papers = await retrieve(trimmed);
  const sessionId = createSearchSession(trimmed, papers);
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
      (q, batch) => rerankPapers(client, q, batch, NEUTRAL_INTENT),
    );
  }

  return resultFromSession(sessionId);
}

export async function scoreVisiblePapers(
  sessionId: string,
  ids: string[],
): Promise<{ papers: RankedPaper[]; pending: number; sessionId: string }> {
  if (!hasApiKey()) {
    throw new Error("Add a TypeSafe key first. It stays on this machine.");
  }
  const client = createClient();
  const scored = await scoreSessionIds(sessionId, ids, (q, batch) =>
    rerankPapers(client, q, batch, NEUTRAL_INTENT),
  );
  const session = getSession(sessionId);
  return {
    papers: scored,
    pending: session ? sessionPending(session) : 0,
    sessionId,
  };
}
