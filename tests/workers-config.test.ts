import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const wrangler = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const assetHeaders = readFileSync(
  new URL("../web/public/_headers", import.meta.url),
  "utf8",
);

describe("Cloudflare Workers config", () => {
  it("deploys Worker openreach on openreach.niched.tech", () => {
    expect(wrangler).toMatch(/"name"\s*:\s*"openreach"/);
    expect(wrangler).toContain("openreach.niched.tech");
    expect(wrangler).toContain("custom_domain");
    expect(wrangler).toContain("nodejs_compat");
    expect(wrangler).toContain("web/dist");
    expect(wrangler).toContain("workers_dev");
    expect(wrangler).not.toMatch(/kv_namespaces/);
    expect(wrangler).not.toContain("openreach.niche.tech");
    expect(wrangler).toMatch(/run_worker_first[\s\S]*\/mcp/);
    expect(wrangler).not.toMatch(/TYPESAFE_API_KEY/);
  });

  it("documents personal-account deploy on niched.tech", () => {
    expect(readme).toContain("https://openreach.niched.tech");
    expect(readme).toMatch(/wrangler deploy/);
    expect(readme).toMatch(/localStorage/);
    expect(readme).toMatch(/does not persist it/i);
    expect(readme).not.toContain("openreach.niche.tech");
    expect(readme).toContain("https://openreach.niched.tech/mcp");
    expect(readme).toContain("X-Typesafe-Key");
    expect(readme).toMatch(/npm run mcp/);
    expect(readme).toMatch(/Do not set `TYPESAFE_API_KEY` as a Worker secret/);
    expect(readme).toMatch(/hashed SPA assets/i);
  });

  it("sets long-lived cache headers on fingerprinted SPA assets", () => {
    expect(assetHeaders).toMatch(/\/assets\/\*/);
    expect(assetHeaders).toMatch(/max-age=31536000/);
    expect(assetHeaders).toMatch(/immutable/);
  });
});
