interface CacheNode<T> {
  value: T;
  expiresAt: number;
}

/** In-memory TTL + LRU cache. `get` refreshes recency; expired keys are dropped. */
export class TtlLruCache<T> {
  private readonly store = new Map<string, CacheNode<T>>();

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
  ) {
    if (maxEntries < 1) throw new Error("maxEntries must be >= 1");
    if (ttlMs < 1) throw new Error("ttlMs must be >= 1");
  }

  get size(): number {
    this.pruneExpired();
    return this.store.size;
  }

  get(key: string): T | undefined {
    const node = this.store.get(key);
    if (!node) return undefined;
    if (node.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    this.store.delete(key);
    this.store.set(key, node);
    return node.value;
  }

  set(key: string, value: T): void {
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    this.evictOverflow();
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  keys(): string[] {
    this.pruneExpired();
    return [...this.store.keys()];
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [key, node] of this.store) {
      if (node.expiresAt <= now) this.store.delete(key);
    }
  }

  private evictOverflow(): void {
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }
}

export function cacheKey(parts: string[]): string {
  return parts.map((p) => p.trim().toLowerCase()).join("\u001f");
}
