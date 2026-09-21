import { cacheKey, TtlLruCache } from "./cache.js";
import type { Intent, Paper, RankedPaper, ScoreContext } from "./types.js";

export const SESSION_TTL_MS = 15 * 60 * 1000;
const MAX_SESSIONS = 40;

export const DEFAULT_INTENT: Intent = {
  field: "other",
  wantsReview: 0,
  wantsEmpirical: 0,
};

export interface SearchSession {
  question: string;
  papers: Map<string, RankedPaper>;
  context: ScoreContext;
  intent: Intent;
}

export type PaperScorer = (
  question: string,
  papers: Paper[],
  context: ScoreContext,
) => Promise<RankedPaper[]>;

const sessions = new TtlLruCache<SearchSession>(MAX_SESSIONS, SESSION_TTL_MS);

export function asUnscored(paper: Paper): RankedPaper {
  return {
    ...paper,
    scored: false,
    method: 0,
    population: 0,
    evidence: 0,
    recency: 0,
    isReview: 0,
    relevance: 0,
    composite: 0,
  };
}

export function createSearchSession(
  question: string,
  papers: Paper[],
  context: ScoreContext = {},
  intent: Intent = DEFAULT_INTENT,
): string {
  const id = crypto.randomUUID();
  const map = new Map<string, RankedPaper>();
  for (const paper of papers) {
    map.set(paper.id, asUnscored(paper));
  }
  sessions.set(id, { question, papers: map, context, intent });
  return id;
}

export function getSession(id: string): SearchSession | undefined {
  return sessions.get(id);
}

export function sessionPending(session: SearchSession): number {
  let n = 0;
  for (const paper of session.papers.values()) {
    if (!paper.scored) n += 1;
  }
  return n;
}

export function sessionPapers(session: SearchSession): RankedPaper[] {
  return [...session.papers.values()];
}

export async function scoreSessionIds(
  sessionId: string,
  ids: string[],
  score: PaperScorer,
): Promise<RankedPaper[]> {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error("Search session expired. Run the search again.");
  }

  const unique = [...new Set(ids)].filter((id) => {
    const paper = session.papers.get(id);
    return paper && !paper.scored;
  });

  if (unique.length === 0) {
    return [];
  }

  const toScore = unique.map((id) => session.papers.get(id)!);
  const scored = await score(session.question, toScore, session.context);
  for (const paper of scored) {
    session.papers.set(paper.id, { ...paper, scored: true });
  }
  sessions.set(sessionId, session);
  return scored;
}

export function deleteSession(id: string): void {
  sessions.delete(id);
}

export function clearSessions(): void {
  sessions.clear();
}

export function sessionCacheSize(): number {
  return sessions.size;
}

export function retrieveCacheKey(query: string): string {
  return cacheKey(["retrieve", query]);
}
