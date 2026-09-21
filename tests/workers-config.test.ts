import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const wrangler = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

describe("Cloudflare Workers config", () => {
  it("deploys Worker openreach on openreach.niche.tech", () => {
    expect(wrangler).toMatch(/"name"\s*:\s*"openreach"/);
    expect(wrangler).toContain("openreach.niche.tech");
    expect(wrangler).toContain("custom_domain");
    expect(wrangler).toContain("nodejs_compat");
    expect(wrangler).toContain("web/dist");
    expect(wrangler).toContain("workers_dev");
    expect(wrangler).not.toMatch(/kv_namespaces/);
    expect(wrangler).not.toContain("niched.tech");
  });

  it("documents personal-account deploy on niche.tech", () => {
    expect(readme).toContain("https://openreach.niche.tech");
    expect(readme).toMatch(/wrangler deploy/);
    expect(readme).toMatch(/localStorage/);
    expect(readme).toMatch(/does not persist it/i);
    expect(readme).not.toContain("niched.tech");
  });
});
