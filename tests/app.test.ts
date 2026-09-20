import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { DEMO_RESULT } from "../src/demo-data.js";
import type { SearchResult } from "../src/types.js";

describe("HTTP API", () => {
  it("reports health", async () => {
    const app = createApp();
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("returns demo papers for UI and filter testing", async () => {
    const app = createApp();
    const res = await app.request("/api/demo");
    expect(res.status).toBe(200);
    const body = (await res.json()) as SearchResult;
    expect(body.papers.length).toBe(DEMO_RESULT.papers.length);
    expect(body.question).toContain("residual");
  });

  it("rejects an empty search", async () => {
    const app = createApp();
    const res = await app.request("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "   " }),
    });
    expect(res.status).toBe(400);
  });

  it("runs the injected search function", async () => {
    const app = createApp({
      search: async (question) => ({ ...DEMO_RESULT, question }),
    });
    const res = await app.request("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "skip connections" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as SearchResult;
    expect(body.question).toBe("skip connections");
    expect(body.papers[0].title).toContain("Residual");
  });

  it("scores only the requested visible ids", async () => {
    const app = createApp({
      scoreVisible: async (sessionId, ids) => ({
        sessionId,
        pending: 3,
        papers: DEMO_RESULT.papers.filter((p) => ids.includes(p.id)),
      }),
    });
    const res = await app.request("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "sess-1",
        ids: ["arxiv:1512.03385"],
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.papers).toHaveLength(1);
    expect(body.pending).toBe(3);
  });

  it("rejects a short TypeSafe key", async () => {
    const app = createApp();
    const res = await app.request("/api/key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "nope" }),
    });
    expect(res.status).toBe(400);
  });

  it("blocks live search until a TypeSafe key exists", async () => {
    delete process.env.TYPESAFE_API_KEY;
    const app = createApp();
    const res = await app.request("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "residual networks" }),
    });
    expect(res.status).toBe(503);
  });

  it("clears caches", async () => {
    let cleared = false;
    const app = createApp({ clearCaches: () => { cleared = true; } });
    const res = await app.request("/api/cache/clear", { method: "POST" });
    expect(res.status).toBe(200);
    expect(cleared).toBe(true);
  });
});
