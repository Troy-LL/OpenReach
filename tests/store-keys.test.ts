import { describe, expect, it } from "vitest";
import {
  RETRIEVE_SHARDS,
  SESSION_SHARDS,
  shardName,
} from "../src/store-keys.js";

describe("shardName", () => {
  it("maps many session ids onto a small Durable Object set", () => {
    expect(SESSION_SHARDS).toBe(16);
    expect(RETRIEVE_SHARDS).toBe(8);
    const names = new Set<string>();
    for (let i = 0; i < 200; i++) {
      names.add(shardName("sess", `id-${i}`, SESSION_SHARDS));
    }
    expect(names.size).toBeLessThanOrEqual(SESSION_SHARDS);
    expect(names.size).toBeGreaterThan(1);
    expect(shardName("sess", "same", SESSION_SHARDS)).toBe(
      shardName("sess", "same", SESSION_SHARDS),
    );
  });
});
