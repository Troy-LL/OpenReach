import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const keyGate = readFileSync(new URL("../web/src/KeyGate.tsx", import.meta.url), "utf8");
const connectMcp = readFileSync(
  new URL("../web/src/ConnectMcp.tsx", import.meta.url),
  "utf8",
);
const app = readFileSync(new URL("../web/src/App.tsx", import.meta.url), "utf8");

describe("KeyGate TypeSafe console footer", () => {
  it("links the TypeSafe keys console under the Continue / Browse sample buttons", () => {
    expect(keyGate).toContain("https://console.typesafe.ai/settings/keys");
    expect(keyGate).toMatch(/Don.t have a key yet/i);
    expect(keyGate).toContain('target="_blank"');
    expect(keyGate).toContain('rel="noreferrer"');
    expect(keyGate.toLowerCase()).not.toContain("jeff");
  });

  it("says the TypeSafe key stays on this device, not our servers", () => {
    expect(keyGate).toMatch(/do not store the key on our servers/i);
    expect(keyGate).toMatch(/stays on\s+this device/i);
    expect(keyGate).toMatch(/Saved in this browser only/i);
  });

  it("keeps Browse sample results as a button action", () => {
    expect(keyGate).toContain("Browse sample results");
    expect(keyGate).toContain("onBrowseSample");
  });

  it("puts Continue and Browse on one row from 640px, stacked full-width below", () => {
    expect(keyGate).toMatch(/flex flex-col gap-3 sm:flex-row/);
    expect(keyGate).toMatch(/min-h-11 w-full sm:flex-1/);
    expect(keyGate).toMatch(/variant="outline"/);
    expect(keyGate).not.toMatch(/flex flex-col gap-3">\s*<Button className="pressable"/);
  });

  it("uses a short TypeSafe placeholder that fits a 390px field", () => {
    expect(keyGate).toContain('placeholder="Paste your TypeSafe key"');
    expect(keyGate).not.toContain(
      'placeholder="Paste the full key from the TypeSafe console"',
    );
  });
});

describe("Connect MCP after KeyGate", () => {
  it("copies a standard remote MCP snippet for any MCP-capable agent", () => {
    expect(connectMcp).toContain("Connect MCP");
    expect(connectMcp).toContain("Copy config");
    expect(connectMcp).toContain("remoteMcpSnippet");
    expect(connectMcp).toContain("remoteMcpUrl");
    expect(connectMcp).toMatch(/MCP-capable agent/i);
    expect(connectMcp).toMatch(/Claude Desktop/i);
    expect(connectMcp).toMatch(/Windsurf|Copilot/i);
    expect(connectMcp).toMatch(/standard MCP remote/i);
    expect(connectMcp).toMatch(/needs your TypeSafe key from this browser/i);
    expect(connectMcp).toMatch(/don.t store it on the server/i);
    expect(connectMcp).not.toMatch(/Settings → MCP/);
    expect(connectMcp).not.toContain("mcp.json");
  });

  it("shows an error when the clipboard write does not stick", () => {
    expect(connectMcp).toMatch(/navigator\.clipboard\.writeText/);
    expect(connectMcp).toMatch(/catch/);
    expect(connectMcp).toMatch(/role="alert"|status="danger"/);
    expect(connectMcp).toMatch(/Couldn.t copy|Could not copy|clipboard/i);
  });

  it("renders the card on the keyed landing, not on KeyGate", () => {
    expect(app).toContain("ConnectMcp");
    expect(app).toMatch(/loadClientKey\(\)/);
    expect(keyGate).not.toContain("ConnectMcp");
    expect(keyGate).not.toContain("Copy config");
  });
});
