import { describe, expect, it } from "vitest";
import { TYPESAFE_KEY_HEADER } from "../src/key-format.js";
import {
  HOSTED_MCP_URL,
  remoteMcpSnippet,
  remoteMcpUrl,
} from "../src/mcp-connect.js";

describe("Remote MCP snippet", () => {
  it("points at the hosted URL and the KeyGate header", () => {
    const key = "apikey_browser_localstorage_1234567890";
    const snippet = remoteMcpSnippet(key);
    const parsed = JSON.parse(snippet) as {
      mcpServers: {
        openreach: { url: string; headers: Record<string, string> };
      };
    };
    expect(parsed.mcpServers.openreach.url).toBe(HOSTED_MCP_URL);
    expect(HOSTED_MCP_URL).toBe("https://openreach.niched.tech/mcp");
    expect(parsed.mcpServers.openreach.headers[TYPESAFE_KEY_HEADER]).toBe(key);
  });

  it("uses the workers.dev origin when that is the page", () => {
    expect(remoteMcpUrl("https://openreach.troy.workers.dev")).toBe(
      "https://openreach.troy.workers.dev/mcp",
    );
    expect(remoteMcpUrl("https://openreach.niched.tech")).toBe(HOSTED_MCP_URL);
    expect(remoteMcpUrl("http://127.0.0.1:5173")).toBe(HOSTED_MCP_URL);
  });
});
