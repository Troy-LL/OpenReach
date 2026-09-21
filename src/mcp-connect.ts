import { TYPESAFE_KEY_HEADER } from "./key-format.js";

export const HOSTED_MCP_URL = "https://openreach.niched.tech/mcp";

export function remoteMcpUrl(origin?: string): string {
  const here =
    origin ?? (typeof location === "undefined" ? "" : location.origin);
  const host = here.replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (host.endsWith("workers.dev")) {
    return `${here.replace(/\/$/, "")}/mcp`;
  }
  return HOSTED_MCP_URL;
}

export function mcpConfigSnippet(key: string, url = HOSTED_MCP_URL): string {
  return JSON.stringify(
    {
      mcpServers: {
        openreach: {
          url,
          headers: {
            [TYPESAFE_KEY_HEADER]: key,
          },
        },
      },
    },
    null,
    2,
  );
}
