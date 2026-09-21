import { AsyncLocalStorage } from "node:async_hooks";
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

export interface SessionBackend {
  get(id: string): Promise<SearchSession | undefined>;
  set(id: string, session: SearchSession): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
  size(): Promise<number>;
}

export interface SessionBucket {
  get(id: string): Promise<string | null>;
  put(id: string, value: string, ttlMs: number): Promise<void>;
  delete(id: string): Promise<void>;
}

const sessionAls = new AsyncLocalStorage<SessionBackend>();
const memorySessions = new TtlLruCache<SearchSession>(MAX_SESSIONS, SESSION_TTL_MS);

const memoryBackend: SessionBackend = {
  async get(id) {
    return memorySessions.get(id);
  },
  async set(id, session) {
    memorySessions.set(id, session);
  },
  async delete(id) {
    memorySessions.delete(id);
  },
  async clear() {
    memorySessions.clear();
  },
  async size() {
    return memorySessions.size;
  },
};

function backend(): SessionBackend {
  return sessionAls.getStore() ?? memoryBackend;
}

export function runWithSessionBackend<T>(store: SessionBackend, fn: () => T): T {
  return sessionAls.run(store, fn);
}

export function serializeSession(session: SearchSession): string {
  return JSON.stringify({
    question: session.question,
    papers: [...session.papers.values()],
    context: session.context,
    intent: session.intent,
  });
}

export function deserializeSession(raw: string): SearchSession | undefined {
  try {
    const data = JSON.parse(raw) as {
      question?: unknown;
      papers?: unknown;
      context?: unknown;
      intent?: unknown;
    };
    if (typeof data.question !== "string" || !Array.isArray(data.papers)) {
      return undefined;
    }
    const map = new Map<string, RankedPaper>();
    for (const item of data.papers) {
      if (!item || typeof item !== "object") continue;
      const paper = item as RankedPaper;
      if (typeof paper.id !== "string") continue;
      map.set(paper.id, paper);
    }
    const intent = data.intent as Intent | undefined;
    return {
      question: data.question,
      papers: map,
      context: (data.context as ScoreContext | undefined) ?? {},
      intent: intent ?? DEFAULT_INTENT,
    };
  } catch {
    return undefined;
  }
}

export function createBucketSessionBackend(bucket: SessionBucket): SessionBackend {
  return {
    async get(id) {
      const raw = await bucket.get(id);
      if (!raw) return undefined;
      return deserializeSession(raw);
    },
    async set(id, session) {
      await bucket.put(id, serializeSession(session), SESSION_TTL_MS);
    },
    async delete(id) {
      await bucket.delete(id);
    },
    async clear() {
      // Durable Object / KV buckets expire sessions via TTL.
    },
    async size() {
      return 0;
    },
  };
}

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

export async function createSearchSession(
  question: string,
  papers: Paper[],
  context: ScoreContext = {},
  intent: Intent = DEFAULT_INTENT,
): Promise<string> {
  const id = crypto.randomUUID();
  const map = new Map<string, RankedPaper>();
  for (const paper of papers) {
    map.set(paper.id, asUnscored(paper));
  }
  await backend().set(id, { question, papers: map, context, intent });
  return id;
}

export async function getSession(id: string): Promise<SearchSession | undefined> {
  return backend().get(id);
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
  const session = await backend().get(sessionId);
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
  await backend().set(sessionId, session);
  return scored;
}

export async function deleteSession(id: string): Promise<void> {
  await backend().delete(id);
}

export async function clearSessions(): Promise<void> {
  await backend().clear();
}

export async function sessionCacheSize(): Promise<number> {
  return backend().size();
}

export function retrieveCacheKey(query: string): string {
  return cacheKey(["retrieve", query]);
}
