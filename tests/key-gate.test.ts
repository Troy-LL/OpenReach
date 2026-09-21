import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const keyGate = readFileSync(new URL("../web/src/KeyGate.tsx", import.meta.url), "utf8");

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
});
