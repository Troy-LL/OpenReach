import { describe, expect, it } from "vitest";
import { sanitizeSearchQuery, topicSearchQuery } from "../src/query.js";

describe("sanitizeSearchQuery", () => {
  it("strips OpenAlex wildcards and punctuation", () => {
    expect(sanitizeSearchQuery("residual networks?")).toBe("residual networks");
    expect(sanitizeSearchQuery("foo*bar")).toBe("foo bar");
  });
});

describe("topicSearchQuery", () => {
  it("keeps content words for topic lookup", () => {
    const q = topicSearchQuery(
      "how do residual connections help train deep image networks?",
    );
    expect(q).toContain("residual");
    expect(q).toContain("connections");
    expect(q).not.toContain("how");
    expect(q).not.toContain("?");
  });
});
