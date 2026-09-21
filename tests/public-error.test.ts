import { describe, expect, it } from "vitest";
import { publicErrorMessage } from "../src/public-error.js";

describe("publicErrorMessage", () => {
  it("passes through known safe client messages", () => {
    expect(publicErrorMessage(new Error("Question is required."), "fail")).toBe(
      "Question is required.",
    );
    expect(publicErrorMessage(new Error("Add a TypeSafe key first."), "fail")).toBe(
      "Add a TypeSafe key first.",
    );
    expect(
      publicErrorMessage(
        new Error("Search session expired. Run the search again."),
        "fail",
      ),
    ).toBe("Search session expired. Run the search again.");
  });

  it("strips upstream URLs, bodies, and key-like tokens", () => {
    const leaked = publicErrorMessage(
      new Error(
        "HTTP 403 for https://api.semanticscholar.org/graph/v1/paper/search?x-api-key=sk_live_supersecret123456: unauthorized",
      ),
      "Search failed.",
    );
    expect(leaked).toBe("Search failed.");
    expect(leaked).not.toMatch(/semanticscholar|sk_live|x-api-key/i);
  });
});
