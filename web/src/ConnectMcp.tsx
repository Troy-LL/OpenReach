import { Button } from "@heroui/react";
import { cursorMcpSnippet, remoteMcpUrl } from "@shared/mcp-connect";
import { useState } from "react";

export function ConnectMcp({ apiKey }: { apiKey: string }) {
  const [copied, setCopied] = useState(false);
  const url = remoteMcpUrl();
  const snippet = cursorMcpSnippet(apiKey, url);

  async function copy() {
    if (!apiKey) return;
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="enter enter-2 search-shell mt-8 p-5 text-left">
      <h2 className="mt-0 mb-2 text-lg font-semibold tracking-tight">
        Connect MCP
      </h2>
      <p className="text-muted mb-3 font-mono text-sm break-all">{url}</p>
      <Button
        className="pressable min-h-11"
        isDisabled={!apiKey}
        type="button"
        onPress={() => void copy()}
      >
        {copied ? "Copied" : "Copy config"}
      </Button>
      <p className="text-muted mt-3 mb-0 text-sm text-pretty">
        Needs your TypeSafe key from this browser; we don’t store it on the server.
      </p>
    </section>
  );
}
