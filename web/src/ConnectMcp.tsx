import { Alert, Button } from "@heroui/react";
import { remoteMcpSnippet, remoteMcpUrl } from "@shared/mcp-connect";
import { useState } from "react";

export function ConnectMcp({ apiKey }: { apiKey: string }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const url = remoteMcpUrl();
  const snippet = remoteMcpSnippet(apiKey, url);

  async function copy() {
    if (!apiKey) return;
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setCopyError(null);
    } catch {
      setCopied(false);
      setCopyError(
        "Couldn't copy. Paste the config into your MCP-capable agent yourself.",
      );
    }
  }

  return (
    <section className="enter enter-2 search-shell mt-8 p-5 text-left">
      <h2 className="mt-0 mb-1 text-lg font-semibold tracking-tight">
        Connect MCP
      </h2>
      <p className="text-muted mb-3 text-sm text-pretty">
        Standard MCP remote server config — a URL plus your TypeSafe key header.
      </p>
      <p className="text-muted mb-3 font-mono text-sm break-all">{url}</p>
      <Button
        className="pressable min-h-11"
        isDisabled={!apiKey}
        type="button"
        onPress={() => void copy()}
      >
        {copied ? "Copied" : "Copy config"}
      </Button>
      {copyError ? (
        <Alert className="mt-3" role="alert" status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Couldn't copy</Alert.Title>
            <Alert.Description>{copyError}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
      <p className="text-muted mt-3 mb-0 text-sm text-pretty">
        Copy config → paste into your MCP-capable agent (Claude Desktop, Cursor,
        Windsurf, Copilot, and others). Needs your TypeSafe key from this browser;
        we don’t store it on the server.
      </p>
    </section>
  );
}
