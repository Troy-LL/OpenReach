import { AsyncLocalStorage } from "node:async_hooks";
import { TtlLruCache } from "./cache.js";
import { retrieveCandidates, type RetrieveOptions } from "./retrieve.js";
import { retrieveCacheKey, type SessionBucket } from "./session.js";
import type { Paper } from "./types.js";

const RETRIEVE_TTL_MS = 10 * 60 * 1000;
const retrieveCache = new TtlLruCache<Paper[]>(80, RETRIEVE_TTL_MS);
const retrieveBucketAls = new AsyncLocalStorage<SessionBucket>();

export function runWithRetrieveBucket<T>(
  bucket: SessionBucket,
  fn: () => T,
): T {
  return retrieveBucketAls.run(bucket, fn);
}

export function retrieveCacheSize(): number {
  return retrieveCache.size;
}

export function clearRetrieveCache(): void {
  retrieveCache.clear();
}

async function readRetrieveL2(key: string): Promise<Paper[] | undefined> {
  const raw = await retrieveBucketAls.getStore()?.get(key);
  if (!raw) return undefined;
  try {
    const papers = JSON.parse(raw) as Paper[];
    return Array.isArray(papers) ? papers : undefined;
  } catch {
    return undefined;
  }
}

async function writeRetrieveL2(key: string, papers: Paper[]): Promise<void> {
  const bucket = retrieveBucketAls.getStore();
  if (!bucket) return;
  await bucket.put(key, JSON.stringify(papers), RETRIEVE_TTL_MS);
}

export async function cachedRetrieveCandidates(
  question: string,
  options: RetrieveOptions,
): Promise<Paper[]> {
  const key = retrieveCacheKey(question, options.field);
  const l1 = retrieveCache.get(key);
  if (l1) return l1;
  const l2 = await readRetrieveL2(key);
  if (l2) {
    retrieveCache.set(key, l2);
    return l2;
  }
  const papers = await retrieveCandidates(question, options);
  retrieveCache.set(key, papers);
  await writeRetrieveL2(key, papers);
  return papers;
}
