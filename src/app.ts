import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { DEMO_RESULT } from "./demo-data.js";
import {
  clearLocalKey,
  hasApiKey,
  saveLocalKey,
} from "./keys.js";
import { clearScoreCache, scoreCacheSize } from "./rerank.js";
import {
  clearRetrieveCache,
  findPapers,
  retrieveCacheSize,
  scoreVisiblePapers,
} from "./search.js";
import { clearSessions, sessionCacheSize } from "./session.js";
import { suggestQueries, type Suggestion } from "./suggest.js";
import type { RankedPaper, SearchResult } from "./types.js";

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
  suggest?: (query: string) => Promise<Suggestion[]>;
  clearCaches?: () => void;
  staticRoot?: string;
}

export function clearAllCaches(): void {
  clearScoreCache();
  clearRetrieveCache();
  clearSessions();
}

export function createApp(deps: AppDeps = {}): Hono {
  const search = deps.search ?? ((q: string) => findPapers(q, { scoreFirst: 0 }));
  const scoreVisible = deps.scoreVisible ?? scoreVisiblePapers;
  const suggest = deps.suggest ?? ((q: string) => suggestQueries(q));
  const clearCaches = deps.clearCaches ?? clearAllCaches;
  const app = new Hono();

  app.get("/api/health", (c) =>
    c.json({
      ok: true,
      hasKey: hasApiKey(),
      cache: {
        scores: scoreCacheSize(),
        sessions: sessionCacheSize(),
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
      const message = err instanceof Error ? err.message : "Suggest failed.";
      return c.json({ error: message }, 500);
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
      return c.json(
        { error: "Add a TypeSafe key first. It stays on this machine." },
        503,
      );
    }

    try {
      const result = await search(question);
      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Search failed.";
      const status = /API_KEY/i.test(message) ? 503 : 500;
      return c.json({ error: message }, status);
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
      const message = err instanceof Error ? err.message : "Score failed.";
      const status = /expired/i.test(message)
        ? 404
        : /API_KEY/i.test(message)
          ? 503
          : 500;
      return c.json({ error: message }, status);
    }
  });

  app.post("/api/cache/clear", (c) => {
    clearCaches();
    return c.json({ ok: true });
  });

  if (deps.staticRoot) {
    const root = deps.staticRoot;
    app.use("/*", serveStatic({ root }));
    app.get("*", async (c) => {
      const html = await readFile(join(root, "index.html"), "utf8");
      return c.html(html);
    });
  }

  return app;
}
