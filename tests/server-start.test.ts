import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { apiListenConfig } from "../src/listen.js";

describe("API process start", () => {
  it("does not use tsx watch, which hangs under concurrently on Windows", () => {
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(pkg.scripts["dev:api"]).not.toMatch(/tsx watch/);
    expect(pkg.scripts.dev).not.toMatch(/tsx watch/);
  });

  it("listens on 127.0.0.1 so the Vite IPv4 proxy can connect", () => {
    expect(apiListenConfig({}).hostname).toBe("127.0.0.1");
    expect(apiListenConfig({}).port).toBe(3000);
    expect(apiListenConfig({ PORT: "3015" }).port).toBe(3015);
  });
});
