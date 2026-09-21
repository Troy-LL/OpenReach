import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { DEMO_RESULT } from "../src/demo-data.js";
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
    const unet = body.papers.find((p) => p.id === "epmc:unet");
    expect(unet?.url).toMatch(/pmc\/articles\/PMC6435980|articles\/PMC6435980/i);
    const undated = body.papers.find((p) => p.id === "oa:undated");
    expect(undated?.url).toBeNull();
    for (const paper of body.papers) {
      expect(paper.url ?? "").not.toMatch(/openalex\.org\/W/i);
    }
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
