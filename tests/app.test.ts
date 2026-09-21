import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { DEMO_RESULT } from "../src/demo-data.js";
import { MCP_MAX_BODY_BYTES } from "../src/mcp-http.js";
import type { SearchResult } from "../src/types.js";

describe("HTTP API", () => {
  it("lists API routes at GET /api", async () => {
    const app = createApp();
    const res = await app.request("/api");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("openreach");
    expect(typeof body.version).toBe("string");
    expect(Array.isArray(body.endpoints)).toBe(true);
    const paths = body.endpoints.map(
      (e: { path: string }) => e.path,
    );
    expect(paths).toContain("/api/health");
    expect(paths).toContain("/api/search");
    expect(paths).toContain("/api/demo");
    expect(body.endpoints.some((e: { purpose: string }) => /mcp/i.test(e.purpose))).toBe(
      true,
    );
  });

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

  it("returns injected autocomplete suggestions", async () => {
    const app = createApp({
      suggest: async () => [
        {
          id: "w1",
          text: "Deep Residual Learning for Image Recognition",
          hint: "Kaiming He et al.",
          kind: "work",
        },
      ],
    });
    const res = await app.request("/api/suggest?q=residual");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.suggestions).toHaveLength(1);
    expect(body.suggestions[0].text).toContain("Residual");
  });

  it("returns empty suggestions for short queries", async () => {
    const app = createApp({
      suggest: async () => {
        throw new Error("should not run");
      },
    });
    const res = await app.request("/api/suggest?q=a");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ suggestions: [] });
  });

  it("exports APA citations without a TypeSafe key", async () => {
    delete process.env.TYPESAFE_API_KEY;
    const paper = DEMO_RESULT.papers[0];
    const app = createApp();
    const res = await app.request("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        format: "apa",
        papers: [
          {
            id: paper.id,
            title: paper.title,
            year: paper.year,
            venue: paper.venue,
            doi: paper.doi,
            url: paper.url,
          },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.format).toBe("apa");
    expect(body.text).toContain(paper.title);
    expect(body.text).toContain("https://doi.org/");
  });

  it("puts retrieved author names in APA export", async () => {
    const paper = DEMO_RESULT.papers[0];
    const app = createApp();
    const res = await app.request("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        format: "apa",
        papers: [
          {
            id: paper.id,
            title: paper.title,
            year: paper.year,
            venue: paper.venue,
            doi: paper.doi,
            url: paper.url,
            authors: paper.authors,
          },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toContain("He, Kaiming");
    expect(body.text).not.toContain("[Author unknown]");
  });

  it("exports BibTeX citations", async () => {
    const paper = DEMO_RESULT.papers[0];
    const app = createApp();
    const res = await app.request("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        format: "bibtex",
        papers: [
          {
            id: paper.id,
            title: paper.title,
            year: paper.year,
            venue: paper.venue,
            doi: paper.doi,
            url: paper.url,
          },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.format).toBe("bibtex");
    expect(body.text).toMatch(/^@\w+\{/);
    expect(body.text).toContain(paper.title);
  });

  it("rejects invalid export format", async () => {
    const app = createApp();
    const res = await app.request("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format: "ris", papers: DEMO_RESULT.papers }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects empty export papers", async () => {
    const app = createApp();
    const res = await app.request("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format: "apa", papers: [] }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects non-array export papers", async () => {
    const app = createApp();
    const res = await app.request("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format: "apa", papers: "nope" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects more-like without a title", async () => {
    const app = createApp({
      moreLike: async () => DEMO_RESULT,
    });
    const res = await app.request("/api/more-like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paper: { id: "x", title: "   " } }),
    });
    expect(res.status).toBe(400);
  });

  it("blocks more-like until a TypeSafe key exists", async () => {
    delete process.env.TYPESAFE_API_KEY;
    const app = createApp();
    const paper = DEMO_RESULT.papers[0];
    const res = await app.request("/api/more-like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paper: {
          id: paper.id,
          title: paper.title,
          abstract: paper.abstract,
          year: paper.year,
          venue: paper.venue,
          doi: paper.doi,
          url: paper.url,
          source: paper.source,
        },
      }),
    });
    expect(res.status).toBe(503);
  });

  it("does not expose an unauthenticated cache wipe", async () => {
    const app = createApp();
    const res = await app.request("/api/cache/clear", { method: "POST" });
    expect(res.status).toBe(404);
  });

  it("rejects an oversized API body before running the handler", async () => {
    let ran = false;
    const app = createApp({
      search: async (question) => {
        ran = true;
        return { ...DEMO_RESULT, question };
      },
    });
    const res = await app.request("/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": String(MCP_MAX_BODY_BYTES + 1),
      },
      body: JSON.stringify({ question: "skip connections" }),
    });
    expect(res.status).toBe(413);
    expect(ran).toBe(false);
  });

  it("rate-limits /api after 60 hits from one connecting IP", async () => {
    const app = createApp();
    const headers = { "cf-connecting-ip": "203.0.113.10" };
    for (let i = 0; i < 60; i++) {
      const res = await app.request("/api/health", { headers });
      expect(res.status).toBe(200);
    }
    const blocked = await app.request("/api/health", { headers });
    expect(blocked.status).toBe(429);
    const other = await app.request("/api/health", {
      headers: { "cf-connecting-ip": "203.0.113.11" },
    });
    expect(other.status).toBe(200);
  });

  it("does not echo upstream URLs or key-like tokens on search failure", async () => {
    const app = createApp({
      search: async () => {
        throw new Error(
          "HTTP 403 for https://api.semanticscholar.org/graph/v1/paper/search?x-api-key=sk_live_supersecret123456: unauthorized",
        );
      },
    });
    const res = await app.request("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "skip connections" }),
    });
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Search failed.");
    expect(JSON.stringify(body)).not.toMatch(/semanticscholar|sk_live|x-api-key/i);
  });

  it("runs injected more-like search", async () => {
    const seed = DEMO_RESULT.papers[0];
    const app = createApp({
      moreLike: async (paper) => ({
        ...DEMO_RESULT,
        question: `More like: ${paper.title}`,
      }),
    });
    const res = await app.request("/api/more-like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paper: {
          id: seed.id,
          title: seed.title,
          abstract: seed.abstract,
          year: seed.year,
          venue: seed.venue,
          doi: seed.doi,
          url: seed.url,
          source: seed.source,
        },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as SearchResult;
    expect(body.question).toContain("More like:");
    expect(body.papers.length).toBeGreaterThan(0);
  });
});
