import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { AgentDeps } from "./agent.js";
import { TYPESAFE_KEY_HEADER } from "./key-format.js";
import { createOpenReachMcpServer } from "./mcp.js";

export const MCP_MAX_BODY_BYTES = 256 * 1024;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": [
    "Accept",
    "Authorization",
    "Content-Type",
    "Last-Event-ID",
    "MCP-Protocol-Version",
    "Mcp-Session-Id",
    TYPESAFE_KEY_HEADER,
  ].join(", "),
  "Access-Control-Expose-Headers": "Mcp-Session-Id, MCP-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

export function createMcpRateLimiter(opts: {
  limit: number;
  windowMs: number;
}): (key: string, now?: number) => boolean {
  const hits = new Map<string, number[]>();
  return (key: string, now = Date.now()) => {
    const times = (hits.get(key) ?? []).filter((t) => now - t < opts.windowMs);
    if (times.length >= opts.limit) {
      hits.set(key, times);
      return false;
    }
    times.push(now);
    hits.set(key, times);
    return true;
  };
}

const allowMcpIp = createMcpRateLimiter({ limit: 60, windowMs: 60_000 });

/** Cloudflare's connecting IP only. X-Forwarded-For is caller-controlled. */
export function requestRateLimitKey(request: Request): string {
  return request.headers.get("cf-connecting-ip")?.trim() || "local";
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function jsonError(status: number, error: string): Response {
  return withCors(
    new Response(JSON.stringify({ error }), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

export async function handleMcpHttp(
  request: Request,
  deps: AgentDeps = {},
  allowIp: (key: string, now?: number) => boolean = allowMcpIp,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (!allowIp(requestRateLimitKey(request))) {
    return jsonError(429, "Too many MCP requests. Try again shortly.");
  }

  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MCP_MAX_BODY_BYTES) {
    return jsonError(413, "MCP request is too large.");
  }

  let parsedBody: unknown;
  if (request.method === "POST") {
    const raw = await request.text();
    if (byteLength(raw) > MCP_MAX_BODY_BYTES) {
      return jsonError(413, "MCP request is too large.");
    }
    if (raw) {
      try {
        parsedBody = JSON.parse(raw) as unknown;
      } catch {
        return jsonError(400, "Invalid JSON.");
      }
    }
  }

  const server = createOpenReachMcpServer(deps);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  try {
    await server.connect(transport);
    const response = await transport.handleRequest(
      new Request(request.url, {
        method: request.method,
        headers: request.headers,
      }),
      parsedBody === undefined ? undefined : { parsedBody },
    );
    return withCors(response);
  } finally {
    await server.close();
  }
}
