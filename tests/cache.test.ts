import { describe, expect, it, vi } from "vitest";
import { TtlLruCache } from "../src/cache.js";

describe("TtlLruCache", () => {
  it("returns set values and evicts the oldest when full", () => {
    const cache = new TtlLruCache<string>(2, 60_000);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("c", "3");
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe("2");
    expect(cache.get("c")).toBe("3");
  });

  it("expires entries and forgets them on clear", () => {
    vi.useFakeTimers();
    const cache = new TtlLruCache<string>(8, 1_000);
    cache.set("k", "v");
    expect(cache.get("k")).toBe("v");
    vi.advanceTimersByTime(1_001);
    expect(cache.get("k")).toBeUndefined();
    cache.set("k", "v2");
    cache.clear();
    expect(cache.get("k")).toBeUndefined();
    expect(cache.size).toBe(0);
    vi.useRealTimers();
  });

  it("touching an entry refreshes LRU order", () => {
    const cache = new TtlLruCache<string>(2, 60_000);
    cache.set("a", "1");
    cache.set("b", "2");
    expect(cache.get("a")).toBe("1");
    cache.set("c", "3");
    expect(cache.get("a")).toBe("1");
    expect(cache.get("b")).toBeUndefined();
  });
});
