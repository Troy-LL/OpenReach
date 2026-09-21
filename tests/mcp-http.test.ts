import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { DEMO_RESULT } from "../src/demo-data.js";
import { TYPESAFE_KEY_HEADER } from "../src/key-format.js";
import { MCP_LIVE_KEY_ERROR } from "../src/mcp.js";
import { createMcpRateLimiter, MCP_MAX_BODY_BYTES } from "../src/mcp-http.js";
import {
  createMemoryKeyStore,
  runWithKeyStore,
} from "../src/keys.js";

const LIVE_KEY = "apikey_remote_mcp_header_1234567890";

function mcpHeaders(extra: HeadersInit = {}): Headers {
  const headers = new Headers({
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
  });
  new Headers(extra).forEach((value, key) => headers.set(key, value));
  return headers;
}

function rpc(method: string, params: unknown, id = 1): string {
  return JSON.stringify({ jsonrpc: "2.0", id, method, params });
}

async function parseMcpMessage(res: Response): Promise<Record<string, unknown>> {
  const type = res.headers.get("content-type") ?? "";
  const text = await res.text();
  if (type.includes("text/event-stream")) {
    const data = text
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .find((line) => line && line !== "[DONE]");
    if (!data) {
      throw new Error(`No SSE data in: ${text}`);
    }
    return JSON.parse(data) as Record<string, unknown>;
  }
  return JSON.parse(text) as Record<string, unknown>;
}

function toolText(message: Record<string, unknown>): string {
  const result = message.result as
    | { content?: Array<{ text?: string }>; isError?: boolean }
    | undefined;
  return result?.content?.map((part) => part.text ?? "").join("\n") ?? "";
}

describe("remote MCP Streamable HTTP", () => {
  beforeEach(() => {
    delete process.env.TYPESAFE_API_KEY;
  });

  afterEach(() => {
    delete process.env.TYPESAFE_API_KEY;
  });

  it("answers initialize at POST /mcp", async () => {
    const app = createApp();
    const res = await app.request("/mcp", {
      method: "POST",
      headers: mcpHeaders(),
      body: rpc("initialize", {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "openreach-test", version: "0.0.1" },
      }),
    });
    expect(res.status).toBe(200);
    const message = await parseMcpMessage(res);
    const result = message.result as { serverInfo?: { name?: string } };
    expect(result.serverInfo?.name).toBe("openreach");
  });

  it("runs demo_papers without a TypeSafe key", async () => {
    const app = createApp();
    const res = await app.request("/mcp", {
      method: "POST",
      headers: mcpHeaders(),
      body: rpc("tools/call", { name: "demo_papers", arguments: {} }),
    });
    expect(res.status).toBe(200);
    const message = await parseMcpMessage(res);
    const payload = JSON.parse(toolText(message)) as { question: string };
    expect(payload.question).toContain("residual");
  });

  it("runs export_citations without a TypeSafe key", async () => {
    const paper = DEMO_RESULT.papers[0];
    const app = createApp();
    const res = await app.request("/mcp", {
      method: "POST",
      headers: mcpHeaders(),
      body: rpc("tools/call", {
        name: "export_citations",
        arguments: {
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
        },
      }),
    });
    expect(res.status).toBe(200);
    const message = await parseMcpMessage(res);
    const payload = JSON.parse(toolText(message)) as { text: string };
    expect(payload.text).toContain(paper.title);
  });

  it("refuses search_papers without X-Typesafe-Key or Bearer", async () => {
    const app = createApp({
      search: async (question) => ({ ...DEMO_RESULT, question }),
    });
    const res = await runWithKeyStore(createMemoryKeyStore(), () =>
      app.request("/mcp", {
        method: "POST",
        headers: mcpHeaders(),
        body: rpc("tools/call", {
          name: "search_papers",
          arguments: { question: "skip connections" },
        }),
      }),
    );
    expect(res.status).toBe(200);
    const message = await parseMcpMessage(res);
    const result = message.result as { isError?: boolean };
    expect(result.isError).toBe(true);
    expect(toolText(message)).toContain(MCP_LIVE_KEY_ERROR);
    expect(toolText(message)).toMatch(/X-Typesafe-Key/i);
  });

  it("uses X-Typesafe-Key for the request only", async () => {
    const app = createApp({
      search: async (question) => ({ ...DEMO_RESULT, question }),
    });
    await runWithKeyStore(createMemoryKeyStore(), async () => {
      const withKey = await app.request("/mcp", {
        method: "POST",
        headers: mcpHeaders({ [TYPESAFE_KEY_HEADER]: LIVE_KEY }),
        body: rpc("tools/call", {
          name: "search_papers",
          arguments: { question: "skip connections" },
        }),
      });
      expect(withKey.status).toBe(200);
      const ok = await parseMcpMessage(withKey);
      expect((ok.result as { isError?: boolean }).isError).toBeFalsy();
      const payload = JSON.parse(toolText(ok)) as { question: string };
      expect(payload.question).toBe("skip connections");

      const without = await app.request("/mcp", {
        method: "POST",
        headers: mcpHeaders(),
        body: rpc("tools/call", {
          name: "search_papers",
          arguments: { question: "skip connections" },
        }),
      });
      const denied = await parseMcpMessage(without);
      expect((denied.result as { isError?: boolean }).isError).toBe(true);
    });
  });

  it("accepts Authorization Bearer as the same request key", async () => {
    const app = createApp({
      search: async (question) => ({ ...DEMO_RESULT, question }),
    });
    const res = await runWithKeyStore(createMemoryKeyStore(), () =>
      app.request("/mcp", {
        method: "POST",
        headers: mcpHeaders({ Authorization: `Bearer ${LIVE_KEY}` }),
        body: rpc("tools/call", {
          name: "search_papers",
          arguments: { question: "skip connections" },
        }),
      }),
    );
    expect(res.status).toBe(200);
    const message = await parseMcpMessage(res);
    expect((message.result as { isError?: boolean }).isError).toBeFalsy();
    expect(JSON.parse(toolText(message)).question).toBe("skip connections");
  });

  it("rejects an oversized MCP body", async () => {
    const app = createApp();
    const res = await app.request("/mcp", {
      method: "POST",
      headers: mcpHeaders(),
      body: "x".repeat(MCP_MAX_BODY_BYTES + 1),
    });
    expect(res.status).toBe(413);
  });

  it("answers CORS preflight for /mcp", async () => {
    const app = createApp();
    const res = await app.request("/mcp", {
      method: "OPTIONS",
      headers: {
        Origin: "https://cursor.com",
        "Access-Control-Request-Headers": TYPESAFE_KEY_HEADER,
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBeTruthy();
    expect(res.headers.get("access-control-allow-headers") ?? "").toMatch(
      /X-Typesafe-Key/i,
    );
  });

  it("lists the remote /mcp route on GET /api", async () => {
    const app = createApp();
    const res = await app.request("/api");
    const body = (await res.json()) as {
      endpoints: Array<{ method: string; path: string; purpose: string }>;
    };
    expect(
      body.endpoints.some(
        (e) => e.path === "/mcp" && /streamable http|remote/i.test(e.purpose),
      ),
    ).toBe(true);
    expect(body.endpoints.some((e) => /stdio/i.test(e.purpose))).toBe(true);
  });
});

describe("MCP rate limiter", () => {
  it("allows a burst then rejects the next hit in the window", () => {
    const allow = createMcpRateLimiter({ limit: 2, windowMs: 60_000 });
    const now = 1_000_000;
    expect(allow("1.1.1.1", now)).toBe(true);
    expect(allow("1.1.1.1", now + 10)).toBe(true);
    expect(allow("1.1.1.1", now + 20)).toBe(false);
    expect(allow("2.2.2.2", now + 20)).toBe(true);
  });
});
