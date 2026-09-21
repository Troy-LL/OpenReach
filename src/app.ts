import { Hono, type MiddlewareHandler } from "hono";
import pkg from "../package.json" with { type: "json" };
import type { AgentDeps } from "./agent.js";
import { formatApaList, formatBibtexList, type Citeable } from "./cite.js";
import { DEMO_RESULT } from "./demo-data.js";
import {
  TYPESAFE_KEY_HEADER,
  clearLocalKey,
  getActiveKeyStore,
  hasApiKey,
  overlayRequestKey,
  requestTypeSafeKey,
  runWithKeyStore,
  saveLocalKey,
} from "./keys.js";
import {
  createMcpRateLimiter,
  handleMcpHttp,
  MCP_MAX_BODY_BYTES,
  requestRateLimitKey,
} from "./mcp-http.js";
import { publicErrorMessage } from "./public-error.js";
import { scoreCacheSize } from "./rerank.js";
import {
  findMoreLikeThis,
  findPapers,
  retrieveCacheSize,
  scoreVisiblePapers,
} from "./search.js";
import { sessionCacheSize } from "./session.js";
import { suggestQueries, type Suggestion } from "./suggest.js";
import type { Paper, PaperSource, RankedPaper, SearchResult } from "./types.js";

export interface ScoreVisibleResult {
  papers: RankedPaper[];
  pending: number;
  sessionId: string;
}

export interface AppDeps {
  search?: (question: string) => Promise<SearchResult>;
  scoreVisible?: (
    sessionId: string,
    ids: string[],
  ) => Promise<ScoreVisibleResult>;
  moreLike?: (paper: Paper) => Promise<SearchResult>;
  suggest?: (query: string) => Promise<Suggestion[]>;
}

const PAPER_SOURCES = new Set<PaperSource>([
  "openalex",
  "semantic_scholar",
  "related",
  "arxiv",
  "europe_pmc",
  "crossref",
  "pubmed",
  "inspire",
  "eric",
  "doaj",
  "openaire",
  "biorxiv",
  "medrxiv",
  "plos",
]);

function parseCiteableList(value: unknown): Citeable[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  const papers: Citeable[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      return null;
    }
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id : "";
    const title = typeof row.title === "string" ? row.title : "";
    if (!id || !title) {
      return null;
    }
    papers.push({
      id,
      title,
      year: typeof row.year === "number" ? row.year : null,
      venue: typeof row.venue === "string" ? row.venue : null,
      doi: typeof row.doi === "string" ? row.doi : null,
      url: typeof row.url === "string" ? row.url : null,
      authors: Array.isArray(row.authors)
        ? row.authors.filter((a): a is string => typeof a === "string")
        : undefined,
      volume: typeof row.volume === "string" ? row.volume : undefined,
      issue: typeof row.issue === "string" ? row.issue : undefined,
      pages: typeof row.pages === "string" ? row.pages : undefined,
    });
  }
  return papers;
}

function parseMoreLikePaper(value: unknown): Paper | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  const title = typeof row.title === "string" ? row.title.trim() : "";
  if (!title) {
    return null;
  }
  const sourceRaw = row.source;
  const source =
    typeof sourceRaw === "string" && PAPER_SOURCES.has(sourceRaw as PaperSource)
      ? (sourceRaw as PaperSource)
      : "openalex";
  return {
    id: typeof row.id === "string" ? row.id : "",
    title,
    abstract: typeof row.abstract === "string" ? row.abstract : "",
    year: typeof row.year === "number" ? row.year : null,
    venue: typeof row.venue === "string" ? row.venue : null,
    doi: typeof row.doi === "string" ? row.doi : null,
    url: typeof row.url === "string" ? row.url : null,
    source,
    authors: Array.isArray(row.authors)
      ? row.authors.filter((a): a is string => typeof a === "string")
      : undefined,
  };
}

export function createApp(deps: AppDeps = {}): Hono {
  const search = deps.search ?? ((q: string) => findPapers(q, { scoreFirst: 0 }));
  const scoreVisible = deps.scoreVisible ?? scoreVisiblePapers;
  const moreLike =
    deps.moreLike ??
    ((paper: Paper) => findMoreLikeThis(paper, { scoreFirst: 0 }));
  const suggest = deps.suggest ?? ((q: string) => suggestQueries(q));
  const allowIp = createMcpRateLimiter({ limit: 60, windowMs: 60_000 });
  const mcpDeps: AgentDeps = {
    search: deps.search
      ? async (question) => deps.search!(question)
      : undefined,
    score: deps.scoreVisible,
    moreLike: deps.moreLike
      ? async (paper) => deps.moreLike!(paper)
      : undefined,
  };
  const app = new Hono();

  const withRequestBudget: MiddlewareHandler = async (c, next) => {
    if (c.req.method === "OPTIONS") {
      await next();
      return;
    }
    const declared = Number(c.req.header("content-length") ?? "");
    if (Number.isFinite(declared) && declared > MCP_MAX_BODY_BYTES) {
      return c.json({ error: "Request is too large." }, 413);
    }
    if (!allowIp(requestRateLimitKey(c.req.raw))) {
      return c.json({ error: "Too many requests. Try again shortly." }, 429);
    }
    await next();
  };

  const withRequestKey: MiddlewareHandler = async (c, next) => {
    const store = overlayRequestKey(
      getActiveKeyStore(),
      requestTypeSafeKey(
        c.req.header(TYPESAFE_KEY_HEADER),
        c.req.header("Authorization"),
      ),
    );
    await runWithKeyStore(store, () => next());
  };

  app.use("/api/*", withRequestBudget);
  app.use("/api/*", withRequestKey);
  app.use("/mcp", withRequestKey);
  app.all("/mcp", (c) => handleMcpHttp(c.req.raw, mcpDeps, allowIp));

  app.get("/api", (c) =>
    c.json({
      name: pkg.name,
      version: pkg.version,
      docs: "https://github.com/Troy-LL/OpenReach#readme",
      endpoints: [
        {
          method: "GET",
          path: "/api/health",
          purpose: "Health, key presence, and cache sizes.",
        },
        {
          method: "GET",
          path: "/api/demo",
          purpose: "Deterministic sample search results for UI and tests.",
        },
        {
          method: "POST",
          path: "/api/search",
          purpose: "Retrieve candidates for a research question (retrieve + gate).",
        },
        {
          method: "POST",
          path: "/api/score",
          purpose: "Score visible paper ids in a search session.",
        },
        {
          method: "POST",
          path: "/api/export",
          purpose: "Export APA or BibTeX citations for selected papers.",
        },
        {
          method: "POST",
          path: "/api/more-like",
          purpose: "Find papers similar to a seed paper.",
        },
        {
          method: "GET",
          path: "/api/suggest",
          purpose: "OpenAlex autocomplete suggestions (query param q).",
        },
        {
          method: "POST",
          path: "/api/key",
          purpose:
            "Validate a TypeSafe key. On Node, also save to data/typesafe.key. Hosted Workers do not store keys.",
        },
        {
          method: "DELETE",
          path: "/api/key",
          purpose:
            "Forget a Node-local key file. Browser keys are cleared in this device only.",
        },
        {
          method: "POST",
          path: "/mcp",
          purpose:
            "Remote MCP Streamable HTTP. Live tools need X-Typesafe-Key (or Authorization: Bearer). demo_papers and export_citations work without a key.",
        },
        {
          method: "stdio",
          path: "mcp",
          purpose:
            "Local stdio MCP: npm run mcp (search, score, more-like, export, demo tools).",
        },
      ],
    }),
  );

  app.get("/api/health", async (c) =>
    c.json({
      ok: true,
      hasKey: hasApiKey(),
      cache: {
        scores: scoreCacheSize(),
        sessions: await sessionCacheSize(),
        retrieves: retrieveCacheSize(),
      },
    }),
  );

  app.get("/api/demo", (c) => c.json(DEMO_RESULT));

  app.get("/api/suggest", async (c) => {
    const q = (c.req.query("q") ?? "").trim();
    if (q.length < 2) {
      return c.json({ suggestions: [] });
    }
    try {
      const suggestions = await suggest(q);
      return c.json({ suggestions });
    } catch (err) {
      return c.json({ error: publicErrorMessage(err, "Suggest failed.") }, 500);
    }
  });
  app.post("/api/key", async (c) => {
    let body: { key?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Expected JSON with a key." }, 400);
    }
    const key = typeof body.key === "string" ? body.key : "";
    try {
      await saveLocalKey(key);
      return c.json({ ok: true, hasKey: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save key.";
      return c.json({ error: message }, 400);
    }
  });

  app.delete("/api/key", async (c) => {
    await clearLocalKey();
    return c.json({ ok: true, hasKey: hasApiKey() });
  });

  app.post("/api/search", async (c) => {
    let body: { question?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Expected JSON body with a question." }, 400);
    }

    const question =
      typeof body.question === "string" ? body.question.trim() : "";
    if (!question) {
      return c.json({ error: "Question is required." }, 400);
    }
    if (!deps.search && !hasApiKey()) {
      return c.json({ error: "Add a TypeSafe key first." }, 503);
    }

    try {
      const result = await search(question);
      return c.json(result);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      const status = /API_KEY/i.test(raw) ? 503 : 500;
      return c.json({ error: publicErrorMessage(err, "Search failed.") }, status);
    }
  });

  app.post("/api/score", async (c) => {
    let body: { sessionId?: unknown; ids?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Expected JSON body with sessionId and ids." }, 400);
    }

    const sessionId =
      typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === "string")
      : [];

    if (!sessionId) {
      return c.json({ error: "sessionId is required." }, 400);
    }
    if (ids.length === 0) {
      return c.json({ papers: [], pending: 0, sessionId });
    }

    try {
      return c.json(await scoreVisible(sessionId, ids));
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      const status = /expired/i.test(raw)
        ? 404
        : /API_KEY/i.test(raw)
          ? 503
          : 500;
      return c.json({ error: publicErrorMessage(err, "Score failed.") }, status);
    }
  });

  app.post("/api/export", async (c) => {
    let body: { format?: unknown; papers?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Expected JSON with format and papers." }, 400);
    }

    const format = body.format;
    if (format !== "apa" && format !== "bibtex") {
      return c.json({ error: 'format must be "apa" or "bibtex".' }, 400);
    }

    const papers = parseCiteableList(body.papers);
    if (!papers) {
      return c.json({ error: "papers must be a non-empty array." }, 400);
    }

    const text =
      format === "apa" ? formatApaList(papers) : formatBibtexList(papers);
    return c.json({ format, text });
  });

  app.post("/api/more-like", async (c) => {
    let body: { paper?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Expected JSON with a paper." }, 400);
    }

    const paper = parseMoreLikePaper(body.paper);
    if (!paper) {
      return c.json({ error: "Paper title is required." }, 400);
    }
    if (!deps.moreLike && !hasApiKey()) {
      return c.json({ error: "Add a TypeSafe key first." }, 503);
    }

    try {
      const result = await moreLike(paper);
      return c.json(result);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      const status = /API_KEY/i.test(raw) ? 503 : 500;
      return c.json(
        { error: publicErrorMessage(err, "More-like failed.") },
        status,
      );
    }
  });

  return app;
}
